/**
 * Saving edited photos back to the device.
 *
 * Two policies, both explicit in the UI: create a new file next to the
 * original (never destructive) or replace the original after confirmation.
 */
import { t } from "@/lib/i18n";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { toAbsolutePath } from "@/lib/files/fs";
import { writeBytes } from "@/lib/pdf/native-io";

export type ExportFormat = "jpeg" | "png" | "webp";

export const FORMAT_LABEL: Record<ExportFormat, string> = {
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
};

const EXT: Record<ExportFormat, string> = { jpeg: "jpg", png: "png", webp: "webp" };

export function formatFromName(name: string): ExportFormat {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "png") return "png";
  if (ext === "webp") return "webp";
  return "jpeg";
}

export async function canvasToBytes(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality: number,
): Promise<Uint8Array> {
  // JPEG has no alpha channel: flatten onto white so transparent areas do
  // not turn black. PNG and WebP keep the transparency intact.
  let target = canvas;
  if (format === "jpeg") {
    const flat = document.createElement("canvas");
    flat.width = canvas.width;
    flat.height = canvas.height;
    const c = flat.getContext("2d");
    if (c) {
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, flat.width, flat.height);
      c.drawImage(canvas, 0, 0);
      target = flat;
    }
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    target.toBlob(resolve, `image/${format}`, format === "png" ? undefined : quality),
  );
  if (!blob) throw new Error(t("system.io.exportFailed"));
  return new Uint8Array(await blob.arrayBuffer());
}

export function suggestedName(original: string, format: ExportFormat): string {
  const dot = original.lastIndexOf(".");
  const base = dot > 0 ? original.slice(0, dot) : original;
  return `${base}-modifie.${EXT[format]}`;
}

export function replacementName(original: string, format: ExportFormat): string {
  const dot = original.lastIndexOf(".");
  const base = dot > 0 ? original.slice(0, dot) : original;
  const ext = dot > 0 ? original.slice(dot + 1).toLowerCase() : "";
  return ext === EXT[format] ? original : `${base}.${EXT[format]}`;
}

export async function saveEditedImage(options: {
  parent: PathRef;
  entry: FileEntry;
  canvas: HTMLCanvasElement;
  format: ExportFormat;
  quality: number;
  mode: "new" | "replace";
}): Promise<{ path: string; size: number; name: string }> {
  const { parent, entry, canvas, format, quality, mode } = options;
  const bytes = await canvasToBytes(canvas, format, quality);
  const name =
    mode === "replace" ? replacementName(entry.name, format) : suggestedName(entry.name, format);
  const target = toAbsolutePath({ rootId: parent.rootId, segments: [...parent.segments, name] });
  const res = await writeBytes(target, bytes, {
    overwrite: mode === "replace",
    autoRename: mode === "new",
  });
  return { ...res, name: res.path.split("/").pop() ?? name };
}
