/**
 * Look presets, crop ratios, fonts and colour helpers for the photo editor.
 *
 * A preset is never an overlay: it is a bundle of real adjustments, an
 * optional per-channel tone curve and an optional split-tone, all of which
 * are evaluated on the actual pixels by the render pipeline.
 */
import type { PresetCurves, PresetSplit } from "./tone";
import type { Adjustments } from "./types";
import { t } from "@/lib/i18n";

export type PresetCategory = "naturel" | "portrait" | "cinema" | "nb" | "couleur";

export const presetCategories = (): { id: PresetCategory; label: string }[] => [
  { id: "naturel", label: "Naturels" },
  { id: "portrait", label: "Portrait" },
  { id: "cinema", label: t("photo.filter.category.cinema") },
  { id: "nb", label: "Noir & blanc" },
  { id: "couleur", label: "Couleurs" },
];

export type Preset = {
  id: string;
  label: string;
  category: PresetCategory;
  adjust: Partial<Adjustments>;
  /** Per-channel tone curve — the backbone of every film-like look. */
  curve?: PresetCurves;
  /** Colour offsets applied to shadows / highlights separately. */
  split?: PresetSplit;
  grayscale?: number;
  /** "Auto": adjustments come from the histogram of the edited image. */
  dynamic?: boolean;
};

export const presets = (): Preset[] => [
  /* ------------------------------- naturels ------------------------------ */
  { id: "none", label: "Original", category: "naturel", adjust: {} },
  { id: "auto", label: "Auto", category: "naturel", adjust: {}, dynamic: true },
  {
    id: "naturel",
    label: "Naturel",
    category: "naturel",
    adjust: { contrast: 0.08, vibrance: 0.14, shadows: 0.08, sharpness: 0.12 },
  },
  {
    id: "eclat",
    label: t("photo.preset.eclat"),
    category: "naturel",
    adjust: { exposure: 0.1, contrast: 0.2, vibrance: 0.34, clarity: 0.22, whites: 0.12 },
  },
  {
    id: "clair",
    label: "Clair",
    category: "naturel",
    adjust: { exposure: 0.18, shadows: 0.24, highlights: -0.12, contrast: -0.05, vibrance: 0.1 },
  },
  {
    id: "doux",
    label: "Doux",
    category: "naturel",
    adjust: { contrast: -0.12, shadows: 0.18, clarity: -0.16, saturation: -0.05, fade: 0.14 },
  },
  {
    id: "paysage",
    label: "Paysage",
    category: "naturel",
    adjust: { contrast: 0.22, vibrance: 0.38, structure: 0.28, temperature: -0.06, blacks: -0.08 },
    curve: { b: { gamma: 0.06 }, g: { gain: 0.02 } },
  },

  /* ------------------------------- portrait ------------------------------ */
  {
    id: "portrait",
    label: "Portrait",
    category: "portrait",
    adjust: { exposure: 0.06, shadows: 0.2, highlights: -0.1, saturation: 0.06, denoise: 0.18 },
    curve: { r: { gain: 0.03 }, b: { gain: -0.02 } },
  },
  {
    id: "peau-douce",
    label: "Peau douce",
    category: "portrait",
    adjust: { denoise: 0.42, clarity: -0.28, shadows: 0.16, exposure: 0.08, vibrance: 0.08 },
    curve: { r: { lift: 0.02 } },
  },
  {
    id: "chaleureux",
    label: "Chaleureux",
    category: "portrait",
    adjust: { temperature: 0.22, exposure: 0.06, contrast: 0.1, vibrance: 0.14 },
    split: { shadows: [0.02, 0.0, -0.03], highlights: [0.06, 0.02, -0.05], amount: 0.5 },
  },
  {
    id: "portrait-cine",
    label: t("photo.filters.portraitCine"),
    category: "portrait",
    adjust: { contrast: 0.18, shadows: 0.22, highlights: -0.22, saturation: -0.08, fade: 0.12 },
    split: { shadows: [-0.05, 0.0, 0.09], highlights: [0.07, 0.03, -0.04], amount: 0.55 },
  },

  /* -------------------------------- cinéma ------------------------------- */
  {
    id: "cinema",
    label: t("photo.filter.category.cinema"),
    category: "cinema",
    adjust: { contrast: 0.24, shadows: 0.26, highlights: -0.24, saturation: -0.12, fade: 0.2 },
    curve: { b: { lift: 0.05, gamma: 0.05 }, r: { gain: 0.03 } },
    split: { shadows: [-0.08, -0.01, 0.12], highlights: [0.09, 0.04, -0.06], amount: 0.6 },
  },
  {
    id: "film",
    label: "Film",
    category: "cinema",
    adjust: {
      contrast: 0.06,
      blacks: 0.14,
      saturation: -0.14,
      grain: 0.22,
      fade: 0.24,
      vignette: 0.2,
    },
    curve: { r: { gamma: 0.05 }, b: { gamma: -0.05 } },
  },
  {
    id: "moody",
    label: "Moody",
    category: "cinema",
    adjust: {
      exposure: -0.12,
      contrast: 0.28,
      blacks: -0.2,
      saturation: -0.18,
      vignette: 0.3,
      clarity: 0.16,
    },
    split: { shadows: [-0.04, 0.0, 0.07], highlights: [0.02, 0.01, -0.02], amount: 0.5 },
  },
  {
    id: "froid-cine",
    label: "Froid",
    category: "cinema",
    adjust: { temperature: -0.3, tint: 0.04, contrast: 0.16, highlights: -0.08 },
    curve: { b: { gain: 0.05 }, r: { gain: -0.03 } },
  },
  {
    id: "chaud-cine",
    label: "Chaud",
    category: "cinema",
    adjust: { temperature: 0.3, contrast: 0.14, vibrance: 0.12, highlights: -0.06 },
    curve: { r: { gain: 0.05 }, b: { gain: -0.04 } },
  },

  /* ----------------------------- noir & blanc ---------------------------- */
  {
    id: "nb",
    label: "N&B",
    category: "nb",
    adjust: { contrast: 0.16, clarity: 0.12 },
    grayscale: 1,
  },
  {
    id: "nb-contraste",
    label: t("photo.filters.nbContraste"),
    category: "nb",
    adjust: { contrast: 0.46, blacks: -0.22, whites: 0.18, clarity: 0.26, structure: 0.18 },
    grayscale: 1,
  },
  {
    id: "nb-doux",
    label: "N&B doux",
    category: "nb",
    adjust: { contrast: -0.08, shadows: 0.24, highlights: -0.12, fade: 0.18 },
    grayscale: 1,
  },
  {
    id: "argentique",
    label: "Argentique",
    category: "nb",
    adjust: { contrast: 0.2, grain: 0.3, vignette: 0.26, fade: 0.14 },
    grayscale: 0.92,
    split: { shadows: [0.03, 0.01, -0.03], highlights: [0.05, 0.03, -0.04], amount: 0.5 },
  },

  /* ------------------------------- couleurs ------------------------------ */
  {
    id: "vintage",
    label: "Vintage",
    category: "couleur",
    adjust: { saturation: -0.2, contrast: 0.08, fade: 0.3, grain: 0.14, vignette: 0.18 },
    curve: { r: { lift: 0.06, gain: -0.03 }, g: { lift: 0.02 }, b: { lift: -0.02, gamma: -0.08 } },
  },
  {
    id: "retro",
    label: t("photo.preset.retro"),
    category: "couleur",
    adjust: { saturation: 0.12, contrast: 0.1, fade: 0.22, temperature: 0.12 },
    curve: { r: { gamma: 0.1 }, b: { lift: 0.07, gain: -0.05 } },
  },
  {
    id: "sature",
    label: t("photo.preset.sature"),
    category: "couleur",
    adjust: { saturation: 0.34, vibrance: 0.24, contrast: 0.18, structure: 0.14 },
  },
  {
    id: "pastel",
    label: "Pastel",
    category: "couleur",
    adjust: { exposure: 0.12, contrast: -0.18, saturation: -0.14, shadows: 0.28, fade: 0.22 },
    split: { shadows: [0.04, 0.0, 0.05], highlights: [0.04, 0.02, 0.03], amount: 0.45 },
  },
  {
    id: "froid",
    label: "Froid",
    category: "couleur",
    adjust: { temperature: -0.26, tint: 0.05, contrast: 0.1, vibrance: 0.1 },
  },
  {
    id: "chaud",
    label: "Chaud",
    category: "couleur",
    adjust: { temperature: 0.28, saturation: 0.1, highlights: -0.08, vibrance: 0.12 },
  },
  {
    id: "nuit",
    label: "Nuit",
    category: "couleur",
    adjust: { exposure: 0.3, shadows: 0.4, denoise: 0.32, blacks: 0.06, contrast: 0.12 },
  },
];

export function presetById(id: string | null): Preset | null {
  if (!id) return null;
  return presets().find((p) => p.id === id) ?? null;
}

export const CROP_RATIOS: { id: string; label: string; value: number | null }[] = [
  { id: "free", label: "Libre", value: null },
  { id: "orig", label: "Original", value: 0 },
  { id: "1:1", label: "1:1", value: 1 },
  { id: "4:5", label: "4:5", value: 4 / 5 },
  { id: "3:4", label: "3:4", value: 3 / 4 },
  { id: "2:3", label: "2:3", value: 2 / 3 },
  { id: "9:16", label: "9:16", value: 9 / 16 },
  { id: "4:3", label: "4:3", value: 4 / 3 },
  { id: "3:2", label: "3:2", value: 3 / 2 },
  { id: "16:9", label: "16:9", value: 16 / 9 },
];

export const fonts = (): { id: string; label: string; css: string }[] => [
  { id: "sans", label: "Moderne", css: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: "serif", label: t("photo.text.font.serif"), css: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Technique", css: "ui-monospace, 'SFMono-Regular', monospace" },
  { id: "round", label: "Ronde", css: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { id: "impact", label: "Impact", css: "Impact, 'Arial Black', sans-serif" },
];

export const SWATCHES = [
  "#ffffff",
  "#000000",
  "#f97066",
  "#ffb020",
  "#ffe066",
  "#3ecf8e",
  "#4da3ff",
  "#8b5cf6",
  "#ff6fb5",
  "#8b6f47",
];

export const EMOJIS = [
  "😀",
  "😍",
  "😎",
  "🤩",
  "🥳",
  "😂",
  "🔥",
  "✨",
  "⭐",
  "❤️",
  "👍",
  "👏",
  "🎉",
  "💯",
  "📌",
  "✅",
  "❌",
  "⚡",
  "🌈",
  "🌸",
];

export const shapes = (): {
  id: "arrow" | "circle" | "rect" | "star" | "bubble";
  label: string;
}[] => [
  { id: "arrow", label: t("photo.sticker.shape.arrow") },
  { id: "circle", label: "Cercle" },
  { id: "rect", label: "Rectangle" },
  { id: "star", label: t("photo.sticker.shape.star") },
  { id: "bubble", label: "Bulle" },
];

/** Extract a small dominant-colour palette from a canvas (median cut lite). */
export function extractPalette(canvas: HTMLCanvasElement, count = 6): string[] {
  const w = 64;
  const h = Math.max(1, Math.round((canvas.height / canvas.width) * w));
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const ctx = tmp.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(canvas, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const cur = buckets.get(key);
    if (cur) {
      cur.r += r;
      cur.g += g;
      cur.b += b;
      cur.n += 1;
    } else buckets.set(key, { r, g, b, n: 1 });
  }
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map(({ r, g, b, n }) => {
      const hex = (v: number) =>
        Math.round(v / n)
          .toString(16)
          .padStart(2, "0");
      return `#${hex(r)}${hex(g)}${hex(b)}`;
    });
}

/** Histogram-based auto correction (levels + gentle vibrance). */
export function autoAdjust(canvas: HTMLCanvasElement): Partial<Adjustments> {
  const w = 96;
  const h = Math.max(1, Math.round((canvas.height / canvas.width) * w));
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const ctx = tmp.getContext("2d", { willReadFrequently: true });
  if (!ctx) return {};
  ctx.drawImage(canvas, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const hist = new Uint32Array(256);
  let sat = 0;
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    hist[l] += 1;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    sat += mx === 0 ? 0 : (mx - mn) / mx;
  }
  const clipLow = total * 0.005;
  const clipHigh = total * 0.005;
  let acc = 0;
  let low = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc > clipLow) {
      low = i;
      break;
    }
  }
  acc = 0;
  let high = 255;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc > clipHigh) {
      high = i;
      break;
    }
  }
  let mean = 0;
  for (let i = 0; i < 256; i++) mean += i * hist[i];
  mean /= total;

  const range = Math.max(1, high - low);
  // Real level expansion: pull the clipped ends back to 0 / 255.
  const contrast = Math.max(0, Math.min(0.4, (255 - range) / 300));
  const exposure = Math.max(-0.35, Math.min(0.35, (128 - mean) / 340));
  const avgSat = sat / total;
  const vibrance = Math.max(0, Math.min(0.32, (0.34 - avgSat) * 0.95));
  return {
    exposure: Number(exposure.toFixed(3)),
    contrast: Number(contrast.toFixed(3)),
    vibrance: Number(vibrance.toFixed(3)),
    blacks: Number((-Math.min(0.3, low / 255) * 0.8).toFixed(3)),
    whites: Number((Math.min(0.3, (255 - high) / 255) * 0.8).toFixed(3)),
    shadows: mean < 110 ? 0.2 : 0.08,
    highlights: mean > 165 ? -0.18 : -0.05,
    sharpness: 0.12,
  };
}
