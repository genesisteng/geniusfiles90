/**
 * Mixage multipiste.
 *
 * Deux pistes partagent la même timeline ; chacune a son décalage
 * temporel, son volume et son état muet. Le mixage produit un clip réel
 * (utilisé pour l'export) — jamais une simple superposition visuelle.
 */
import type { AudioClip } from "./types";
import { emptyClip, resampleTo } from "./dsp";

export type TrackLayer = {
  clip: AudioClip;
  /** Décalage de départ, en secondes (>= 0). */
  offset: number;
  /** Volume linéaire 0..2. */
  gain: number;
  muted: boolean;
};

/** Durée totale du montage, en secondes. */
export function mixDuration(layers: TrackLayer[]): number {
  let max = 0;
  for (const l of layers) {
    const end = Math.max(0, l.offset) + l.clip.length / l.clip.sampleRate;
    if (end > max) max = end;
  }
  return max;
}

/** Mixe les pistes en un seul clip (somme limitée à ±1). */
export function mixTracks(layers: TrackLayer[]): AudioClip {
  const active = layers.filter((l) => !l.muted && l.clip.length > 0);
  if (active.length === 0) {
    const first = layers[0]?.clip;
    return emptyClip(first?.sampleRate ?? 44100, first?.channels.length ?? 2, 0);
  }
  if (active.length === 1 && Math.abs(active[0].offset) < 1e-6 && active[0].gain === 1) {
    return active[0].clip;
  }
  const sampleRate = active[0].clip.sampleRate;
  const channelCount = Math.max(...active.map((l) => l.clip.channels.length));
  const length = Math.max(
    1,
    Math.round(
      mixDuration(active.map((l) => ({ ...l, clip: resampleTo(l.clip, sampleRate) }))) * sampleRate,
    ),
  );
  const out = emptyClip(sampleRate, channelCount, length);
  for (const layer of active) {
    const src =
      layer.clip.sampleRate === sampleRate ? layer.clip : resampleTo(layer.clip, sampleRate);
    const at = Math.max(0, Math.round(layer.offset * sampleRate));
    const g = Math.max(0, layer.gain);
    for (let c = 0; c < channelCount; c++) {
      const from = src.channels[Math.min(c, src.channels.length - 1)];
      const to = out.channels[c];
      const n = Math.min(from.length, length - at);
      for (let i = 0; i < n; i++) to[at + i] += from[i] * g;
    }
  }
  for (const ch of out.channels) {
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i];
      ch[i] = v > 1 ? 1 : v < -1 ? -1 : v;
    }
  }
  return out;
}
