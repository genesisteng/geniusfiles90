/**
 * Détection des « fichiers récemment ajoutés au stockage ».
 *
 * Contrairement au journal d'usage (`./store`), ce module ne dépend
 * d'aucune action réalisée dans GeniusFiles : il observe la date réelle
 * d'apparition des fichiers dans le stockage (téléchargement terminé,
 * photo prise, réception Bluetooth / Quick Share, copie, extraction,
 * document créé…). Consulter un fichier ne change jamais cette date.
 *
 * Performances :
 * - aucune analyse complète du stockage ; seuls les dossiers « chauds »
 *   (Téléchargements, DCIM, Bluetooth, Quick Share, Documents…) sont
 *   parcourus, sur deux niveaux et avec un plafond strict de dossiers ;
 * - le résultat est mis en cache localement : la page d'accueil affiche
 *   immédiatement la dernière liste connue puis se rafraîchit en fond ;
 * - surveillance légère : rafraîchissement au retour au premier plan,
 *   après toute mutation du stockage et par sondage discret.
 */
import { t } from "@/lib/i18n";
import { listDirectory, getExternalVolumes, toAbsolutePath } from "@/lib/files/fs";
import { subscribeFsPatch } from "@/lib/index/patches";
import { extOf, kindOf } from "@/lib/files/format";
import type { FileEntry, FileKind, PathRef, StorageRootId } from "@/lib/files/types";

export type AddedFile = FileEntry & {
  rootId: StorageRootId;
  folderSegments: string[];
  /** Date réelle d'ajout au stockage (ms epoch). */
  at: number;
};

const KEY = "gf.added.v1";
const EVENT = "gf:added-changed";
const MAX_ITEMS = 600;
const MAX_DIRS = 140;
const MAX_DEPTH = 3;
/** Fenêtre affichée par la page dédiée : 7 jours. */
export const ADDED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const POLL_MS = 20_000;
const MIN_INTERVAL_MS = 4_000;

const SKIP_DIRS = new Set([
  "android",
  "cache",
  "caches",
  "code_cache",
  "thumbnails",
  "thumbs",
  "lost.dir",
  "lost+found",
  ".trash",
  ".trashed",
]);

/** Dossiers déjà couverts par une racine dédiée — évite les doublons. */
const INTERNAL_ALIASES = new Set([
  "download",
  "downloads",
  "pictures",
  "movies",
  "music",
  "documents",
  "dcim",
  "bluetooth",
  "quickshare",
  "quick share",
]);

function seeds(): PathRef[] {
  const list: PathRef[] = [
    { rootId: "downloads", segments: [] },
    { rootId: "pictures", segments: [] },
    { rootId: "movies", segments: [] },
    { rootId: "music", segments: [] },
    { rootId: "documents", segments: [] },
    { rootId: "internal", segments: ["DCIM"] },
    { rootId: "internal", segments: ["Bluetooth"] },
    { rootId: "internal", segments: ["QuickShare"] },
    { rootId: "internal", segments: ["Quick Share"] },
    { rootId: "internal", segments: [] },
  ];
  for (const v of getExternalVolumes()) list.push({ rootId: v.id, segments: [] });
  return list;
}

export function addedId(f: AddedFile): string {
  return `${f.rootId}::${f.folderSegments.join("/")}::${f.name}`;
}

function readCache(): AddedFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AddedFile[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((f) => f && typeof f.name === "string" && typeof f.at === "number");
  } catch {
    return [];
  }
}

function writeCache(items: AddedFile[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* quota / mode privé */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Dernière liste connue — lecture instantanée, aucun accès disque. */
export function loadAddedFiles(): AddedFile[] {
  return readCache();
}

/** Fichiers ajoutés durant la fenêtre récente (7 jours par défaut). */
export function loadAddedWindow(now = Date.now()): AddedFile[] {
  const min = now - ADDED_WINDOW_MS;
  return readCache().filter((f) => f.at >= min);
}

export function subscribeAdded(listener: () => void): () => void {
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

let scanning: Promise<AddedFile[]> | null = null;
let lastScanAt = 0;

async function scan(force = false): Promise<AddedFile[]> {
  const found = new Map<string, AddedFile>();
  const queue: { path: PathRef; depth: number }[] = seeds().map((p) => ({ path: p, depth: 0 }));
  const visited = new Set<string>();
  let dirs = 0;

  while (queue.length > 0 && dirs < MAX_DIRS) {
    const { path, depth } = queue.shift()!;
    const key = `${path.rootId}::${path.segments.join("/")}`;
    if (visited.has(key)) continue;
    visited.add(key);
    dirs++;

    const res = await listDirectory(path, { force });
    if (!res.ok) continue;

    for (const entry of res.entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory) {
        if (depth >= MAX_DEPTH) continue;
        const lower = entry.name.toLowerCase();
        if (SKIP_DIRS.has(lower)) continue;
        if (path.rootId === "internal" && depth === 0 && INTERNAL_ALIASES.has(lower)) continue;
        queue.push({
          path: { rootId: path.rootId, segments: [...path.segments, entry.name] },
          depth: depth + 1,
        });
        continue;
      }
      const at = entry.mtime ?? 0;
      if (!at) continue;
      const file: AddedFile = {
        ...entry,
        kind: entry.kind as FileKind,
        rootId: path.rootId,
        folderSegments: path.segments,
        at,
      };
      const id = addedId(file);
      const existing = found.get(id);
      if (!existing || existing.at < at) found.set(id, file);
    }

    // Laisse respirer l'UI entre deux dossiers.
    if (dirs % 6 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  return [...found.values()].sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS);
}

/**
 * Rafraîchit la liste en arrière-plan. Les appels rapprochés sont
 * fusionnés ; un scan en cours n'est jamais dupliqué.
 */
export async function refreshAddedFiles(force = false): Promise<AddedFile[]> {
  if (typeof window === "undefined") return [];
  if (scanning) return scanning;
  const now = Date.now();
  if (!force && now - lastScanAt < MIN_INTERVAL_MS) return readCache();
  scanning = scan(force)
    .then((items) => {
      lastScanAt = Date.now();
      const before = readCache();
      const changed =
        before.length !== items.length ||
        items.some((f, i) => before[i]?.at !== f.at || addedId(before[i]) !== addedId(f));
      if (changed) writeCache(items);
      return items;
    })
    .catch(() => readCache())
    .finally(() => {
      scanning = null;
    });
  return scanning;
}

/**
 * Surveillance légère du stockage : premier plan, mutations internes et
 * sondage espacé. Retourne la fonction d'arrêt.
 */
let watchers = 0;
let stopWatch: (() => void) | null = null;

export function watchAddedFiles(): () => void {
  if (typeof window === "undefined") return () => {};
  watchers += 1;
  if (watchers === 1) {
    let debounce: number | null = null;
    /* Une rafale d'événements (mutations disque + retour au premier plan)
       ne doit déclencher qu'un seul balayage, en fin de rafale. */
    const kick = () => {
      if (debounce != null) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        debounce = null;
        void refreshAddedFiles();
      }, 300);
    };
    void refreshAddedFiles();
    const onVisible = () => {
      if (document.visibilityState === "visible") kick();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") kick();
    }, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", kick);
    window.addEventListener("gf:storage-changed", kick);
    stopWatch = () => {
      if (debounce != null) window.clearTimeout(debounce);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", kick);
      window.removeEventListener("gf:storage-changed", kick);
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    watchers = Math.max(0, watchers - 1);
    if (watchers === 0) {
      stopWatch?.();
      stopWatch = null;
    }
  };
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

/** Chemin absolu du fichier ajouté (miniatures, ouverture système). */
export function addedAbsPath(f: AddedFile): string {
  return toAbsolutePath({ rootId: f.rootId, segments: [...f.folderSegments, f.name] });
}

export function addedLocationLabel(f: AddedFile): string {
  const last = f.folderSegments[f.folderSegments.length - 1];
  if (last) return last;
  return (
    rootLabel(f.rootId) ??
    (f.rootId.startsWith("ext:") ? t("storage.external") : t("files.recent.rootFallback"))
  );
}

/* ─────────────────────────────────────────────────────────────
   Mise à jour immédiate après une action.

   Chaque mutation du stockage est appliquée directement à la liste
   connue : un fichier supprimé disparaît aussitôt, un renommage ou un
   déplacement est reflété sur place, un nouveau fichier apparaît —
   sans attendre le prochain balayage ni recharger la page.
   ───────────────────────────────────────────────────────────── */
if (typeof window !== "undefined") {
  subscribeFsPatch((patch) => {
    const items = readCache();
    let next: AddedFile[] | null = null;

    if (patch.op === "delete") {
      const id = `${patch.rootId}::${patch.segments.join("/")}::${patch.name}`;
      const filtered = items.filter((f) => addedId(f) !== id);
      if (filtered.length !== items.length) next = filtered;
    } else if (patch.op === "rename") {
      const id = `${patch.rootId}::${patch.segments.join("/")}::${patch.oldName}`;
      let touched = false;
      const mapped = items.map((f) => {
        if (addedId(f) !== id) return f;
        touched = true;
        return {
          ...f,
          name: patch.newName,
          path: [...patch.segments, patch.newName].join("/"),
          kind: kindOf(patch.newName, false) as FileKind,
          ext: extOf(patch.newName),
        };
      });
      if (touched) next = mapped;
    } else if (patch.op === "move") {
      const id = `${patch.fromRootId}::${patch.fromSegments.join("/")}::${patch.fromName}`;
      let touched = false;
      const mapped = items.map((f) => {
        if (addedId(f) !== id) return f;
        touched = true;
        return {
          ...f,
          rootId: patch.toRootId,
          folderSegments: [...patch.toSegments],
          name: patch.toName,
          path: [...patch.toSegments, patch.toName].join("/"),
          kind: kindOf(patch.toName, false) as FileKind,
          ext: extOf(patch.toName),
        };
      });
      if (touched) next = mapped;
    } else if (patch.op === "create" && !patch.isDirectory) {
      const file: AddedFile = {
        name: patch.name,
        path: [...patch.segments, patch.name].join("/"),
        isDirectory: false,
        size: patch.size,
        mtime: patch.mtime ?? Date.now(),
        kind: kindOf(patch.name, false) as FileKind,
        ext: extOf(patch.name),
        rootId: patch.rootId,
        folderSegments: [...patch.segments],
        at: patch.mtime ?? Date.now(),
      };
      if (!items.some((f) => addedId(f) === addedId(file))) {
        next = [file, ...items].sort((a, b) => b.at - a.at);
      }
    }

    if (next) writeCache(next);
  });
}
