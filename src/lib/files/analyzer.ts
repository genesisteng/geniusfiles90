/**
 * Dashboard storage analyzer.
 *
 * Walks the primary internal root in a breadth-first manner and
 * aggregates bytes/counts per high-level category (images, videos,
 * audio, documents, archives, apps, other). Yields to the event loop
 * every N folders so the UI stays smooth even on large filesystems.
 *
 * Works on native Android (real java.io.File listings) AND on the web
 * preview (curated mock tree) via the shared `listDirectory` bridge.
 */
import { listDirectory } from "./fs";
import { categoryOfName, shouldTraverseCategoryDir, type CategoryKind } from "./category-rules";

import type { FileKind, PathRef } from "./types";

export type CategoryKey =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "pdf"
  | "archive"
  | "apk"
  | "other";

export type CategoryStats = {
  key: CategoryKey;
  bytes: number;
  count: number;
};

const KIND_TO_CATEGORY: Partial<Record<FileKind, CategoryKey>> = {
  image: "image",
  video: "video",
  audio: "audio",
  document: "document",
  pdf: "pdf",
  text: "document",
  archive: "archive",
  apk: "apk",
  code: "other",
  font: "other",
  other: "other",
};

const shouldTraverseDir = shouldTraverseCategoryDir;

export type FolderBreakdown = {
  path: string;
  rootId: string;
  bytes: number;
  count: number;
};

/** Totaux par catégorie d'accueil (mêmes règles que les écrans catégorie). */
export type KindStats = { bytes: number; count: number };

export type ScanResult = {
  categories: Record<CategoryKey, CategoryStats>;
  /**
   * Tailles réelles par catégorie de l'accueil. Calculées avec
   * `category-rules` : ce que l'accueil affiche est exactement ce que
   * l'écran de la catégorie contient.
   */
  kinds: Record<Exclude<CategoryKind, "downloads">, KindStats>;
  totalFiles: number;
  totalBytes: number;
  scannedFolders: number;
  /** Top folders by total bytes (bucketed by first segment under each root). */
  topFolders: FolderBreakdown[];
  done: boolean;
  cancelled: boolean;
};

export function emptyKindStats(): ScanResult["kinds"] {
  return {
    images: { bytes: 0, count: 0 },
    videos: { bytes: 0, count: 0 },
    audio: { bytes: 0, count: 0 },
    documents: { bytes: 0, count: 0 },
  };
}

function emptyResult(done: boolean): ScanResult {
  return {
    categories: {
      image: { key: "image", bytes: 0, count: 0 },
      video: { key: "video", bytes: 0, count: 0 },
      audio: { key: "audio", bytes: 0, count: 0 },
      document: { key: "document", bytes: 0, count: 0 },
      pdf: { key: "pdf", bytes: 0, count: 0 },
      archive: { key: "archive", bytes: 0, count: 0 },
      apk: { key: "apk", bytes: 0, count: 0 },
      other: { key: "other", bytes: 0, count: 0 },
    },
    kinds: emptyKindStats(),
    totalFiles: 0,
    totalBytes: 0,
    scannedFolders: 0,
    topFolders: [],
    done,
    cancelled: false,
  };
}

export type ScanHandle = {
  cancel: () => void;
};

export function scanCategories(
  roots: PathRef[],
  onProgress: (partial: ScanResult) => void,
  onDone: (result: ScanResult) => void,
): ScanHandle {
  let cancelled = false;
  const handle: ScanHandle = {
    cancel: () => {
      cancelled = true;
    },
  };
  const result = emptyResult(false);
  const folderAgg = new Map<string, FolderBreakdown>();

  (async () => {
    const queue: PathRef[] = [...roots];
    const visited = new Set<string>();
    let step = 0;

    while (queue.length && !cancelled) {
      const p = queue.shift()!;
      const key = `${p.rootId}/${p.segments.join("/")}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const res = await listDirectory(p);
      result.scannedFolders += 1;

      if (res.ok) {
        for (const e of res.entries) {
          if (e.name.startsWith(".")) continue;
          if (e.isDirectory) {
            if (!shouldTraverseDir(e.name, p.segments)) continue;
            queue.push({ rootId: p.rootId, segments: [...p.segments, e.name] });
          } else {
            result.totalFiles += 1;
            const cat = KIND_TO_CATEGORY[e.kind] ?? "other";
            const size = e.size ?? 0;
            result.categories[cat].bytes += size;
            result.categories[cat].count += 1;
            result.totalBytes += size;
            const homeKind = categoryOfName(e.name);
            if (homeKind) {
              result.kinds[homeKind].bytes += size;
              result.kinds[homeKind].count += 1;
            }

            const bucketSeg = p.segments[0] ?? "(racine)";
            const bucketKey = `${p.rootId}:${bucketSeg}`;
            let bucket = folderAgg.get(bucketKey);
            if (!bucket) {
              bucket = {
                path: `${p.rootId}/${bucketSeg}`,
                rootId: p.rootId,
                bytes: 0,
                count: 0,
              };
              folderAgg.set(bucketKey, bucket);
            }
            bucket.bytes += size;
            bucket.count += 1;
          }
        }
      }

      step += 1;
      if (step % 4 === 0) {
        result.topFolders = [...folderAgg.values()].sort((a, b) => b.bytes - a.bytes).slice(0, 8);
        onProgress({
          ...result,
          categories: { ...result.categories },
          kinds: { ...result.kinds },
        });

        await new Promise((r) => setTimeout(r, 0));
      }
    }

    result.topFolders = [...folderAgg.values()].sort((a, b) => b.bytes - a.bytes).slice(0, 8);
    result.done = !cancelled;
    result.cancelled = cancelled;
    onDone(result);
  })().catch(() => {
    result.done = true;
    onDone(result);
  });

  return handle;
}
