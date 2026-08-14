import type { FileKind } from "./types";

const EXT: Record<string, FileKind> = {
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
  mp4: "video",
  mkv: "video",
  mov: "video",
  avi: "video",
  webm: "video",
  "3gp": "video",
  mp3: "audio",
  wav: "audio",
  flac: "audio",
  ogg: "audio",
  m4a: "audio",
  aac: "audio",
  opus: "audio",
  pdf: "document",
  doc: "document",
  docx: "document",
  odt: "document",
  txt: "document",
  md: "document",
  rtf: "document",
  xls: "document",
  xlsx: "document",
  csv: "document",
  ppt: "document",
  pptx: "document",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  bz2: "archive",
  apk: "app",
  aab: "app",
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
  swift: "code",
  c: "code",
  cpp: "code",
  h: "code",
  rs: "code",
  go: "code",
  php: "code",
  rb: "code",
};

export function kindFromName(name: string, isDir: boolean): FileKind {
  if (isDir) return "folder";
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "other";
  return EXT[name.slice(dot + 1).toLowerCase()] ?? "other";
}

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} o`;
  const units = ["Ko", "Mo", "Go", "To"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
