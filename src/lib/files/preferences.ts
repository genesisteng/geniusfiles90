import type { PathRef, SortKey, SortOrder, ViewMode } from "./types";
import { t } from "@/lib/i18n";

const KEYS = {
  view: "gf.files.view",
  sort: "gf.files.sort",
  folders: "gf.files.foldersFirst",

  recents: "gf.files.recents",
  trashRetention: "gf.files.trashRetentionDays",
  trashLastPurge: "gf.files.trashLastPurgeAt",
} as const;

/** Retention in days; -1 means "keep until manual deletion". */
export type TrashRetentionDays = 7 | 30 | 60 | 90 | -1;

export const TRASH_RETENTION_OPTIONS: { value: TrashRetentionDays; label: string }[] = [
  { value: 7, label: "7 jours" },
  { value: 30, label: "30 jours" },
  { value: 60, label: "60 jours" },
  { value: 90, label: "90 jours" },
  { value: -1, label: t("settings.trash.option.manual") },
];

export function loadTrashRetention(): TrashRetentionDays {
  const raw = safeGetTop("gf.files.trashRetentionDays");
  if (!raw) return 30;
  const n = Number.parseInt(raw, 10);
  if (n === 7 || n === 30 || n === 60 || n === 90 || n === -1) return n;
  return 30;
}
export function saveTrashRetention(days: TrashRetentionDays) {
  safeSetTop("gf.files.trashRetentionDays", String(days));
}

export function loadTrashLastPurgeAt(): number {
  const raw = safeGetTop("gf.files.trashLastPurgeAt");
  return raw ? Number.parseInt(raw, 10) || 0 : 0;
}
export function markTrashPurged(now = Date.now()) {
  safeSetTop("gf.files.trashLastPurgeAt", String(now));
}

function safeGetTop(k: string) {
  return safeGet(k);
}
function safeSetTop(k: string, v: string) {
  safeSet(k, v);
}

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function loadView(): ViewMode {
  return safeGet(KEYS.view) === "grid" ? "grid" : "list";
}
export function saveView(v: ViewMode) {
  safeSet(KEYS.view, v);
}

export function loadSort(): { key: SortKey; order: SortOrder } {
  const raw = safeGet(KEYS.sort);
  if (!raw) return { key: "name", order: "asc" };
  try {
    const parsed = JSON.parse(raw) as { key: SortKey; order: SortOrder };
    return parsed;
  } catch {
    return { key: "name", order: "asc" };
  }
}
export function saveSort(sort: { key: SortKey; order: SortOrder }) {
  safeSet(KEYS.sort, JSON.stringify(sort));
}

export function loadFoldersFirst(): boolean {
  const v = safeGet(KEYS.folders);
  return v == null ? true : v === "1";
}
export function saveFoldersFirst(on: boolean) {
  safeSet(KEYS.folders, on ? "1" : "0");
}

export type StoredPath = PathRef & { name: string; addedAt: number };

export type RecentItem = {
  name: string;
  rootId: PathRef["rootId"];
  segments: string[];
  isDirectory: boolean;
  openedAt: number;
};

export function loadRecents(): RecentItem[] {
  const raw = safeGet(KEYS.recents);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RecentItem[];
  } catch {
    return [];
  }
}
export function pushRecent(item: Omit<RecentItem, "openedAt">, max = 12): RecentItem[] {
  const list = loadRecents().filter(
    (r) => !(r.rootId === item.rootId && r.segments.join("/") === item.segments.join("/")),
  );
  const next: RecentItem[] = [{ ...item, openedAt: Date.now() }, ...list].slice(0, max);
  safeSet(KEYS.recents, JSON.stringify(next));
  return next;
}
