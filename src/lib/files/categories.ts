/**
 * Virtual category index for GeniusFiles home shortcuts.
 *
 * Design goals
 * ------------
 * - **Instant open.** The first snapshot for a category comes from an
 *   IndexedDB-backed cache — no background scan blocks the UI.
 * - **Never wipe.** A storage-change event schedules a silent refresh
 *   in the background; the displayed list stays populated the whole
 *   time.
 * - **Surgical updates.** `gf:fs-patch` events (create/delete/rename/
 *   move) mutate the cache in place, so trivial user actions do not
 *   trigger a full BFS.
 * - **Per-volume indexes.** Internal storage and every mounted SD/USB
 *   volume have their own cache slice. Mounting or ejecting a volume
 *   patches only the affected slice.
 * - **Background rebuild.** If the cache is missing or corrupt, a fresh
 *   BFS runs in the background while the app remains usable.
 */
import { getExternalVolumes, listDirectory, subscribeRoots } from "./fs";
import { extOf } from "./format";
import {
  CATEGORY_EXT,
  CATEGORY_KINDS,
  categoryLabel,
  matchesCategory,
  shouldTraverseCategoryDir,
  type CategoryKind,
} from "./category-rules";
import type { FileEntry, PathRef, StorageRootId } from "./types";
import { idbGetCached, idbSetCached } from "@/lib/index/persist";
import { subscribeFsPatch, type FsPatchOp } from "@/lib/index/patches";

export type { CategoryKind };

export type CategoryFile = FileEntry & {
  rootId: StorageRootId;
  folderSegments: string[];
};

/* Extensions, libellés et dossiers ignorés : voir `category-rules.ts`.
   Une seule définition partagée avec l'analyseur de l'accueil. */
const EXT = CATEGORY_EXT;

export { matchesCategory, categoryLabel, CATEGORY_KINDS };

/* ---------- Roots per kind, per volume ---------- */

/* ---------- BFS scan for a single root ---------- */

export type ScanProgress = {
  scannedFolders: number;
  discovered: number;
  done: boolean;
  cancelled: boolean;
};

export type ScanHandle = { cancel: () => void };

function buildFile(
  entry: FileEntry,
  rootId: StorageRootId,
  folderSegments: string[],
): CategoryFile {
  return { ...entry, rootId, folderSegments };
}

/**
 * Walk a volume **once** and dispatch every matching file to each
 * requested kind. A single BFS feeds Images/Vidéos/Musique/Documents
 * simultaneously: one traversal instead of one per category, which is
 * what used to make opening a category feel like a fresh analysis.
 */
function walkRoot(
  root: PathRef,
  kinds: CategoryKind[],
  onBatch: (kind: CategoryKind, files: CategoryFile[]) => void,
  onDone: () => void,
  opts: { batchSize?: number; yieldEvery?: number } = {},
): ScanHandle {
  const batchSize = opts.batchSize ?? 256;
  const yieldEvery = opts.yieldEvery ?? 6;
  let cancelled = false;
  const handle: ScanHandle = {
    cancel: () => {
      cancelled = true;
    },
  };

  (async () => {
    const queue: PathRef[] = [root];
    const visited = new Set<string>();
    let scannedFolders = 0;
    const buffers = new Map<CategoryKind, CategoryFile[]>();
    for (const k of kinds) buffers.set(k, []);

    const flush = () => {
      for (const [k, buf] of buffers) {
        if (buf.length === 0) continue;
        onBatch(k, buf);
        buffers.set(k, []);
      }
    };

    while (queue.length && !cancelled) {
      const p = queue.shift()!;
      const key = `${p.rootId}/${p.segments.join("/")}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const res = await listDirectory(p);
      scannedFolders += 1;
      if (res.ok) {
        for (const entry of res.entries) {
          if (entry.name.startsWith(".")) continue;
          if (entry.isDirectory) {
            if (!shouldTraverseCategoryDir(entry.name, p.segments)) continue;
            queue.push({ rootId: p.rootId, segments: [...p.segments, entry.name] });
            continue;
          }
          for (const k of kinds) {
            if (!matchesCategory(k, entry.name)) continue;
            const buf = buffers.get(k)!;
            buf.push(buildFile(entry, p.rootId, p.segments));
            if (buf.length >= batchSize) flush();
          }
        }
      }
      if (scannedFolders % yieldEvery === 0) {
        flush();
        // Yield to the UI thread: indexing never blocks scrolling.
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    flush();
    onDone();
  })().catch(() => onDone());

  return handle;
}

/* ---------- Persistent index (per kind + volume) ---------- */

type VolumeIndex = {
  rootId: StorageRootId;
  files: CategoryFile[];
  builtAt: number;
};

type KindIndex = {
  version: 1;
  kind: CategoryKind;
  volumes: Record<string, VolumeIndex>;
};

const memIndex = new Map<CategoryKind, KindIndex>();
const inflight = new Map<CategoryKind, Promise<KindIndex>>();

function idbKey(kind: CategoryKind): string {
  return `category:v1:${kind}`;
}

function emptyIndex(kind: CategoryKind): KindIndex {
  return { version: 1, kind, volumes: {} };
}

async function loadKindIndex(kind: CategoryKind): Promise<KindIndex> {
  if (memIndex.has(kind)) return memIndex.get(kind)!;
  const existing = inflight.get(kind);
  if (existing) return existing;
  const p = (async () => {
    const raw = await idbGetCached<KindIndex>(idbKey(kind));
    const idx =
      raw && raw.version === 1 && raw.kind === kind && raw.volumes ? raw : emptyIndex(kind);
    memIndex.set(kind, idx);
    return idx;
  })();
  inflight.set(kind, p);
  const v = await p;
  inflight.delete(kind);
  return v;
}

function persistKindIndex(kind: CategoryKind): void {
  const idx = memIndex.get(kind);
  if (!idx) return;
  // Fire-and-forget — persistence must never block the UI.
  void idbSetCached(idbKey(kind), idx);
}

function flatten(idx: KindIndex): CategoryFile[] {
  const out: CategoryFile[] = [];
  for (const v of Object.values(idx.volumes)) {
    for (const f of v.files) out.push(f);
  }
  return out;
}

/* ---------- Subscribers ---------- */

type Listener = (files: CategoryFile[], done: boolean) => void;
const listeners = new Map<CategoryKind, Set<Listener>>();

function notify(kind: CategoryKind, done: boolean) {
  const set = listeners.get(kind);
  if (!set || set.size === 0) return;
  const idx = memIndex.get(kind);
  if (!idx) return;
  const snapshot = flatten(idx);
  for (const cb of set) {
    try {
      cb(snapshot, done);
    } catch {
      /* ignore */
    }
  }
}

/* ---------- Persistent indexer (one traversal, every kind) ---------- */

const ALL_KINDS: CategoryKind[] = ["images", "videos", "audio", "documents", "downloads"];

/**
 * Groupes de traversée : chaque volume est parcouru **une seule fois** et
 * alimente toutes les catégories concernées. « Téléchargements » a son
 * propre root dédié.
 */
function walkGroups(): Array<{ root: PathRef; kinds: CategoryKind[] }> {
  const media: CategoryKind[] = ["images", "videos", "audio", "documents"];
  const groups: Array<{ root: PathRef; kinds: CategoryKind[] }> = [
    { root: { rootId: "internal", segments: [] }, kinds: media },
  ];
  for (const v of getExternalVolumes()) {
    groups.push({ root: { rootId: v.id, segments: [] }, kinds: media });
  }
  groups.push({ root: { rootId: "downloads", segments: [] }, kinds: ["downloads"] });
  return groups;
}

type IndexMeta = { version: 1; lastFullAt: number };
const META_KEY = "category:v1:meta";

/** Au-delà de ce délai, l'index est reconstruit en tâche de fond. */
const FULL_REINDEX_TTL_MS = 12 * 60 * 60_000;
/** Garde-fou : deux reconstructions ne peuvent pas s'enchaîner. */
const MIN_REINDEX_GAP_MS = 60_000;

let meta: IndexMeta | null = null;
let indexRunning = false;
let indexTimer: ReturnType<typeof setTimeout> | null = null;
let activeHandles: ScanHandle[] = [];

async function loadMeta(): Promise<IndexMeta> {
  if (meta) return meta;
  const raw = await idbGetCached<IndexMeta>(META_KEY);
  meta = raw && raw.version === 1 ? raw : { version: 1, lastFullAt: 0 };
  return meta;
}

function markIndexed() {
  meta = { version: 1, lastFullAt: Date.now() };
  void idbSetCached(META_KEY, meta);
}

function cancelIndexing() {
  for (const h of activeHandles) h.cancel();
  activeHandles = [];
}

function mergeBatch(kind: CategoryKind, rootId: StorageRootId, batch: CategoryFile[]) {
  const idx = memIndex.get(kind);
  if (!idx) return;
  const existing = idx.volumes[rootId]?.files ?? [];
  const seen = new Set(existing.map(fileId));
  const merged = existing.slice();
  for (const f of batch) {
    const id = fileId(f);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(f);
  }
  idx.volumes[rootId] = { rootId, files: merged, builtAt: Date.now() };
  notify(kind, true);
}

/**
 * Reconstruction incrémentale de l'index, en tâche de fond. L'affichage
 * n'est jamais vidé : les nouvelles entrées sont fusionnées au fur et à
 * mesure, et le slice de volume est remplacé une fois la traversée finie
 * (ce qui évince les fichiers disparus).
 */
async function runIndexer(): Promise<void> {
  if (indexRunning) return;
  indexRunning = true;
  cancelIndexing();
  try {
    await Promise.all(ALL_KINDS.map((k) => loadKindIndex(k)));
    const groups = walkGroups();
    if (groups.length === 0) return;

    await new Promise<void>((resolve) => {
      let remaining = groups.length;
      const finish = () => {
        remaining -= 1;
        if (remaining <= 0) resolve();
      };
      for (const group of groups) {
        const staging = new Map<CategoryKind, CategoryFile[]>();
        for (const k of group.kinds) staging.set(k, []);
        const handle = walkRoot(
          group.root,
          group.kinds,
          (kind, batch) => {
            staging.get(kind)?.push(...batch);
            mergeBatch(kind, group.root.rootId, batch);
          },
          () => {
            for (const kind of group.kinds) {
              const idx = memIndex.get(kind);
              if (!idx) continue;
              idx.volumes[group.root.rootId] = {
                rootId: group.root.rootId,
                files: staging.get(kind) ?? [],
                builtAt: Date.now(),
              };
              persistKindIndex(kind);
              notify(kind, true);
            }
            finish();
          },
        );
        activeHandles.push(handle);
      }
    });
    markIndexed();
  } finally {
    indexRunning = false;
    activeHandles = [];
  }
}

/** Reconstruction immédiate — renvoie la promesse de la traversée en
 *  cours lorsqu'une indexation est déjà lancée (aucun doublon). */
let indexerPromise: Promise<void> | null = null;

function runIndexerNow(): Promise<void> {
  if (indexTimer) {
    clearTimeout(indexTimer);
    indexTimer = null;
  }
  if (indexerPromise) return indexerPromise;
  indexerPromise = runIndexer().finally(() => {
    indexerPromise = null;
  });
  return indexerPromise;
}

function scheduleIndexer(delay = 1200) {
  if (indexTimer) clearTimeout(indexTimer);
  indexTimer = setTimeout(() => {
    indexTimer = null;
    void runIndexerNow();
  }, delay);
}

/* ---------- Freshness ---------- */

function builtAtOf(idx: KindIndex): number {
  let max = 0;
  for (const v of Object.values(idx.volumes)) if (v.builtAt > max) max = v.builtAt;
  return max;
}

/** Vrai si un index utilisable existe déjà pour cette catégorie. */
export function isCategoryFresh(kind: CategoryKind): boolean {
  const idx = memIndex.get(kind);
  return !!idx && builtAtOf(idx) > 0;
}

/* ---------- Public API ---------- */

export type { FsPatchOp };

/**
 * Amorce l'indexation persistante. Appelé **une seule fois au lancement**
 * de l'application : c'est le seul moment où une traversée complète peut
 * démarrer spontanément. Ouvrir une catégorie ne déclenche plus jamais
 * d'analyse.
 */
export async function startMediaIndexer(): Promise<void> {
  if (typeof window === "undefined") return;
  await Promise.all(ALL_KINDS.map((k) => loadKindIndex(k)));
  for (const kind of ALL_KINDS) notify(kind, true);
  const m = await loadMeta();
  const known = ALL_KINDS.some((k) => isCategoryFresh(k));
  if (!known || Date.now() - m.lastFullAt > FULL_REINDEX_TTL_MS) {
    scheduleIndexer(1500);
  }
}

/**
 * Abonnement à une catégorie. Émet immédiatement l'instantané connu
 * (mémoire puis IndexedDB) et ne lance **aucune** analyse : l'index est
 * entretenu par l'indexeur de lancement et les patchs temps réel.
 *
 * `force` (bouton « Actualiser ») demande explicitement une
 * reconstruction en tâche de fond, sans vider l'affichage.
 */
export function subscribeCategory(
  kind: CategoryKind,
  onUpdate: (files: CategoryFile[], done: boolean) => void,
  opts: { force?: boolean } = {},
): ScanHandle {
  let cancelled = false;
  const wrapped: Listener = (files, done) => {
    if (cancelled) return;
    onUpdate(files, done);
  };
  let set = listeners.get(kind);
  if (!set) {
    set = new Set();
    listeners.set(kind, set);
  }
  set.add(wrapped);

  // 1. Émission synchrone depuis l'index mémoire (ouverture instantanée).
  const cached = memIndex.get(kind);
  onUpdate(cached ? flatten(cached) : [], true);

  // 2. Puis l'instantané persistant, si la mémoire était froide.
  (async () => {
    const idx = await loadKindIndex(kind);
    if (cancelled) return;
    onUpdate(flatten(idx), true);
    if (opts.force) scheduleIndexer(0);
    else if (builtAtOf(idx) === 0) {
      // Aucun index connu (première ouverture / cache purgé) : on le
      // construit en arrière-plan, la liste se remplit en direct.
      const m = await loadMeta();
      if (Date.now() - m.lastFullAt > MIN_REINDEX_GAP_MS) scheduleIndexer(0);
    }
  })();

  return {
    cancel: () => {
      cancelled = true;
      set!.delete(wrapped);
    },
  };
}

/**
 * Actualisation réelle : relit le stockage et attend la fin de la
 * traversée (l'affichage n'est jamais vidé — les entrées disparues sont
 * évincées, les nouvelles fusionnées au fur et à mesure).
 */
export function refreshCategory(_kind?: CategoryKind): Promise<void> {
  return runIndexerNow();
}

/** Invalidation explicite (purge du cache depuis les Paramètres). */
export function invalidateCategory(kind?: CategoryKind) {
  const kinds: CategoryKind[] = kind ? [kind] : ALL_KINDS;
  for (const k of kinds) {
    memIndex.delete(k);
    void idbSetCached(idbKey(k), emptyIndex(k));
  }
  meta = { version: 1, lastFullAt: 0 };
  void idbSetCached(META_KEY, meta);
  scheduleIndexer(100);
}

/* ---------- Utilities ---------- */

function fileId(f: { rootId: StorageRootId; folderSegments: string[]; name: string }): string {
  return `${f.rootId}::${f.folderSegments.join("/")}::${f.name}`;
}

/* ---------- Live patch handling ---------- */

function applyPatchToKind(kind: CategoryKind, patch: FsPatchOp) {
  const idx = memIndex.get(kind);
  if (!idx) return false;

  const removeFrom = (rootId: StorageRootId, segments: string[], name: string) => {
    const vol = idx.volumes[rootId];
    if (!vol) return false;
    const before = vol.files.length;
    vol.files = vol.files.filter((f) => !(f.name === name && arrEq(f.folderSegments, segments)));
    return vol.files.length !== before;
  };
  const addTo = (rootId: StorageRootId, segments: string[], file: FileEntry) => {
    if (file.isDirectory) return false;
    if (!matchesCategory(kind, file.name)) return false;
    let vol = idx.volumes[rootId];
    if (!vol) {
      vol = { rootId, files: [], builtAt: Date.now() };
      idx.volumes[rootId] = vol;
    }
    const id = fileId({ rootId, folderSegments: segments, name: file.name });
    if (vol.files.some((f) => fileId(f) === id)) return false;
    vol.files.push({ ...file, rootId, folderSegments: segments });
    return true;
  };

  let changed = false;
  switch (patch.op) {
    case "create":
      changed = addTo(patch.rootId, patch.segments, {
        name: patch.name,
        path: `/${[...patch.segments, patch.name].join("/")}`,
        isDirectory: patch.isDirectory,
        size: patch.size,
        mtime: patch.mtime,
        kind: fileKindGuess(patch.name),
        ext: extOf(patch.name),
      });
      break;
    case "delete":
      changed = removeFrom(patch.rootId, patch.segments, patch.name);
      break;
    case "rename": {
      const wasRemoved = removeFrom(patch.rootId, patch.segments, patch.oldName);
      const added = addTo(patch.rootId, patch.segments, {
        name: patch.newName,
        path: `/${[...patch.segments, patch.newName].join("/")}`,
        isDirectory: patch.isDirectory ?? false,
        kind: fileKindGuess(patch.newName),
        ext: extOf(patch.newName),
      });
      changed = wasRemoved || added;
      break;
    }
    case "move": {
      const wasRemoved = removeFrom(patch.fromRootId, patch.fromSegments, patch.fromName);
      const added = addTo(patch.toRootId, patch.toSegments, {
        name: patch.toName,
        path: `/${[...patch.toSegments, patch.toName].join("/")}`,
        isDirectory: patch.isDirectory ?? false,
        kind: fileKindGuess(patch.toName),
        ext: extOf(patch.toName),
      });
      changed = wasRemoved || added;
      break;
    }
  }
  return changed;
}

function arrEq(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function fileKindGuess(name: string): FileEntry["kind"] {
  const ext = extOf(name);
  if (!ext) return "other";
  if (EXT.images.has(ext)) return "image";
  if (EXT.videos.has(ext)) return "video";
  if (EXT.audio.has(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  return "other";
}

if (typeof window !== "undefined") {
  // Surgical patches: mutate the affected slice + re-emit.
  subscribeFsPatch((patch) => {
    for (const kind of CATEGORY_KINDS) {
      const changed = applyPatchToKind(kind, patch);
      if (changed) {
        persistKindIndex(kind);
        notify(kind, true);
      }
    }
  });

  // Signal grossier (opération de masse, retour d'une app externe) :
  // rafraîchissement incrémental différé et throttlé, jamais de purge.
  let lastCoarse = 0;
  window.addEventListener("gf:storage-changed", () => {
    const now = Date.now();
    if (now - lastCoarse < MIN_REINDEX_GAP_MS) return;
    lastCoarse = now;
    scheduleIndexer(2000);
  });

  // Volume mount/unmount: refresh affected kinds. Removed volumes are
  // pruned from the cache immediately so their files stop appearing.
  subscribeRoots(() => {
    const alive = new Set<StorageRootId>([
      "internal",
      "downloads",
      "pictures",
      "movies",
      "music",
      "documents",
      "sdcard",
      ...getExternalVolumes().map((v) => v.id),
    ]);
    for (const [kind, idx] of memIndex) {
      let mutated = false;
      for (const key of Object.keys(idx.volumes)) {
        if (!alive.has(key as StorageRootId)) {
          delete idx.volumes[key];
          mutated = true;
        }
      }
      if (mutated) {
        persistKindIndex(kind);
        notify(kind, true);
      }
    }
    // Un volume monté/démonté change réellement le contenu : on
    // réindexe en arrière-plan.
    scheduleIndexer(800);
  });
}
