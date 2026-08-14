/**
 * Chargement et décodage d'un fichier audio du stockage.
 *
 * Le décodage passe par l'`AudioContext` du navigateur/WebView : tous les
 * formats déjà lisibles par le lecteur GeniusFiles (mp3, m4a/aac, wav,
 * ogg, flac, opus…) sont donc pris en charge sans dépendance ajoutée.
 */
import type { FileEntry, PathRef } from "@/lib/files/types";
import { readBytes } from "@/lib/pdf/native-io";
import { absolutePathOf, sourceUrlOf } from "@/lib/viewer/source";
import type { AudioClip } from "./types";
import { t } from "@/lib/i18n";

export class AudioEditorError extends Error {
  code: "unsupported" | "corrupted" | "unreadable" | "permission" | "empty" | "storage" | "failed";
  constructor(code: AudioEditorError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "AudioEditorError";
  }
}

let ctx: AudioContext | null = null;

/** Contexte audio partagé (créé à la demande, jamais dupliqué). */
export function audioContext(): AudioContext {
  if (typeof window === "undefined")
    throw new AudioEditorError("failed", t("media.error.audioUnavailable"));
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new AudioEditorError("unsupported", t("media.error.audioUnsupported"));
  if (!ctx || ctx.state === "closed") ctx = new Ctor();
  return ctx;
}

function toClip(buffer: AudioBuffer): AudioClip {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(Float32Array.from(buffer.getChannelData(c)));
  }
  if (channels.length === 0)
    throw new AudioEditorError("corrupted", t("media.error.unreadableFile"));
  return { sampleRate: buffer.sampleRate, channels, length: buffer.length };
}

export async function decodeBytes(bytes: Uint8Array): Promise<AudioClip> {
  if (bytes.byteLength === 0) throw new AudioEditorError("empty", t("media.error.emptyFile"));
  const context = audioContext();
  const copy = bytes.slice().buffer as ArrayBuffer;
  let buffer: AudioBuffer;
  try {
    buffer = await context.decodeAudioData(copy);
  } catch {
    throw new AudioEditorError("unsupported", t("media.error.unsupportedFormat"));
  }
  if (!buffer || buffer.length === 0) {
    throw new AudioEditorError("corrupted", t("media.error.corruptedFile"));
  }
  return toClip(buffer);
}

/**
 * Décode un fichier désigné par son chemin absolu.
 *
 * Les sélecteurs de fichiers renvoient un chemin absolu déjà résolu : le
 * reconstruire à partir d'une racine supposée produisait des chemins
 * doublés (« fichier introuvable »). On lit donc le chemin tel quel.
 */
export async function loadAudioClipFromPath(absolute: string): Promise<AudioClip> {
  let bytes: Uint8Array;
  try {
    bytes = await readBytes(absolute);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    throw new AudioEditorError(
      /permission|denied|autoris/i.test(msg) ? "permission" : "unreadable",
      /permission|denied|autoris/i.test(msg)
        ? t("media.error.noPermissionRead")
        : t("media.error.fileUnreachable"),
    );
  }
  return decodeBytes(bytes);
}

/** Lit le fichier puis le décode. Erreurs normalisées et lisibles. */
export async function loadAudioClip(parent: PathRef, entry: FileEntry): Promise<AudioClip> {
  let bytes: Uint8Array | null = null;
  try {
    bytes = await readBytes(absolutePathOf(parent, entry));
  } catch (e) {
    // Repli : certaines sources (aperçu web, contenus servis) ne sont
    // accessibles que par URL.
    const url = sourceUrlOf(parent, entry);
    if (url) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        bytes = new Uint8Array(await res.arrayBuffer());
      } catch {
        bytes = null;
      }
    }
    if (!bytes) {
      const msg = e instanceof Error ? e.message : "";
      throw new AudioEditorError(
        /permission|denied|autoris/i.test(msg) ? "permission" : "unreadable",
        /permission|denied|autoris/i.test(msg)
          ? t("media.error.noPermissionRead")
          : t("media.error.fileUnreachable"),
      );
    }
  }
  return decodeBytes(bytes);
}
