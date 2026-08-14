/**
 * Persistent search index (Lot 4).
 *
 * Purpose: give the Recherche route sub-second responses on devices
 * holding hundreds of thousands of files, without re-walking the tree
 * on every query.
 *
 * How it works:
 *   - A background walker BFS-scans every configured root, streaming
 *     entries into an in-memory Map keyed by absolute path.
 *   - Every {@link SHARD_BYTES} of accumulated data (or at the end)
 *     a JSON shard is flushed via the native `writeFileBase64` bridge
 *     under {@code cacheDir/gf-index/}. A tiny manifest tracks shard
 *     order + total entry count, so a warm start can restore the whole
 *     index without a filesystem walk.
 *   - Queries are pure in-memory scans over the entry array — fast,
 *     synchronous, no bridge hop per keystroke.
 *
 * The walker is cancellable and idempotent: re-running it after a
 * `gf:storage-changed` burst simply overwrites shards. The heavy work
 * yields to the event loop every {@link YIELD_EVERY} entries so the UI
 * stays fluid during a rebuild.
 */
import {
  isAndroidNative,
  listNativeDirectory,
  nativePlugin,
} from "@/lib/native/geniusfiles-native";
import { toAbsolutePath } from "@/lib/files/fs";
import type { PathRef, StorageRootId } from "@/lib/files/types";
import { normalize } from "./normalize";

export type IndexedEntry = {
  path: string;
  name: string;
  norm: string;
  rootId: StorageRootId;
  segments: string[];
  isDirectory: boolean;
  size: number;
  mtime: number;
};

const INDEX_DIR_NAME = "gf-index";
const MANIFEST_NAME = "manifest.json";
const SHARD_BYTES = 512 * 1024; // 512 KB flush threshold
const YIELD_EVERY = 500;

type Manifest = {
  version: 1;
  builtAt: number;
  totalEntries: number;
  roots: StorageRootId[];
  shards: string[]; // filenames
};

type NativePlugin = {
  writeFileBase64?: (o: { path: string; data: string; overwrite?: boolean }) => Promise<unknown>;
  readFileBase64?: (o: { path: string }) => Promise<{ data: string; size: number }>;
  rootPath?: () => Promise<{ path: string }>;
};

function plugin(): NativePlugin | null {
  return nativePlugin() as unknown as NativePlugin | null;
}

// In-memory copy: kept per-session, shared by all queries.
const entries: IndexedEntry[] = [];
const paths = new Set<string>();
let ready = false;
let currentBuild: { abort: () => void; done: Promise<void> } | null = null;

export function isIndexReady(): boolean {
  return ready;
}
export function indexSize(): number {
  return entries.length;
}

/**
 * Nombre de fichiers connus par stockage, lu depuis l'index local déjà
 * en mémoire (aucun scan déclenché). Renvoie un objet vide tant que
 * l'index n'a pas été restauré.
 */
export function indexCountsByRoot(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (e.isDirectory) continue;
    out[e.rootId] = (out[e.rootId] ?? 0) + 1;
  }
  return out;
}

/**
 * In-memory query over the index. Returns up to {@code limit} entries
 * whose normalised name contains every token from the query.
 */
export function queryIndex(query: string, limit = 200): IndexedEntry[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const out: IndexedEntry[] = [];
  for (let i = 0; i < entries.length && out.length < limit; i++) {
    const e = entries[i];
    let ok = true;
    for (const t of tokens) {
      if (!e.norm.includes(t)) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(e);
  }
  return out;
}

/* ---------- persistence ---------- */

async function readTextFile(absPath: string): Promise<string | null> {
  const p = plugin();
  if (!p?.readFileBase64) return null;
  try {
    const { data } = await p.readFileBase64({ path: absPath });
    return typeof atob === "function"
      ? decodeURIComponent(escape(atob(data)))
      : Buffer.from(data, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

async function writeTextFile(absPath: string, text: string): Promise<void> {
  const p = plugin();
  if (!p?.writeFileBase64) return;
  const b64 =
    typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(text)))
      : Buffer.from(text, "utf-8").toString("base64");
  await p.writeFileBase64({ path: absPath, data: b64, overwrite: true });
}

async function indexDirPath(): Promise<string | null> {
  const p = plugin();
  if (!p?.rootPath) return null;
  try {
    // We piggy-back off the shared trash convention: store index shards
    // alongside them so a wipe-app-data clears everything atomically.
    const { path } = await p.rootPath();
    return `${path}/.GeniusFilesIndex`;
  } catch {
    return null;
  }
}

/** Restore the index from disk shards. Silent no-op if none exist. */
export async function restoreIndexFromDisk(): Promise<boolean> {
  if (!isAndroidNative() || ready) return ready;
  const dir = await indexDirPath();
  if (!dir) return false;
  const manifestText = await readTextFile(`${dir}/${MANIFEST_NAME}`);
  if (!manifestText) return false;
  try {
    const manifest = JSON.parse(manifestText) as Manifest;
    entries.length = 0;
    paths.clear();
    for (const shard of manifest.shards) {
      const shardText = await readTextFile(`${dir}/${shard}`);
      if (!shardText) continue;
      const arr = JSON.parse(shardText) as IndexedEntry[];
      for (const e of arr) {
        if (paths.has(e.path)) continue;
        paths.add(e.path);
        entries.push(e);
      }
    }
    ready = true;
    return true;
  } catch {
    return false;
  }
}

/* ---------- builder ---------- */

export type BuildProgress = { scanned: number; indexed: number; currentPath: string };

export type BuildController = {
  abort: () => void;
  done: Promise<void>;
};

/**
 * Kick off (or return) a background index build. Concurrent callers get
 * the same controller. Safe to call whenever `gf:storage-changed` fires
 * — the previous run is aborted and a fresh one starts.
 */
export function buildIndex(opts: {
  roots: { rootId: StorageRootId; path: PathRef }[];
  onProgress?: (p: BuildProgress) => void;
}): BuildController {
  if (currentBuild) currentBuild.abort();

  const controller = new AbortController();
  const shardsDir = indexDirPath();

  const done = (async () => {
    if (!isAndroidNative()) return;
    const dir = await shardsDir;
    if (!dir) return;

    entries.length = 0;
    paths.clear();
    ready = false;

    const shards: string[] = [];
    let buffer: IndexedEntry[] = [];
    let bufferBytes = 0;
    let scanned = 0;

    const flush = async () => {
      if (buffer.length === 0) return;
      const shardName = `shard-${shards.length.toString().padStart(4, "0")}.json`;
      const text = JSON.stringify(buffer);
      await writeTextFile(`${dir}/${shardName}`, text);
      shards.push(shardName);
      buffer = [];
      bufferBytes = 0;
    };

    for (const root of opts.roots) {
      if (controller.signal.aborted) break;
      const startAbs = toAbsolutePath(root.path);
      const queue: { abs: string; parentSegments: string[] }[] = [
        { abs: startAbs, parentSegments: root.path.segments },
      ];
      while (queue.length) {
        if (controller.signal.aborted) break;
        const cur = queue.shift()!;
        const res = await listNativeDirectory(cur.abs);
        if (!res.ok) continue;
        for (const raw of res.listing.entries) {
          if (raw.name.startsWith(".")) continue;
          scanned++;
          if (paths.has(raw.path)) continue;
          const entry: IndexedEntry = {
            path: raw.path,
            name: raw.name,
            norm: normalize(raw.name),
            rootId: root.rootId,
            segments: [...cur.parentSegments, raw.name],
            isDirectory: raw.isDirectory,
            size: raw.isDirectory ? 0 : raw.size,
            mtime: raw.mtime,
          };
          paths.add(entry.path);
          entries.push(entry);
          buffer.push(entry);
          bufferBytes += entry.path.length + entry.name.length + 80;
          if (bufferBytes >= SHARD_BYTES) await flush();
          if (raw.isDirectory) {
            queue.push({ abs: raw.path, parentSegments: [...cur.parentSegments, raw.name] });
          }
          if (scanned % YIELD_EVERY === 0) {
            opts.onProgress?.({ scanned, indexed: entries.length, currentPath: cur.abs });
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      }
    }

    if (!controller.signal.aborted) {
      await flush();
      const manifest: Manifest = {
        version: 1,
        builtAt: Date.now(),
        totalEntries: entries.length,
        roots: opts.roots.map((r) => r.rootId),
        shards,
      };
      await writeTextFile(`${dir}/${MANIFEST_NAME}`, JSON.stringify(manifest));
      ready = true;
      opts.onProgress?.({ scanned, indexed: entries.length, currentPath: "" });
    }
  })();

  currentBuild = {
    abort: () => controller.abort(),
    done: done.finally(() => {
      if (currentBuild && currentBuild.done === (done as unknown)) currentBuild = null;
    }) as Promise<void>,
  };
  return currentBuild;
}

/** Drop the in-memory index; forces the next query to run against a fresh build. */
export function clearIndex(): void {
  entries.length = 0;
  paths.clear();
  ready = false;
  if (currentBuild) {
    currentBuild.abort();
    currentBuild = null;
  }
}
