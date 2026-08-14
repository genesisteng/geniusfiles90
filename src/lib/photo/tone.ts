/**
 * Tone & colour maths for the photo editor.
 *
 * Everything here is real image processing on pixel values: no overlays,
 * no semi-transparent veils. The tone curve is monotonic and
 * endpoint-preserving, so contrast is a true S-curve, exposure is a gain
 * in linear light, and each tonal-range slider only bends the part of the
 * curve it owns.
 */
import type { Adjustments } from "./types";

export type ChannelCurve = { lift?: number; gamma?: number; gain?: number };
export type PresetCurves = { r?: ChannelCurve; g?: ChannelCurve; b?: ChannelCurve };
export type PresetSplit = {
  /** RGB offsets in -1..1 applied to the dark end. */
  shadows: [number, number, number];
  /** RGB offsets in -1..1 applied to the bright end. */
  highlights: [number, number, number];
  amount: number;
};

export function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function srgbToLin(v: number) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function linToSrgb(v: number) {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/** Photographic tone curve evaluated on a single 0..1 sample. */
export function toneCurve(input: number, a: Adjustments): number {
  let v = clamp01(input);

  // 1. Exposure - gain in linear light (about +/-2.2 stops at the extremes).
  if (a.exposure) v = clamp01(linToSrgb(srgbToLin(v) * Math.pow(2, a.exposure * 2.2)));

  // 2. Brightness - midtone gamma; black and white points stay anchored.
  if (a.brightness) v = Math.pow(v, 1 / (1 + a.brightness * 0.85));

  // 3. Contrast - tanh S-curve pivoted on middle grey, exact endpoints.
  if (a.contrast > 0) {
    const g = 1 + a.contrast * 2.4;
    v = 0.5 + Math.tanh((v - 0.5) * g) / (2 * Math.tanh(g * 0.5));
  } else if (a.contrast < 0) {
    v = 0.5 + (v - 0.5) * (1 + a.contrast * 0.8);
  }
  v = clamp01(v);

  // 4. Shadows - dark end only.
  if (a.shadows > 0) v += a.shadows * 0.32 * Math.pow(1 - v, 3);
  else if (a.shadows < 0) v += a.shadows * 0.9 * v * Math.pow(1 - v, 3);

  // 5. Highlights - bright end only.
  if (a.highlights < 0) v += a.highlights * 0.32 * Math.pow(v, 3);
  else if (a.highlights > 0) v += a.highlights * 0.9 * (1 - v) * Math.pow(v, 3);

  // 6. Whites - the very top of the range.
  if (a.whites > 0) v += a.whites * 0.8 * (1 - v) * Math.pow(v, 4);
  else if (a.whites < 0) v += a.whites * 0.2 * Math.pow(v, 5);

  // 7. Blacks - the very bottom of the range.
  if (a.blacks > 0) v += a.blacks * 0.2 * Math.pow(1 - v, 5);
  else if (a.blacks < 0) v += a.blacks * 0.8 * v * Math.pow(1 - v, 3);
  v = clamp01(v);

  // 8. Gamma, then the matte "fade" lift.
  if (a.gamma) v = Math.pow(v, 1 / (1 + a.gamma));
  if (a.fade > 0) v = a.fade * 0.22 + v * (1 - a.fade * 0.3);
  return clamp01(v);
}

/**
 * Per-channel LUTs: shared tone curve + white balance + the preset's own
 * channel curve. Three 256-entry tables turn the pixel loop into a few
 * lookups instead of a dozen Math.pow calls per pixel.
 */
export function buildChannelLUTs(a: Adjustments, curve: PresetCurves | undefined, k: number) {
  const r = new Float32Array(256);
  const g = new Float32Array(256);
  const b = new Float32Array(256);
  // Temperature / tint are gains in linear light - real white balance.
  const gainR = Math.pow(2, a.temperature * 0.55);
  const gainB = Math.pow(2, -a.temperature * 0.55);
  const gainG = Math.pow(2, a.tint * 0.35);

  const channel = (base: number, gain: number, c?: ChannelCurve) => {
    let out = base;
    if (gain !== 1) out = clamp01(linToSrgb(srgbToLin(out) * gain));
    if (c) {
      const lift = (c.lift ?? 0) * k;
      const gamma = 1 + (c.gamma ?? 0) * k;
      const gain2 = 1 + (c.gain ?? 0) * k;
      if (gamma !== 1) out = Math.pow(out, 1 / gamma);
      out = out * gain2 + lift * (1 - out);
    }
    return clamp01(out) * 255;
  };

  for (let i = 0; i < 256; i++) {
    const base = toneCurve(i / 255, a);
    r[i] = channel(base, gainR, curve?.r);
    g[i] = channel(base, gainG, curve?.g);
    b[i] = channel(base, gainB, curve?.b);
  }
  return { r, g, b };
}
