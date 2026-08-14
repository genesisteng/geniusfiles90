/**
 * Règles de catégorisation — **source de vérité unique**.
 *
 * Ce module ne dépend d'aucun autre module de l'application : il est
 * importé aussi bien par l'analyseur de stockage (tailles affichées sur
 * l'accueil) que par l'index des catégories (contenu des écrans de
 * catégorie). Les deux voient donc exactement les mêmes fichiers, avec
 * les mêmes extensions et les mêmes dossiers ignorés — impossible que
 * l'accueil annonce une taille qui ne corresponde pas au contenu réel
 * de la catégorie.
 */
import { extOf } from "./format";
import { t } from "@/lib/i18n";

export type CategoryKind = "images" | "videos" | "audio" | "documents" | "downloads";

export const CATEGORY_KINDS: readonly CategoryKind[] = [
  "images",
  "videos",
  "audio",
  "documents",
  "downloads",
];

/** Libellé traduit d'une catégorie (résolu à l'appel, jamais au chargement). */
export function categoryLabel(kind: CategoryKind): string {
  return t(`category.${kind}`);
}

export const CATEGORY_EXT: Record<Exclude<CategoryKind, "downloads">, Set<string>> = {
  images: new Set([
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "bmp",
    "heic",
    "heif",
    "tif",
    "tiff",
    "svg",
    "avif",
    "ico",
    "jfif",
  ]),
  videos: new Set([
    "mp4",
    "mkv",
    "avi",
    "mov",
    "webm",
    "3gp",
    "flv",
    "mpeg",
    "mpg",
    "m4v",
    "wmv",
    "m2ts",
    "mts",
    "ts",
  ]),
  audio: new Set([
    "mp3",
    "m4a",
    "aac",
    "flac",
    "wav",
    "ogg",
    "opus",
    "amr",
    "mid",
    "midi",
    "ape",
    "aiff",
    "aif",
    "wma",
  ]),
  documents: new Set([
    "pdf",
    "doc",
    "docx",
    "dot",
    "dotx",
    "wps",
    "txt",
    "log",
    "ini",
    "cfg",
    "conf",
    "yml",
    "yaml",
    "tsv",
    "rtf",
    "odt",
    "xls",
    "xlsx",
    "xlsm",
    "csv",
    "ppt",
    "pptx",
    "pptm",
    "odp",
    "ods",
    "odg",
    "xml",
    "json",
    "html",
    "htm",
    "md",
    "epub",
    "mobi",
  ]),
};

/** Catégories réellement déduites d'une extension (hors « downloads »). */
export const EXT_CATEGORY_KINDS: Array<Exclude<CategoryKind, "downloads">> = [
  "images",
  "videos",
  "audio",
  "documents",
];

export function matchesCategory(kind: CategoryKind, name: string): boolean {
  if (kind === "downloads") return true;
  const ext = extOf(name);
  if (!ext) return false;
  return CATEGORY_EXT[kind].has(ext);
}

/** Catégorie d'un fichier d'après son nom, ou `null` s'il n'en a aucune. */
export function categoryOfName(name: string): Exclude<CategoryKind, "downloads"> | null {
  const ext = extOf(name);
  if (!ext) return null;
  for (const k of EXT_CATEGORY_KINDS) if (CATEGORY_EXT[k].has(ext)) return k;
  return null;
}

/**
 * Dossiers strictement techniques ignorés par toutes les traversées.
 * Aucun dossier visible par l'utilisateur n'est exclu : sous /Android on
 * traverse `media` (les pièces jointes des messageries y vivent) et on
 * n'ignore que `data`/`obb`, illisibles de toute façon.
 */
const SYSTEM_CACHE_NAMES = new Set([
  "cache",
  "caches",
  ".cache",
  "code_cache",
  "thumbnails",
  ".thumbnails",
  "thumbs",
  ".thumbs",
  ".trash",
  ".trashed",
  ".trash-1000",
  "app_webview",
  "shared_prefs",
  "node_modules",
]);

export function shouldTraverseCategoryDir(name: string, parentSegments: string[]): boolean {
  const lower = name.toLowerCase();
  if (SYSTEM_CACHE_NAMES.has(lower)) return false;
  const parentIsAndroid = parentSegments[parentSegments.length - 1]?.toLowerCase() === "android";
  if (parentIsAndroid && (lower === "data" || lower === "obb")) return false;
  return true;
}
