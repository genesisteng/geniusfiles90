/**
 * Encodage WAV PCM 16 bits — sans dépendance externe.
 *
 * Le WAV est le seul format que l'on peut produire de façon fiable et
 * rapide dans le WebView Android sans embarquer un encodeur lourd. Il est
 * lu nativement par GeniusFiles et par Android.
 */
import type { AudioClip } from "./types";

export function encodeWav(clip: AudioClip): Uint8Array {
  const channelCount = Math.max(1, clip.channels.length);
  const frames = clip.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channelCount, true);
  view.setUint32(24, clip.sampleRate, true);
  view.setUint32(28, clip.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channelCount; c++) {
      const ch = clip.channels[Math.min(c, clip.channels.length - 1)];
      let v = ch[i] ?? 0;
      v = v > 1 ? 1 : v < -1 ? -1 : v;
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      offset += 2;
    }
  }
  return new Uint8Array(buffer);
}
