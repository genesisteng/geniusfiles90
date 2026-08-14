/**
 * GeniusFiles search engine — streaming, cancellable, provider-based.
 *
 * The name provider is registered by default. Future providers (content,
 * OCR, semantic, IA) can be added via `registerSearchProvider()` without
 * touching the Recherche route.
 *
 * Traversal is BFS across every selected storage root. Yields to the event
 * loop periodically so scanning a large tree never blocks the UI.
 */
import { isAndroidNative, listNativeDirectory } from "@/lib/native/geniusfiles-native";
import { mockResolve, toAbsolutePath, type MockNode } from "@/lib/files/fs";
import { extOf, kindOf } from "@/lib/files/format";
import type { FileEntry, PathRef, StorageRootId } from "@/lib/files/types";
import { normalize, scoreName, tokenize } from "./normalize";
import {
  DEFAULT_FILTERS,
  KIND_FILTER_MATCH,
  SIZE_BAND_BYTES,
  classifyImageSource,
  imageSourceRank,
  dateBandCutoff,
  type SearchContext,
  type SearchFilters,
  type SearchProvider,
  type SearchResult,
} from "./types";
import { t } from "@/lib/i18n";

/* ---------- ignored directories (early skip) ----------
 *
 * Règle : on ne skippe QUE les dossiers strictement techniques ou
 * inaccessibles (caches système, thumbnails, données privées d'apps sous
 * Android/data ou Android/obb). Aucun dossier utilisateur n'est écarté
 * au nom d'une supposition sur son contenu.
 */
const SYSTEM_CACHE_NAMES: ReadonlySet<string> = new Set([
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
  "app_webview",
  "shared_prefs",
  ".nomedia",
]);

function shouldTraverseDir(child: string, parentSegments: string[]): boolean {
  const name = child.toLowerCase();
  if (SYSTEM_CACHE_NAMES.has(name)) return false;
  const parentLower = parentSegments.map((s) => s.toLowerCase());
  const parentIsAndroid = parentLower[parentLower.length - 1] === "android";
  if (parentIsAndroid && (name === "data" || name === "obb")) return false;
  return true;
}

/* ---------- provider registry ---------- */

const providers: SearchProvider[] = [];

export function registerSearchProvider(p: SearchProvider) {
  if (providers.some((x) => x.id === p.id)) return;
  providers.push(p);
}
export function listSearchProviders(): SearchProvider[] {
  return providers.slice();
}

/* ---------- filter predicate ---------- */

function entryPassesFilters(entry: FileEntry, filters: SearchFilters): boolean {
  // Extension whitelist — le filtre le plus strict, appliqué en premier.
  if (filters.exts && filters.exts.length > 0) {
    if (entry.isDirectory) return false;
    const ext = (entry.ext ?? "").toLowerCase();
    if (!filters.exts.includes(ext)) return false;
  }
  if (filters.kind !== "any") {
    const allowed = KIND_FILTER_MATCH[filters.kind];
    if (!allowed.includes(entry.kind)) return false;
  }
  // Precise size range takes precedence over the coarse band.
  const hasPreciseSize = filters.sizeMinBytes != null || filters.sizeMaxBytes != null;
  if (hasPreciseSize) {
    if (entry.isDirectory) return false;
    const s = entry.size ?? 0;
    if (filters.sizeMinBytes != null && s < filters.sizeMinBytes) return false;
    if (filters.sizeMaxBytes != null && s > filters.sizeMaxBytes) return false;
  } else if (filters.size !== "any") {
    if (entry.isDirectory) return false;
    const [lo, hi] = SIZE_BAND_BYTES[filters.size];
    const s = entry.size ?? 0;
    if (s < lo || s >= hi) return false;
  }
  // Precise date range takes precedence over the coarse band.
  const hasPreciseDate = filters.mtimeMin != null || filters.mtimeMax != null;
  if (hasPreciseDate) {
    const m = entry.mtime ?? 0;
    if (filters.mtimeMin != null && m < filters.mtimeMin) return false;
    if (filters.mtimeMax != null && m >= filters.mtimeMax) return false;
  } else if (filters.date !== "any") {
    const cutoff = dateBandCutoff(filters.date);
    if (cutoff && (entry.mtime ?? 0) < cutoff) return false;
  }
  return true;
}

/* ---------- name provider (default) ---------- */

const nameProvider: SearchProvider = {
  id: "name",
  label: t("media.editor.fileNamePlaceholder"),
  enabled: true,
  async run(ctx) {
    const { tokens, filters, signal, emit, progress } = ctx;
    // Filter-only mode: no text tokens but at least one active filter
    // ("photos de cette semaine" → kind=image, date=week, tokens=[]).
    // We still walk the tree and emit every entry passing the filters.
    const filterOnly =
      tokens.length === 0 &&
      (filters.kind !== "any" ||
        filters.size !== "any" ||
        filters.date !== "any" ||
        filters.sizeMinBytes != null ||
        filters.sizeMaxBytes != null ||
        filters.mtimeMin != null ||
        filters.mtimeMax != null ||
        !!filters.imageSource ||
        (filters.exts?.length ?? 0) > 0);
    if (tokens.length === 0 && !filterOnly) return;
    let scanned = 0;

    const visit = async (entry: FileEntry, parentSegments: string[], rootId: StorageRootId) => {
      scanned++;
      if (scanned % 200 === 0) {
        progress(scanned, parentSegments.join("/"));
        await yieldToLoop();
      }
      if (!entryPassesFilters(entry, filters)) return;
      // Image sub-source filter (photo vs capture vs sticker vs cache…).
      if (filters.imageSource && entry.kind === "image" && !entry.isDirectory) {
        const src = classifyImageSource(parentSegments, entry.name);
        if (src !== filters.imageSource) return;
      }
      // When filtering images without an explicit sub-source, exclude
      // cache thumbnails and stickers — they are never what a human
      // means by "mes photos".
      // Quand on filtre les images sans sous-source explicite, on exclut
      // tout ce qui n'est jamais "une vraie photo" : caches, stickers,
      // wallpapers, backups d'app. Les vraies photos (camera, screenshot,
      // download, messagerie explicite) restent visibles.
      if (
        !filters.imageSource &&
        filters.kind === "image" &&
        entry.kind === "image" &&
        !entry.isDirectory
      ) {
        const src = classifyImageSource(parentSegments, entry.name);
        if (src === "cache" || src === "sticker" || src === "wallpaper") return;
      }
      let score: number;
      if (tokens.length === 0) {
        score = 1;
      } else {
        score = scoreName(entry.name, tokens);
        if (score <= 0) return;
      }
      // Boost images from higher-quality sources (camera > screenshot > download > messaging).
      if (entry.kind === "image" && !entry.isDirectory) {
        score += imageSourceRank(classifyImageSource(parentSegments, entry.name));
      }
      emit({
        ...entry,
        rootId,
        segments: [...parentSegments, entry.name],
        parentSegments,
        score,
        providerId: "name",
      });
    };

    if (isAndroidNative()) {
      for (const root of ctx.roots) {
        if (signal.aborted) return;
        const startAbs = toAbsolutePath(root.path);
        await bfsNative({
          startAbs,
          rootId: root.rootId,
          rootSegmentsBase: root.path.segments,
          onEntry: (entry, parentSegments) => visit(entry, parentSegments, root.rootId),
          signal,
        });
      }
    } else {
      for (const root of ctx.roots) {
        if (signal.aborted) return;
        const node = mockResolve(root.path);
        if (!node) continue;
        await bfsMock({
          node,
          rootId: root.rootId,
          parentSegments: root.path.segments,
          onEntry: (entry, parentSegments) => visit(entry, parentSegments, root.rootId),
          signal,
        });
      }
    }
    progress(scanned, "");
  },
};
registerSearchProvider(nameProvider);

/* ---------- traversal helpers ---------- */

function yieldToLoop(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

type NativeVisitor = (entry: FileEntry, parentSegments: string[]) => void | Promise<void>;
type MockVisitor = (entry: FileEntry, parentSegments: string[]) => void | Promise<void>;

async function bfsNative(opts: {
  startAbs: string;
  rootId: StorageRootId;
  rootSegmentsBase: string[];
  onEntry: NativeVisitor;
  signal: AbortSignal;
}): Promise<void> {
  // Queue holds directories to explore. We push their children as we go.
  const queue: { abs: string; parentSegments: string[] }[] = [
    { abs: opts.startAbs, parentSegments: opts.rootSegmentsBase },
  ];
  while (queue.length) {
    if (opts.signal.aborted) return;
    const cur = queue.shift()!;
    const res = await listNativeDirectory(cur.abs);
    if (!res.ok) continue;
    for (const raw of res.listing.entries) {
      if (raw.name.startsWith(".")) continue;
      const entry: FileEntry = {
        name: raw.name,
        path: raw.path,
        isDirectory: raw.isDirectory,
        size: raw.isDirectory ? undefined : raw.size,
        mtime: raw.mtime,
        kind: kindOf(raw.name, raw.isDirectory),
        ext: raw.isDirectory ? undefined : extOf(raw.name),
      };
      await opts.onEntry(entry, cur.parentSegments);
      if (raw.isDirectory) {
        if (shouldTraverseDir(raw.name, cur.parentSegments)) {
          queue.push({ abs: raw.path, parentSegments: [...cur.parentSegments, raw.name] });
        }
      }
    }
  }
}

async function bfsMock(opts: {
  node: MockNode;
  rootId: StorageRootId;
  parentSegments: string[];
  onEntry: MockVisitor;
  signal: AbortSignal;
}): Promise<void> {
  const queue: { node: MockNode; parentSegments: string[] }[] = [
    { node: opts.node, parentSegments: opts.parentSegments },
  ];
  while (queue.length) {
    if (opts.signal.aborted) return;
    const cur = queue.shift()!;
    const children = cur.node.children ?? [];
    for (const child of children) {
      const entry: FileEntry = {
        name: child.name,
        path: "/" + [...cur.parentSegments, child.name].join("/"),
        isDirectory: child.isDirectory,
        size: child.isDirectory ? undefined : child.size,
        mtime: child.mtime,
        kind: kindOf(child.name, child.isDirectory),
        ext: child.isDirectory ? undefined : extOf(child.name),
      };
      await opts.onEntry(entry, cur.parentSegments);
      if (child.isDirectory) {
        if (shouldTraverseDir(child.name, cur.parentSegments)) {
          queue.push({ node: child, parentSegments: [...cur.parentSegments, child.name] });
        }
      }
    }
  }
}

/* ---------- runner ---------- */

export type RunSearchOptions = {
  query: string;
  filters?: SearchFilters;
  roots: { rootId: StorageRootId; path: PathRef }[];
  onBatch: (results: SearchResult[]) => void;
  onProgress?: (scanned: number, currentPath: string) => void;
  onDone?: () => void;
  /** Deduplicate the batch stream — results are unique by absolute path. */
  batchIntervalMs?: number;
};

/**
 * Kick off a streaming search. Returns a controller with `abort()`.
 * Results are batched (default every 80ms) so React re-renders stay cheap
 * even when thousands of matches stream in.
 */
export function runSearch(opts: RunSearchOptions): { abort: () => void; done: Promise<void> } {
  const controller = new AbortController();
  const filters = opts.filters ?? DEFAULT_FILTERS;
  const tokens = tokenize(opts.query);
  const batchIntervalMs = opts.batchIntervalMs ?? 80;

  const buffer: SearchResult[] = [];
  const seen = new Set<string>();
  let flushTimer: number | null = null;

  const flush = () => {
    flushTimer = null;
    if (buffer.length === 0) return;
    const out = buffer.splice(0, buffer.length);
    opts.onBatch(out);
  };
  const schedule = () => {
    if (flushTimer != null || typeof window === "undefined") return;
    flushTimer = window.setTimeout(flush, batchIntervalMs);
  };

  const ctx: SearchContext = {
    query: opts.query,
    tokens,
    filters,
    signal: controller.signal,
    roots: opts.roots,
    emit: (r) => {
      const key = `${r.rootId}::${r.segments.join("/")}`;
      if (seen.has(key)) return;
      seen.add(key);
      buffer.push(r);
      schedule();
    },
    progress: (scanned, current) => opts.onProgress?.(scanned, current),
  };

  const done = (async () => {
    // Allow filter-only searches (no tokens but active kind/size/date).
    const filterOnly =
      tokens.length === 0 &&
      (filters.kind !== "any" ||
        filters.size !== "any" ||
        filters.date !== "any" ||
        filters.sizeMinBytes != null ||
        filters.sizeMaxBytes != null ||
        filters.mtimeMin != null ||
        filters.mtimeMax != null ||
        !!filters.imageSource ||
        (filters.exts?.length ?? 0) > 0);
    if (tokens.length === 0 && !filterOnly) return;
    for (const p of providers) {
      if (!p.enabled) continue;
      if (controller.signal.aborted) break;
      try {
        await p.run(ctx);
      } catch {
        /* provider failure is non-fatal */
      }
    }
    if (flushTimer != null && typeof window !== "undefined") {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
    flush();
    opts.onDone?.();
  })();

  return {
    abort: () => {
      controller.abort();
      if (flushTimer != null && typeof window !== "undefined") {
        window.clearTimeout(flushTimer);
        flushTimer = null;
      }
    },
    done,
  };
}

/** Convenience — sort results by score desc, then name asc. */
export function sortResults(results: SearchResult[]): SearchResult[] {
  return results
    .slice()
    .sort((a, b) => b.score - a.score || normalize(a.name).localeCompare(normalize(b.name)));
}
