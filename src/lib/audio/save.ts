/**
 * Export de l'audio édité vers le stockage.
 *
 * Règle absolue : l'original n'est jamais écrasé sans demande explicite.
 * Le mode « nouveau fichier » suffixe le nom et laisse `writeBytes`
 * auto-renommer en cas de collision.
 */
import type { FileEntry, PathRef } from "@/lib/files/types";
import { toAbsolutePath } from "@/lib/files/fs";
import { writeBytes } from "@/lib/pdf/native-io";
import { encodeWav } from "./wav";
import { encodeMp3 } from "./mp3";
import type { AudioClip } from "./types";
import { AudioEditorError } from "./decode";
import { t } from "@/lib/i18n";

/** Formats d'export proposés. */
export type AudioExportFormat = "wav" | "mp3";

function baseName(original: string): string {
  const dot = original.lastIndexOf(".");
  return dot > 0 ? original.slice(0, dot) : original;
}

/** Remplace l'extension d'un nom saisi par celle du format choisi. */
export function withFormatExtension(name: string, format: AudioExportFormat): string {
  return `${baseName(name.trim() || "audio")}.${format}`;
}

export function suggestedAudioName(original: string, format: AudioExportFormat = "wav"): string {
  return `${baseName(original)}-modifie.${format}`;
}

export function replacementAudioName(original: string, format: AudioExportFormat = "wav"): string {
  return `${baseName(original)}.${format}`;
}

export async function saveEditedAudio(options: {
  parent: PathRef;
  entry: FileEntry;
  clip: AudioClip;
  mode: "new" | "replace";
  name?: string;
  format?: AudioExportFormat;
  /** Débit MP3 en kbps (ignoré en WAV). */
  bitrate?: number;
  /** Force un export mono (ignoré en WAV). */
  mono?: boolean;
  onProgress?: (ratio: number) => void;
}): Promise<{ path: string; size: number; name: string }> {
  const { parent, entry, clip, mode } = options;
  const format: AudioExportFormat = options.format ?? "wav";
  if (clip.length === 0) throw new AudioEditorError("empty", t("media.error.emptyExport"));
  let bytes: Uint8Array;
  try {
    bytes =
      format === "mp3"
        ? await encodeMp3(clip, {
            bitrate: options.bitrate,
            mono: options.mono,
            onProgress: options.onProgress,
          })
        : encodeWav(clip);
  } catch {
    throw new AudioEditorError("failed", t("media.error.encodeFailed"));
  }
  const requested = options.name?.trim();
  const name = requested
    ? withFormatExtension(requested, format)
    : mode === "replace"
      ? replacementAudioName(entry.name, format)
      : suggestedAudioName(entry.name, format);
  const target = toAbsolutePath({ rootId: parent.rootId, segments: [...parent.segments, name] });
  try {
    const res = await writeBytes(target, bytes, {
      overwrite: mode === "replace",
      autoRename: mode === "new",
    });
    return { ...res, name: res.path.split("/").pop() ?? name };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/space|ENOSPC|quota/i.test(msg)) {
      throw new AudioEditorError("storage", t("media.error.storageFull"));
    }
    if (/permission|denied|EACCES/i.test(msg)) {
      throw new AudioEditorError("permission", t("media.error.noPermissionWrite"));
    }
    throw new AudioEditorError("failed", t("media.error.exportFailed"));
  }
}
