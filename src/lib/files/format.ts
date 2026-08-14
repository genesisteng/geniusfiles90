import { t } from "@/lib/i18n";
import type { FileEntry, FileKind, PathRef, StorageRoot } from "./types";

const EXT_MAP: Record<string, FileKind> = {
  // images
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  heic: "image",
  heif: "image",
  bmp: "image",
  svg: "image",
  avif: "image",
  tif: "image",
  tiff: "image",
  ico: "image",
  jfif: "image",

  // video
  mp4: "video",
  mkv: "video",
  mov: "video",
  avi: "video",
  webm: "video",
  m4v: "video",
  "3gp": "video",
  flv: "video",
  m2ts: "video",

  mts: "video",
  wmv: "video",

  // audio
  mp3: "audio",
  wav: "audio",
  flac: "audio",
  ogg: "audio",
  m4a: "audio",
  aac: "audio",
  opus: "audio",
  wma: "audio",

  // documents
  doc: "document",
  docx: "document",
  odt: "document",
  rtf: "document",
  xls: "document",
  xlsx: "document",
  ods: "document",
  ppt: "document",
  pptx: "document",
  odp: "document",
  epub: "document",
  mobi: "document",

  pdf: "pdf",
  txt: "text",
  md: "text",
  log: "text",
  csv: "text",
  // archives
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  bz2: "archive",
  xz: "archive",
  // code
  js: "code",
  ts: "code",
  tsx: "code",
  jsx: "code",
  json: "code",
  html: "code",
  css: "code",
  py: "code",
  java: "code",
  kt: "code",
  c: "code",
  cpp: "code",
  h: "code",
  go: "code",
  rs: "code",
  sh: "code",
  xml: "code",
  yml: "code",
  yaml: "code",
  // apk
  apk: "apk",
  aab: "apk",
  // fonts
  ttf: "font",
  otf: "font",
  woff: "font",
  woff2: "font",
};

export function extOf(name: string): string | undefined {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return undefined;
  return name.slice(i + 1).toLowerCase();
}

export function kindOf(name: string, isDirectory: boolean): FileKind {
  if (isDirectory) return "folder";
  const ext = extOf(name);
  if (!ext) return "other";
  return EXT_MAP[ext] ?? "other";
}

const UNITS = ["o", "Ko", "Mo", "Go", "To"];

export function formatSize(bytes?: number): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes < 1) return "0 o";
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  const rounded = value >= 100 || i === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded.toString().replace(".", ",")} ${UNITS[i]}`;
}

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function formatDate(mtime?: number): string {
  if (!mtime) return "—";
  const d = new Date(mtime);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return t("files.date.today", { time: TIME_FMT.format(d) });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return t("files.date.yesterday", { time: TIME_FMT.format(d) });
  return DATE_FMT.format(d);
}

export function kindLabel(kind: FileKind, ext?: string): string {
  const label = t(`files.kind.${kind}`);
  return ext && kind !== "folder" ? `${label} · ${ext.toUpperCase()}` : label;
}

export function fileMetaLine(entry: FileEntry): string {
  if (entry.isDirectory) return formatDate(entry.mtime);
  return `${formatSize(entry.size)} · ${formatDate(entry.mtime)}`;
}

export function pathToString(path: PathRef, roots: StorageRoot[]): string {
  const root = roots.find((r) => r.id === path.rootId);
  const rootLabel = root?.label ?? path.rootId;
  if (path.segments.length === 0) return rootLabel;
  return `${rootLabel} / ${path.segments.join(" / ")}`;
}
