/**
 * Coffre-fort — persistent index (items + folders + access log).
 *
 * Kept in localStorage under `gf.vault.index`. Physical file bytes live
 * outside this index — on native, under `/storage/emulated/0/.GeniusFilesVault/`
 * (dot-prefixed → automatically hidden from every public listing by
 * `src/lib/files/fs.ts`); on the web preview, encoded inside
 * `mockSnapshot`.
 *
 * The index is written back atomically after every mutation so an app
 * kill mid-operation cannot orphan an entry that has already been moved
 * out of its public location — items are only added to the index AFTER
 * the physical move succeeds (see `api.ts`).
 */
import type { VaultAccessLogEntry, VaultFolder, VaultItem } from "./types";

const KEY_ITEMS = "gf.vault.items";
const KEY_FOLDERS = "gf.vault.folders";
const KEY_LOG = "gf.vault.log";
const LOG_MAX = 300;

function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

function fire() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("gf:vault-changed"));
    window.dispatchEvent(new CustomEvent("gf:storage-changed"));
  } catch {
    /* ignore */
  }
}

/* ---------------- Folders ---------------- */

export function readFolders(): VaultFolder[] {
  return readList<VaultFolder>(KEY_FOLDERS);
}

export function writeFolders(folders: VaultFolder[]): void {
  writeList(KEY_FOLDERS, folders);
  fire();
}

/* ---------------- Items ---------------- */

export function readItems(): VaultItem[] {
  return readList<VaultItem>(KEY_ITEMS);
}

export function writeItems(items: VaultItem[]): void {
  writeList(KEY_ITEMS, items);
  fire();
}

export function upsertItem(item: VaultItem): void {
  const list = readItems();
  const idx = list.findIndex((i) => i.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  writeItems(list);
}

export function removeItems(ids: string[]): void {
  const set = new Set(ids);
  writeItems(readItems().filter((i) => !set.has(i.id)));
}

/* ---------------- Access log ---------------- */

export function readAccessLog(): VaultAccessLogEntry[] {
  return readList<VaultAccessLogEntry>(KEY_LOG);
}

export function appendAccessLog(
  entry: Omit<VaultAccessLogEntry, "id" | "at">,
): VaultAccessLogEntry {
  const rec: VaultAccessLogEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    ...entry,
  };
  const list = [rec, ...readAccessLog()].slice(0, LOG_MAX);
  writeList(KEY_LOG, list);
  return rec;
}

export function clearVaultData(): void {
  writeItems([]);
  writeFolders([]);
  writeList(KEY_LOG, []);
}
