/**
 * Persistent on-disk thumbnail cache bridge.
 *
 * The native side stores compressed JPEGs under {@code cacheDir/gf-thumbs/}
 * keyed by absolutePath+mtime+size, so:
 *   - subsequent opens of the Gallery/Explorer are near-instant
 *   - RAM usage stays flat regardless of how many items scroll past
 *   - deleting a source file (or mutating it) transparently invalidates
 *     the cached blob on the next lookup
 *
 * Off native the resolver returns {@code null}; callers fall back to the
 * existing mock URL logic.
 */
import { isAndroidNative, nativePlugin } from "./geniusfiles-native";

type Plugin = {
  getOrCreateThumbnail?: (o: { path: string; size?: number }) => Promise<{
    cachePath: string;
    cached: boolean;
    size: number;
  }>;
  clearThumbnailCache?: () => Promise<{ deleted: number; bytesFreed: number }>;
};

function plugin(): Plugin | null {
  return nativePlugin() as unknown as Plugin | null;
}

function convertFileSrc(absolute: string): string {
  if (typeof window === "undefined") return absolute;
  const cap = (window as unknown as { Capacitor?: { convertFileSrc?: (p: string) => string } })
    .Capacitor;
  if (cap && typeof cap.convertFileSrc === "function") return cap.convertFileSrc(absolute);
  return absolute;
}

/** Formats dont Android sait extraire une image. */
const IMAGE_EXTS = new Set([
  "jpg",
  "jpeg",
  "jpe",
  "jfif",
  "png",
  "webp",
  "gif",
  "bmp",
  "heic",
  "heif",
  "avif",
  "tif",
  "tiff",
  "dng",
  "ico",
  "cr2",
  "nef",
  "arw",
]);

const VIDEO_EXTS = new Set([
  "mp4",
  "m4v",
  "mkv",
  "webm",
  "3gp",
  "3g2",
  "avi",
  "mov",
  "ts",
  "m2ts",
  "mts",
  "flv",
  "wmv",
  "asf",
  "mpg",
  "mpeg",
  "ogv",
  "divx",
]);

/** Une miniature réelle peut-elle être générée pour ce fichier ? */
export function canThumbnail(path: string, kind?: "image" | "video" | string): boolean {
  const ext = path.split(/[\\/]/).pop()?.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext)) return true;
  // Extension inconnue : on tente quand même quand le type est média.
  return kind === "image" || kind === "video";
}

/** Résolution adaptée à la densité d'écran (netteté sans gaspillage mémoire). */
export function scaleForDisplay(px: number): number {
  const dpr =
    typeof window !== "undefined" && typeof window.devicePixelRatio === "number"
      ? window.devicePixelRatio
      : 2;
  return Math.min(1080, Math.round(px * Math.min(3, Math.max(1, dpr))));
}

// In-flight dedupe: if two components ask for the same thumbnail at the
// same size at once we resolve the native call only once.
const inflight = new Map<string, Promise<string | null>>();
// LRU of resolved URLs — assez large pour couvrir plusieurs écrans de
// défilement sans épingler la mémoire.
const resolved = new Map<string, string>();
const RESOLVED_MAX = 800;
// Cache négatif : évite de retenter en boucle un fichier sans miniature.
const failed = new Set<string>();

function remember(key: string, url: string) {
  resolved.delete(key);
  resolved.set(key, url);
  while (resolved.size > RESOLVED_MAX) {
    const first = resolved.keys().next().value;
    if (first === undefined) break;
    resolved.delete(first);
  }
}

// File d'attente à concurrence limitée : le décodage natif reste réactif et
// le défilement fluide même avec des milliers d'éléments.
const MAX_CONCURRENT = 4;
let running = 0;
const queue: Array<() => void> = [];

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      running++;
      task()
        .then(resolve, reject)
        .finally(() => {
          running--;
          const next = queue.shift();
          if (next) next();
        });
    };
    if (running < MAX_CONCURRENT) run();
    else queue.push(run);
  });
}

// Suivi des demandeurs : une miniature dont la ligne a quitté l'écran avant
// d'être décodée est abandonnée au lieu de monopoliser la file native.
const wanted = new Map<string, number>();

export function retainThumbnail(absolutePath: string, size = 320): void {
  const key = `${absolutePath}@${size}`;
  wanted.set(key, (wanted.get(key) ?? 0) + 1);
}

export function releaseThumbnail(absolutePath: string, size = 320): void {
  const key = `${absolutePath}@${size}`;
  const next = (wanted.get(key) ?? 0) - 1;
  if (next > 0) wanted.set(key, next);
  else wanted.delete(key);
}

/** Sync accessor for a previously-resolved thumbnail. */
export function peekThumbnail(absolutePath: string, size = 320): string | null {
  return resolved.get(`${absolutePath}@${size}`) ?? null;
}

/**
 * Resolve (and lazily create) a persistent thumbnail for the given file.
 * Returns a WebView-loadable URL, or {@code null} if unavailable / off native.
 */
export async function resolveThumbnail(absolutePath: string, size = 320): Promise<string | null> {
  if (!isAndroidNative()) return null;
  const key = `${absolutePath}@${size}`;
  const cached = resolved.get(key);
  if (cached) return cached;
  if (failed.has(key)) return null;
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = plugin();
  if (!p?.getOrCreateThumbnail) return null;

  /* Un appel direct (lecteur, préchargement voisin) n'est jamais annulé :
     seul un élément qui avait été « retenu » par une ligne visible puis
     relâché (sorti de l'écran) abandonne sa place dans la file. Sans cette
     distinction, les miniatures demandées hors liste n'étaient jamais
     générées. */
  const retainedAtStart = (wanted.get(key) ?? 0) > 0;

  const task = schedule(async () => {
    try {
      // Sortie d'écran pendant l'attente : on abandonne sans décoder.
      if (retainedAtStart && (wanted.get(key) ?? 0) <= 0) return null;
      const ret = await p.getOrCreateThumbnail!({ path: absolutePath, size });
      const url = convertFileSrc(ret.cachePath);
      remember(key, url);
      return url;
    } catch {
      failed.add(key);
      return null;
    } finally {
      inflight.delete(key);
    }
  });
  inflight.set(key, task);
  return task;
}

/** Wipe the entire persistent thumbnail cache (used by Nettoyeur/Paramètres). */
export async function clearThumbnailCache(): Promise<{ deleted: number; bytesFreed: number }> {
  const p = plugin();
  resolved.clear();
  inflight.clear();
  failed.clear();
  wanted.clear();
  if (!p?.clearThumbnailCache) return { deleted: 0, bytesFreed: 0 };
  try {
    return await p.clearThumbnailCache();
  } catch {
    return { deleted: 0, bytesFreed: 0 };
  }
}
