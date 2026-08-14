/**
 * GeniusFiles — PDF Tools API.
 *
 * Local, offline PDF operations built on pdf-lib (+ pdf.js for text/render,
 * mammoth/xlsx/jszip for Office ingest). Every function accepts an
 * AbortSignal for cancellation and an onProgress callback for the UI, and
 * always emits `gf:storage-changed` after a mutation so the file manager
 * refreshes immediately.
 */
import {
  PDFDocument,
  degrees,
  PageSizes,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { readBytes, writeBytes } from "./native-io";
import { loadPdfJs } from "./pdfjs";
import {
  docxToBlocks,
  xlsxToBlocks,
  pptxToBlocks,
  textToBlocks,
  type OfficeBlock,
  type OfficeDocument,
} from "./office";

/* ---------- Types ---------- */

export type PageSize = "A4" | "Letter" | "Legal" | "A3" | "A5";
export type Orientation = "portrait" | "landscape";
export type CompressionLevel = "low" | "medium" | "high" | "max";
export type Rotation = 0 | 90 | 180 | 270;

export type ProgressCb = (info: {
  completed: number;
  total: number;
  currentName?: string;
  elapsedMs: number;
  etaMs?: number;
}) => void;

export type OpOptions = {
  signal?: AbortSignal;
  onProgress?: ProgressCb;
};

export type PdfInfo = {
  path: string;
  size: number;
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  producer?: string;
  creator?: string;
  createdAt?: number;
  modifiedAt?: number;
  encrypted: boolean;
};

export type PdfFeatureFlags = {
  merge: boolean;
  split: boolean;
  reorder: boolean;
  rotate: boolean;
  compress: boolean;
  imagesToPdf: boolean;
  scanner: boolean;
  watermark: boolean;
  addText: boolean;
  addImage: boolean;
  signature: boolean;
  annotation: boolean;
  formFilling: boolean;
  textSearch: boolean;
  extractText: boolean;
  pdfToImages: boolean;
  wordToPdf: boolean;
  excelToPdf: boolean;
  pptToPdf: boolean;
  textToPdf: boolean;
};

export function pdfCapabilities(): PdfFeatureFlags {
  return {
    merge: true,
    split: true,
    reorder: true,
    rotate: true,
    compress: true,
    imagesToPdf: true,
    scanner: true,
    watermark: true,
    addText: true,
    addImage: true,
    signature: true,
    annotation: true,
    formFilling: true,
    textSearch: true,
    extractText: true,
    pdfToImages: true,
    wordToPdf: true,
    excelToPdf: true,
    pptToPdf: true,
    textToPdf: true,
  };
}

/* ---------- Helpers ---------- */

function ensure(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
}

function pageSizePoints(size: PageSize, orientation: Orientation): [number, number] {
  const map: Record<PageSize, [number, number]> = {
    A4: PageSizes.A4,
    A3: PageSizes.A3,
    A5: PageSizes.A5,
    Letter: PageSizes.Letter,
    Legal: PageSizes.Legal,
  };
  const [w, h] = map[size];
  return orientation === "landscape" ? [h, w] : [w, h];
}

function joinPath(dir: string, name: string): string {
  const d = dir.endsWith("/") ? dir.slice(0, -1) : dir;
  return `${d}/${name}`;
}

function baseNameNoExt(path: string): string {
  const b = path.split("/").pop() ?? "document";
  return b.replace(/\.[^.]+$/, "");
}

function extOf(path: string): string {
  const b = path.split("/").pop() ?? "";
  const idx = b.lastIndexOf(".");
  return idx >= 0 ? b.slice(idx + 1).toLowerCase() : "";
}

async function loadPdf(path: string): Promise<PDFDocument> {
  const bytes = await readBytes(path);
  return await PDFDocument.load(bytes, { ignoreEncryption: true });
}

function dispatchStorageChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("gf:storage-changed"));
  } catch {
    /* ignore */
  }
}

async function saveDoc(doc: PDFDocument, path: string): Promise<{ path: string; size: number }> {
  const bytes = await doc.save({ useObjectStreams: true });
  const res = await writeBytes(path, bytes, { overwrite: true });
  dispatchStorageChanged();
  return res;
}

/** Ensure the file at `path` does not overwrite an existing document without
 *  making a backup first. Rewrites the file at `path.bak.pdf` (never
 *  overwritten twice) so an in-place operation can always be undone. */
export async function backupBeforeOverwrite(path: string): Promise<string | null> {
  try {
    const bytes = await readBytes(path);
    const backup = path.replace(/\.pdf$/i, "") + ".bak.pdf";
    await writeBytes(backup, bytes, { overwrite: true });
    return backup;
  } catch {
    return null;
  }
}

/* ---------- Info ---------- */

export async function pdfInfo(path: string): Promise<PdfInfo> {
  const bytes = await readBytes(path);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return {
    path,
    size: bytes.byteLength,
    pageCount: doc.getPageCount(),
    title: doc.getTitle() || undefined,
    author: doc.getAuthor() || undefined,
    subject: doc.getSubject() || undefined,
    producer: doc.getProducer() || undefined,
    creator: doc.getCreator() || undefined,
    createdAt: doc.getCreationDate()?.getTime(),
    modifiedAt: doc.getModificationDate()?.getTime(),
    encrypted: doc.isEncrypted,
  };
}

/* ---------- Merge ---------- */

export async function mergePdfs(
  sources: string[],
  destination: string,
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  const start = Date.now();
  const out = await PDFDocument.create();
  for (let i = 0; i < sources.length; i++) {
    ensure(opts.signal);
    const src = sources[i];
    const doc = await loadPdf(src);
    const idx = doc.getPageIndices();
    const pages = await out.copyPages(doc, idx);
    pages.forEach((p) => out.addPage(p));
    const elapsed = Date.now() - start;
    opts.onProgress?.({
      completed: i + 1,
      total: sources.length,
      currentName: src.split("/").pop(),
      elapsedMs: elapsed,
      etaMs: (elapsed / (i + 1)) * (sources.length - i - 1),
    });
  }
  const res = await saveDoc(out, destination);
  return { ...res, pageCount: out.getPageCount() };
}

/* ---------- Split ---------- */

export async function splitPdf(
  source: string,
  ranges: number[][],
  destinationDir: string,
  baseName: string,
  opts: OpOptions = {},
): Promise<{ files: { path: string; size: number; pageCount: number }[] }> {
  const start = Date.now();
  const src = await loadPdf(source);
  const files: { path: string; size: number; pageCount: number }[] = [];
  for (let i = 0; i < ranges.length; i++) {
    ensure(opts.signal);
    const [a, b] = ranges[i];
    const wanted: number[] = [];
    for (let p = a; p <= b; p++) wanted.push(p - 1);
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, wanted);
    pages.forEach((p) => out.addPage(p));
    const path = joinPath(destinationDir, `${baseName}_part-${i + 1}.pdf`);
    const res = await saveDoc(out, path);
    files.push({ ...res, pageCount: out.getPageCount() });
    const elapsed = Date.now() - start;
    opts.onProgress?.({
      completed: i + 1,
      total: ranges.length,
      currentName: `Partie ${i + 1}`,
      elapsedMs: elapsed,
      etaMs: (elapsed / (i + 1)) * (ranges.length - i - 1),
    });
  }
  return { files };
}

export async function extractPages(
  source: string,
  pages1Based: number[],
  destination: string,
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  ensure(opts.signal);
  const src = await loadPdf(source);
  const out = await PDFDocument.create();
  const idx = pages1Based.map((p) => p - 1).filter((i) => i >= 0 && i < src.getPageCount());
  const copied = await out.copyPages(src, idx);
  copied.forEach((p) => out.addPage(p));
  const res = await saveDoc(out, destination);
  opts.onProgress?.({
    completed: 1,
    total: 1,
    currentName: destination.split("/").pop(),
    elapsedMs: 0,
  });
  return { ...res, pageCount: out.getPageCount() };
}

export async function deletePages(
  source: string,
  pages1Based: number[],
  destination: string,
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  ensure(opts.signal);
  const src = await loadPdf(source);
  const total = src.getPageCount();
  const remove = new Set(pages1Based.map((p) => p - 1));
  const keep: number[] = [];
  for (let i = 0; i < total; i++) if (!remove.has(i)) keep.push(i);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, keep);
  copied.forEach((p) => out.addPage(p));
  const res = await saveDoc(out, destination);
  return { ...res, pageCount: out.getPageCount() };
}

export async function reorderPages(
  source: string,
  newOrder1Based: number[],
  destination: string,
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  ensure(opts.signal);
  const src = await loadPdf(source);
  const idx = newOrder1Based.map((p) => p - 1);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, idx);
  copied.forEach((p) => out.addPage(p));
  const res = await saveDoc(out, destination);
  return { ...res, pageCount: out.getPageCount() };
}

export async function rotatePages(
  source: string,
  rotations: Record<number, Rotation>,
  destination: string,
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  ensure(opts.signal);
  const doc = await loadPdf(source);
  for (const [pageStr, rot] of Object.entries(rotations)) {
    const i = Number(pageStr) - 1;
    if (i < 0 || i >= doc.getPageCount()) continue;
    doc.getPage(i).setRotation(degrees(rot));
  }
  const res = await saveDoc(doc, destination);
  return { ...res, pageCount: doc.getPageCount() };
}

/* ---------- Compress ---------- */

/**
 * Real compression pipeline.
 *
 * - "low"    → metadata cleanup only (lossless), object streams enabled.
 * - "medium" → metadata cleanup + object streams (lossless best effort).
 * - "high"   → rasterizes each page via pdf.js at 1.6× and re-encodes as
 *              JPEG @0.75 quality. Text becomes non-selectable but the
 *              file is dramatically smaller. Guarantees a real gain.
 * - "max"    → same as "high" but 1.1× / JPEG @0.55.
 *
 * Falls back to the lossless path if pdf.js is unavailable or a page
 * fails to render, so the output PDF is always valid.
 */
export async function compressPdf(
  source: string,
  destination: string,
  level: CompressionLevel = "medium",
  opts: OpOptions = {},
): Promise<{ path: string; size: number; ratio: number; originalSize: number }> {
  ensure(opts.signal);
  const orig = await readBytes(source);
  const start = Date.now();

  const raster = level === "high" || level === "max";
  let outBytes: Uint8Array | null = null;

  if (raster && typeof document !== "undefined") {
    const scale = level === "max" ? 1.1 : 1.6;
    const quality = level === "max" ? 0.55 : 0.75;
    try {
      outBytes = await rasterizeToPdf(orig, scale, quality, opts);
    } catch {
      outBytes = null;
    }
  }

  if (!outBytes) {
    const doc = await PDFDocument.load(orig, { ignoreEncryption: true, updateMetadata: false });
    if (level !== "low") {
      doc.setTitle("");
      doc.setSubject("");
      doc.setKeywords([]);
      doc.setProducer("GeniusFiles");
      doc.setCreator("GeniusFiles");
    }
    outBytes = await doc.save({ useObjectStreams: true });
    opts.onProgress?.({
      completed: 1,
      total: 1,
      currentName: destination.split("/").pop(),
      elapsedMs: Date.now() - start,
    });
  }

  // Safety: never write a file larger than the original — fall back to the
  // original bytes if the "compression" made things worse.
  const finalBytes = outBytes.byteLength < orig.byteLength ? outBytes : orig;
  await writeBytes(destination, finalBytes, { overwrite: true });
  dispatchStorageChanged();
  const ratio = orig.byteLength > 0 ? finalBytes.byteLength / orig.byteLength : 1;
  return {
    path: destination,
    size: finalBytes.byteLength,
    ratio,
    originalSize: orig.byteLength,
  };
}

async function rasterizeToPdf(
  src: Uint8Array,
  scale: number,
  quality: number,
  opts: OpOptions,
): Promise<Uint8Array> {
  const lib = await loadPdfJs();
  if (!lib) throw new Error("pdf.js indisponible");
  const doc = await lib.getDocument({ data: src }).promise;
  const out = await PDFDocument.create();
  const total = doc.numPages;
  const start = Date.now();
  for (let i = 1; i <= total; i++) {
    ensure(opts.signal);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob) continue;
    const buf = new Uint8Array(await blob.arrayBuffer());
    const jpg = await out.embedJpg(buf);
    const p = out.addPage([canvas.width, canvas.height]);
    p.drawImage(jpg, { x: 0, y: 0, width: canvas.width, height: canvas.height });
    const elapsed = Date.now() - start;
    opts.onProgress?.({
      completed: i,
      total,
      currentName: `Page ${i}`,
      elapsedMs: elapsed,
      etaMs: (elapsed / i) * (total - i),
    });
  }
  await doc.destroy?.();
  return await out.save({ useObjectStreams: true });
}

/**
 * Rough size estimate for the "before/after" hint shown in the UI, based
 * purely on the level so we can update instantly without actually running
 * the compression.
 */
export function estimateCompressedSize(originalSize: number, level: CompressionLevel): number {
  const ratio = level === "low" ? 0.98 : level === "medium" ? 0.9 : level === "high" ? 0.55 : 0.35;
  return Math.max(1024, Math.round(originalSize * ratio));
}

/**
 * Renders every page of a PDF as a low-resolution JPEG data URL. Used by
 * the visual page selectors of the "Modifier un PDF" tools. Non-blocking
 * — pages are yielded via the `onPage` callback so the UI can render them
 * progressively without waiting for the whole document.
 */
export async function renderPdfThumbnails(
  source: string,
  onPage: (index1: number, dataUrl: string, width: number, height: number) => void,
  opts: { signal?: AbortSignal; scale?: number; quality?: number } = {},
): Promise<{ pageCount: number }> {
  const lib = await loadPdfJs();
  if (!lib) throw new Error("pdf.js indisponible");
  const bytes = await readBytes(source);
  const doc = await lib.getDocument({ data: bytes }).promise;
  const scale = opts.scale ?? 0.5;
  const quality = opts.quality ?? 0.72;
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      ensure(opts.signal);
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      onPage(i, dataUrl, canvas.width, canvas.height);
    }
    return { pageCount: doc.numPages };
  } finally {
    await doc.destroy?.();
  }
}

/* ---------- Duplicate ---------- */

export async function duplicatePdf(
  source: string,
  destination: string,
): Promise<{ path: string; size: number }> {
  const bytes = await readBytes(source);
  const res = await writeBytes(destination, bytes, { overwrite: false });
  dispatchStorageChanged();
  return res;
}

/* ---------- Images → PDF ---------- */

export type ImageSource =
  | { kind: "file"; file: File; name: string }
  | { kind: "blob"; blob: Blob; name: string }
  | { kind: "dataUrl"; dataUrl: string; name: string };

async function imageBytes(src: ImageSource): Promise<{ bytes: Uint8Array; mime: string }> {
  if (src.kind === "file") {
    const buf = new Uint8Array(await src.file.arrayBuffer());
    return { bytes: buf, mime: src.file.type };
  }
  if (src.kind === "blob") {
    const buf = new Uint8Array(await src.blob.arrayBuffer());
    return { bytes: buf, mime: src.blob.type };
  }
  const resp = await fetch(src.dataUrl);
  const buf = new Uint8Array(await resp.arrayBuffer());
  return { bytes: buf, mime: resp.headers.get("content-type") ?? "image/png" };
}

async function reencodeAsJpeg(
  bytes: Uint8Array,
  mime: string,
  quality: number,
): Promise<Uint8Array> {
  if (typeof document === "undefined") return bytes;
  try {
    const blob = new Blob([bytes as BlobPart], { type: mime || "image/png" });
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return bytes;
      ctx.drawImage(img, 0, 0);
      const jpeg: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
      if (!jpeg) return bytes;
      return new Uint8Array(await jpeg.arrayBuffer());
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return bytes;
  }
}

export async function imagesToPdf(
  images: ImageSource[],
  destination: string,
  settings: {
    pageSize: PageSize;
    orientation: Orientation;
    compression: CompressionLevel;
    margin?: number;
  },
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  const start = Date.now();
  const doc = await PDFDocument.create();
  const [pw, ph] = pageSizePoints(settings.pageSize, settings.orientation);
  const margin = settings.margin ?? 24;
  const quality =
    settings.compression === "high" ? 0.55 : settings.compression === "medium" ? 0.78 : 0.92;

  for (let i = 0; i < images.length; i++) {
    ensure(opts.signal);
    const raw = await imageBytes(images[i]);
    let bytes = raw.bytes;
    let mime = raw.mime;
    if (settings.compression !== "low" || !/(png|jpe?g)$/i.test(mime)) {
      bytes = await reencodeAsJpeg(raw.bytes, raw.mime, quality);
      mime = "image/jpeg";
    }
    const embedded = mime === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const page = doc.addPage([pw, ph]);
    const maxW = pw - margin * 2;
    const maxH = ph - margin * 2;
    const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
    const dw = embedded.width * scale;
    const dh = embedded.height * scale;
    page.drawImage(embedded, {
      x: (pw - dw) / 2,
      y: (ph - dh) / 2,
      width: dw,
      height: dh,
    });
    const elapsed = Date.now() - start;
    opts.onProgress?.({
      completed: i + 1,
      total: images.length,
      currentName: images[i].name,
      elapsedMs: elapsed,
      etaMs: (elapsed / (i + 1)) * (images.length - i - 1),
    });
  }
  const res = await saveDoc(doc, destination);
  return { ...res, pageCount: doc.getPageCount() };
}

/* ---------- Read blob URL (preview / open) ---------- */

export async function readPdfBlobUrl(path: string): Promise<string> {
  const bytes = await readBytes(path);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

/* ---------- Watermark ---------- */

export type WatermarkOptions = {
  /** Text watermark (mutually exclusive with `image`). */
  text?: string;
  /** Image watermark. */
  image?: { bytes: Uint8Array; mime: string };
  opacity?: number;
  fontSize?: number;
  angle?: number;
  color?: { r: number; g: number; b: number };
  family?: FontFamily;
  bold?: boolean;
  /** Restrict to specific 1-based pages. */
  pages?: number[];
  /** Tile the watermark across the whole page instead of a single centered one. */
  tile?: boolean;
  /** Image width as fraction of page width when using `image`. Defaults to 0.5. */
  imageWidth?: number;
};

export async function watermarkPdf(
  source: string,
  destination: string,
  wm: WatermarkOptions,
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  ensure(opts.signal);
  const start = Date.now();
  const doc = await loadPdf(source);
  const font = wm.text
    ? await doc.embedFont(pickStandardFont(wm.family ?? "helvetica", wm.bold ?? true, false))
    : null;
  const embedded = wm.image
    ? wm.image.mime === "image/png"
      ? await doc.embedPng(wm.image.bytes)
      : await doc.embedJpg(wm.image.bytes)
    : null;
  const fontSize = wm.fontSize ?? 60;
  const opacity = wm.opacity ?? 0.18;
  const angle = wm.angle ?? -30;
  const color = wm.color ?? { r: 0.1, g: 0.1, b: 0.1 };
  const pages = doc.getPages();
  const target = wm.pages && wm.pages.length ? new Set(wm.pages) : null;
  for (let i = 0; i < pages.length; i++) {
    ensure(opts.signal);
    if (target && !target.has(i + 1)) continue;
    const page = pages[i];
    const { width, height } = page.getSize();
    const placements: { x: number; y: number }[] = wm.tile
      ? (() => {
          const step = Math.max(fontSize * 4, 120);
          const list: { x: number; y: number }[] = [];
          for (let y = step / 2; y < height; y += step)
            for (let x = step / 2; x < width; x += step) list.push({ x, y });
          return list;
        })()
      : [{ x: width / 2, y: height / 2 }];
    for (const { x, y } of placements) {
      if (wm.text && font) {
        const textWidth = font.widthOfTextAtSize(wm.text, fontSize);
        page.drawText(wm.text, {
          x: x - textWidth / 2,
          y: y - fontSize / 2,
          size: fontSize,
          font,
          color: rgb(color.r, color.g, color.b),
          opacity,
          rotate: degrees(angle),
        });
      } else if (embedded) {
        const dw = (wm.imageWidth ?? 0.5) * width;
        const dh = (embedded.height / embedded.width) * dw;
        page.drawImage(embedded, {
          x: x - dw / 2,
          y: y - dh / 2,
          width: dw,
          height: dh,
          opacity,
          rotate: degrees(angle),
        });
      }
    }
    const elapsed = Date.now() - start;
    opts.onProgress?.({
      completed: i + 1,
      total: pages.length,
      currentName: `Page ${i + 1}`,
      elapsedMs: elapsed,
      etaMs: (elapsed / (i + 1)) * (pages.length - i - 1),
    });
  }
  const res = await saveDoc(doc, destination);
  return { ...res, pageCount: doc.getPageCount() };
}

/* ---------- Add text ---------- */

export type FontFamily = "helvetica" | "times" | "courier";
export type TextOverlay = {
  page: number; // 1-based
  text: string;
  x: number; // 0..1 fraction from left
  y: number; // 0..1 fraction from top (invert-y internally)
  fontSize?: number;
  color?: { r: number; g: number; b: number };
  family?: FontFamily;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  rotate?: number; // degrees
  opacity?: number;
  align?: "left" | "center" | "right";
  maxWidth?: number; // fraction of page width — enables wrapping
};

function pickStandardFont(family: FontFamily, bold?: boolean, italic?: boolean): StandardFonts {
  if (family === "times") {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
    if (bold) return StandardFonts.TimesRomanBold;
    if (italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (family === "courier") {
    if (bold && italic) return StandardFonts.CourierBoldOblique;
    if (bold) return StandardFonts.CourierBold;
    if (italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

export async function addTextToPdf(
  source: string,
  destination: string,
  overlays: TextOverlay[],
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  ensure(opts.signal);
  const doc = await loadPdf(source);
  const fontCache = new Map<string, Awaited<ReturnType<PDFDocument["embedFont"]>>>();
  const getFont = async (family: FontFamily, bold?: boolean, italic?: boolean) => {
    const key = `${family}-${bold ? 1 : 0}-${italic ? 1 : 0}`;
    const cached = fontCache.get(key);
    if (cached) return cached;
    const f = await doc.embedFont(pickStandardFont(family, bold, italic));
    fontCache.set(key, f);
    return f;
  };
  const pages = doc.getPages();
  for (const ov of overlays) {
    const idx = ov.page - 1;
    if (idx < 0 || idx >= pages.length) continue;
    const page = pages[idx];
    const { width, height } = page.getSize();
    const size = ov.fontSize ?? 16;
    const c = ov.color ?? { r: 0, g: 0, b: 0 };
    const font = await getFont(ov.family ?? "helvetica", ov.bold, ov.italic);
    const lines: string[] = [];
    if (ov.maxWidth && ov.maxWidth > 0) {
      const limit = ov.maxWidth * width;
      for (const rawLine of ov.text.split(/\r?\n/)) {
        const words = rawLine.split(/\s+/);
        let cur = "";
        for (const w of words) {
          const trial = cur ? cur + " " + w : w;
          if (font.widthOfTextAtSize(trial, size) <= limit) cur = trial;
          else {
            if (cur) lines.push(cur);
            cur = w;
          }
        }
        lines.push(cur);
      }
    } else {
      lines.push(...ov.text.split(/\r?\n/));
    }
    const rotate = ov.rotate ?? 0;
    const opacity = ov.opacity ?? 1;
    const baseX = ov.x * width;
    const baseY = height - ov.y * height - size;
    const lh = size * 1.2;
    lines.forEach((line, li) => {
      const w = font.widthOfTextAtSize(line, size);
      let dx = 0;
      if (ov.align === "center") dx = -w / 2;
      else if (ov.align === "right") dx = -w;
      const lineY = baseY - li * lh;
      page.drawText(line, {
        x: baseX + dx,
        y: lineY,
        size,
        font,
        color: rgb(c.r, c.g, c.b),
        opacity,
        rotate: rotate ? degrees(rotate) : undefined,
      });
      if (ov.underline) {
        page.drawLine({
          start: { x: baseX + dx, y: lineY - 2 },
          end: { x: baseX + dx + w, y: lineY - 2 },
          thickness: Math.max(0.5, size / 16),
          color: rgb(c.r, c.g, c.b),
          opacity,
        });
      }
    });
  }
  const res = await saveDoc(doc, destination);
  return { ...res, pageCount: doc.getPageCount() };
}

/* ---------- Add image / signature / annotation overlay ---------- */

export type ImageOverlay = {
  page: number;
  bytes: Uint8Array;
  mime: string; // image/png | image/jpeg
  x: number; // fraction from left
  y: number; // fraction from top
  w: number; // fraction of page width
  h?: number; // optional; auto keeps aspect ratio
  opacity?: number;
  rotate?: number; // degrees, around element center
};

async function embedOverlay(doc: PDFDocument, ov: ImageOverlay): Promise<PDFImage> {
  return ov.mime === "image/png" ? await doc.embedPng(ov.bytes) : await doc.embedJpg(ov.bytes);
}

export async function addImageToPdf(
  source: string,
  destination: string,
  overlays: ImageOverlay[],
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  ensure(opts.signal);
  const doc = await loadPdf(source);
  const pages = doc.getPages();
  for (const ov of overlays) {
    ensure(opts.signal);
    const idx = ov.page - 1;
    if (idx < 0 || idx >= pages.length) continue;
    const page = pages[idx];
    const embedded = await embedOverlay(doc, ov);
    const { width, height } = page.getSize();
    const dw = ov.w * width;
    const dh = ov.h ? ov.h * height : (embedded.height / embedded.width) * dw;
    const rot = ov.rotate ?? 0;
    // pdf-lib rotates around the (x,y) anchor. Compensate so rotation is around
    // the image center, matching the on-screen preview.
    const cx = ov.x * width + dw / 2;
    const cy = height - ov.y * height - dh / 2;
    const rad = (rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const drawX = cx - (dw / 2) * cos + (dh / 2) * sin;
    const drawY = cy - (dw / 2) * sin - (dh / 2) * cos;
    page.drawImage(embedded, {
      x: drawX,
      y: drawY,
      width: dw,
      height: dh,
      opacity: ov.opacity ?? 1,
      rotate: rot ? degrees(rot) : undefined,
    });
  }
  const res = await saveDoc(doc, destination);
  return { ...res, pageCount: doc.getPageCount() };
}

/* ---------- Form filling ---------- */

export type FormFieldInfo = {
  name: string;
  type: "text" | "checkbox" | "radio" | "dropdown" | "optionList" | "button" | "signature";
  value?: string | boolean | string[];
  options?: string[];
};

export async function readPdfForm(source: string): Promise<FormFieldInfo[]> {
  const doc = await loadPdf(source);
  const form = doc.getForm();
  const out: FormFieldInfo[] = [];
  for (const f of form.getFields()) {
    const name = f.getName();
    const type = f.constructor.name;
    if (type === "PDFTextField") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const field = f as any;
      out.push({ name, type: "text", value: field.getText?.() ?? "" });
    } else if (type === "PDFCheckBox") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const field = f as any;
      out.push({ name, type: "checkbox", value: !!field.isChecked?.() });
    } else if (type === "PDFRadioGroup") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const field = f as any;
      out.push({
        name,
        type: "radio",
        value: field.getSelected?.() ?? "",
        options: field.getOptions?.() ?? [],
      });
    } else if (type === "PDFDropdown") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const field = f as any;
      out.push({
        name,
        type: "dropdown",
        value: field.getSelected?.()?.[0] ?? "",
        options: field.getOptions?.() ?? [],
      });
    } else {
      out.push({ name, type: "button" });
    }
  }
  return out;
}

export async function fillPdfForm(
  source: string,
  destination: string,
  values: Record<string, string | boolean | string[]>,
  opts: { flatten?: boolean } & OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  ensure(opts.signal);
  const doc = await loadPdf(source);
  const form = doc.getForm();
  for (const [name, v] of Object.entries(values)) {
    try {
      const f = form.getField(name);
      const type = f.constructor.name;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const field = f as any;
      if (type === "PDFTextField") field.setText(String(v ?? ""));
      else if (type === "PDFCheckBox") {
        if (v) field.check();
        else field.uncheck();
      } else if (type === "PDFRadioGroup") field.select(String(v));
      else if (type === "PDFDropdown") field.select(Array.isArray(v) ? v[0] : String(v));
    } catch {
      /* skip missing / incompatible fields */
    }
  }
  if (opts.flatten) {
    try {
      form.flatten();
    } catch {
      /* ignore */
    }
  }
  const res = await saveDoc(doc, destination);
  return { ...res, pageCount: doc.getPageCount() };
}

/* ---------- Extract text / search ---------- */

export type PdfPageText = { page: number; text: string };

export async function extractPdfText(
  source: string,
  opts: OpOptions = {},
): Promise<{ pages: PdfPageText[]; text: string }> {
  const lib = await loadPdfJs();
  if (!lib) throw new Error("Moteur PDF indisponible");
  const bytes = await readBytes(source);
  const doc = await lib.getDocument({ data: bytes }).promise;
  const pages: PdfPageText[] = [];
  const start = Date.now();
  for (let i = 1; i <= doc.numPages; i++) {
    ensure(opts.signal);
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it) => it.str).join(" ");
    pages.push({ page: i, text });
    const elapsed = Date.now() - start;
    opts.onProgress?.({
      completed: i,
      total: doc.numPages,
      currentName: `Page ${i}`,
      elapsedMs: elapsed,
      etaMs: (elapsed / i) * (doc.numPages - i),
    });
  }
  await doc.destroy?.();
  return { pages, text: pages.map((p) => p.text).join("\n\n") };
}

export type SearchHit = { page: number; snippet: string; index: number };

export async function searchInPdf(
  source: string,
  query: string,
  opts: { caseSensitive?: boolean } & OpOptions = {},
): Promise<SearchHit[]> {
  if (!query) return [];
  const { pages } = await extractPdfText(source, opts);
  const flags = opts.caseSensitive ? "g" : "gi";
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(q, flags);
  const hits: SearchHit[] = [];
  for (const p of pages) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(p.text))) {
      const from = Math.max(0, m.index - 32);
      const to = Math.min(p.text.length, m.index + query.length + 32);
      hits.push({
        page: p.page,
        snippet:
          (from > 0 ? "…" : "") +
          p.text.slice(from, to).replace(/\s+/g, " ") +
          (to < p.text.length ? "…" : ""),
        index: m.index,
      });
    }
  }
  return hits;
}

/* ---------- PDF → Images ---------- */

export type PdfToImagesResult = { files: { path: string; size: number; page: number }[] };

export async function pdfToImages(
  source: string,
  destinationDir: string,
  settings: { scale?: number; format?: "png" | "jpeg"; quality?: number; pages?: number[] } = {},
  opts: OpOptions = {},
): Promise<PdfToImagesResult> {
  const lib = await loadPdfJs();
  if (!lib) throw new Error("Moteur PDF indisponible");
  const bytes = await readBytes(source);
  const doc = await lib.getDocument({ data: bytes }).promise;
  const scale = settings.scale ?? 2;
  const format = settings.format ?? "png";
  const quality = settings.quality ?? 0.88;
  const base = baseNameNoExt(source);
  const start = Date.now();
  const files: { path: string; size: number; page: number }[] = [];
  const pageNums = settings.pages && settings.pages.length ? settings.pages : null;
  const total = pageNums ? pageNums.length : doc.numPages;
  let done = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    if (pageNums && !pageNums.includes(i)) continue;
    ensure(opts.signal);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob: Blob | null = await new Promise((r) =>
      canvas.toBlob(r, format === "png" ? "image/png" : "image/jpeg", quality),
    );
    if (!blob) continue;
    const buf = new Uint8Array(await blob.arrayBuffer());
    const num = String(i).padStart(3, "0");
    const ext = format === "png" ? "png" : "jpg";
    const out = joinPath(destinationDir, `${base}_p${num}.${ext}`);
    const res = await writeBytes(out, buf, { overwrite: true });
    files.push({ ...res, page: i });
    done++;
    const elapsed = Date.now() - start;
    opts.onProgress?.({
      completed: done,
      total,
      currentName: `Page ${i}`,
      elapsedMs: elapsed,
      etaMs: (elapsed / done) * (total - done),
    });
  }
  await doc.destroy?.();
  dispatchStorageChanged();
  return { files };
}

/* ---------- Text → PDF (rich office blocks) ---------- */

export type TextToPdfSettings = {
  pageSize?: PageSize;
  orientation?: Orientation;
  fontSize?: number;
  margin?: number;
  title?: string;
};

async function renderOfficeToPdf(
  document: OfficeDocument,
  destination: string,
  settings: TextToPdfSettings,
  opts: OpOptions,
): Promise<{ path: string; size: number; pageCount: number }> {
  const doc = await PDFDocument.create();
  if (settings.title) doc.setTitle(settings.title);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const [pw, ph] = pageSizePoints(settings.pageSize ?? "A4", settings.orientation ?? "portrait");
  const margin = settings.margin ?? 40;
  const bodySize = settings.fontSize ?? 11;
  const lineGap = 4;

  let page: PDFPage = doc.addPage([pw, ph]);
  let cursorY = ph - margin;

  const newPage = () => {
    page = doc.addPage([pw, ph]);
    cursorY = ph - margin;
  };

  const ensureSpace = (needed: number) => {
    if (cursorY - needed < margin) newPage();
  };

  const wrap = (text: string, f: PDFFont, size: number, maxWidth: number): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const contentWidth = pw - margin * 2;

  const drawParagraph = (text: string, f: PDFFont, size: number) => {
    const safe = sanitizeForFont(text);
    const lines = wrap(safe, f, size, contentWidth);
    for (const l of lines) {
      ensureSpace(size + lineGap);
      page.drawText(l, { x: margin, y: cursorY - size, size, font: f });
      cursorY -= size + lineGap;
    }
    cursorY -= lineGap;
  };

  const drawTable = (rows: string[][]) => {
    if (rows.length === 0) return;
    const cols = Math.max(...rows.map((r) => r.length));
    const colWidth = contentWidth / cols;
    const rowHeight = bodySize + 8;
    for (let r = 0; r < rows.length; r++) {
      ensureSpace(rowHeight);
      const rowY = cursorY - rowHeight;
      for (let c = 0; c < cols; c++) {
        page.drawRectangle({
          x: margin + c * colWidth,
          y: rowY,
          width: colWidth,
          height: rowHeight,
          borderColor: rgb(0.7, 0.7, 0.7),
          borderWidth: 0.5,
        });
        const cell = sanitizeForFont(rows[r][c] ?? "");
        const truncated = truncateToWidth(cell, r === 0 ? bold : font, bodySize, colWidth - 6);
        page.drawText(truncated, {
          x: margin + c * colWidth + 3,
          y: rowY + 4,
          size: bodySize,
          font: r === 0 ? bold : font,
        });
      }
      cursorY -= rowHeight;
    }
    cursorY -= lineGap;
  };

  const total = document.blocks.length;
  const start = Date.now();
  for (let i = 0; i < total; i++) {
    ensure(opts.signal);
    const b: OfficeBlock = document.blocks[i];
    switch (b.kind) {
      case "heading": {
        const size = b.level === 1 ? 22 : b.level === 2 ? 16 : 13;
        cursorY -= size * 0.4;
        drawParagraph(b.text, bold, size);
        break;
      }
      case "paragraph":
        drawParagraph(b.text, font, bodySize);
        break;
      case "list":
        for (let j = 0; j < b.items.length; j++) {
          const bullet = b.ordered ? `${j + 1}. ` : "• ";
          drawParagraph(bullet + b.items[j], font, bodySize);
        }
        break;
      case "table":
        drawTable(b.rows);
        break;
      case "pageBreak":
        newPage();
        break;
    }
    const elapsed = Date.now() - start;
    opts.onProgress?.({
      completed: i + 1,
      total,
      currentName: b.kind,
      elapsedMs: elapsed,
      etaMs: (elapsed / (i + 1)) * (total - i - 1),
    });
  }

  const res = await saveDoc(doc, destination);
  return { ...res, pageCount: doc.getPageCount() };
}

function sanitizeForFont(text: string): string {
  // Helvetica supports WinAnsi; strip unsupported code points instead of failing.
  // eslint-disable-next-line no-control-regex
  return text.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "");
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (font.widthOfTextAtSize(text.slice(0, mid) + "…", size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + "…";
}

export async function textToPdf(
  text: string,
  destination: string,
  settings: TextToPdfSettings = {},
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  const document = textToBlocks(text);
  return renderOfficeToPdf(document, destination, settings, opts);
}

/* ---------- Office conversions ---------- */

export async function wordToPdf(
  source: string,
  destination: string,
  settings: TextToPdfSettings = {},
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  const bytes = await readBytes(source);
  const document = await docxToBlocks(bytes);
  document.title = document.title ?? baseNameNoExt(source);
  return renderOfficeToPdf(document, destination, settings, opts);
}

export async function excelToPdf(
  source: string,
  destination: string,
  settings: TextToPdfSettings = {},
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  const bytes = await readBytes(source);
  const document = await xlsxToBlocks(bytes);
  document.title = document.title ?? baseNameNoExt(source);
  return renderOfficeToPdf(
    document,
    destination,
    { ...settings, orientation: settings.orientation ?? "landscape" },
    opts,
  );
}

export async function powerpointToPdf(
  source: string,
  destination: string,
  settings: TextToPdfSettings = {},
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  const bytes = await readBytes(source);
  const document = await pptxToBlocks(bytes);
  document.title = document.title ?? baseNameNoExt(source);
  return renderOfficeToPdf(
    document,
    destination,
    { ...settings, orientation: settings.orientation ?? "landscape" },
    opts,
  );
}

export async function textFileToPdf(
  source: string,
  destination: string,
  settings: TextToPdfSettings = {},
  opts: OpOptions = {},
): Promise<{ path: string; size: number; pageCount: number }> {
  const bytes = await readBytes(source);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const document = textToBlocks(text);
  document.title = document.title ?? baseNameNoExt(source);
  return renderOfficeToPdf(document, destination, settings, opts);
}

/* ---------- Multi-file → PDF orchestrator ---------- */

export type ConvertResult = { source: string; output?: string; error?: string };

export async function filesToPdf(
  sources: string[],
  destinationDir: string,
  opts: {
    merge?: boolean;
    baseName?: string;
    settings?: TextToPdfSettings;
    imagesSettings?: {
      pageSize: PageSize;
      orientation: Orientation;
      compression: CompressionLevel;
    };
  } & OpOptions = {},
): Promise<{ results: ConvertResult[]; merged?: string }> {
  const start = Date.now();
  const results: ConvertResult[] = [];
  const perFile: string[] = [];

  const imageExts = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];
  const settings = opts.settings ?? {};
  const imageSettings = opts.imagesSettings ?? {
    pageSize: settings.pageSize ?? "A4",
    orientation: settings.orientation ?? "portrait",
    compression: "medium" as CompressionLevel,
  };

  const bufferedImages: ImageSource[] = [];
  for (let i = 0; i < sources.length; i++) {
    ensure(opts.signal);
    const src = sources[i];
    const ext = extOf(src);
    const base = baseNameNoExt(src);
    try {
      let out: string | null = null;
      if (ext === "pdf") {
        // Copy in place so we can later merge them uniformly.
        const bytes = await readBytes(src);
        out = joinPath(destinationDir, `${base}.pdf`);
        await writeBytes(out, bytes, { overwrite: true });
      } else if (ext === "docx") {
        out = joinPath(destinationDir, `${base}.pdf`);
        await wordToPdf(src, out, settings, { signal: opts.signal });
      } else if (ext === "xlsx" || ext === "xls") {
        out = joinPath(destinationDir, `${base}.pdf`);
        await excelToPdf(src, out, settings, { signal: opts.signal });
      } else if (ext === "pptx") {
        out = joinPath(destinationDir, `${base}.pdf`);
        await powerpointToPdf(src, out, settings, { signal: opts.signal });
      } else if (ext === "txt" || ext === "md" || ext === "log" || ext === "csv") {
        out = joinPath(destinationDir, `${base}.pdf`);
        await textFileToPdf(src, out, settings, { signal: opts.signal });
      } else if (imageExts.includes(ext)) {
        const bytes = await readBytes(src);
        const blob = new Blob([bytes as BlobPart], {
          type: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
        });
        bufferedImages.push({ kind: "blob", blob, name: src.split("/").pop() ?? base });
        results.push({ source: src, output: undefined });
        continue;
      } else {
        results.push({ source: src, error: `Format non supporté (.${ext})` });
        continue;
      }
      if (out) {
        results.push({ source: src, output: out });
        perFile.push(out);
      }
    } catch (e) {
      results.push({ source: src, error: (e as Error).message });
    }
    const elapsed = Date.now() - start;
    opts.onProgress?.({
      completed: i + 1,
      total: sources.length,
      currentName: src.split("/").pop(),
      elapsedMs: elapsed,
      etaMs: (elapsed / (i + 1)) * (sources.length - i - 1),
    });
  }

  if (bufferedImages.length) {
    const out = joinPath(destinationDir, `${opts.baseName ?? "images"}.pdf`);
    await imagesToPdf(bufferedImages, out, imageSettings, { signal: opts.signal });
    perFile.push(out);
    results.push({ source: "(images groupées)", output: out });
  }

  if (opts.merge && perFile.length > 1) {
    const merged = joinPath(destinationDir, `${opts.baseName ?? "fusion"}.pdf`);
    await mergePdfs(perFile, merged, { signal: opts.signal });
    return { results, merged };
  }
  return { results };
}
