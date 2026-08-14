/**
 * Photo editor render pipeline.
 *
 * `render(source, state, options)` is the single source of truth: the live
 * preview calls it on a downscaled canvas (fast, ~16 ms on a mid-range
 * phone), the export calls it on the full-resolution image. Same code,
 * same result — WYSIWYG guaranteed.
 *
 * Stages, in order:
 *   1. geometry  — straighten, perspective, quarter turns, flips, crop
 *   2. tonal     — LUT-based exposure / contrast / tone curve / gamma
 *   3. colour    — temperature, tint, saturation, vibrance, grayscale
 *   4. detail    — denoise, sharpness, clarity, structure (unsharp mask)
 *   5. focus     — radial / linear / background blur
 *   6. layers    — masked effects (blur, pixelate), strokes, text, stickers
 *   7. finishing — vignette
 */
import type { EditState, Geometry, Layer, StrokeLayer, TextLayer, StickerLayer } from "./types";
import { presetById } from "./presets";
import { buildChannelLUTs, type PresetCurves, type PresetSplit } from "./tone";
import { ZERO_ADJUST, type Adjustments } from "./types";

export type Source = HTMLImageElement | ImageBitmap | HTMLCanvasElement;

function srcWidth(s: Source) {
  return s instanceof HTMLImageElement ? s.naturalWidth : s.width;
}
function srcHeight(s: Source) {
  return s instanceof HTMLImageElement ? s.naturalHeight : s.height;
}

function make(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctx2d(c: HTMLCanvasElement, readFrequently = false) {
  const g = c.getContext("2d", { willReadFrequently: readFrequently });
  if (!g) throw new Error("Canvas 2D indisponible");
  return g;
}

/** Effective adjustments = manual sliders + active preset × strength. */
export function effectiveAdjust(state: EditState): Adjustments {
  const preset = presetById(state.filter);
  const out = { ...state.adjust } as Adjustments;
  if (!preset) return out;
  const k = state.filterStrength;
  // "Auto" carries no fixed values: it uses the histogram of this photo.
  const base = preset.dynamic ? (state.auto ?? {}) : preset.adjust;
  (Object.keys(base) as (keyof Adjustments)[]).forEach((key) => {
    out[key] = (out[key] ?? 0) + (base[key] ?? 0) * k;
  });
  return out;
}

/** Output size of the geometry stage, before any downscale. */
export function geometrySize(source: Source, g: Geometry) {
  const iw = srcWidth(source);
  const ih = srcHeight(source);
  const rad = (g.straighten * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  // Straightening crops inward so no empty corner is ever produced.
  const scale = Math.max((iw * cos + ih * sin) / iw, (iw * sin + ih * cos) / ih);
  const baseW = iw;
  const baseH = ih;
  const cw = baseW * g.crop.w;
  const ch = baseH * g.crop.h;
  const swap = g.rot === 1 || g.rot === 3;
  return {
    width: swap ? ch : cw,
    height: swap ? cw : ch,
    straightenScale: scale,
  };
}

function drawGeometry(source: Source, g: Geometry, outW: number, outH: number) {
  const iw = srcWidth(source);
  const ih = srcHeight(source);
  const { straightenScale } = geometrySize(source, g);
  const swap = g.rot === 1 || g.rot === 3;
  // Un-rotated cropped size in image pixels.
  const cw = swap ? outH : outW;
  const ch = swap ? outW : outH;

  const canvas = make(outW, outH);
  const c = ctx2d(canvas);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  c.save();
  c.translate(outW / 2, outH / 2);
  c.rotate((g.rot * Math.PI) / 2);
  // Perspective is approximated with a shear + scale pair: enough for the
  // keystone corrections users make on documents and buildings, and it
  // stays a single GPU-accelerated drawImage.
  c.transform(1, g.perspectiveY * 0.35, g.perspectiveX * 0.35, 1, 0, 0);
  c.scale(g.flipH ? -1 : 1, g.flipV ? -1 : 1);
  c.rotate((g.straighten * Math.PI) / 180);
  c.scale(straightenScale, straightenScale);

  // Map crop rect (normalised, image space) to the destination centre.
  const scaleX = cw / (iw * g.crop.w);
  const scaleY = ch / (ih * g.crop.h);
  const cropCx = (g.crop.x + g.crop.w / 2) * iw;
  const cropCy = (g.crop.y + g.crop.h / 2) * ih;
  c.scale(scaleX, scaleY);
  c.drawImage(source as CanvasImageSource, -cropCx, -cropCy);
  c.restore();
  return canvas;
}

function clamp255(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function applyPixels(
  canvas: HTMLCanvasElement,
  a: Adjustments,
  grayscale: number,
  look?: { curve?: PresetCurves; split?: PresetSplit; strength: number },
) {
  const k = look?.strength ?? 1;
  const split = look?.split;
  const needsTone =
    a.exposure ||
    a.brightness ||
    a.contrast ||
    a.highlights ||
    a.shadows ||
    a.whites ||
    a.blacks ||
    a.gamma ||
    a.fade ||
    a.temperature ||
    a.tint ||
    look?.curve;
  if (!needsTone && !a.saturation && !a.vibrance && !grayscale && !split) return;

  const c = ctx2d(canvas, true);
  const img = c.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const { r: lutR, g: lutG, b: lutB } = buildChannelLUTs(a, look?.curve, k);
  const sat = 1 + a.saturation;
  const vib = a.vibrance;
  const splitAmount = split ? split.amount * k * 255 : 0;

  for (let i = 0; i < d.length; i += 4) {
    let r = lutR[d[i]];
    let g = lutG[d[i + 1]];
    let b = lutB[d[i + 2]];

    // Rec.709 luma keeps colour moves perceptually neutral.
    let l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (sat !== 1) {
      r = l + (r - l) * sat;
      g = l + (g - l) * sat;
      b = l + (b - l) * sat;
    }
    if (vib) {
      // Vibrance protects already-saturated pixels (and skin tones).
      const mx = r > g ? (r > b ? r : b) : g > b ? g : b;
      const mn = r < g ? (r < b ? r : b) : g < b ? g : b;
      const cur = mx <= 0 ? 0 : (mx - mn) / mx;
      const kv = 1 + vib * (1 - cur) * (1 - cur) * 1.5;
      r = l + (r - l) * kv;
      g = l + (g - l) * kv;
      b = l + (b - l) * kv;
    }
    if (grayscale) {
      const gl = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r += (gl - r) * grayscale;
      g += (gl - g) * grayscale;
      b += (gl - b) * grayscale;
    }
    if (splitAmount && split) {
      // Split toning: real per-tone colour offsets, not a flat wash.
      l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const ws = (1 - l) * (1 - l);
      const wh = l * l;
      r += splitAmount * (split.shadows[0] * ws + split.highlights[0] * wh);
      g += splitAmount * (split.shadows[1] * ws + split.highlights[1] * wh);
      b += splitAmount * (split.shadows[2] * ws + split.highlights[2] * wh);
    }
    d[i] = clamp255(r);
    d[i + 1] = clamp255(g);
    d[i + 2] = clamp255(b);
  }
  c.putImageData(img, 0, 0);
}

function blurCopy(canvas: HTMLCanvasElement, radius: number) {
  const out = make(canvas.width, canvas.height);
  const c = ctx2d(out);
  c.filter = `blur(${radius}px)`;
  c.drawImage(canvas, 0, 0);
  c.filter = "none";
  return out;
}

/** Edge-aware smoothing: flat areas lose noise, edges keep their contrast. */
function applyDenoise(canvas: HTMLCanvasElement, amount: number, unit: number) {
  const c = ctx2d(canvas, true);
  const img = c.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const soft = ctx2d(blurCopy(canvas, 1.1 * unit), true).getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  ).data;
  const strength = Math.min(1, amount);
  const threshold = 26 + strength * 26;
  for (let i = 0; i < d.length; i += 4) {
    const diff =
      (Math.abs(d[i] - soft[i]) +
        Math.abs(d[i + 1] - soft[i + 1]) +
        Math.abs(d[i + 2] - soft[i + 2])) /
      3;
    // Only blend where the local difference looks like noise, not an edge.
    const w = strength * Math.exp(-(diff * diff) / (threshold * threshold));
    d[i] += (soft[i] - d[i]) * w;
    d[i + 1] += (soft[i + 1] - d[i + 1]) * w;
    d[i + 2] += (soft[i + 2] - d[i + 2]) * w;
  }
  c.putImageData(img, 0, 0);
}

/** Deterministic film grain, stronger in the midtones like real emulsion. */
function applyGrain(canvas: HTMLCanvasElement, amount: number, unit: number) {
  const c = ctx2d(canvas, true);
  const img = c.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const w = canvas.width;
  const intensity = amount * 46;
  const scale = Math.max(1, Math.round(unit));
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const x = ((p % w) / scale) | 0;
    const y = (((p / w) | 0) / scale) | 0;
    // Cheap hash noise: stable between renders, no allocation.
    let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    n = n - Math.floor(n) - 0.5;
    const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    const weight = 4 * l * (1 - l);
    const delta = n * intensity * (0.35 + weight);
    d[i] = clamp255(d[i] + delta);
    d[i + 1] = clamp255(d[i + 1] + delta);
    d[i + 2] = clamp255(d[i + 2] + delta);
  }
  c.putImageData(img, 0, 0);
}

/** Unsharp masking for sharpness / clarity / structure, plus denoise & grain. */
function applyDetail(canvas: HTMLCanvasElement, a: Adjustments) {
  const unit = Math.max(1, Math.min(canvas.width, canvas.height) / 900);
  if (a.denoise > 0) applyDenoise(canvas, a.denoise, unit);

  const passes: { radius: number; amount: number }[] = [];
  if (a.sharpness) passes.push({ radius: 1 * unit, amount: a.sharpness * 1.1 });
  if (a.structure) passes.push({ radius: 4 * unit, amount: a.structure * 0.9 });
  if (a.clarity) passes.push({ radius: 12 * unit, amount: a.clarity * 0.8 });

  if (passes.length) {
    const c = ctx2d(canvas, true);
    for (const { radius, amount } of passes) {
      const blurred = ctx2d(blurCopy(canvas, radius), true).getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      const base = c.getImageData(0, 0, canvas.width, canvas.height);
      const d = base.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = clamp255(d[i] + (d[i] - blurred[i]) * amount);
        d[i + 1] = clamp255(d[i + 1] + (d[i + 1] - blurred[i + 1]) * amount);
        d[i + 2] = clamp255(d[i + 2] + (d[i + 2] - blurred[i + 2]) * amount);
      }
      c.putImageData(base, 0, 0);
    }
  }

  if (a.grain > 0) applyGrain(canvas, a.grain, unit);
}

function pixelateCopy(canvas: HTMLCanvasElement, cell: number) {
  const w = Math.max(1, Math.round(canvas.width / cell));
  const h = Math.max(1, Math.round(canvas.height / cell));
  const small = make(w, h);
  const sc = ctx2d(small);
  sc.imageSmoothingEnabled = false;
  sc.drawImage(canvas, 0, 0, w, h);
  const out = make(canvas.width, canvas.height);
  const oc = ctx2d(out);
  oc.imageSmoothingEnabled = false;
  oc.drawImage(small, 0, 0, canvas.width, canvas.height);
  return out;
}

function strokePath(c: CanvasRenderingContext2D, layer: StrokeLayer, w: number, h: number) {
  const width = Math.max(1, layer.size * Math.max(w, h));
  c.lineWidth = width;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  const pts = layer.points;
  if (!pts.length) return;
  if (pts.length === 1) {
    c.moveTo(pts[0].x * w, pts[0].y * h);
    c.lineTo(pts[0].x * w + 0.01, pts[0].y * h);
  } else {
    c.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x * w, pts[i].y * h);
  }
  c.stroke();
}

function drawFocus(canvas: HTMLCanvasElement, state: EditState) {
  const f = state.focus;
  if (f.mode === "off" || f.strength <= 0) return;
  const w = canvas.width;
  const h = canvas.height;
  const radius = (6 + f.strength * 26) * Math.max(1, Math.min(w, h) / 900);
  const blurred = blurCopy(canvas, radius);
  const mask = make(w, h);
  const mc = ctx2d(mask);
  mc.drawImage(blurred, 0, 0);
  mc.globalCompositeOperation = "destination-out";
  if (f.mode === "radial" || f.mode === "background") {
    const r = Math.max(w, h) * f.radius;
    const grad = mc.createRadialGradient(f.x * w, f.y * h, r * 0.35, f.x * w, f.y * h, r);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    mc.fillStyle = grad;
    mc.fillRect(0, 0, w, h);
  } else {
    mc.save();
    mc.translate(f.x * w, f.y * h);
    mc.rotate((f.angle * Math.PI) / 180);
    const band = Math.max(w, h) * f.radius;
    const grad = mc.createLinearGradient(0, -band, 0, band);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.35, "rgba(0,0,0,1)");
    grad.addColorStop(0.65, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    mc.fillStyle = grad;
    mc.fillRect(-w, -h, w * 2, h * 2);
    mc.restore();
  }
  mc.globalCompositeOperation = "source-over";
  ctx2d(canvas).drawImage(mask, 0, 0);
}

function drawMaskedEffect(canvas: HTMLCanvasElement, layer: StrokeLayer) {
  const w = canvas.width;
  const h = canvas.height;
  const unit = Math.max(1, Math.min(w, h) / 900);
  const effect =
    layer.tool === "blur"
      ? blurCopy(canvas, 14 * unit)
      : pixelateCopy(canvas, layer.tool === "mosaic" ? 28 * unit : 14 * unit);
  const mask = make(w, h);
  const mc = ctx2d(mask);
  mc.drawImage(effect, 0, 0);
  mc.globalCompositeOperation = "destination-in";
  mc.strokeStyle = "#000";
  strokePath(mc, layer, w, h);
  mc.globalCompositeOperation = "source-over";
  ctx2d(canvas).drawImage(mask, 0, 0);
}

function drawText(c: CanvasRenderingContext2D, l: TextLayer, w: number, h: number) {
  const size = Math.max(8, l.size * h);
  c.save();
  c.globalAlpha = l.opacity;
  c.translate(l.x * w, l.y * h);
  c.rotate((l.rotation * Math.PI) / 180);
  c.font = `${l.italic ? "italic " : ""}${l.bold ? "700" : "500"} ${size}px ${l.font}`;
  c.textAlign = l.align;
  c.textBaseline = "middle";
  const lines = l.text.split("\n");
  const lh = size * 1.2;
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * lh;
    if (l.shadow) {
      c.shadowColor = "rgba(0,0,0,0.55)";
      c.shadowBlur = size * 0.22;
      c.shadowOffsetY = size * 0.06;
    }
    if (l.outline) {
      c.lineWidth = Math.max(1, size * 0.09);
      c.lineJoin = "round";
      c.strokeStyle = l.outlineColor;
      c.strokeText(line, 0, y);
    }
    c.fillStyle = l.color;
    c.fillText(line, 0, y);
    c.shadowColor = "transparent";
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
  });
  c.restore();
}

function drawSticker(c: CanvasRenderingContext2D, l: StickerLayer, w: number, h: number) {
  const size = Math.max(10, l.size * Math.max(w, h));
  c.save();
  c.globalAlpha = l.opacity;
  c.translate(l.x * w, l.y * h);
  c.rotate((l.rotation * Math.PI) / 180);
  c.strokeStyle = l.color;
  c.fillStyle = l.color;
  c.lineWidth = Math.max(2, size * 0.08);
  c.lineJoin = "round";
  c.lineCap = "round";
  const r = size / 2;
  switch (l.shape) {
    case "circle":
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      if (l.filled) c.fill();
      else c.stroke();
      break;
    case "rect":
      c.beginPath();
      c.roundRect(-r, -r * 0.7, size, size * 0.7, size * 0.08);
      if (l.filled) c.fill();
      else c.stroke();
      break;
    case "arrow":
      c.beginPath();
      c.moveTo(-r, 0);
      c.lineTo(r, 0);
      c.moveTo(r, 0);
      c.lineTo(r - size * 0.28, -size * 0.2);
      c.moveTo(r, 0);
      c.lineTo(r - size * 0.28, size * 0.2);
      c.stroke();
      break;
    case "star": {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const ang = (Math.PI / 5) * i - Math.PI / 2;
        const x = Math.cos(ang) * rad;
        const y = Math.sin(ang) * rad;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.closePath();
      if (l.filled) c.fill();
      else c.stroke();
      break;
    }
    case "bubble":
      c.beginPath();
      c.roundRect(-r, -r * 0.75, size, size * 0.75, size * 0.2);
      c.moveTo(-r * 0.2, size * 0.375 - r * 0.75 + r * 0.75);
      if (l.filled) c.fill();
      else c.stroke();
      break;
    default:
      c.font = `${size}px system-ui, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(l.glyph, 0, 0);
  }
  c.restore();
}

function drawLayers(canvas: HTMLCanvasElement, layers: Layer[]) {
  const w = canvas.width;
  const h = canvas.height;
  const c = ctx2d(canvas);
  for (const layer of layers) {
    if (layer.type === "stroke") {
      if (layer.tool === "brush" || layer.tool === "marker") {
        c.save();
        c.globalAlpha = layer.opacity;
        if (layer.tool === "marker") c.globalCompositeOperation = "multiply";
        c.strokeStyle = layer.color;
        strokePath(c, layer, w, h);
        c.restore();
      } else {
        drawMaskedEffect(canvas, layer);
      }
    } else if (layer.type === "text") {
      drawText(c, layer, w, h);
    } else {
      drawSticker(c, layer, w, h);
    }
  }
}

function drawFinishing(canvas: HTMLCanvasElement, a: Adjustments) {
  if (!a.vignette) return;
  const c = ctx2d(canvas);
  const w = canvas.width;
  const h = canvas.height;
  const grad = c.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.32,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.78,
  );
  const strength = Math.abs(a.vignette);
  const colour = a.vignette > 0 ? "0,0,0" : "255,255,255";
  grad.addColorStop(0, `rgba(${colour},0)`);
  grad.addColorStop(1, `rgba(${colour},${Math.min(0.85, strength)})`);
  c.save();
  c.globalCompositeOperation = a.vignette > 0 ? "multiply" : "screen";
  c.fillStyle = grad;
  c.fillRect(0, 0, w, h);
  c.restore();
}

export type RenderOptions = {
  /** Longest-side cap. Preview passes ~1400, export passes Infinity. */
  maxSize?: number;
  /** Skip everything but geometry — used by the before/after comparison. */
  originalOnly?: boolean;
};

export function render(source: Source, state: EditState, options: RenderOptions = {}) {
  const maxSize = options.maxSize ?? Infinity;
  const size = geometrySize(source, state.geometry);
  const scale = Math.min(1, maxSize / Math.max(size.width, size.height));
  const outW = Math.max(1, Math.round(size.width * scale));
  const outH = Math.max(1, Math.round(size.height * scale));

  const canvas = drawGeometry(source, state.geometry, outW, outH);
  if (options.originalOnly) return canvas;

  const a = effectiveAdjust(state);
  const preset = presetById(state.filter);
  applyPixels(canvas, a, (preset?.grayscale ?? 0) * state.filterStrength, {
    curve: preset?.curve,
    split: preset?.split,
    strength: state.filterStrength,
  });
  applyDetail(canvas, a);
  drawFocus(canvas, state);
  drawLayers(canvas, state.layers);
  drawFinishing(canvas, a);
  return canvas;
}

export function isPristine(state: EditState) {
  const g = state.geometry;
  const geometryClean =
    g.rot === 0 &&
    !g.flipH &&
    !g.flipV &&
    g.straighten === 0 &&
    g.perspectiveX === 0 &&
    g.perspectiveY === 0 &&
    g.crop.x === 0 &&
    g.crop.y === 0 &&
    g.crop.w === 1 &&
    g.crop.h === 1;
  const adjustClean = (Object.keys(ZERO_ADJUST) as (keyof Adjustments)[]).every(
    (k) => state.adjust[k] === 0,
  );
  return (
    geometryClean &&
    adjustClean &&
    (!state.filter || state.filter === "none") &&
    state.focus.mode === "off" &&
    state.layers.length === 0
  );
}
