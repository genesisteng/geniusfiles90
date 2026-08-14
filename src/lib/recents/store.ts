/**
 * Journal local des « Fichiers récents ».
 *
 * Base locale légère (localStorage) alimentée en continu par les actions
 * réelles de l'utilisateur : ouverture, création, modification, copie,
 * déplacement, renommage, partage, téléchargement.
 *
 * Objectifs :
 * - jamais de données fictives : seules les actions effectivement
 *   réalisées produisent une entrée ;
 * - dédoublonnage strict par fichier (un fichier ouvert dix fois
 *   n'apparaît qu'une seule fois, avec sa date de dernière utilisation) ;
 * - lecture instantanée : aucune analyse du stockage n'est relancée.
 */
import { t } from "@/lib/i18n";
import type { FileEntry, FileKind, PathRef, StorageRootId } from "@/lib/files/types";
import { kindOf } from "@/lib/files/format";
import { subscribeFsPatch } from "@/lib/index/patches";

export type RecentReason =
  | "open"
  | "edit"
  | "create"
  | "copy"
  | "move"
  | "rename"
  | "share"
  | "download";

/** Un fichier récent — même forme qu'une `FileEntry` + son emplacement. */
export type RecentFile = FileEntry & {
  rootId: StorageRootId;
  folderSegments: string[];
  /** Date de dernière utilisation (ms epoch). */
  at: number;
  reason: RecentReason;
};

const KEY = "gf.recents.v1";
const MAX = 300;
/** Fenêtre affichée par la page dédiée : 48 h. */
export const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const EVENT = "gf:recents-changed";

function idOf(rootId: string, segments: string[], name: string): string {
  return `${rootId}::${segments.join("/")}::${name}`;
}

export function recentId(f: RecentFile): string {
  return idOf(f.rootId, f.folderSegments, f.name);
}

function read(): RecentFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentFile[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => r && typeof r.name === "string" && typeof r.at === "number");
  } catch {
    return [];
  }
}

function write(items: RecentFile[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* quota / mode privé */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Tous les fichiers récents connus, du plus récent au plus ancien. */
export function loadRecentFiles(): RecentFile[] {
  return read().sort((a, b) => b.at - a.at);
}

/** Fichiers récents des 48 dernières heures. */
export function loadRecentWindow(now = Date.now()): RecentFile[] {
  const min = now - RECENT_WINDOW_MS;
  return loadRecentFiles().filter((r) => r.at >= min);
}

/** S'abonne aux mises à jour (même onglet + autres onglets). */
export function subscribeRecents(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) listener();
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

type TouchInput = {
  rootId: StorageRootId;
  folderSegments: string[];
  name: string;
  isDirectory?: boolean;
  kind?: FileKind;
  size?: number;
  mtime?: number;
  ext?: string;
};

function extOf(name: string): string | undefined {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return undefined;
  return name.slice(i + 1).toLowerCase();
}

/**
 * Enregistre (ou rafraîchit) un fichier récent. Les dossiers sont
 * ignorés : la section liste des fichiers.
 */
export function touchRecent(input: TouchInput, reason: RecentReason, at = Date.now()) {
  if (typeof window === "undefined") return;
  if (input.isDirectory) return;
  if (!input.name) return;
  const segments = input.folderSegments ?? [];
  const id = idOf(input.rootId, segments, input.name);
  const items = read().filter((r) => recentId(r) !== id);
  const record: RecentFile = {
    name: input.name,
    path: [...segments, input.name].join("/"),
    isDirectory: false,
    size: input.size,
    mtime: input.mtime ?? at,
    kind: input.kind ?? kindOf(input.name, false),
    ext: input.ext ?? extOf(input.name),
    rootId: input.rootId,
    folderSegments: segments,
    at,
    reason,
  };
  items.unshift(record);
  write(items.sort((a, b) => b.at - a.at));
}

/** Variante pratique à partir d'un dossier parent + entrée listée. */
export function touchRecentEntry(parent: PathRef, entry: FileEntry, reason: RecentReason) {
  touchRecent(
    {
      rootId: parent.rootId,
      folderSegments: parent.segments,
      name: entry.name,
      isDirectory: entry.isDirectory,
      kind: entry.kind,
      size: entry.size,
      mtime: entry.mtime,
      ext: entry.ext,
    },
    reason,
  );
}

/** Plusieurs fichiers d'un même dossier en une passe. */
export function touchRecentNames(
  rootId: StorageRootId,
  folderSegments: string[],
  names: string[],
  reason: RecentReason,
) {
  const at = Date.now();
  for (const name of names) touchRecent({ rootId, folderSegments, name }, reason, at);
}

/** Retire des fichiers du journal (suppression, déplacement, renommage). */
export function forgetRecents(rootId: StorageRootId, folderSegments: string[], names: string[]) {
  if (typeof window === "undefined" || names.length === 0) return;
  const ids = new Set(names.map((n) => idOf(rootId, folderSegments, n)));
  const items = read();
  const next = items.filter((r) => !ids.has(recentId(r)));
  if (next.length !== items.length) write(next);
}

export function clearRecents() {
  write([]);
}

/* --------------------------- présentation --------------------------- */

const ROOT_LABEL_KEY: Record<string, string> = {
  internal: "storage.internal",
  documents: "category.documents",
  downloads: "category.downloads",
  pictures: "category.images",
  movies: "category.videos",
  music: "files.recent.rootMusic",
  sdcard: "storage.sdCard",
};

function rootLabel(rootId: string): string | undefined {
  const key = ROOT_LABEL_KEY[rootId];
  return key ? t(key) : undefined;
}

/** Emplacement lisible et discret affiché sous le nom du fichier. */
export function recentLocationLabel(f: RecentFile): string {
  const last = f.folderSegments[f.folderSegments.length - 1];
  if (last) return last;
  return (
    rootLabel(f.rootId) ??
    (f.rootId.startsWith("ext:") ? t("storage.external") : t("files.recent.rootFallback"))
  );
}

const TIME_FMT = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const DAY_FMT = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** « Il y a 18 min », « Hier • 21:34 », « 12 mars • 09:15 ». */
export function formatRecentTime(at: number, now = Date.now()): string {
  const diff = Math.max(0, now - at);
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return t("files.recent.justNow");
  if (minutes < 60) return t("files.recent.minutesAgo", { count: minutes });
  const d = new Date(at);
  const today = new Date(now);
  if (isSameDay(d, today)) {
    const hours = Math.round(minutes / 60);
    return hours < 6 ? `Il y a ${hours} h` : `Aujourd'hui • ${TIME_FMT.format(d)}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, yesterday)) return `Hier • ${TIME_FMT.format(d)}`;
  return `${DAY_FMT.format(d)} • ${TIME_FMT.format(d)}`;
}

export function formatRecentClock(at: number): string {
  return TIME_FMT.format(new Date(at));
}

export type RecentGroup<T = RecentFile> = { key: string; label: string; files: T[] };

/** Regroupe par jour : Aujourd'hui, Hier, puis date. */
export function groupRecents<T extends { at: number }>(
  files: T[],
  now = Date.now(),
): RecentGroup<T>[] {
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const groups: RecentGroup<T>[] = [];
  const index = new Map<string, RecentGroup<T>>();
  for (const f of files) {
    const d = new Date(f.at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let group = index.get(key);
    if (!group) {
      const label = isSameDay(d, today)
        ? "Aujourd'hui"
        : isSameDay(d, yesterday)
          ? "Hier"
          : DAY_FMT.format(d);
      group = { key, label, files: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.files.push(f);
  }
  return groups;
}

/* ─────────────────────────────────────────────────────────────
   Synchronisation avec les mutations du stockage.

   Les fichiers récents ne peuvent jamais pointer vers un fichier
   disparu ou renommé : le journal suit les patchs en direct, sans
   analyse ni rechargement.
   ───────────────────────────────────────────────────────────── */
subscribeFsPatch((patch) => {
  if (typeof window === "undefined") return;
  try {
    if (patch.op === "rename") {
      const oldId = idOf(patch.rootId, patch.segments, patch.oldName);
      const items = read();
      let touched = false;
      const next = items.map((r) => {
        if (recentId(r) !== oldId) return r;
        touched = true;
        return {
          ...r,
          name: patch.newName,
          path: [...patch.segments, patch.newName].join("/"),
          kind: kindOf(patch.newName, false),
          ext: extOf(patch.newName),
        };
      });
      if (touched) write(next);
      return;
    }
    if (patch.op === "delete") {
      forgetRecents(patch.rootId, patch.segments, [patch.name]);
      return;
    }
    if (patch.op === "move") {
      const fromId = idOf(patch.fromRootId, patch.fromSegments, patch.fromName);
      const items = read();
      let touched = false;
      const next = items.map((r) => {
        if (recentId(r) !== fromId) return r;
        touched = true;
        return {
          ...r,
          rootId: patch.toRootId,
          folderSegments: [...patch.toSegments],
          name: patch.toName,
          path: [...patch.toSegments, patch.toName].join("/"),
        };
      });
      if (touched) write(next);
    }
  } catch {
    /* le journal reste utilisable même si un patch est illisible */
  }
});
