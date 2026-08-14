/**
 * Bip de censure — signal réellement synthétisé, calé exactement sur la
 * plage sélectionnée.
 *
 * La zone traitée conserve sa durée : le bip *remplace* les échantillons
 * de la sélection (mode `replace`) ou se superpose au signal atténué
 * (mode `over`). Aucun décalage temporel n'est introduit, donc la
 * sélection reste valide après l'opération.
 */
import type { AudioClip, TimeRange } from "./types";
import { cloneClip, rangeToSamples } from "./dsp";

export type CensorStyle = "continu" | "double" | "triple";

export type CensorParams = {
  /** Fréquence du bip, en Hz. */
  freq: number;
  /** Niveau du bip, 0..1. */
  gain: number;
  style: CensorStyle;
  /** Fondu d'entrée/sortie, en secondes. */
  fade: number;
  /** `replace` : le bip seul. `over` : bip + voix fortement atténuée. */
  mode: "replace" | "over";
};

export const CENSOR_DEFAULTS: CensorParams = {
  freq: 1000,
  gain: 0.7,
  style: "continu",
  fade: 0.008,
  mode: "replace",
};

function pattern(style: CensorStyle): number[] {
  // Rapports [on, off] répétés sur la durée de la sélection.
  if (style === "double") return [0.45, 0.1, 0.45];
  if (style === "triple") return [0.28, 0.08, 0.28, 0.08, 0.28];
  return [1];
}

/**
 * Applique le bip sur `range`. La longueur du clip est inchangée.
 */
export function censorRange(clip: AudioClip, range: TimeRange, p: CensorParams): AudioClip {
  const { a, b } = rangeToSamples(clip, range);
  const count = b - a;
  if (count <= 0) return clip;
  const sr = clip.sampleRate;
  const out = cloneClip(clip);
  const fade = Math.max(1, Math.round(Math.max(0, p.fade) * sr));
  const amp = Math.max(0, Math.min(1, p.gain));
  const freq = Math.max(60, Math.min(sr / 3, p.freq));

  // Découpage on/off du motif choisi.
  const parts = pattern(p.style);
  const total = parts.reduce((n, v) => n + v, 0);
  const segments: { from: number; to: number }[] = [];
  let cursor = 0;
  parts.forEach((share, index) => {
    const len = Math.round((share / total) * count);
    if (index % 2 === 0) segments.push({ from: cursor, to: Math.min(count, cursor + len) });
    cursor += len;
  });

  const tone = new Float32Array(count);
  for (const seg of segments) {
    const segLen = seg.to - seg.from;
    if (segLen <= 0) continue;
    const f = Math.min(fade, Math.floor(segLen / 2));
    let phase = 0;
    for (let i = 0; i < segLen; i++) {
      phase += (2 * Math.PI * freq) / sr;
      let env = 1;
      if (f > 0) {
        if (i < f) env = i / f;
        else if (segLen - i < f) env = (segLen - i) / f;
      }
      tone[seg.from + i] = Math.sin(phase) * amp * env;
    }
  }

  for (const ch of out.channels) {
    for (let i = 0; i < count; i++) {
      const t = tone[i];
      ch[a + i] = p.mode === "replace" ? t : ch[a + i] * 0.08 + t;
    }
  }
  return out;
}
