/**
 * Document scanner — offline pipeline.
 *
 * Capture (WebView camera, `capture="environment"`) → détection automatique
 * de la page (gradient de Sobel sur une miniature, profils de bord) →
 * correction de perspective (homographie + échantillonnage bilinéaire) →
 * amélioration de lisibilité (niveaux de gris + contraste).
 *
 * Tout est fait hors-ligne en JavaScript pur : aucune dépendance native,
 * aucun modèle à télécharger.
 */

export type Quad = {
  tl: [number, number];
  tr: [number, number];
  br: [number, number];
  bl: [number, number];
};

type Source = HTMLImageElement | HTMLCanvasElement;

export async function loadImage(source: File | Blob | string): Promise<HTMLImageElement> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    if (typeof source !== "string") setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

function sourceSize(src: Source): { width: number; height: number } {
  return src instanceof HTMLCanvasElement
    ? { width: src.width, height: src.height }
    : { width: src.naturalWidth || src.width, height: src.naturalHeight || src.height };
}

/** Miniature en niveaux de gris (largeur max `max`) pour l'analyse. */
function grayThumbnail(src: Source, max = 320) {
  const { width, height } = sourceSize(src);
  const scale = Math.min(1, max / Math.max(width, height));
  const w = Math.max(8, Math.round(width * scale));
  const h = Math.max(8, Math.round(height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    gray[p] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  }
  return { gray, w, h, scale: width / w };
}

/** Magnitude de gradient (Sobel) sur la miniature. */
function sobel(gray: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = gray[i - w - 1],
        b = gray[i - w],
        c = gray[i - w + 1];
      const d = gray[i - 1],
        f = gray[i + 1];
      const g = gray[i + w - 1],
        hh = gray[i + w],
        k = gray[i + w + 1];
      const gx = a + 2 * d + g - (c + 2 * f + k);
      const gy = a + 2 * b + c - (g + 2 * hh + k);
      out[i] = Math.hypot(gx, gy);
    }
  }
  return out;
}

/** Première position (depuis `from` vers `to`) où l'énergie dépasse le seuil. */
function firstEdge(profile: Float32Array, threshold: number, reverse: boolean): number {
  const n = profile.length;
  if (reverse) {
    for (let i = n - 1; i >= 0; i--) if (profile[i] > threshold) return i;
    return n - 1;
  }
  for (let i = 0; i < n; i++) if (profile[i] > threshold) return i;
  return 0;
}

/**
 * Détecte la page photographiée. Analyse les profils d'énergie de bord par
 * ligne et par colonne : les marges (fond uniforme) ont une énergie faible,
 * la page une énergie nettement supérieure. Retourne un quadrilatère en
 * coordonnées pleine résolution ; en cas de doute, l'image entière.
 */
export function autoDetectQuad(src: Source): Quad {
  const { width, height } = sourceSize(src);
  const full: Quad = {
    tl: [0, 0],
    tr: [width, 0],
    br: [width, height],
    bl: [0, height],
  };
  const thumb = grayThumbnail(src);
  if (!thumb) return full;
  const { gray, w, h, scale } = thumb;
  const mag = sobel(gray, w, h);

  const rows = new Float32Array(h);
  const cols = new Float32Array(w);
  let max = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = mag[y * w + x];
      rows[y] += v / w;
      cols[x] += v / h;
      if (v > max) max = v;
    }
  }
  if (max <= 0) return full;

  const mean = (arr: Float32Array) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const rowThreshold = mean(rows) * 0.45;
  const colThreshold = mean(cols) * 0.45;

  const top = firstEdge(rows, rowThreshold, false);
  const bottom = firstEdge(rows, rowThreshold, true);
  const left = firstEdge(cols, colThreshold, false);
  const right = firstEdge(cols, colThreshold, true);

  // Marge de sécurité de 1 % pour ne pas rogner du contenu.
  const padX = w * 0.01;
  const padY = h * 0.01;
  const x0 = Math.max(0, left - padX) * scale;
  const x1 = Math.min(w, right + 1 + padX) * scale;
  const y0 = Math.max(0, top - padY) * scale;
  const y1 = Math.min(h, bottom + 1 + padY) * scale;

  // Détection jugée non fiable si elle supprime plus de 60 % de l'image.
  const area = (x1 - x0) * (y1 - y0);
  if (!(area > 0) || area < width * height * 0.4) return full;

  return { tl: [x0, y0], tr: [x1, y0], br: [x1, y1], bl: [x0, y1] };
}

/** Résout un système linéaire 8×8 (élimination de Gauss). */
function solve8(m: number[][], v: number[]): number[] | null {
  const n = 8;
  const a = m.map((row, i) => [...row, v[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-9) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const p = a[col][col];
    for (let c = col; c <= n; c++) a[col][c] /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col];
      if (!f) continue;
      for (let c = col; c <= n; c++) a[r][c] -= f * a[col][c];
    }
  }
  return a.map((row) => row[n]);
}

/** Homographie envoyant le rectangle destination (w×h) vers le quadrilatère source. */
function homographyRectToQuad(quad: Quad, w: number, h: number): number[] | null {
  const dst: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const srcPts: [number, number][] = [quad.tl, quad.tr, quad.br, quad.bl];
  const m: number[][] = [];
  const v: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = dst[i];
    const [u, t] = srcPts[i];
    m.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    v.push(u);
    m.push([0, 0, 0, x, y, 1, -x * t, -y * t]);
    v.push(t);
  }
  return solve8(m, v);
}

/**
 * Corrige la perspective : le quadrilatère détecté est redressé en rectangle
 * par homographie avec échantillonnage bilinéaire.
 */
export function warpToQuad(img: Source, quad: Quad): HTMLCanvasElement {
  const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const outW = Math.max(1, Math.round(Math.max(dist(quad.tl, quad.tr), dist(quad.bl, quad.br))));
  const outH = Math.max(1, Math.round(Math.max(dist(quad.tl, quad.bl), dist(quad.tr, quad.br))));

  const { width, height } = sourceSize(img);
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = width;
  srcCanvas.height = height;
  const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const outCtx = out.getContext("2d");
  if (!srcCtx || !outCtx) return out;
  srcCtx.drawImage(img, 0, 0, width, height);

  const H = homographyRectToQuad(quad, outW, outH);
  if (!H) {
    // Repli : simple recadrage sur la boîte englobante.
    const xs = [quad.tl[0], quad.tr[0], quad.br[0], quad.bl[0]];
    const ys = [quad.tl[1], quad.tr[1], quad.br[1], quad.bl[1]];
    outCtx.drawImage(
      srcCanvas,
      Math.min(...xs),
      Math.min(...ys),
      outW,
      outH,
      0,
      0,
      outW,
      outH,
    );
    return out;
  }

  const src = srcCtx.getImageData(0, 0, width, height);
  const sp = src.data;
  const dstImg = outCtx.createImageData(outW, outH);
  const dp = dstImg.data;
  const [h0, h1, h2, h3, h4, h5, h6, h7] = H;

  const sample = (x: number, y: number, o: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;
    const i00 = (y0 * width + x0) * 4;
    const i10 = (y0 * width + x1) * 4;
    const i01 = (y1 * width + x0) * 4;
    const i11 = (y1 * width + x1) * 4;
    for (let c = 0; c < 3; c++) {
      const top = sp[i00 + c] * (1 - fx) + sp[i10 + c] * fx;
      const bot = sp[i01 + c] * (1 - fx) + sp[i11 + c] * fx;
      dp[o + c] = top * (1 - fy) + bot * fy;
    }
    dp[o + 3] = 255;
  };

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const den = h6 * x + h7 * y + 1;
      let sx = (h0 * x + h1 * y + h2) / den;
      let sy = (h3 * x + h4 * y + h5) / den;
      sx = sx < 0 ? 0 : sx > width - 1 ? width - 1 : sx;
      sy = sy < 0 ? 0 : sy > height - 1 ? height - 1 : sy;
      sample(sx, sy, (y * outW + x) * 4);
    }
  }
  outCtx.putImageData(dstImg, 0, 0);
  return out;
}

/** Legibility booster: grayscale + contrast + very mild threshold. */
export function enhanceReadability(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height);
  const px = data.data;
  // Contrast lift around midpoint 128.
  const factor = 1.35;
  const bias = 12;
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    let v = (g - 128) * factor + 128 + bias;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export async function scanFromCapture(
  source: File | Blob,
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(source);
  const quad = autoDetectQuad(img);
  const warped = warpToQuad(img, quad);
  const enhanced = enhanceReadability(warped);
  const blob: Blob = await new Promise((r) =>
    enhanced.toBlob((b) => r(b ?? new Blob()), "image/jpeg", 0.86),
  );
  return { blob, width: enhanced.width, height: enhanced.height };
}
