/**
 * Extracteurs d'analyse — texte, PDF, OCR, image, média.
 *
 * Chaque extracteur retourne un résultat partiel (`Partial<AnalysisRecord>`)
 * et n'importe jamais directement une bibliothèque optionnelle : les
 * dépendances lourdes (pdf.js, tesseract) sont chargées à la demande via
 * `import()` et échouent gracieusement si absentes, en retombant sur une
 * alternative locale (métadonnées + nom de fichier).
 *
 * Le but est de rester rapide, hors ligne quand possible, et respectueux
 * de la vie privée : aucune donnée ne quitte l'appareil.
 */
import { sourceUrlOf } from "@/lib/viewer/source";
import { loadTextFile, TEXT_HARD_LIMIT } from "@/lib/viewer/text";
import type { FileEntry, PathRef } from "@/lib/files/types";
import type {
  AnalysisRecord,
  ContentAnalysis,
  DocType,
  ImageAnalysis,
  MediaMetadata,
} from "./types";
import { guessLang, topKeywords } from "./tokenize";
import { capabilityAvailable } from "./capabilities";

/* ------------------------------------------------------------------ *
 * Contenu texte / code / CSV                                         *
 * ------------------------------------------------------------------ */

const TEXT_EXTS = new Set([
  "txt",
  "md",
  "log",
  "csv",
  "json",
  "xml",
  "yml",
  "yaml",
  "html",
  "css",
  "js",
  "ts",
  "tsx",
  "jsx",
  "py",
  "java",
  "kt",
  "c",
  "cpp",
  "h",
  "go",
  "rs",
  "sh",
  "ini",
  "toml",
]);

const CODE_EXTS = new Set([
  "js",
  "ts",
  "tsx",
  "jsx",
  "py",
  "java",
  "kt",
  "c",
  "cpp",
  "h",
  "go",
  "rs",
  "sh",
  "json",
  "xml",
  "yml",
  "yaml",
  "html",
  "css",
]);

export function isTextExt(ext?: string): boolean {
  return !!ext && TEXT_EXTS.has(ext.toLowerCase());
}

async function readSourceText(parent: PathRef, entry: FileEntry, maxBytes = TEXT_HARD_LIMIT) {
  const url = sourceUrlOf(parent, entry);
  if (!url) return null;
  const res = await loadTextFile(url, maxBytes);
  if (!res.ok) return null;
  return res;
}

export async function extractText(
  parent: PathRef,
  entry: FileEntry,
): Promise<ContentAnalysis | null> {
  const res = await readSourceText(parent, entry);
  if (!res) return null;
  const source: ContentAnalysis["source"] = CODE_EXTS.has(entry.ext ?? "")
    ? "code"
    : entry.ext === "csv"
      ? "csv"
      : "plain";
  return buildContent(res.content, res.truncated, source, entry);
}

/* ------------------------------------------------------------------ *
 * PDF — pdf.js chargé à la demande                                    *
 * ------------------------------------------------------------------ */

let pdfLibPromise: Promise<unknown> | null = null;
async function loadPdfLib(): Promise<{
  getDocument: (opts: { data: ArrayBuffer }) => { promise: Promise<PdfDoc> };
} | null> {
  if (typeof window === "undefined") return null;
  if (!pdfLibPromise) {
    // Chargement dynamique — protégé par try/catch : si pdf.js n'est pas
    // installé, on retombe silencieusement sur le nom du fichier.
    // Le specifier est construit à l'exécution pour empêcher Vite de tenter
    // une résolution statique (échec 500 si la peer dep n'est pas installée).
    const spec = ["pdfjs-dist", "legacy/build/pdf.mjs"].join("/");
    pdfLibPromise = import(/* @vite-ignore */ spec).catch(() => null);
  }
  const mod = (await pdfLibPromise) as {
    getDocument: (opts: { data: ArrayBuffer }) => { promise: Promise<PdfDoc> };
  } | null;
  return mod ?? null;
}

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage> };
type PdfPage = { getTextContent: () => Promise<{ items: { str: string }[] }> };

export async function extractPdf(
  parent: PathRef,
  entry: FileEntry,
): Promise<ContentAnalysis | null> {
  if (!capabilityAvailable("pdf")) return null;
  const url = sourceUrlOf(parent, entry);
  if (!url) return null;
  try {
    const lib = await loadPdfLib();
    if (!lib) return null;
    const buf = await (await fetch(url)).arrayBuffer();
    const doc = await lib.getDocument({ data: buf }).promise;
    const pages = Math.min(doc.numPages, 50);
    let text = "";
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n\n";
      if (text.length > TEXT_HARD_LIMIT) break;
    }
    return buildContent(text, doc.numPages > 50, "pdf", entry);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * OCR — tesseract.js chargé à la demande                              *
 * ------------------------------------------------------------------ */

let ocrPromise: Promise<((url: string) => Promise<string>) | null> | null = null;
async function loadOcr(): Promise<((url: string) => Promise<string>) | null> {
  if (!capabilityAvailable("ocr")) return null;
  if (typeof window === "undefined") return null;
  if (!ocrPromise) {
    ocrPromise = (async () => {
      try {
        // Specifier construit à l'exécution — évite la résolution statique de Vite.
        const spec = ["tesseract", "js"].join(".");
        const mod = (await import(/* @vite-ignore */ spec)) as {
          recognize: (url: string, langs: string) => Promise<{ data: { text: string } }>;
        };
        return async (url: string) => {
          const res = await mod.recognize(url, "fra+eng");
          return res.data?.text ?? "";
        };
      } catch {
        return null;
      }
    })();
  }
  return ocrPromise;
}

export async function extractOcr(parent: PathRef, entry: FileEntry): Promise<string | null> {
  const url = sourceUrlOf(parent, entry);
  if (!url) return null;
  const runner = await loadOcr();
  if (!runner) return null;
  try {
    const text = await runner(url);
    return text?.trim() || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Analyse d'image (dimensions, aHash, heuristiques)                  *
 * ------------------------------------------------------------------ */

const AHASH_SIZE = 8;

async function loadImageBitmap(url: string): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof window === "undefined") return null;
  try {
    if ("createImageBitmap" in window) {
      const blob = await (await fetch(url)).blob();
      return await createImageBitmap(blob);
    }
  } catch {
    /* fallback */
  }
  return await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function computeAHash(img: ImageBitmap | HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = AHASH_SIZE;
    canvas.height = AHASH_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, AHASH_SIZE, AHASH_SIZE);
    const { data } = ctx.getImageData(0, 0, AHASH_SIZE, AHASH_SIZE);
    let sum = 0;
    const grays: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const g = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
      grays.push(g);
      sum += g;
    }
    const avg = sum / grays.length;
    let bits = "";
    for (const g of grays) bits += g >= avg ? "1" : "0";
    // pack en hex
    let hex = "";
    for (let i = 0; i < bits.length; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  } catch {
    return null;
  }
}

function heuristicsFromName(entry: FileEntry, parent: PathRef): Partial<ImageAnalysis> {
  const name = entry.name.toLowerCase();
  const path = parent.segments.join("/").toLowerCase();
  const isScreenshot =
    /screenshot|capture|screen[_-]?shot/.test(name) ||
    /screenshot|screen_shot|screenshots/.test(path);
  const isReceipt = /re[çc]u|receipt|ticket/.test(name);
  const isInvoice = /facture|invoice/.test(name);
  const isBusinessCard = /carte[_ -]?visite|business[_ -]?card|contact/.test(name);
  return { isScreenshot, isReceipt, isInvoice, isBusinessCard };
}

export async function extractImage(
  parent: PathRef,
  entry: FileEntry,
): Promise<ImageAnalysis | null> {
  const url = sourceUrlOf(parent, entry);
  if (!url) return heuristicsFromName(entry, parent);
  const img = await loadImageBitmap(url);
  const base: ImageAnalysis = { ...heuristicsFromName(entry, parent) };
  if (!img) return base;
  const width = "width" in img ? img.width : undefined;
  const height = "height" in img ? img.height : undefined;
  base.width = width;
  base.height = height;
  if (width && height) base.aspect = Math.round((width / height) * 100) / 100;
  base.aHash = computeAHash(img) ?? undefined;
  // Heuristique complémentaire : ratio quasi-A4 → document
  if (
    base.aspect &&
    (Math.abs(base.aspect - 0.707) < 0.05 || Math.abs(base.aspect - 1.414) < 0.05)
  ) {
    base.isDocument = true;
  }
  // Ratio proche 1.6/0.6 → carte de visite
  if (base.aspect && (Math.abs(base.aspect - 1.6) < 0.1 || Math.abs(base.aspect - 0.625) < 0.05)) {
    base.isBusinessCard = base.isBusinessCard || true;
  }
  // OCR opportuniste si l'image ressemble à un document
  if (
    (base.isDocument || base.isReceipt || base.isInvoice || base.isBusinessCard) &&
    capabilityAvailable("ocr")
  ) {
    const ocr = await extractOcr(parent, entry);
    if (ocr) base.ocrText = ocr;
  }
  return base;
}

/* ------------------------------------------------------------------ *
 * Audio / vidéo — métadonnées via HTMLMediaElement                    *
 * ------------------------------------------------------------------ */

export async function extractMedia(
  parent: PathRef,
  entry: FileEntry,
): Promise<MediaMetadata | null> {
  if (typeof document === "undefined") return null;
  const url = sourceUrlOf(parent, entry);
  if (!url) return null;
  const isVideo = entry.kind === "video";
  const el = document.createElement(isVideo ? "video" : "audio") as HTMLMediaElement;
  el.preload = "metadata";
  el.src = url;
  const meta: MediaMetadata = {};
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    el.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(el.duration)) meta.durationMs = Math.round(el.duration * 1000);
      if (isVideo) {
        const v = el as HTMLVideoElement;
        meta.width = v.videoWidth || undefined;
        meta.height = v.videoHeight || undefined;
      }
      finish();
    });
    el.addEventListener("error", finish);
    setTimeout(finish, 4000);
  });
  el.src = "";
  return meta;
}

/* ------------------------------------------------------------------ *
 * Classification & résumé documentaire                                *
 * ------------------------------------------------------------------ */

function classifyDocument(text: string, entry: FileEntry): DocType {
  const t = text.toLowerCase();
  const name = entry.name.toLowerCase();
  if (/\bfacture\b|\binvoice\b|\btva\b|\bmontant ttc\b/.test(t) || /facture|invoice/.test(name))
    return "facture";
  if (/\bre[çc]u\b|\bticket de caisse\b|\breceipt\b/.test(t) || /recu|receipt|ticket/.test(name))
    return "recu";
  if (/\bcontrat\b|\bconvention\b|\bcontract\b|\bagreement\b/.test(t)) return "contrat";
  if (/\bcurriculum vitae\b|\bresume\b|\bcv\b\W/.test(t) || /\bcv\b/.test(name)) return "cv";
  if (/\bcarte de visite\b|\bbusiness card\b/.test(t)) return "carte_visite";
  if (/\brapport\b|\brapport annuel\b|\breport\b/.test(t)) return "rapport";
  if (CODE_EXTS.has(entry.ext ?? "")) return "code";
  if ((entry.ext === "csv" || entry.ext === "xlsx") && /[,;\t].*[,;\t]/.test(text.slice(0, 500)))
    return "tableau";
  if (text.length > 400) return "article";
  if (text.length > 0) return "note";
  return "inconnu";
}

const CATEGORY_MAP: Record<DocType, string[]> = {
  facture: ["Finances", "Documents administratifs"],
  recu: ["Finances", "Reçus"],
  contrat: ["Documents administratifs", "Contrats"],
  cv: ["Emploi", "Personnel"],
  carte_visite: ["Contacts", "Personnel"],
  note: ["Notes"],
  article: ["Documents"],
  rapport: ["Documents", "Travail"],
  tableau: ["Tableaux", "Données"],
  code: ["Développement"],
  inconnu: [],
};

function summarize(text: string, lang: "fr" | "en" | "unknown"): string | undefined {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 120) return undefined;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
  const first = sentences.slice(0, 3).join(" ").trim();
  return first.length > 320 ? first.slice(0, 320).trimEnd() + "…" : first;
}

function buildContent(
  text: string,
  truncated: boolean,
  source: ContentAnalysis["source"],
  entry: FileEntry,
): ContentAnalysis {
  const rawLength = text.length;
  const clipped = text.length > TEXT_HARD_LIMIT ? text.slice(0, TEXT_HARD_LIMIT) : text;
  const lang = guessLang(clipped);
  const keywords = topKeywords(clipped, 10);
  const docType = classifyDocument(clipped, entry);
  const categories = CATEGORY_MAP[docType];
  const summary = summarize(clipped, lang);
  return {
    text: clipped,
    rawLength,
    truncated: truncated || rawLength > TEXT_HARD_LIMIT,
    source,
    lang,
    keywords,
    summary,
    docType,
    categories,
  };
}

/* ------------------------------------------------------------------ *
 * Orchestrateur — choisit les extracteurs pertinents pour une entrée *
 * ------------------------------------------------------------------ */

export type AnalyzeResult = Partial<Pick<AnalysisRecord, "content" | "image" | "media" | "errors">>;

export async function analyzeEntry(parent: PathRef, entry: FileEntry): Promise<AnalyzeResult> {
  const errors: string[] = [];
  const out: AnalyzeResult = {};
  try {
    if (entry.kind === "image") {
      const img = await extractImage(parent, entry);
      if (img) out.image = img;
    } else if (entry.kind === "pdf") {
      const c = await extractPdf(parent, entry);
      if (c) out.content = c;
    } else if (entry.kind === "text" || entry.kind === "code" || isTextExt(entry.ext)) {
      const c = await extractText(parent, entry);
      if (c) out.content = c;
    } else if (entry.kind === "audio" || entry.kind === "video") {
      const m = await extractMedia(parent, entry);
      if (m) out.media = m;
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  if (errors.length) out.errors = errors;
  return out;
}
