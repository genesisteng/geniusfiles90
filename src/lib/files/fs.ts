/**
 * Filesystem bridge for GeniusFiles.
 *
 * Native Android: uses the custom `GeniusFilesNative` plugin (java.io.File)
 * so browsing works with the MANAGE_EXTERNAL_STORAGE grant on every recent
 * Android version. Roots resolve to real absolute paths under
 * /storage/emulated/0.
 *
 * Web preview / SSR: falls back to a curated mock dataset so the UI is
 * fully navigable inside the Lovable preview.
 *
 * All errors are normalised into a discriminated union consumed by the UI:
 * denied · unavailable · error. Callers never see raw exceptions.
 */
import {
  isAndroidNative,
  listStorageVolumes as nativeListVolumes,
  onStorageVolumesChanged,
  type NativeStorageVolume,
} from "@/lib/native/geniusfiles-native";
import {
  invalidateAll,
  invalidateUnder,
  listDirectoryCached,
  peekCachedEntries,
  prefetchDirectory,
  updateCachedEntries,
} from "@/lib/native/dir-cache";
import type { NativeDirEntry } from "@/lib/native/geniusfiles-native";
import { subscribeFsPatch } from "@/lib/index/patches";

import { extOf, kindOf } from "./format";
import type { FileEntry, PathRef, StorageRoot, StorageRootId } from "./types";
import { t } from "@/lib/i18n";

export type ListResult =
  | { ok: true; entries: FileEntry[] }
  | { ok: false; reason: "denied" | "unavailable" | "error"; message?: string };

/* ---------- Storage roots ---------- */

type NativeRootDef = StorageRoot & { subdir: string };

/**
 * Absolute-path sub-directories relative to the primary external storage
 * root (typically /storage/emulated/0). Missing directories are handled
 * gracefully at read time — no crash, just an empty listing.
 */
/**
 * Les libellés sont recalculés à chaque appel : la langue de l'application
 * peut changer à chaud, une constante figée resterait dans la langue
 * chargée au démarrage.
 */
const rootDefs = (): NativeRootDef[] => [
  {
    id: "internal",
    label: t("storage.internal"),
    hint: "/storage/emulated/0",
    available: true,
    subdir: "",
  },
  { id: "downloads", label: t("home.category.downloads"), available: true, subdir: "Download" },
  { id: "pictures", label: t("home.category.images"), available: true, subdir: "Pictures" },
  { id: "movies", label: t("home.category.videos"), available: true, subdir: "Movies" },
  { id: "music", label: t("home.category.audio"), available: true, subdir: "Music" },
  { id: "documents", label: t("home.category.documents"), available: true, subdir: "Documents" },
];

/* ---------- External volumes (SD card / USB OTG) ---------- */

export type ExternalVolume = {
  /** Root id used in PathRef, e.g. "ext:XXXX-XXXX". */
  id: StorageRootId;
  label: string;
  absolutePath: string;
  kind: "sdcard" | "usb" | "external";
  total: number;
  free: number;
  used: number;
};

let externalCache: ExternalVolume[] = [];
const rootSubscribers = new Set<() => void>();

function notifyRoots() {
  for (const cb of rootSubscribers) {
    try {
      cb();
    } catch {
      /* ignore */
    }
  }
}

/** Subscribe to root list changes (volumes mount / unmount). */
export function subscribeRoots(cb: () => void): () => void {
  rootSubscribers.add(cb);
  return () => rootSubscribers.delete(cb);
}

/** Get current detected external volumes (synchronous snapshot). */
export function getExternalVolumes(): ExternalVolume[] {
  return externalCache;
}

function volumeToRootId(v: NativeStorageVolume): string {
  if (v.uuid) return `ext:${v.uuid}`;
  // Use the mount name (e.g. XXXX-XXXX or usb0) as a stable id.
  const name = v.path.split("/").filter(Boolean).pop() ?? v.path;
  return `ext:${name}`;
}

/** Refresh the external volume cache from the native bridge. */
export async function refreshStorageVolumes(): Promise<void> {
  if (!isAndroidNative()) return;
  try {
    const volumes = await nativeListVolumes();
    const next: ExternalVolume[] = [];
    for (const v of volumes) {
      if (v.primary) continue;
      if (v.state && v.state !== "mounted") continue;
      next.push({
        id: volumeToRootId(v) as StorageRootId,
        label:
          v.label ||
          (v.kind === "sdcard"
            ? t("storage.sdCard")
            : v.kind === "usb"
              ? t("storage.usbDevice")
              : t("storage.external")),
        absolutePath: v.path,
        kind: v.kind === "sdcard" || v.kind === "usb" ? v.kind : "external",
        total: v.total,
        free: v.free,
        used: v.used,
      });
    }
    const changed =
      next.length !== externalCache.length ||
      next.some(
        (v, i) =>
          v.id !== externalCache[i]?.id || v.absolutePath !== externalCache[i]?.absolutePath,
      );
    externalCache = next;
    if (changed) notifyRoots();
  } catch {
    /* ignore */
  }
}

// Auto-refresh when the native layer signals a mount/unmount event.
if (typeof window !== "undefined") {
  try {
    onStorageVolumesChanged(() => {
      void refreshStorageVolumes();
    });
  } catch {
    /* ignore */
  }
  // Kick off an initial detection.
  void refreshStorageVolumes();
}

export function listRoots(): StorageRoot[] {
  const native = isAndroidNative();
  const roots: StorageRoot[] = rootDefs().map((r) => ({
    id: r.id,
    label: r.label,
    hint: r.hint,
    available: native,
  }));
  if (externalCache.length === 0) {
    // Placeholder so the UI still shows a "SD card" entry when nothing is mounted.
    roots.push({
      id: "sdcard",
      label: t("storage.sdCard"),
      hint: t("files.nonInseree"),
      available: false,
    });
  } else {
    for (const v of externalCache) {
      roots.push({
        id: v.id,
        label: v.label,
        hint: v.absolutePath,
        available: true,
      });
    }
  }
  return roots;
}

/**
 * Alias de chemins — permet d'exposer dans les composants « fichiers »
 * (visualiseur, miniatures) un fichier qui ne vit pas sous une racine de
 * stockage classique : par exemple un élément de la Corbeille, stocké
 * dans l'espace privé de l'application sous un identifiant opaque.
 *
 * La clé est le PathRef complet ; la valeur, le chemin absolu réel.
 */
const pathAliases = new Map<string, string>();

function aliasKey(path: PathRef): string {
  return `${path.rootId}|${path.segments.join("/")}`;
}

export function registerPathAlias(path: PathRef, absolute: string): void {
  pathAliases.set(aliasKey(path), absolute);
}

export function clearPathAliases(prefix: string): void {
  for (const key of Array.from(pathAliases.keys())) {
    if (key.startsWith(prefix)) pathAliases.delete(key);
  }
}

/** Resolve a PathRef to an absolute filesystem path on device. */
export function toAbsolutePath(path: PathRef): string {
  const alias = pathAliases.get(aliasKey(path));
  if (alias) return alias;
  // Racine libre `abs:<chemin absolu>` (corbeille, dossiers hors racines).
  if (typeof path.rootId === "string" && path.rootId.startsWith("abs:")) {
    const base = path.rootId.slice(4).split("#")[0];
    return [base, ...path.segments].join("/");
  }

  // External volume rootIds are prefixed with "ext:" and looked up in the cache.
  if (typeof path.rootId === "string" && path.rootId.startsWith("ext:")) {
    const v = externalCache.find((e) => e.id === path.rootId);
    if (v) {
      const parts = [v.absolutePath];
      if (path.segments.length) parts.push(...path.segments);
      return parts.join("/");
    }
  }
  const root = rootDefs().find((r) => r.id === path.rootId);
  const base = "/storage/emulated/0";
  const parts = [base];
  if (root?.subdir) parts.push(root.subdir);
  if (path.segments.length) parts.push(...path.segments);
  return parts.join("/");
}

/* ---------- Mock dataset (web preview) ---------- */

export type MockNode = {
  name: string;
  isDirectory: boolean;
  size?: number;
  mtime?: number;
  children?: MockNode[];
};

function d(name: string, children: MockNode[]): MockNode {
  return { name, isDirectory: true, children, mtime: Date.now() - 86400000 };
}
function f(name: string, size: number, daysAgo = 1): MockNode {
  return { name, isDirectory: false, size, mtime: Date.now() - daysAgo * 86400000 };
}

const MOCK: Record<StorageRootId, MockNode> = {
  internal: d("internal", [
    d("Download", [
      f("facture-2026-07.pdf", 184_000, 0),
      f("cv-manon.docx", 42_000, 2),
      f("installer.apk", 38_400_000, 5),
      f("archive-projet.zip", 12_800_000, 3),
    ]),
    d("DCIM", [
      d("Camera", [
        f("IMG_20260718_142301.jpg", 3_800_000, 0),
        f("IMG_20260718_142302.jpg", 4_100_000, 0),
        f("VID_20260717_180145.mp4", 128_000_000, 1),
      ]),
      d("Screenshots", [
        f("Screenshot_20260719-142201.png", 620_000, 0),
        f("Screenshot_20260719-142530.png", 540_000, 0),
      ]),
    ]),
    d("Documents", [
      f("Notes.md", 3_200, 4),
      f("Budget.xlsx", 86_000, 7),
      f("Roadmap.pdf", 940_000, 10),
    ]),
    d("Pictures", [
      d("Wallpapers", [f("mountains-01.jpg", 2_100_000, 20), f("ocean-03.jpg", 2_400_000, 20)]),
    ]),
    d("Music", [f("track-01.mp3", 5_800_000, 30), f("track-02.flac", 32_400_000, 30)]),
    d("WhatsApp", [d("Media", []), f("chats.txt", 12_000, 2)]),
    f("readme.txt", 1_200, 15),
  ]),
  documents: d("documents", [f("Contrat.pdf", 320_000, 8), f("Presentation.pptx", 1_800_000, 12)]),
  downloads: d("downloads", [
    f("facture-2026-07.pdf", 184_000, 0),
    f("installer.apk", 38_400_000, 5),
  ]),
  pictures: d("pictures", [f("photo-01.jpg", 2_100_000, 2)]),
  movies: d("movies", []),
  music: d("music", [f("track-01.mp3", 5_800_000, 30)]),
  sdcard: d("sdcard", []),
};

export function mockResolve(path: PathRef): MockNode | null {
  let node: MockNode | undefined = MOCK[path.rootId];
  for (const seg of path.segments) {
    if (!node || !node.children) return null;
    node = node.children.find((c) => c.name === seg && c.isDirectory);
  }
  return node ?? null;
}

/**
 * Mutate a mock directory in-place. The callback may return an error code
 * string (e.g. "EXISTS", "NOT_FOUND") or `null` on success. Returns the
 * error code (or `null` when the target directory is missing).
 */
export function mockMutate(
  path: PathRef,
  mutator: (node: MockNode) => string | null,
): string | null {
  const node = mockResolve(path);
  if (!node) return "NOT_FOUND";
  return mutator(node);
}

function resolveMock(path: PathRef): MockNode | null {
  return mockResolve(path);
}

function toEntry(node: MockNode, parentSegments: string[]): FileEntry {
  const segs = [...parentSegments, node.name];
  return {
    name: node.name,
    path: "/" + segs.join("/"),
    isDirectory: node.isDirectory,
    size: node.isDirectory ? undefined : node.size,
    mtime: node.mtime,
    kind: kindOf(node.name, node.isDirectory),
    ext: node.isDirectory ? undefined : extOf(node.name),
  };
}

/* ---------- Public API ---------- */

function nativeToEntries(
  raw: { name: string; path: string; isDirectory: boolean; size: number; mtime: number }[],
): FileEntry[] {
  const out: FileEntry[] = [];
  for (const e of raw) {
    if (e.name.startsWith(".")) continue;
    out.push({
      name: e.name,
      path: e.path,
      isDirectory: e.isDirectory,
      size: e.isDirectory ? undefined : e.size,
      mtime: e.mtime,
      kind: kindOf(e.name, e.isDirectory),
      ext: e.isDirectory ? undefined : extOf(e.name),
    });
  }
  return out;
}

/**
 * Lecture synchrone : renvoie le contenu déjà connu d'un dossier (cache
 * natif ou dataset mock) sans aucun aller-retour. Permet de peindre la
 * liste dès le premier frame puis de revalider en arrière-plan.
 */
export function peekDirectory(path: PathRef): FileEntry[] | null {
  if (isAndroidNative()) {
    const cached = peekCachedEntries(toAbsolutePath(path));
    return cached ? nativeToEntries(cached) : null;
  }
  const node = resolveMock(path);
  if (!node) return null;
  return (node.children ?? []).map((c) => toEntry(c, path.segments));
}

/**
 * Préchauffe les sous-dossiers d'un dossier déjà affiché : leur ouverture
 * devient instantanée. Exécuté pendant les temps morts, jamais bloquant.
 */
export function prefetchSubdirectories(path: PathRef, entries: FileEntry[], max = 12): void {
  if (!isAndroidNative()) return;
  const base = toAbsolutePath(path);
  let n = 0;
  for (const e of entries) {
    if (!e.isDirectory) continue;
    if (n++ >= max) break;
    prefetchDirectory(`${base}/${e.name}`);
  }
}

export async function listDirectory(
  path: PathRef,
  opts: { force?: boolean } = {},
): Promise<ListResult> {
  if (isAndroidNative()) {
    const abs = toAbsolutePath(path);
    const res = await listDirectoryCached(abs, opts);
    if (!res.ok) {
      if (res.reason === "denied") return { ok: false, reason: "denied", message: res.message };
      if (res.reason === "not_found") return { ok: true, entries: [] };
      return { ok: false, reason: "error", message: res.message };
    }
    return { ok: true, entries: nativeToEntries(res.listing.entries) };
  }

  // Web preview: serve curated mock dataset.
  const node = resolveMock(path);
  if (!node) return { ok: false, reason: "unavailable" };
  const children = node.children ?? [];
  return { ok: true, entries: children.map((c) => toEntry(c, path.segments)) };
}

/**
 * Create a subdirectory inside `parent`. Used by the destination picker's
 * inline "Nouveau dossier" action so the user does not have to leave the
 * save flow just to prepare a target folder.
 */
export async function createFolder(
  parent: PathRef,
  name: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const clean = name.trim().replace(/[\\/]+/g, "-");
  if (!clean) return { ok: false, message: t("files.nomDeDossierRequis") };
  if (isAndroidNative()) {
    const { nativePlugin } = await import("@/lib/native/geniusfiles-native");
    const p = nativePlugin();
    if (!p) return { ok: false, message: t("system.extra.storageNotAvailable") };
    const abs = `${toAbsolutePath(parent)}/${clean}`;
    try {
      await p.createDirectory({ path: abs });
      return { ok: true };
    } catch (e) {
      const raw = (e as { message?: string })?.message ?? String(e);
      if (/EXISTS/i.test(raw)) return { ok: false, message: t("files.unDossierDeCeNomExiste") };
      if (/DENIED/i.test(raw))
        return { ok: false, message: t("files.accesRefuseAutorisezTousLesFichiers") };
      return { ok: false, message: t("files.creationImpossible") };
    }
  }
  // Web mock: mutate in place so the picker refresh sees the new folder.
  const node = mockResolve(parent);
  if (!node) return { ok: false, message: t("files.dossierParentIntrouvable") };
  node.children = node.children ?? [];
  if (node.children.some((c) => c.name === clean))
    return { ok: false, message: t("files.unDossierDeCeNomExiste") };
  node.children.push({ name: clean, isDirectory: true, children: [], mtime: Date.now() });
  return { ok: true };
}

/**
 * Préchauffe les racines de stockage (interne, téléchargements, images…)
 * dès le démarrage, pendant les temps morts. Le premier affichage d'un
 * stockage devient quasi instantané au lieu d'attendre une lecture disque.
 */
export function prefetchRoots(): void {
  if (!isAndroidNative()) return;
  for (const r of rootDefs()) {
    prefetchDirectory(toAbsolutePath({ rootId: r.id, segments: [] }));
  }
  for (const v of externalCache) {
    prefetchDirectory(v.absolutePath);
  }
}

/* ─────────────────────────────────────────────────────────────
   Cache de dossiers : mise à jour chirurgicale.

   Avant, la moindre mutation vidait tout le cache et forçait une
   relecture complète du dossier (blocage visible sur les très gros
   dossiers). Désormais chaque patch corrige uniquement les entrées
   concernées ; le vidage global ne subsiste que pour les événements
   génériques sans patch associé (changement de permission, montage
   de volume, opérations externes).
   ───────────────────────────────────────────────────────────── */
if (typeof window !== "undefined") {
  let lastPatchAt = 0;

  const absOf = (rootId: StorageRootId, segments: string[]) => toAbsolutePath({ rootId, segments });

  subscribeFsPatch((patch) => {
    lastPatchAt = Date.now();
    try {
      switch (patch.op) {
        case "create": {
          const dir = absOf(patch.rootId, patch.segments);
          updateCachedEntries(dir, (entries) =>
            entries.some((e) => e.name === patch.name)
              ? null
              : [
                  ...entries,
                  {
                    name: patch.name,
                    path: `${dir}/${patch.name}`,
                    isDirectory: patch.isDirectory,
                    size: patch.size ?? 0,
                    mtime: patch.mtime ?? Date.now(),
                  },
                ],
          );
          break;
        }
        case "delete": {
          const dir = absOf(patch.rootId, patch.segments);
          updateCachedEntries(dir, (entries) => {
            const next = entries.filter((e) => e.name !== patch.name);
            return next.length === entries.length ? null : next;
          });
          if (patch.isDirectory) invalidateUnder(`${dir}/${patch.name}`);
          break;
        }
        case "rename": {
          const dir = absOf(patch.rootId, patch.segments);
          updateCachedEntries(dir, (entries) => {
            let touched = false;
            const next = entries.map((e) => {
              if (e.name !== patch.oldName) return e;
              touched = true;
              return {
                ...e,
                name: patch.newName,
                path: `${dir}/${patch.newName}`,
                mtime: Date.now(),
              };
            });
            return touched ? next : null;
          });
          // Le sous-arbre renommé change de chemin : ses entrées cachées
          // deviennent obsolètes (et sont peu nombreuses).
          invalidateUnder(`${dir}/${patch.oldName}`);
          break;
        }
        case "move": {
          const fromDir = absOf(patch.fromRootId, patch.fromSegments);
          const toDir = absOf(patch.toRootId, patch.toSegments);
          let moved: NativeDirEntry | undefined;
          updateCachedEntries(fromDir, (entries) => {
            moved = entries.find((e) => e.name === patch.fromName);
            const next = entries.filter((e) => e.name !== patch.fromName);
            return next.length === entries.length ? null : next;
          });
          updateCachedEntries(toDir, (entries) =>
            entries.some((e) => e.name === patch.toName)
              ? null
              : [
                  ...entries,
                  {
                    name: patch.toName,
                    path: `${toDir}/${patch.toName}`,
                    isDirectory: patch.isDirectory ?? moved?.isDirectory ?? false,
                    size: moved?.size ?? 0,
                    mtime: Date.now(),
                  },
                ],
          );
          invalidateUnder(`${fromDir}/${patch.fromName}`);
          break;
        }
      }
    } catch {
      // Un patch illisible ne doit jamais casser la navigation : on
      // repart d'un cache propre.
      invalidateAll();
    }
  });

  window.addEventListener("gf:storage-changed", () => {
    // Un patch vient d'être appliqué : le cache est déjà à jour.
    if (Date.now() - lastPatchAt <= 50) return;
    invalidateAll();
  });
}
