/**
 * Traitement audio réel (aucune simulation).
 *
 * Toutes les fonctions sont pures : elles reçoivent un `AudioClip` et en
 * retournent un nouveau, sans jamais muter l'entrée. Les boucles sont
 * écrites canal par canal sur des `Float32Array` pour rester rapides même
 * sur des fichiers longs.
 */
import type { AudioClip, TimeRange } from "./types";

export function emptyClip(sampleRate: number, channelCount: number, length = 0): AudioClip {
  const channels: Float32Array[] = [];
  for (let c = 0; c < channelCount; c++) channels.push(new Float32Array(length));
  return { sampleRate, channels, length };
}

export function durationOf(clip: AudioClip): number {
  return clip.length / clip.sampleRate;
}

function clampIndex(v: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(v)));
}

/** Convertit une plage en secondes vers des index d'échantillons valides. */
export function rangeToSamples(clip: AudioClip, range: TimeRange): { a: number; b: number } {
  const a = clampIndex(range.start * clip.sampleRate, clip.length);
  const b = clampIndex(range.end * clip.sampleRate, clip.length);
  return a <= b ? { a, b } : { a: b, b: a };
}

export function sliceClip(clip: AudioClip, a: number, b: number): AudioClip {
  const start = clampIndex(a, clip.length);
  const end = clampIndex(b, clip.length);
  const len = Math.max(0, end - start);
  return {
    sampleRate: clip.sampleRate,
    length: len,
    channels: clip.channels.map((ch) => ch.slice(start, start + len)),
  };
}

/** Concatène des clips (harmonise le nombre de canaux). */
export function concatClips(clips: AudioClip[]): AudioClip {
  const parts = clips.filter((c) => c.length > 0);
  if (parts.length === 0) return emptyClip(clips[0]?.sampleRate ?? 44100, 1);
  const sampleRate = parts[0].sampleRate;
  const channelCount = Math.max(...parts.map((p) => p.channels.length));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = emptyClip(sampleRate, channelCount, total);
  let offset = 0;
  for (const part of parts) {
    for (let c = 0; c < channelCount; c++) {
      const src = part.channels[Math.min(c, part.channels.length - 1)];
      out.channels[c].set(src, offset);
    }
    offset += part.length;
  }
  return out;
}

/** Rééchantillonne un clip vers `sampleRate` (interpolation linéaire). */
export function resampleTo(clip: AudioClip, sampleRate: number): AudioClip {
  if (clip.sampleRate === sampleRate || clip.length === 0) return clip;
  const ratio = sampleRate / clip.sampleRate;
  const len = Math.max(1, Math.round(clip.length * ratio));
  const out = emptyClip(sampleRate, clip.channels.length, len);
  for (let c = 0; c < clip.channels.length; c++) {
    const src = clip.channels[c];
    const dst = out.channels[c];
    for (let i = 0; i < len; i++) {
      const pos = i / ratio;
      const i0 = Math.floor(pos);
      const frac = pos - i0;
      const s0 = src[Math.min(i0, src.length - 1)] ?? 0;
      const s1 = src[Math.min(i0 + 1, src.length - 1)] ?? s0;
      dst[i] = s0 + (s1 - s0) * frac;
    }
  }
  return out;
}

/* ---------- Opérations d'édition ---------- */

export function deleteRange(clip: AudioClip, range: TimeRange): AudioClip {
  const { a, b } = rangeToSamples(clip, range);
  if (b <= a) return clip;
  return concatClips([sliceClip(clip, 0, a), sliceClip(clip, b, clip.length)]);
}

export function keepRange(clip: AudioClip, range: TimeRange): AudioClip {
  const { a, b } = rangeToSamples(clip, range);
  if (b <= a) return clip;
  return sliceClip(clip, a, b);
}

/** Silence avec micro-fondus de 3 ms pour éviter les clics. */
export function silenceRange(clip: AudioClip, range: TimeRange): AudioClip {
  const { a, b } = rangeToSamples(clip, range);
  if (b <= a) return clip;
  const out = cloneClip(clip);
  const ramp = Math.min(Math.round(clip.sampleRate * 0.003), Math.floor((b - a) / 2));
  for (const ch of out.channels) {
    for (let i = a; i < b; i++) {
      let g = 0;
      if (i - a < ramp) g = 1 - (i - a) / ramp;
      else if (b - i <= ramp) g = 1 - (b - i) / ramp;
      ch[i] *= g;
    }
  }
  return out;
}

export function cloneClip(clip: AudioClip): AudioClip {
  return {
    sampleRate: clip.sampleRate,
    length: clip.length,
    channels: clip.channels.map((ch) => Float32Array.from(ch)),
  };
}

export function applyGain(clip: AudioClip, db: number, range?: TimeRange): AudioClip {
  const gain = Math.pow(10, db / 20);
  if (gain === 1) return clip;
  const out = cloneClip(clip);
  const { a, b } = range ? rangeToSamples(clip, range) : { a: 0, b: clip.length };
  for (const ch of out.channels) {
    for (let i = a; i < b; i++) ch[i] = clamp1(ch[i] * gain);
  }
  return out;
}

function clamp1(v: number): number {
  return v > 1 ? 1 : v < -1 ? -1 : v;
}

export function fadeIn(clip: AudioClip, duration: number): AudioClip {
  const n = Math.min(clip.length, Math.round(duration * clip.sampleRate));
  if (n <= 0) return clip;
  const out = cloneClip(clip);
  for (const ch of out.channels) {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      ch[i] *= t * t * (3 - 2 * t); // courbe douce (smoothstep)
    }
  }
  return out;
}

export function fadeOut(clip: AudioClip, duration: number): AudioClip {
  const n = Math.min(clip.length, Math.round(duration * clip.sampleRate));
  if (n <= 0) return clip;
  const out = cloneClip(clip);
  for (const ch of out.channels) {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      ch[clip.length - 1 - i] *= t * t * (3 - 2 * t);
    }
  }
  return out;
}

export function peakOf(clip: AudioClip): number {
  let peak = 0;
  for (const ch of clip.channels) {
    for (let i = 0; i < ch.length; i++) {
      const v = Math.abs(ch[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

export function normalize(clip: AudioClip, peakDb: number): AudioClip {
  const peak = peakOf(clip);
  if (peak <= 0.000001) return clip;
  const target = Math.pow(10, peakDb / 20);
  const gain = target / peak;
  if (Math.abs(gain - 1) < 0.0005) return clip;
  const out = cloneClip(clip);
  for (const ch of out.channels) {
    for (let i = 0; i < ch.length; i++) ch[i] = clamp1(ch[i] * gain);
  }
  return out;
}

export function reverse(clip: AudioClip, range?: TimeRange): AudioClip {
  const { a, b } = range ? rangeToSamples(clip, range) : { a: 0, b: clip.length };
  if (b - a < 2) return clip;
  const out = cloneClip(clip);
  for (const ch of out.channels) {
    for (let i = a, j = b - 1; i < j; i++, j--) {
      const t = ch[i];
      ch[i] = ch[j];
      ch[j] = t;
    }
  }
  return out;
}

/** Insère `piece` à l'échantillon `at`. */
export function insertClip(clip: AudioClip, piece: AudioClip, at: number): AudioClip {
  const pos = clampIndex(at, clip.length);
  const normalized = resampleTo(piece, clip.sampleRate);
  return concatClips([sliceClip(clip, 0, pos), normalized, sliceClip(clip, pos, clip.length)]);
}

/**
 * Étirement temporel par recouvrement (OLA) : change la durée sans
 * modifier la hauteur perçue. `ratio` = durée de sortie / durée d'entrée.
 */
export function timeStretch(clip: AudioClip, ratio: number): AudioClip {
  if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.001 || clip.length === 0) return clip;
  const win = Math.max(256, Math.round(clip.sampleRate * 0.046)); // ~46 ms
  const half = Math.floor(win / 2);
  const outLength = Math.max(1, Math.round(clip.length * ratio));
  const out = emptyClip(clip.sampleRate, clip.channels.length, outLength);
  const window = new Float32Array(win);
  for (let i = 0; i < win; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1));

  for (let c = 0; c < clip.channels.length; c++) {
    const src = clip.channels[c];
    const dst = out.channels[c];
    const norm = new Float32Array(outLength);
    let outPos = 0;
    while (outPos < outLength) {
      const inPos = Math.round(outPos / ratio);
      for (let i = 0; i < win; i++) {
        const si = inPos + i;
        const di = outPos + i;
        if (si >= src.length || di >= outLength) break;
        dst[di] += src[si] * window[i];
        norm[di] += window[i];
      }
      outPos += half;
    }
    for (let i = 0; i < outLength; i++) {
      if (norm[i] > 0.0001) dst[i] = clamp1(dst[i] / norm[i]);
    }
  }
  return out;
}

/** Rééchantillonnage « bête » : change durée ET hauteur (mode vinyle). */
export function resampleFactor(clip: AudioClip, factor: number): AudioClip {
  if (!Number.isFinite(factor) || Math.abs(factor - 1) < 0.001 || clip.length === 0) return clip;
  const len = Math.max(1, Math.round(clip.length / factor));
  const out = emptyClip(clip.sampleRate, clip.channels.length, len);
  for (let c = 0; c < clip.channels.length; c++) {
    const src = clip.channels[c];
    const dst = out.channels[c];
    for (let i = 0; i < len; i++) {
      const pos = i * factor;
      const i0 = Math.floor(pos);
      const frac = pos - i0;
      const s0 = src[Math.min(i0, src.length - 1)] ?? 0;
      const s1 = src[Math.min(i0 + 1, src.length - 1)] ?? s0;
      dst[i] = s0 + (s1 - s0) * frac;
    }
  }
  return out;
}

/**
 * Vitesse de lecture. Avec `keepPitch`, on étire le temps puis on garde la
 * hauteur ; sinon simple rééchantillonnage (effet vinyle).
 */
export function changeSpeed(clip: AudioClip, factor: number, keepPitch: boolean): AudioClip {
  if (!Number.isFinite(factor) || factor <= 0) return clip;
  if (!keepPitch) return resampleFactor(clip, factor);
  return timeStretch(clip, 1 / factor);
}

/**
 * Transposition : étirement temporel inverse suivi d'un rééchantillonnage,
 * la durée totale reste identique.
 */
export function changePitch(clip: AudioClip, semitones: number): AudioClip {
  if (!semitones) return clip;
  const factor = Math.pow(2, semitones / 12);
  const stretched = timeStretch(clip, factor);
  return resampleFactor(stretched, factor);
}
