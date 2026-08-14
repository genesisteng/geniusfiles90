/**
 * Coffre-fort — high-level API used by the UI.
 *
 * Native (Android):
 *   Physical files/directories live under
 *   `/storage/emulated/0/.GeniusFilesVault/<id>[.ext]`. The parent
 *   directory is dot-prefixed, so `src/lib/files/fs.ts` filters it out
 *   of every public listing without any extra bookkeeping.
 *
 * Web preview:
 *   Files are removed from the mock filesystem tree and their snapshot
 *   is kept inside the vault index. Restore splices them back at the
 *   original (or chosen) location.
 *
 * All operations are transactional at the item level: the index is
 * updated ONLY after the physical move / delete succeeded, and vice
 * versa, so an app crash mid-batch can never lose a file — it either
 * still lives in its origin OR it lives in the vault.
 */
import { toast } from "sonner";
import { extOf, kindOf } from "@/lib/files/format";
import { mockMutate, mockResolve, toAbsolutePath, type MockNode } from "@/lib/files/fs";
import { recordOperation } from "@/lib/files/history";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { isAndroidNative, nativePlugin } from "@/lib/native/geniusfiles-native";
import {
  appendAccessLog,
  readFolders,
  readItems,
  removeItems as removeItemsFromIndex,
  upsertItem,
  writeFolders,
  writeItems,
  clearVaultData,
} from "./store";
import type {
  PublicSource,
  VaultAddResult,
  VaultDeleteResult,
  VaultFolder,
  VaultItem,
  VaultListing,
  VaultProgress,
  VaultRestoreResult,
  VaultSortKey,
  VaultSortOrder,
} from "./types";
import { t } from "@/lib/i18n";

const VAULT_DIR_NAME = ".GeniusFilesVault";

/* ---------------- helpers ---------------- */

function vaultBaseAbs(): string {
  return `${toAbsolutePath({ rootId: "internal", segments: [] })}/${VAULT_DIR_NAME}`;
}

function newId(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function join(base: string, name: string): string {
  return `${base.replace(/\/$/, "")}/${name}`;
}

async function ensureVaultDir(): Promise<void> {
  if (!isAndroidNative()) return;
  const p = nativePlugin();
  if (!p) return;
  try {
    await p.createDirectory({ path: vaultBaseAbs() });
  } catch {
    /* already exists — fine */
  }
}

function estimateEta(elapsed: number, done: number, total: number): number | undefined {
  if (done <= 0 || total <= 0 || done >= total) return undefined;
  return Math.max(0, Math.round((elapsed / done) * (total - done)));
}

function sumMock(node: MockNode): number {
  if (!node.isDirectory) return node.size ?? 0;
  return (node.children ?? []).reduce((s, c) => s + sumMock(c), 0);
}

function fireStorageChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("gf:storage-changed"));
  } catch {
    /* ignore */
  }
}

/* ---------------- listing ---------------- */

export function listVault(folderId: string | null): VaultListing {
  const folders = readFolders()
    .filter((f) => f.parentId === folderId)
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  const items = readItems().filter((i) => i.folderId === folderId);
  return { folders, items };
}

export function findFolder(id: string | null): VaultFolder | null {
  if (!id) return null;
  return readFolders().find((f) => f.id === id) ?? null;
}

export function folderPath(folderId: string | null): VaultFolder[] {
  if (!folderId) return [];
  const map = new Map(readFolders().map((f) => [f.id, f] as const));
  const chain: VaultFolder[] = [];
  let cur: string | null = folderId;
  while (cur) {
    const node = map.get(cur);
    if (!node) break;
    chain.unshift(node);
    cur = node.parentId;
  }
  return chain;
}

export function sortItems(
  items: VaultItem[],
  key: VaultSortKey,
  order: VaultSortOrder,
): VaultItem[] {
  const dir = order === "asc" ? 1 : -1;
  const sorted = [...items].sort((a, b) => {
    switch (key) {
      case "name":
        return dir * a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
      case "size":
        return dir * ((a.size ?? 0) - (b.size ?? 0));
      case "type":
        return dir * (a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
      case "date":
      default:
        return dir * (a.addedAt - b.addedAt);
    }
  });
  return sorted;
}

export function searchAll(query: string): VaultItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return readItems().filter((i) => i.name.toLowerCase().includes(q));
}

export function favorites(): VaultItem[] {
  return readItems().filter((i) => i.favorite);
}

export function usageVault(): { count: number; bytes: number } {
  const items = readItems();
  return {
    count: items.length,
    bytes: items.reduce((s, i) => s + (i.size ?? 0), 0),
  };
}

/* ---------------- folder mutations ---------------- */

export function createFolder(
  name: string,
  parentId: string | null,
): {
  ok: boolean;
  error?: string;
  folder?: VaultFolder;
} {
  const clean = name.trim();
  if (!clean || /[\\/]/.test(clean)) return { ok: false, error: t("vault.error.invalidName") };
  const siblings = readFolders().filter((f) => f.parentId === parentId);
  if (siblings.some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
    return { ok: false, error: t("vault.error.nameExists") };
  }
  const folder: VaultFolder = {
    id: newId(),
    name: clean,
    parentId,
    createdAt: Date.now(),
  };
  writeFolders([...readFolders(), folder]);
  appendAccessLog({ action: "folder.create", detail: clean });
  return { ok: true, folder };
}

export function renameFolder(id: string, name: string): { ok: boolean; error?: string } {
  const clean = name.trim();
  if (!clean || /[\\/]/.test(clean)) return { ok: false, error: t("vault.error.invalidName") };
  const list = readFolders();
  const target = list.find((f) => f.id === id);
  if (!target) return { ok: false, error: t("vault.error.folderNotFound") };
  const siblings = list.filter((f) => f.parentId === target.parentId && f.id !== id);
  if (siblings.some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
    return { ok: false, error: t("vault.error.nameExists") };
  }
  target.name = clean;
  writeFolders(list);
  appendAccessLog({ action: "folder.rename", detail: clean });
  return { ok: true };
}

export function deleteEmptyFolder(id: string): { ok: boolean; error?: string } {
  const items = readItems();
  const folders = readFolders();
  const hasItems = items.some((i) => i.folderId === id);
  const hasChildren = folders.some((f) => f.parentId === id);
  if (hasItems || hasChildren) return { ok: false, error: t("vault.error.folderNotEmpty") };
  writeFolders(folders.filter((f) => f.id !== id));
  appendAccessLog({ action: "folder.delete" });
  return { ok: true };
}

export function moveItemsToFolder(ids: string[], folderId: string | null): void {
  const set = new Set(ids);
  const items = readItems().map((i) => (set.has(i.id) ? { ...i, folderId } : i));
  writeItems(items);
}

export function toggleFavorite(id: string): void {
  const items = readItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return;
  items[idx] = { ...items[idx], favorite: !items[idx].favorite };
  writeItems(items);
  appendAccessLog({ action: "favorite", detail: items[idx].name });
}

/* ---------------- add (move into vault) ---------------- */

export type AddOptions = {
  folderId: string | null;
  onProgress?: (p: VaultProgress) => void;
  signal?: { cancelled: boolean };
};

export async function addFromPublic(
  sources: PublicSource[],
  opts: AddOptions,
): Promise<VaultAddResult> {
  await ensureVaultDir();

  const failed: VaultAddResult["failed"] = [];
  let added = 0;

  const started = Date.now();
  let bytesDone = 0;
  const total = sources.length;
  const totalBytes = sources.reduce((s, x) => s + (x.size || 0), 0);

  const emit = (name: string) => {
    opts.onProgress?.({
      completed: added + failed.length,
      total,
      bytes: bytesDone,
      totalBytes,
      currentName: name,
      elapsedMs: Date.now() - started,
      etaMs: estimateEta(Date.now() - started, bytesDone, totalBytes),
    });
  };
  emit(sources[0]?.name ?? "");

  for (const src of sources) {
    if (opts.signal?.cancelled) break;
    const id = newId();
    const ext = extOf(src.name);

    // Native path: move on disk, then commit to index.
    if (isAndroidNative()) {
      const p = nativePlugin();
      if (!p) {
        failed.push({ name: src.name, reason: t("vault.error.pluginUnavailable") });
        continue;
      }
      const sourceAbs = join(toAbsolutePath(src.parent), src.name);
      const vaultAbs = join(vaultBaseAbs(), ext ? `${id}.${ext}` : id);
      // Date réelle relevée avant le déplacement : elle sera restituée
      // telle quelle si l'élément ressort du coffre-fort.
      let originalMtime: number | undefined;
      try {
        const st = await p.stat({ path: sourceAbs });
        if (st?.mtime && st.mtime > 0) originalMtime = st.mtime;
      } catch {
        /* date inconnue : on ne fabrique jamais de valeur */
      }
      try {
        await p.moveFile({ source: sourceAbs, destination: vaultAbs, overwrite: false });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push({ name: src.name, reason: msg });
        continue;
      }
      upsertItem({
        id,
        name: src.name,
        folderId: opts.folderId,
        size: src.size,
        isDirectory: src.isDirectory,
        kind: kindOf(src.name, src.isDirectory),
        ext,
        addedAt: Date.now(),
        originalMtime,
        originalPath: sourceAbs,
        originalRootId: src.parent.rootId,
        originalParentSegments: src.parent.segments,
        vaultAbsolutePath: vaultAbs,
      });
      bytesDone += src.size || 0;
      added++;
      emit(src.name);
      continue;
    }

    // Mock path: extract from mock tree, snapshot in index.
    const parentNode = mockResolve(src.parent);
    if (!parentNode || !parentNode.children) {
      failed.push({ name: src.name, reason: t("vault.error.locationNotFound") });
      continue;
    }
    const child = parentNode.children.find((c) => c.name === src.name);
    if (!child) {
      failed.push({ name: src.name, reason: t("vault.error.fileNotFound") });
      continue;
    }
    const snapshot: MockNode = JSON.parse(JSON.stringify(child));
    mockMutate(src.parent, (n) => {
      if (!n.children) return null;
      n.children = n.children.filter((c) => c.name !== src.name);
      return null;
    });
    upsertItem({
      id,
      name: src.name,
      folderId: opts.folderId,
      size: snapshot.isDirectory ? sumMock(snapshot) : (snapshot.size ?? 0),
      isDirectory: snapshot.isDirectory,
      kind: kindOf(src.name, snapshot.isDirectory),
      ext,
      addedAt: Date.now(),
      originalMtime: snapshot.mtime,
      originalPath: `/${[...src.parent.segments, src.name].join("/")}`,
      originalRootId: src.parent.rootId,
      originalParentSegments: src.parent.segments,
      mockSnapshot: snapshot,
    });
    bytesDone += src.size || 0;
    added++;
    emit(src.name);
  }

  if (added > 0) {
    appendAccessLog({ action: "add", detail: `${added} élément${added > 1 ? "s" : ""}` });
    recordOperation({
      kind: "move",
      summary: t("vault.log.add", { count: added, name: sources[0]?.name ?? "" }),
      names: sources.map((s) => s.name),
      succeeded: added,
      failed: failed.length,
    });
    fireStorageChanged();
  }

  return { added, failed, cancelled: !!opts.signal?.cancelled };
}

/* ---------------- restore ---------------- */

export type RestoreOptions = {
  /** When set, restore into this folder instead of each item's origin. */
  targetPath?: PathRef;
  onProgress?: (p: VaultProgress) => void;
};

export async function restoreItems(
  items: VaultItem[],
  opts: RestoreOptions = {},
): Promise<VaultRestoreResult> {
  const failed: VaultRestoreResult["failed"] = [];
  const restoredIds: string[] = [];

  const started = Date.now();
  let bytesDone = 0;
  const totalBytes = items.reduce((s, i) => s + (i.size || 0), 0);

  const emit = (name: string) => {
    opts.onProgress?.({
      completed: restoredIds.length + failed.length,
      total: items.length,
      bytes: bytesDone,
      totalBytes,
      currentName: name,
      elapsedMs: Date.now() - started,
      etaMs: estimateEta(Date.now() - started, bytesDone, totalBytes),
    });
  };
  emit(items[0]?.name ?? "");

  for (const it of items) {
    if (isAndroidNative()) {
      const p = nativePlugin();
      if (!p) {
        failed.push({ id: it.id, name: it.name, reason: t("vault.error.pluginUnavailable") });
        continue;
      }
      const target: PathRef | null = opts.targetPath
        ? opts.targetPath
        : it.originalRootId
          ? { rootId: it.originalRootId, segments: it.originalParentSegments ?? [] }
          : null;
      if (!target) {
        failed.push({ id: it.id, name: it.name, reason: t("vault.error.originUnknown") });
        continue;
      }
      const targetAbs = join(toAbsolutePath(target), it.name);
      try {
        await p.moveFile({
          source: it.vaultAbsolutePath ?? "",
          destination: targetAbs,
          overwrite: false,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push({ id: it.id, name: it.name, reason: msg });
        continue;
      }
      restoredIds.push(it.id);
      bytesDone += it.size || 0;
      emit(it.name);
      continue;
    }

    // Mock: splice snapshot back
    const target: PathRef | null = opts.targetPath
      ? opts.targetPath
      : it.originalRootId
        ? { rootId: it.originalRootId, segments: it.originalParentSegments ?? [] }
        : null;
    if (!target) {
      failed.push({ id: it.id, name: it.name, reason: t("vault.error.originUnknown") });
      continue;
    }
    const parent = mockResolve(target);
    if (!parent) {
      failed.push({ id: it.id, name: it.name, reason: t("vault.error.destNotFound") });
      continue;
    }
    if (!parent.children) parent.children = [];
    const snapshot: MockNode = (it.mockSnapshot as MockNode | undefined)
      ? (JSON.parse(JSON.stringify(it.mockSnapshot)) as MockNode)
      : {
          name: it.name,
          isDirectory: it.isDirectory,
          size: it.size,
          mtime: it.originalMtime,
        };
    // Jamais la date de restauration : on restitue la date réelle connue.
    snapshot.mtime = snapshot.mtime ?? it.originalMtime;
    let node = snapshot;
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
    restoredIds.push(it.id);
    bytesDone += it.size || 0;
    emit(it.name);
  }

  if (restoredIds.length > 0) {
    removeItemsFromIndex(restoredIds);
    appendAccessLog({
      action: "restore",
      detail: `${restoredIds.length} élément${restoredIds.length > 1 ? "s" : ""}`,
    });
    recordOperation({
      kind: "copy",
      summary: t("vault.log.restore", { count: restoredIds.length, name: items[0]?.name ?? "" }),
      names: items.map((i) => i.name),
      succeeded: restoredIds.length,
      failed: failed.length,
    });
    fireStorageChanged();
  }
  return { restored: restoredIds.length, failed };
}

/* ---------------- permanent delete ---------------- */

export async function permanentDelete(items: VaultItem[]): Promise<VaultDeleteResult> {
  const failed: string[] = [];
  const deleted: string[] = [];
  for (const it of items) {
    if (isAndroidNative()) {
      const p = nativePlugin();
      if (!p || !it.vaultAbsolutePath) {
        // Sur appareil, sans chemin réel la suppression ne peut pas être
        // garantie : on ne prétend pas l'avoir effectuée.
        failed.push(it.id);
        continue;
      }
      try {
        await p.deletePath({ path: it.vaultAbsolutePath });
        deleted.push(it.id);
      } catch {
        failed.push(it.id);
      }
      continue;
    }
    // Web preview — nothing to delete on disk, just drop the entry.
    deleted.push(it.id);
  }
  if (deleted.length > 0) {
    removeItemsFromIndex(deleted);
    appendAccessLog({
      action: "delete",
      detail: `${deleted.length} élément${deleted.length > 1 ? "s" : ""}`,
    });
    recordOperation({
      kind: "delete",
      summary: t("vault.log.delete", { count: deleted.length, name: items[0]?.name ?? "" }),
      names: items.map((i) => i.name),
      succeeded: deleted.length,
      failed: failed.length,
    });
    fireStorageChanged();
  }
  return { deleted: deleted.length, failed };
}

/* ---------------- preview (native only, best-effort) ---------------- */

/**
 * Build a `FileEntry` + parent path pair suitable for opening the item
 * inside a lightweight inline viewer that speaks WebView-safe URLs.
 * On the web preview the vaultAbsolutePath does not exist — the caller
 * shows a placeholder in that case.
 */
export function toPreviewTarget(item: VaultItem): {
  parent: PathRef;
  entry: FileEntry;
  absolute?: string;
} {
  // Parent is the hidden vault folder; item filename is opaque `<id>[.ext]`.
  const parent: PathRef = { rootId: "internal", segments: [VAULT_DIR_NAME] };
  const filename = item.ext ? `${item.id}.${item.ext}` : item.id;
  const entry: FileEntry = {
    name: filename,
    path: `/${VAULT_DIR_NAME}/${filename}`,
    isDirectory: item.isDirectory,
    size: item.size,
    mtime: item.originalMtime ?? item.addedAt,
    kind: item.kind,
    ext: item.ext,
  };
  return { parent, entry, absolute: item.vaultAbsolutePath };
}

/* ---------------- reset (danger) ---------------- */

/**
 * Wipe every physical file the vault owns AND clear the index. Called
 * when the user hard-resets the vault credential.
 */
export async function wipeVault(): Promise<void> {
  const items = readItems();
  if (isAndroidNative()) {
    const p = nativePlugin();
    if (p) {
      for (const it of items) {
        if (!it.vaultAbsolutePath) continue;
        try {
          await p.deletePath({ path: it.vaultAbsolutePath });
        } catch {
          /* ignore */
        }
      }
    }
  }
  clearVaultData();
  fireStorageChanged();
}

/** Small helper so callers can surface a toast without importing sonner. */
export function toastError(msg: string): void {
  toast.error(msg);
}
