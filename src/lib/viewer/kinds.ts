/**
 * Universal Viewer — kind resolution.
 *
 * Maps a FileEntry to a viewer variant. Every entry that has a native or
 * WebView-friendly renderer becomes "previewable" — the fallback stage
 * still opens for the rest, so *every* file can be opened in the viewer;
 * unsupported formats simply show a rich info card + "Ouvrir avec…".
 */
import type { FileEntry } from "@/lib/files/types";
import { extOf } from "@/lib/files/format";

export type ViewerKind = "image" | "video" | "audio" | "pdf" | "text" | "office" | "ebook" | "none";

const TEXT_EXTS = new Set([
  "txt",
  "md",
  "log",
  "csv",
  "tsv",
  "json",
  "xml",
  "yml",
  "yaml",
  "html",
  "htm",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "java",
  "kt",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
  "go",
  "rs",
  "sh",
  "bat",
  "ini",
  "conf",
  "toml",
  "gitignore",
  "env",
  "sql",
  "srt",
  "vtt",
]);

const OFFICE_EXTS = new Set([
  "doc",
  "docx",
  "odt",
  "rtf",
  "xls",
  "xlsx",
  "ods",
  "ppt",
  "pptx",
  "odp",
]);

const EBOOK_EXTS = new Set(["epub", "mobi"]);

export function viewerKindOf(entry: FileEntry): ViewerKind {
  if (entry.isDirectory) return "none";
  switch (entry.kind) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "pdf":
      return "pdf";
    case "text":
    case "code":
      return "text";
    default: {
      const ext = extOf(entry.name);
      if (!ext) return "none";
      if (TEXT_EXTS.has(ext)) return "text";
      if (OFFICE_EXTS.has(ext)) return "office";
      if (EBOOK_EXTS.has(ext)) return "ebook";
      return "none";
    }
  }
}

/**
 * Every non-directory file is "openable" in the Universal Viewer — the
 * fallback stage renders a rich details card for kinds without a
 * dedicated renderer. Callers use this to expose the "Ouvrir" action.
 */
export function canOpenInViewer(entry: FileEntry): boolean {
  return !entry.isDirectory;
}

/**
 * True when the viewer will render a dedicated player rather than the
 * fallback details card. Kept for callers that want to short-circuit
 * tap-to-open only for actual media/documents.
 */
export function canPreview(entry: FileEntry): boolean {
  const k = viewerKindOf(entry);
  // Office (docx/xlsx/pptx/odt/ods/odp/rtf) and ebook (epub) formats are
  // rendered natively by DocumentStage, so tapping such a file must open
  // the in-app viewer directly rather than surface the actions sheet.
  return k !== "none";
}
