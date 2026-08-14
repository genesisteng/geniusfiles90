/**
 * Archive module — creation, listing and extraction.
 *
 * Native (Android): backed by the GeniusFilesNative plugin using
 * java.util.zip. Only ZIP-family archives are supported: creation of
 * .zip, reading (list + extract) of .zip, .jar, .apk and .aab. RAR, 7z
 * and tar are NOT handled anywhere in the app and are therefore treated
 * as ordinary files.
 *
 * Web preview: a deterministic mock keeps the UI fully explorable
 * inside Lovable — no real bytes are written.
 */
import {
  isAndroidNative,
  nativePlugin,
  type NativeArchiveListing,
  type NativeArchiveProgress,
} from "@/lib/native/geniusfiles-native";
import type { FileEntry, PathRef } from "./types";
import { extOf } from "./format";
import { toAbsolutePath, mockResolve, mockMutate, type MockNode } from "./fs";
import { recordOperation } from "./history";
import type { OperationSignal, ProgressEvent } from "./operations";
import { beginJob, finishJob, updateJob } from "@/lib/jobs/journal";
import { t } from "@/lib/i18n";

/** Extensions we can *create* today. */
export const CREATE_FORMATS = ["zip"] as const;
/** Extensions we can *read* (list + extract) today. */
export const READ_FORMATS = ["zip", "jar", "apk", "aab"] as const;

export type ArchiveFormat = (typeof CREATE_FORMATS)[number];

export type ConflictPolicy = "replace" | "skip" | "rename" | "keepBoth";

export type ArchiveCapabilities = {
  supportedCreate: string[];
  supportedRead: string[];
  passwordSupported: boolean;
  splitSupported: boolean;
};

const DEFAULT_CAPS: ArchiveCapabilities = {
  supportedCreate: [...CREATE_FORMATS],
  supportedRead: [...READ_FORMATS],
  passwordSupported: false,
  splitSupported: false,
};

let capCache: ArchiveCapabilities | null = null;

export async function getArchiveCapabilities(): Promise<ArchiveCapabilities> {
  if (capCache) return capCache;
  if (isAndroidNative()) {
    const p = nativePlugin();
    if (p) {
      try {
        const info = await p.archiveInfo();
        capCache = {
          ...DEFAULT_CAPS,
          supportedCreate: info.supportedCreate,
          supportedRead: info.supportedRead,
          passwordSupported: info.passwordSupported,
          splitSupported: info.splitSupported,
        };
        return capCache;
      } catch {
        /* fall through to defaults */
      }
    }
  }
  capCache = DEFAULT_CAPS;
  return capCache;
}

export function canReadArchive(entry: FileEntry): boolean {
  if (entry.isDirectory) return false;
  const ext = entry.ext ?? extOf(entry.name);
  return !!ext && (READ_FORMATS as readonly string[]).includes(ext);
}

/* ---------- Listing ---------- */

export type ArchiveNode = {
  name: string;
  path: string; // full entry path inside archive
  isDirectory: boolean;
  size: number;
  compressedSize: number;
  mtime: number;
  children?: ArchiveNode[];
};

export type ArchiveListing = {
  archivePath: string;
  format: string;
  archiveSize: number;
  mtime: number;
  fileCount: number;
  dirCount: number;
  totalUncompressed: number;
  /** Flat list of entries as stored in the archive. */
  entries: ArchiveNode[];
  /** Tree view built from `entries` for the UI. */
  tree: ArchiveNode;
  /** Set to true when the format is currently read-only preview. */
  readOnly: boolean;
};

function buildTree(entries: ArchiveNode[]): ArchiveNode {
  const root: ArchiveNode = {
    name: "",
    path: "",
    isDirectory: true,
    size: 0,
    compressedSize: 0,
    mtime: 0,
    children: [],
  };
  const dirMap = new Map<string, ArchiveNode>();
  dirMap.set("", root);
  const ensureDir = (fullPath: string, mtime: number): ArchiveNode => {
    const trimmed = fullPath.replace(/\/+$/, "");
    if (!trimmed) return root;
    const existing = dirMap.get(trimmed);
    if (existing) return existing;
    const parts = trimmed.split("/");
    const name = parts.pop() ?? trimmed;
    const parent = ensureDir(parts.join("/"), mtime);
    const node: ArchiveNode = {
      name,
      path: trimmed,
      isDirectory: true,
      size: 0,
      compressedSize: 0,
      mtime,
      children: [],
    };
    parent.children!.push(node);
    dirMap.set(trimmed, node);
    return node;
  };
  for (const e of entries) {
    if (e.isDirectory) {
      ensureDir(e.path, e.mtime);
      continue;
    }
    const parts = e.path.split("/");
    const name = parts.pop() ?? e.path;
    const parent = ensureDir(parts.join("/"), e.mtime);
    parent.children!.push({ ...e, name });
  }
  return root;
}

function toArchiveNodes(native: NativeArchiveListing): ArchiveNode[] {
  return native.entries.map((e) => ({
    name: e.name.replace(/\/+$/, "").split("/").pop() || e.name,
    path: e.name.replace(/\/+$/, ""),
    isDirectory: e.isDirectory,
    size: e.size ?? 0,
    compressedSize: e.compressedSize ?? 0,
    mtime: e.mtime ?? 0,
  }));
}

export async function listArchive(
  parent: PathRef,
  entry: FileEntry,
): Promise<{ ok: true; listing: ArchiveListing } | { ok: false; error: string }> {
  if (!canReadArchive(entry)) {
    return { ok: false, error: t("ops.error.archiveFormatUnsupportedRead") };
  }
  if (isAndroidNative()) {
    const p = nativePlugin();
    if (!p) return { ok: false, error: "Plugin indisponible" };
    const abs = joinAbs(toAbsolutePath(parent), entry.name);
    try {
      const raw = await p.listArchive({ path: abs });
      const entries = toArchiveNodes(raw);
      return {
        ok: true,
        listing: {
          archivePath: raw.path,
          format: raw.format,
          archiveSize: raw.archiveSize,
          mtime: raw.mtime,
          fileCount: raw.fileCount,
          dirCount: raw.dirCount,
          totalUncompressed: raw.totalUncompressed,
          entries,
          tree: buildTree(entries),
          readOnly: false,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg || t("system.io.readFailed") };
    }
  }
  // Mock — synthesize a plausible content list from the source entry name.
  const nodes = mockArchiveContents(entry);
  return {
    ok: true,
    listing: {
      archivePath: `/mock/${entry.name}`,
      format: (entry.ext ?? "zip").toLowerCase(),
      archiveSize: entry.size ?? 0,
      mtime: entry.mtime ?? Date.now(),
      fileCount: nodes.filter((n) => !n.isDirectory).length,
      dirCount: nodes.filter((n) => n.isDirectory).length,
      totalUncompressed: nodes.reduce((s, n) => s + (n.isDirectory ? 0 : n.size), 0),
      entries: nodes,
      tree: buildTree(nodes),
      readOnly: false,
    },
  };
}

function mockArchiveContents(entry: FileEntry): ArchiveNode[] {
  const base = entry.name.replace(/\.[^.]+$/, "");
  const t = entry.mtime ?? Date.now();
  const totalSize = Math.max(entry.size ?? 200_000, 200_000);
  const perFile = Math.round(totalSize / 6);
  return [
    { name: base, path: base, isDirectory: true, size: 0, compressedSize: 0, mtime: t },
    {
      name: "README.md",
      path: `${base}/README.md`,
      isDirectory: false,
      size: 2_400,
      compressedSize: 900,
      mtime: t,
    },
    {
      name: "manifest.json",
      path: `${base}/manifest.json`,
      isDirectory: false,
      size: 3_100,
      compressedSize: 1_200,
      mtime: t,
    },
    { name: "src", path: `${base}/src`, isDirectory: true, size: 0, compressedSize: 0, mtime: t },
    {
      name: "index.ts",
      path: `${base}/src/index.ts`,
      isDirectory: false,
      size: perFile,
      compressedSize: Math.round(perFile * 0.5),
      mtime: t,
    },
    {
      name: "app.ts",
      path: `${base}/src/app.ts`,
      isDirectory: false,
      size: perFile,
      compressedSize: Math.round(perFile * 0.45),
      mtime: t,
    },
    {
      name: "assets",
      path: `${base}/assets`,
      isDirectory: true,
      size: 0,
      compressedSize: 0,
      mtime: t,
    },
    {
      name: "logo.png",
      path: `${base}/assets/logo.png`,
      isDirectory: false,
      size: perFile * 2,
      compressedSize: perFile * 2,
      mtime: t,
    },
  ];
}

/* ---------- Creation ---------- */

export type CreateOptions = {
  parent: PathRef;
  entries: FileEntry[];
  destination: PathRef;
  archiveName: string;
  format: ArchiveFormat;
  /** 0 (store) → 9 (max). Ignored for non-deflated formats. */
  level: number;
  /** Reserved — future encryption. */
  password?: string;
  onProgress?: (p: ProgressEvent) => void;
  signal?: OperationSignal;
};

export type CreateResult = {
  ok: boolean;
  cancelled: boolean;
  path?: string;
  size?: number;
  error?: string;
};

export async function createArchive(opts: CreateOptions): Promise<CreateResult> {
  const finalName = ensureExtension(opts.archiveName.trim(), opts.format);
  if (!finalName) return { ok: false, cancelled: false, error: t("ops.error.invalidName") };
  const dstAbs = joinAbs(toAbsolutePath(opts.destination), finalName);

  const totalItems = opts.entries.length;
  const totalBytesJob = opts.entries.reduce((s, e) => s + (e.size ?? 0), 0);
  const jobId = beginJob({
    kind: "compress",
    title: finalName,
    total: totalItems,
    totalBytes: totalBytesJob,
    payload: {
      parent: opts.parent,
      destination: opts.destination,
      entries: opts.entries,
      archiveName: opts.archiveName,
      format: opts.format,
      level: opts.level,
    },
  });
  const wrapProgress = opts.onProgress;
  opts.onProgress = (p) => {
    updateJob(jobId, {
      completed: p.completed,
      bytes: p.bytes,
      totalBytes: p.totalBytes,
      total: p.total,
    });
    wrapProgress?.(p);
  };
  const finalize = <T extends CreateResult>(res: T): T => {
    finishJob(jobId, res.cancelled ? "cancelled" : res.ok ? "done" : "failed", res.error);
    return res;
  };

  if (isAndroidNative()) {
    const p = nativePlugin();
    if (!p) return finalize({ ok: false, cancelled: false, error: "Plugin indisponible" });
    const sources = opts.entries.map((e) => joinAbs(toAbsolutePath(opts.parent), e.name));
    const started = Date.now();
    const listener = await p.addListener?.("archiveProgress", (evt) => {
      opts.onProgress?.(toProgress(evt, started));
    });
    try {
      const res = await p.createZipArchive({
        sources,
        destination: dstAbs,
        level: opts.level,
        overwrite: false,
        ...(opts.password ? { password: opts.password } : {}),
      });
      dispatchStorageChanged();
      recordOperation({
        kind: "archive.create",
        summary: `Archive « ${finalName} » créée (${opts.entries.length} élément(s))`,
        source: opts.parent,
        destination: opts.destination,
        names: [finalName],
        succeeded: 1,
        failed: 0,
      });
      return finalize({ ok: true, cancelled: false, path: res.path, size: res.size });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/EXISTS/i.test(msg))
        return finalize({
          ok: false,
          cancelled: false,
          error: t("ops.error.archiveNameExists"),
        });
      return finalize({ ok: false, cancelled: false, error: msg });
    } finally {
      try {
        const remove = (await listener)?.remove;
        if (typeof remove === "function") await remove();
      } catch {
        /* ignore */
      }
    }
  }

  // Mock — simulate progress + add a node to destination directory.
  const total = opts.entries.length + 3;
  const totalMockBytes = opts.entries.reduce((s, e) => s + (e.size ?? 0), 0) || total * 100_000;
  const started = Date.now();
  for (let i = 0; i <= total; i++) {
    if (opts.signal?.cancelled) return finalize({ ok: false, cancelled: true });
    await sleep(35);
    opts.onProgress?.({
      completed: i,
      total,
      bytes: Math.round((i / total) * totalMockBytes),
      totalBytes: totalMockBytes,
      currentName: opts.entries[Math.min(i, opts.entries.length - 1)]?.name ?? finalName,
      elapsedMs: Date.now() - started,
      etaMs:
        i > 0 && i < total ? Math.round(((Date.now() - started) / i) * (total - i)) : undefined,
    });
  }
  const err = mockMutate(opts.destination, (node) => {
    if (!node.children) node.children = [];
    if (node.children.some((c) => c.name === finalName)) return "EXISTS";
    node.children.push({
      name: finalName,
      isDirectory: false,
      size: Math.round(totalMockBytes * 0.6),
      mtime: Date.now(),
    });
    return null;
  });
  if (err === "EXISTS")
    return finalize({ ok: false, cancelled: false, error: t("ops.error.archiveNameExists") });
  if (err) return finalize({ ok: false, cancelled: false, error: t("home.folder.createFailed") });
  dispatchStorageChanged();
  recordOperation({
    kind: "archive.create",
    summary: `Archive « ${finalName} » créée (${opts.entries.length} élément(s))`,
    source: opts.parent,
    destination: opts.destination,
    names: [finalName],
    succeeded: 1,
    failed: 0,
  });
  return finalize({ ok: true, cancelled: false, path: dstAbs });
}

/* ---------- Extraction ---------- */

export type ExtractOptions = {
  parent: PathRef;
  entry: FileEntry;
  destination: PathRef;
  /** Optional selection — extract only these archive-relative paths. */
  entries?: string[];
  conflict: ConflictPolicy;
  password?: string;
  onProgress?: (p: ProgressEvent) => void;
  signal?: OperationSignal;
};

export type ExtractResult = {
  ok: boolean;
  cancelled: boolean;
  path?: string;
  completed?: number;
  skipped?: number;
  overwritten?: number;
  error?: string;
};

export async function extractArchive(opts: ExtractOptions): Promise<ExtractResult> {
  if (!canReadArchive(opts.entry))
    return { ok: false, cancelled: false, error: t("system.io.unsupportedFormat") };
  const dstAbs = toAbsolutePath(opts.destination);

  const jobId = beginJob({
    kind: "extract",
    title: opts.entry.name,
    total: 0,
    totalBytes: opts.entry.size ?? 0,
    payload: {
      parent: opts.parent,
      destination: opts.destination,
      entry: opts.entry,
      selection: opts.entries,
      conflict: opts.conflict,
    },
  });
  const wrapProgress = opts.onProgress;
  opts.onProgress = (p) => {
    updateJob(jobId, {
      completed: p.completed,
      bytes: p.bytes,
      totalBytes: p.totalBytes,
      total: p.total,
    });
    wrapProgress?.(p);
  };
  const finalize = <T extends ExtractResult>(res: T): T => {
    finishJob(jobId, res.cancelled ? "cancelled" : res.ok ? "done" : "failed", res.error);
    return res;
  };

  if (isAndroidNative()) {
    const p = nativePlugin();
    if (!p) return finalize({ ok: false, cancelled: false, error: "Plugin indisponible" });
    const srcAbs = joinAbs(toAbsolutePath(opts.parent), opts.entry.name);
    const started = Date.now();
    const listener = await p.addListener?.("extractProgress", (evt) => {
      opts.onProgress?.(toProgress(evt, started));
    });
    try {
      const res = await p.extractArchive({
        source: srcAbs,
        destination: dstAbs,
        entries: opts.entries,
        conflict: opts.conflict,
      });
      dispatchStorageChanged();
      recordOperation({
        kind: "archive.extract",
        summary: `Extraction de « ${opts.entry.name} » (${res.completed} élément(s))`,
        source: opts.parent,
        destination: opts.destination,
        names: [opts.entry.name],
        succeeded: res.completed,
        failed: 0,
      });
      return finalize({ ok: true, cancelled: false, ...res });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return finalize({ ok: false, cancelled: false, error: msg });
    } finally {
      try {
        const remove = (await listener)?.remove;
        if (typeof remove === "function") await remove();
      } catch {
        /* ignore */
      }
    }
  }

  // Mock — simulate extraction, create a folder next to the archive.
  const list = await listArchive(opts.parent, opts.entry);
  if (!list.ok) return finalize({ ok: false, cancelled: false, error: list.error });
  const items = list.listing.entries.filter((e) => !opts.entries || opts.entries.includes(e.path));
  const total = items.length;
  const totalBytes = items.reduce((s, i) => s + (i.isDirectory ? 0 : i.size), 0);
  const started = Date.now();
  for (let i = 0; i <= total; i++) {
    if (opts.signal?.cancelled) return finalize({ ok: false, cancelled: true });
    await sleep(25);
    opts.onProgress?.({
      completed: i,
      total,
      bytes: Math.round((i / total) * totalBytes),
      totalBytes,
      currentName: items[Math.min(i, items.length - 1)]?.path ?? opts.entry.name,
      elapsedMs: Date.now() - started,
      etaMs:
        i > 0 && i < total ? Math.round(((Date.now() - started) / i) * (total - i)) : undefined,
    });
  }
  const folderName = opts.entry.name.replace(/\.[^.]+$/, "");
  mockMutate(opts.destination, (node) => {
    if (!node.children) node.children = [];
    let target = node.children.find((c) => c.name === folderName && c.isDirectory);
    if (!target) {
      target = { name: folderName, isDirectory: true, children: [], mtime: Date.now() };
      node.children.push(target);
    }
    const child: MockNode = {
      name: "extrait.txt",
      isDirectory: false,
      size: 1_200,
      mtime: Date.now(),
    };
    if (!target.children!.some((c) => c.name === child.name)) target.children!.push(child);
    return null;
  });
  dispatchStorageChanged();
  recordOperation({
    kind: "archive.extract",
    summary: `Extraction de « ${opts.entry.name} » (${total} élément(s))`,
    source: opts.parent,
    destination: opts.destination,
    names: [opts.entry.name],
    succeeded: total,
    failed: 0,
  });
  return finalize({ ok: true, cancelled: false, completed: total, path: dstAbs });
}

/* ---------- helpers ---------- */

function joinAbs(base: string, name: string): string {
  return `${base.replace(/\/$/, "")}/${name}`;
}

function ensureExtension(name: string, format: ArchiveFormat): string | null {
  if (!name || /[\\/]/.test(name)) return null;
  return name.toLowerCase().endsWith(`.${format}`) ? name : `${name}.${format}`;
}

function toProgress(evt: NativeArchiveProgress, started: number): ProgressEvent {
  const elapsed = Date.now() - started;
  const done = evt.bytes || evt.completed;
  const total = evt.totalBytes || evt.total;
  const etaMs =
    done > 0 && total > 0 && done < total
      ? Math.max(0, Math.round((elapsed / done) * (total - done)))
      : undefined;
  return {
    completed: evt.completed,
    total: evt.total,
    bytes: evt.bytes,
    totalBytes: evt.totalBytes,
    currentName: evt.currentName ?? "",
    elapsedMs: elapsed,
    etaMs,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function dispatchStorageChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("gf:storage-changed"));
  } catch {
    /* ignore */
  }
}

// Re-export for the UI which builds trees from mock listings too.
export { mockResolve };
