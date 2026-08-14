/**
 * URL/source resolution for the Universal Viewer.
 *
 * On native Android, `Capacitor.convertFileSrc` rewrites an absolute path
 * into a WebView-safe URL served through the bridge — the same technique
 * used by the gallery. On web/SSR, fall back to deterministic mocks so
 * the UI stays interactive inside the Lovable preview.
 */
import { isAndroidNative } from "@/lib/native/geniusfiles-native";
import { toAbsolutePath } from "@/lib/files/fs";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { viewerKindOf } from "./kinds";

function convertFileSrc(absolute: string): string {
  if (typeof window === "undefined") return absolute;
  const cap = (window as unknown as { Capacitor?: { convertFileSrc?: (p: string) => string } })
    .Capacitor;
  if (cap && typeof cap.convertFileSrc === "function") return cap.convertFileSrc(absolute);
  return absolute;
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function absolutePathOf(parent: PathRef, entry: FileEntry): string {
  return toAbsolutePath({ rootId: parent.rootId, segments: [...parent.segments, entry.name] });
}

/** Stable identifier for resume/history storage. */
export function entryKey(parent: PathRef, entry: FileEntry): string {
  return `${parent.rootId}::${[...parent.segments, entry.name].join("/")}`;
}

/**
 * Build a WebView-loadable URL for the file. On the web preview we return
 * a deterministic placeholder so the viewer remains navigable.
 */
export function sourceUrlOf(parent: PathRef, entry: FileEntry): string {
  if (isAndroidNative()) return convertFileSrc(absolutePathOf(parent, entry));
  const kind = viewerKindOf(entry);
  const seed = hash(entryKey(parent, entry)) % 1000;
  if (kind === "image") return `https://picsum.photos/seed/gf-${seed}/1024/1024`;
  return "";
}
