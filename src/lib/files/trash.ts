/**
 * GeniusFiles — Corbeille (Trash) subsystem.
 *
 * Provides the high-level trash API used by the UI:
 *   - listTrashItems()             — merged native + mock listing
 *   - restoreItems(items, target?) — restore to original path or a picked one
 *   - permanentDelete(ids)         — irrevocable deletion of trash entries
 *   - emptyTrash()                 — wipe the entire trash
 *   - usageTrash()                 — count + bytes for dashboard signals
 *   - autoPurgeTrash(retention)    — background TTL sweep on app boot
 *
 * Native Android: backed by the GeniusFilesNative plugin, which stores
 * items under `/storage/emulated/0/.GeniusFilesTrash` with `.meta.json`
 * sidecars. Restoration falls back to a user-chosen destination when the
 * original folder no longer exists.
 *
 * Web preview: an in-memory ledger persisted to localStorage mirrors the
 * native contract so every UI flow remains explorable in Lovable.
 *
 * All mutations dispatch `gf:storage-changed` so the dashboard, files
 * page and storage stats refresh immediately after every operation.
 */
import {
  isAndroidNative,
  nativePlugin,
  type NativeRestoreResult,
  type NativeTrashItem,
} from "@/lib/native/geniusfiles-native";
import type { PathRef } from "./types";
import { toAbsolutePath, mockResolve, type MockNode } from "./fs";
import { recordOperation } from "./history";
import { loadTrashRetention, markTrashPurged, loadTrashLastPurgeAt } from "./preferences";

export type TrashItem = {
  id: string;
  name: string;
  originalPath: string;
  isDirectory: boolean;
  size: number;
  /** Milliseconds since epoch — when the item was moved to the trash. */
  deletedAt: number;
  /** Milliseconds until permanent deletion. Undefined = keep forever. */
  msUntilPurge?: number;
  /** True when the original parent directory still exists (native only). */
  originalParentExists?: boolean;
  /** Chemin absolu réel du fichier dans la corbeille (Android uniquement). */
  trashPath?: string;
};

export type TrashListing = {
  items: TrashItem[];
  totalBytes: number;
};

export type RestoreOptions = {
  /** When set, restore every item into this folder instead of its origin. */
  targetPath?: string;
};

export type RestoreOutcome = {
  restored: number;
  failed: {
    id: string;
    name: string;
    reason: "PARENT_MISSING" | "MISSING" | "NO_TARGET" | "MOVE_FAILED";
    originalPath?: string;
  }[];
};

/* ---------- mock (web preview) ---------- */

const MOCK_KEY = "gf.files.trash.mock";

export type MockTrashRecord = {
  id: string;
  name: string;
  originalPath: string;
  isDirectory: boolean;
  size: number;
  deletedAt: number;
  parentSegments: string[];
  rootId: PathRef["rootId"];
  /** Serialised MockNode so restore can splice it back into fs.ts. */
  snapshot: MockNode;
};

function readMock(): MockTrashRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MOCK_KEY);
    return raw ? (JSON.parse(raw) as MockTrashRecord[]) : [];
  } catch {
    return [];
  }
}

function writeMock(items: MockTrashRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MOCK_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
}

/**
 * Register mock trash entries. Called by operations.ts when a soft delete
 * runs in the Lovable preview (web) mode.
 */
export function recordMockTrash(records: MockTrashRecord[]) {
  const merged = [...records, ...readMock()];
  writeMock(merged);
  dispatchTrashChanged();
}

function fireStorageChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("gf:storage-changed"));
  } catch {
    /* ignore */
  }
}

function dispatchTrashChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("gf:trash-changed"));
  } catch {
    /* ignore */
  }
  fireStorageChanged();
}

/* ---------- public API ---------- */

function toItem(n: NativeTrashItem, retentionDays: number): TrashItem {
  const purgeAt = retentionDays > 0 ? n.deletedAt + retentionDays * 86_400_000 : undefined;
  return {
    id: n.id,
    name: n.name || n.originalPath.split("/").pop() || n.id,
    originalPath: n.originalPath,
    isDirectory: n.isDirectory,
    size: n.size ?? 0,
    deletedAt: n.deletedAt,
    msUntilPurge: purgeAt != null ? Math.max(0, purgeAt - Date.now()) : undefined,
    trashPath: n.trashPath,
  };
}

export async function listTrashItems(): Promise<TrashListing> {
  const retention = loadTrashRetention();
  if (isAndroidNative()) {
    const p = nativePlugin();
    if (!p) return { items: [], totalBytes: 0 };
    try {
      const res = await p.listTrash();
      // Parent-existence probe: best-effort via stat.
      const items: TrashItem[] = [];
      for (const raw of res.items) {
        const base = toItem(raw, retention);
        const parent = raw.originalPath ? raw.originalPath.split("/").slice(0, -1).join("/") : "";
        let originalParentExists: boolean | undefined = undefined;
        if (parent) {
          try {
            await p.stat({ path: parent });
            originalParentExists = true;
          } catch {
            originalParentExists = false;
          }
        }
        items.push({ ...base, originalParentExists });
      }
      const totalBytes = items.reduce((s, it) => s + (it.size || 0), 0);
      return { items, totalBytes };
    } catch {
      return { items: [], totalBytes: 0 };
    }
  }
  const mock = readMock();
  const items: TrashItem[] = mock.map((m) => {
    const purgeAt = retention > 0 ? m.deletedAt + retention * 86_400_000 : undefined;
    return {
      id: m.id,
      name: m.name,
      originalPath: m.originalPath,
      isDirectory: m.isDirectory,
      size: m.size,
      deletedAt: m.deletedAt,
      msUntilPurge: purgeAt != null ? Math.max(0, purgeAt - Date.now()) : undefined,
      originalParentExists: true,
    };
  });
  return { items, totalBytes: items.reduce((s, it) => s + (it.size || 0), 0) };
}

export async function usageTrash(): Promise<{ count: number; bytes: number }> {
  const { items, totalBytes } = await listTrashItems();
  return { count: items.length, bytes: totalBytes };
}

export async function restoreItems(
  items: TrashItem[],
  opts: RestoreOptions = {},
): Promise<RestoreOutcome> {
  if (items.length === 0) return { restored: 0, failed: [] };

  if (isAndroidNative()) {
    const p = nativePlugin();
    if (!p)
      return {
        restored: 0,
        failed: items.map((it) => ({ id: it.id, name: it.name, reason: "MOVE_FAILED" as const })),
      };
    const payload = items.map((it) => ({
      id: it.id,
      targetPath: opts.targetPath ? joinAbs(opts.targetPath, it.name) : undefined,
    }));
    let res: NativeRestoreResult;
    try {
      res = await p.restoreFromTrash({ items: payload });
    } catch {
      return {
        restored: 0,
        failed: items.map((it) => ({ id: it.id, name: it.name, reason: "MOVE_FAILED" as const })),
      };
    }
    const failed: RestoreOutcome["failed"] = res.failed.map((f) => {
      const it = items.find((i) => i.id === f.id);
      return {
        id: f.id,
        name: it?.name ?? f.id,
        reason: f.reason,
        originalPath: f.originalPath ?? it?.originalPath,
      };
    });
    recordOperation({
      kind: "copy",
      summary:
        res.restored.length === 1
          ? `Restauré « ${items.find((i) => i.id === res.restored[0].id)?.name ?? ""} »`
          : `${res.restored.length} éléments restaurés depuis la Corbeille`,
      names: items.map((i) => i.name),
      succeeded: res.restored.length,
      failed: failed.length,
    });
    dispatchTrashChanged();
    return { restored: res.restored.length, failed };
  }

  // Mock — splice snapshots back into the mock fs tree.
  const mock = readMock();
  const failed: RestoreOutcome["failed"] = [];
  const removedIds = new Set<string>();
  for (const it of items) {
    const rec = mock.find((m) => m.id === it.id);
    if (!rec) {
      failed.push({ id: it.id, name: it.name, reason: "MISSING" });
      continue;
    }
    const target = opts.targetPath
      ? parseMockPath(opts.targetPath)
      : { rootId: rec.rootId, segments: rec.parentSegments };
    if (!target) {
      failed.push({ id: it.id, name: it.name, reason: "NO_TARGET" });
      continue;
    }
    const parent = mockResolve(target);
    if (!parent) {
      failed.push({
        id: it.id,
        name: it.name,
        reason: "PARENT_MISSING",
        originalPath: rec.originalPath,
      });
      continue;
    }
    if (!parent.children) parent.children = [];
    // Avoid clash.
    let node: MockNode = JSON.parse(JSON.stringify(rec.snapshot));
    let n = 2;
    while (parent.children.some((c) => c.name === node.name)) {
      const dot = node.name.lastIndexOf(".");
      node = {
        ...node,
        name:
          !node.isDirectory && dot > 0
            ? `${node.name.slice(0, dot)} (${n})${node.name.slice(dot)}`
            : `${node.name} (${n})`,
      };
      n++;
    }
    parent.children.push(node);
    removedIds.add(it.id);
  }
  writeMock(mock.filter((m) => !removedIds.has(m.id)));
  const restored = removedIds.size;
  recordOperation({
    kind: "copy",
    summary:
      restored === 1
        ? `Restauré « ${items[0].name} »`
        : `${restored} éléments restaurés depuis la Corbeille`,
    names: items.map((i) => i.name),
    succeeded: restored,
    failed: failed.length,
  });
  dispatchTrashChanged();
  return { restored, failed };
}

export async function permanentDelete(items: TrashItem[]): Promise<{
  deleted: number;
  failed: string[];
}> {
  if (items.length === 0) return { deleted: 0, failed: [] };
  if (isAndroidNative()) {
    const p = nativePlugin();
    if (!p) return { deleted: 0, failed: items.map((i) => i.id) };
    try {
      const res = await p.permanentDeleteInTrash({ ids: items.map((i) => i.id) });
      recordOperation({
        kind: "delete",
        summary:
          res.deleted.length === 1
            ? `Suppression définitive de « ${items[0].name} »`
            : `${res.deleted.length} éléments supprimés définitivement`,
        names: items.map((i) => i.name),
        succeeded: res.deleted.length,
        failed: res.failed.length,
      });
      dispatchTrashChanged();
      return { deleted: res.deleted.length, failed: res.failed };
    } catch {
      return { deleted: 0, failed: items.map((i) => i.id) };
    }
  }
  const mock = readMock();
  const ids = new Set(items.map((i) => i.id));
  writeMock(mock.filter((m) => !ids.has(m.id)));
  recordOperation({
    kind: "delete",
    summary:
      items.length === 1
        ? `Suppression définitive de « ${items[0].name} »`
        : `${items.length} éléments supprimés définitivement`,
    names: items.map((i) => i.name),
    succeeded: items.length,
    failed: 0,
  });
  dispatchTrashChanged();
  return { deleted: items.length, failed: [] };
}

export async function emptyTrash(): Promise<{ deleted: number; failed: number }> {
  if (isAndroidNative()) {
    const p = nativePlugin();
    if (!p) return { deleted: 0, failed: 0 };
    try {
      const res = await p.emptyTrash();
      recordOperation({
        kind: "delete",
        summary: `Corbeille vidée (${res.deleted})`,
        names: [],
        succeeded: res.deleted,
        failed: res.failed,
      });
      dispatchTrashChanged();
      return res;
    } catch {
      return { deleted: 0, failed: 0 };
    }
  }
  const count = readMock().length;
  writeMock([]);
  recordOperation({
    kind: "delete",
    summary: `Corbeille vidée (${count})`,
    names: [],
    succeeded: count,
    failed: 0,
  });
  dispatchTrashChanged();
  return { deleted: count, failed: 0 };
}

/**
 * Sweep the trash for items older than the current retention setting.
 * Runs at most once every 12 hours to stay lightweight.
 */
export async function autoPurgeTrash(force = false): Promise<{ deleted: number }> {
  const retention = loadTrashRetention();
  if (retention <= 0) return { deleted: 0 };
  const last = loadTrashLastPurgeAt();
  const now = Date.now();
  if (!force && now - last < 12 * 3600 * 1000) return { deleted: 0 };
  markTrashPurged(now);
  const { items } = await listTrashItems();
  const cutoff = now - retention * 86_400_000;
  const expired = items.filter((it) => it.deletedAt < cutoff);
  if (expired.length === 0) return { deleted: 0 };
  const res = await permanentDelete(expired);
  return { deleted: res.deleted };
}

/* ---------- helpers ---------- */

function joinAbs(base: string, name: string): string {
  return `${base.replace(/\/$/, "")}/${name}`;
}

/** Convert a native absolute path into a mock PathRef (best effort). */
function parseMockPath(abs: string): PathRef | null {
  const base = "/storage/emulated/0";
  if (!abs.startsWith(base)) return null;
  const rest = abs.slice(base.length).replace(/^\//, "");
  const parts = rest.split("/").filter(Boolean);
  return { rootId: "internal", segments: parts };
}

export function trashAbsPath(): string {
  return `${toAbsolutePath({ rootId: "internal", segments: [] })}/.GeniusFilesTrash`;
}
