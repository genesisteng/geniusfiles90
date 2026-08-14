/**
 * Search type contracts.
 *
 * The `SearchProvider` interface is the extension point for the upcoming
 * IA / content / OCR / semantic providers — they'll be registered against
 * the engine without touching the Recherche UI.
 */
import type { FileEntry, FileKind, PathRef, StorageRootId } from "../files/types";

export type KindFilter =
  | "any"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "pdf"
  | "text"
  | "code"
  | "apk"
  | "archive"
  | "folder";

export const KIND_FILTER_MATCH: Record<Exclude<KindFilter, "any">, FileKind[]> = {
  image: ["image"],
  video: ["video"],
  audio: ["audio"],
  document: ["document", "pdf", "text"],
  pdf: ["pdf"],
  text: ["text"],
  code: ["code"],
  apk: ["apk"],
  archive: ["archive"],
  folder: ["folder"],
};

/** MB thresholds — inclusive lower, exclusive upper. */
export type SizeBand = "any" | "lt1" | "1to10" | "10to100" | "100to1000" | "gt1000";
export const SIZE_BAND_BYTES: Record<Exclude<SizeBand, "any">, [number, number]> = {
  lt1: [0, 1_000_000],
  "1to10": [1_000_000, 10_000_000],
  "10to100": [10_000_000, 100_000_000],
  "100to1000": [100_000_000, 1_000_000_000],
  gt1000: [1_000_000_000, Number.POSITIVE_INFINITY],
};

export type DateBand = "any" | "today" | "week" | "month" | "year";
export function dateBandCutoff(band: DateBand): number | null {
  const now = new Date();
  switch (band) {
    case "today": {
      // Depuis minuit local — pas les dernières 24 h glissantes.
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return d.getTime();
    }
    case "week": {
      // Depuis lundi 00:00 local.
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dow = (d.getDay() + 6) % 7; // 0 = lundi
      d.setDate(d.getDate() - dow);
      return d.getTime();
    }
    case "month": {
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }
    case "year": {
      return new Date(now.getFullYear(), 0, 1).getTime();
    }
    default:
      return null;
  }
}

export type SearchFilters = {
  kind: KindFilter;
  size: SizeBand;
  date: DateBand;
  rootId: StorageRootId | "all";
  /** Precise bounds (bytes). When set, override the coarse `size` band. */
  sizeMinBytes?: number;
  sizeMaxBytes?: number;
  /** Precise mtime bounds (ms). When set, override the coarse `date` band. */
  mtimeMin?: number;
  mtimeMax?: number;
  /** Restrict images to a specific source (camera photos, screenshots, …). */
  imageSource?: ImageSource;
  /**
   * Strict extension whitelist (lowercase, without the dot). When set, a
   * file must match one of these extensions — directories are excluded.
   * This is the strongest filter: "uniquement des PDF" → exts: ["pdf"].
   */
  exts?: string[];
};

export const DEFAULT_FILTERS: SearchFilters = {
  kind: "any",
  size: "any",
  date: "any",
  rootId: "all",
};

export function filtersActive(f: SearchFilters): number {
  let n = 0;
  if (f.kind !== "any") n++;
  if (f.size !== "any") n++;
  if (f.date !== "any") n++;
  if (f.rootId !== "all") n++;
  if (f.sizeMinBytes != null || f.sizeMaxBytes != null) n++;
  if (f.mtimeMin != null || f.mtimeMax != null) n++;
  if (f.imageSource) n++;
  if (f.exts && f.exts.length > 0) n++;

  return n;
}

/* ---------- image sub-source classification ----------
 *
 * A single "image/jpeg" file can be a photo, a screenshot, a WhatsApp
 * sticker, a cached thumbnail… "Photos prises aujourd'hui" must never
 * surface a sticker or a cached preview. We classify each image using
 * its path segments + file name so callers can filter precisely.
 */

export type ImageSource =
  | "camera"
  | "screenshot"
  | "download"
  | "whatsapp"
  | "telegram"
  | "sticker"
  | "cache"
  | "wallpaper"
  | "other";

function segmentsLower(segments: readonly string[]): string[] {
  return segments.map((s) => s.toLowerCase());
}

export function classifyImageSource(segments: readonly string[], fileName: string): ImageSource {
  const segs = segmentsLower(segments);
  const name = fileName.toLowerCase();
  const joined = segs.join("/");

  // Stickers first — they can live under any messaging tree.
  if (segs.some((s) => s.includes("sticker")) || name.startsWith("sticker")) return "sticker";

  // Thumbnails / caches / system previews / app-private data / backups.
  // Ces segments produisent des fichiers image qui ne sont JAMAIS ce que
  // l'utilisateur appelle "mes photos".
  if (
    segs.some(
      (s) =>
        s === "cache" ||
        s === "caches" ||
        s === ".thumbnails" ||
        s === "thumbnails" ||
        s === "thumbs" ||
        s === "backup" ||
        s === "backups" ||
        s === "sauvegarde" ||
        s === "sauvegardes" ||
        s.endsWith(".cache") ||
        s.startsWith("cache_") ||
        s === "android" ||
        s === "obb",
    ) ||
    // .../Android/data/... et .../Android/media/... : contenu privé d'apps.
    joined.includes("android/data/") ||
    joined.includes("android/obb/") ||
    joined.includes("android/media/") ||
    // Fichiers WhatsApp/Telegram *Backup* : rarement des photos utiles.
    /(^|\/)(?:whatsapp|telegram)[^/]*\/(?:backups?|databases?)(\/|$)/.test(joined)
  )
    return "cache";

  // Wallpapers / lockscreen art.
  if (segs.some((s) => s.includes("wallpaper") || s.includes("lockscreen"))) return "wallpaper";

  // Messaging apps — WhatsApp / Telegram (media, not stickers).
  if (/(^|\/)whatsapp(\/|$)/.test(joined) || joined.includes("com.whatsapp")) return "whatsapp";
  if (/(^|\/)telegram(\/|$)/.test(joined) || joined.includes("org.telegram")) return "telegram";

  // Downloads.
  if (
    segs.some((s) => s === "download" || s === "downloads" || s === "telechargements") ||
    joined.startsWith("downloads/")
  )
    return "download";

  // Screenshots — must run BEFORE the camera check because some phones
  // store screenshots inside DCIM/Screenshots.
  if (
    segs.some((s) => s.includes("screenshot") || s.includes("capture")) ||
    name.startsWith("screenshot") ||
    name.startsWith("screen_") ||
    name.startsWith("capture")
  )
    return "screenshot";

  // Camera / DCIM.
  if (
    segs.some((s) => s === "dcim" || s === "camera" || s === "opencamera" || s.startsWith("100")) ||
    /^(img|dsc|pxl|photo|mvimg)_?\d/.test(name)
  )
    return "camera";

  return "other";
}

/** Rank an image source for relevance sorting (camera > screenshot > download > …). */
export function imageSourceRank(src: ImageSource): number {
  switch (src) {
    case "camera":
      return 100;
    case "screenshot":
      return 80;
    case "download":
      return 60;
    case "whatsapp":
    case "telegram":
      return 40;
    case "wallpaper":
      return 20;
    case "other":
      return 10;
    case "sticker":
    case "cache":
    default:
      return 0;
  }
}

export type SearchResult = FileEntry & {
  rootId: StorageRootId;
  /** Segments relative to the root, including the entry name itself. */
  segments: string[];
  /** Segments of the containing folder relative to the root. */
  parentSegments: string[];
  /** Ranking score — higher is more relevant. */
  score: number;
  /** Which provider produced the match. Used later for icons/badges. */
  providerId: string;
};

export type SearchContext = {
  query: string;
  tokens: string[];
  filters: SearchFilters;
  signal: AbortSignal;
  /** Roots to traverse. */
  roots: { rootId: StorageRootId; path: PathRef }[];
  /** Report a match — engine may buffer & batch. */
  emit: (r: SearchResult) => void;
  /** Report progress (scanned entries). */
  progress: (scanned: number, currentPath: string) => void;
};

export type SearchProvider = {
  id: string;
  label: string;
  /** Marks providers unavailable on web preview / when disabled. */
  enabled: boolean;
  /** Provider entry point. Must respect `ctx.signal`. */
  run(ctx: SearchContext): Promise<void>;
};
