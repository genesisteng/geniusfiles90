/**
 * Encodage MP3 — encodeur LAME en JavaScript pur (aucun binaire natif,
 * fonctionne dans le WebView Android comme dans le navigateur).
 *
 * L'encodeur est chargé paresseusement : l'éditeur reste léger tant que
 * l'utilisateur n'exporte pas en MP3.
 */
import type { AudioClip } from "./types";
import { resampleTo } from "./dsp";

/** Débits proposés à l'utilisateur (kbps). */
export const MP3_BITRATES = [96, 128, 192, 256, 320] as const;
export type Mp3Bitrate = (typeof MP3_BITRATES)[number];

/** Fréquences d'échantillonnage acceptées par MPEG 1/2 Layer III. */
const MPEG_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];

function nearestMpegRate(rate: number): number {
  let best = MPEG_RATES[0];
  let dist = Math.abs(rate - best);
  for (const r of MPEG_RATES) {
    const d = Math.abs(rate - r);
    if (d < dist) {
      best = r;
      dist = d;
    }
  }
  return best;
}

function toInt16(input: Float32Array, from: number, count: number): Int16Array {
  const out = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    let v = input[from + i] ?? 0;
    v = v > 1 ? 1 : v < -1 ? -1 : v;
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

/**
 * Encode le clip en MP3.
 *
 * @param onProgress fraction 0..1, appelée régulièrement (l'encodage rend
 *   la main au navigateur entre les blocs pour garder l'UI fluide).
 */
export async function encodeMp3(
  clip: AudioClip,
  options: { bitrate?: number; mono?: boolean; onProgress?: (ratio: number) => void } = {},
): Promise<Uint8Array> {
  const bitrate = options.bitrate ?? 192;
  const target = nearestMpegRate(clip.sampleRate);
  const src = target === clip.sampleRate ? clip : resampleTo(clip, target);

  const mono = options.mono === true || src.channels.length < 2;
  const channelCount = mono ? 1 : 2;

  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encoder = new Mp3Encoder(channelCount, src.sampleRate, bitrate);

  let left = src.channels[0];
  let right = src.channels[1] ?? src.channels[0];
  if (mono && src.channels.length > 1) {
    const mix = new Float32Array(src.length);
    for (let i = 0; i < src.length; i++) mix[i] = (left[i] + right[i]) * 0.5;
    left = mix;
    right = mix;
  }

  const block = 1152 * 20; // multiple de la trame MP3
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < src.length; i += block) {
    const count = Math.min(block, src.length - i);
    const l = toInt16(left, i, count);
    const buf = mono ? encoder.encodeBuffer(l) : encoder.encodeBuffer(l, toInt16(right, i, count));
    if (buf.length > 0) {
      chunks.push(new Uint8Array(buf));
      total += buf.length;
    }
    options.onProgress?.(Math.min(1, (i + count) / Math.max(1, src.length)));
    // Respire : évite de bloquer le fil principal sur les longs fichiers.
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  const tail = encoder.flush();
  if (tail.length > 0) {
    chunks.push(new Uint8Array(tail));
    total += tail.length;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  options.onProgress?.(1);
  return out;
}
