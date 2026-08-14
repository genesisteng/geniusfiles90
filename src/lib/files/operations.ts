/**
 * High-level file operations for GeniusFiles.
 *
 * Native (Android): uses the GeniusFilesNative plugin — real filesystem
 * writes under MANAGE_EXTERNAL_STORAGE.
 * Web preview: mutates the in-memory mock dataset in `fs.ts` so the UI
 * remains fully explorable inside Lovable.
 *
 * All batch operations report incremental progress and honour a cancel
 * signal so the UI can offer "Annuler" during long copies / moves.
 */
import {
  isAndroidNative,
  listNativeDirectory,
  nativePlugin,
  type NativeStat,
} from "@/lib/native/geniusfiles-native";
import type { FileEntry, PathRef } from "./types";
import { extOf, kindOf } from "./format";
import { mockMutate, mockResolve, toAbsolutePath, type MockNode } from "./fs";
import { recordOperation } from "./history";
import { recordMockTrash, type MockTrashRecord } from "./trash";
import { beginJob, finishJob, updateJob } from "@/lib/jobs/journal";
import { dispatchFsPatch } from "@/lib/index/patches";
import { chunks, runQueued, tick } from "./op-queue";
import { namesStillPresent, nameExists } from "./verify";
import { t } from "@/lib/i18n";

function dispatchStorageChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("gf:storage-changed"));
  } catch {
    /* ignore */
  }
}

/**
 * Traduit un code d'erreur natif en message compréhensible.
 * Aucun code brut (`IO_FAILED`, `DENIED`…) ne remonte à l'utilisateur.
 */
export function humanizeIoError(raw: unknown, fallback = t("ops.error.deleteFailed")): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? "");
  if (/DENIED|PERMISSION/i.test(msg)) return t("ops.error.accessDenied");
  if (/NOT_FOUND|ENOENT/i.test(msg)) return t("ops.error.notFound");
  if (/EXISTS/i.test(msg)) return t("ops.error.nameExists");
  if (/NOT_A_DIRECTORY/i.test(msg)) return t("ops.error.notADirectory");
  if (/NO_SPACE|ENOSPC/i.test(msg)) return t("ops.error.noSpace");
  if (/UNSUPPORTED/i.test(msg)) return t("ops.error.unsupported");
  if (/plugin|bridge/i.test(msg)) return t("ops.error.storageUnavailable");
  return fallback;
}

/** Élimine les doublons de noms d'une sélection (deux écrans, même fichier). */
function uniqueEntries(entries: FileEntry[]): FileEntry[] {
  const seen = new Set<string>();
  const out: FileEntry[] = [];
  for (const e of entries) {
    if (!e?.name || seen.has(e.name)) continue;
    seen.add(e.name);
    out.push(e);
  }
  return out;
}

export type ProgressEvent = {
  /** Absolute number of items completed (files + directories). */
  completed: number;
  /** Best-effort total known so far. */
  total: number;
  /** Bytes processed for streamed content. */
  bytes: number;
  /** Best-effort total bytes (0 when unknown). */
  totalBytes: number;
  /** Label of the entry currently being processed. */
  currentName: string;
  /** ms since operation start. */
  elapsedMs: number;
  /** Estimated remaining ms — undefined when not enough data. */
  etaMs?: number;
};

export type OperationSignal = {
  cancelled: boolean;
  onCancel: () => void;
};

export type OperationResult = {
  ok: boolean;
  succeeded: number;
  failed: { name: string; reason: string }[];
  cancelled: boolean;
};

export function createSignal(): OperationSignal & { cancel: () => void } {
  const s = { cancelled: false, onCancel: () => {} } as OperationSignal & { cancel: () => void };
  s.cancel = () => {
    s.cancelled = true;
    s.onCancel();
  };
  return s;
}

function segmentsToPath(root: PathRef["rootId"], segments: string[]): PathRef {
  return { rootId: root, segments };
}

function joinAbs(base: string, name: string): string {
  return `${base.replace(/\/$/, "")}/${name}`;
}

function estimateEta(elapsed: number, done: number, total: number): number | undefined {
  if (done <= 0 || total <= 0 || done >= total) return undefined;
  return Math.max(0, Math.round((elapsed / done) * (total - done)));
}

/**
 * Budget d'énumération d'un dossier.
 *
 * Au-delà de ce nombre de fichiers, GeniusFiles arrête de construire un
 * plan détaillé en mémoire : la copie / le déplacement est confié à
 * l'implémentation native, qui traite l'arborescence en flux. On évite
 * ainsi OutOfMemory, StackOverflow et le gel du fil principal sur les
 * dossiers de plusieurs dizaines de milliers d'éléments — la progression
 * reste réelle, simplement à la granularité du dossier.
 */
const PLAN_FILE_BUDGET = 1500;
/** Nombre d'entrées énumérées avant de rendre la main au rendu. */
const PLAN_YIELD_EVERY = 400;

type WalkPlan = {
  files: { source: string; relative: string; size: number }[];
  dirs: string[];
  totalBytes: number;
  /** Vrai quand le plan détaillé a été abandonné (trop volumineux). */
  bulk: boolean;
  /** Nombre d'éléments estimé, y compris en mode `bulk`. */
  itemCount: number;
};

async function walkPlan(
  absPath: string,
  isDirectory: boolean,
  signal?: OperationSignal,
): Promise<WalkPlan> {
  const files: WalkPlan["files"] = [];
  const dirs: string[] = [];
  let totalBytes = 0;

  if (!isDirectory) {
    const p = nativePlugin();
    let size = 0;
    if (p) {
      try {
        const s: NativeStat = await p.stat({ path: absPath });
        size = s.size ?? 0;
      } catch {
        /* size stays 0 */
      }
    }
    files.push({ source: absPath, relative: absPath.split("/").pop() ?? "file", size });
    return { files, dirs, totalBytes: size, bulk: false, itemCount: 1 };
  }

  // Parcours itératif (jamais récursif) avec budget et respiration.
  const rootName = absPath.split("/").pop() ?? "folder";
  dirs.push(rootName);
  const stack: { abs: string; rel: string }[] = [{ abs: absPath, rel: rootName }];
  let seen = 0;
  while (stack.length) {
    if (signal?.cancelled) break;
    const cur = stack.pop()!;
    const res = await listNativeDirectory(cur.abs);
    if (!res.ok) continue;
    for (const e of res.listing.entries) {
      if (e.name.startsWith(".")) continue;
      seen++;
      if (seen % PLAN_YIELD_EVERY === 0) await tick();
      const childRel = `${cur.rel}/${e.name}`;
      if (e.isDirectory) {
        dirs.push(childRel);
        stack.push({ abs: e.path, rel: childRel });
      } else {
        files.push({ source: e.path, relative: childRel, size: e.size ?? 0 });
        totalBytes += e.size ?? 0;
      }
    }
    if (files.length > PLAN_FILE_BUDGET) {
      // Trop gros pour un plan détaillé : on bascule en mode natif global
      // et on demande des totaux au système plutôt qu'en énumérant.
      return bulkPlan(absPath, rootName);
    }
  }
  return { files, dirs, totalBytes, bulk: false, itemCount: files.length + dirs.length };
}

/** Totaux d'un gros dossier obtenus par `stat` — sans énumération JS. */
async function bulkPlan(absPath: string, rootName: string): Promise<WalkPlan> {
  const p = nativePlugin();
  let totalBytes = 0;
  let itemCount = 0;
  if (p) {
    try {
      const s: NativeStat = await p.stat({ path: absPath });
      totalBytes = s.recursiveSize ?? 0;
      itemCount = s.itemCount ?? 0;
    } catch {
      /* totaux inconnus — l'interface n'affichera que le réel */
    }
  }
  return {
    files: [],
    dirs: [rootName],
    totalBytes,
    bulk: true,
    itemCount: itemCount > 0 ? itemCount : 1,
  };
}

/* ---------- create / rename ---------- */

export async function createDirectory(
  parent: PathRef,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  const clean = name.trim();
  if (!clean || /[\\/]/.test(clean)) return { ok: false, error: t("ops.error.invalidName") };
  if (isAndroidNative()) {
    const p = nativePlugin();
    if (!p) return { ok: false, error: t("ops.error.pluginUnavailable") };
    try {
      const abs = joinAbs(toAbsolutePath(parent), clean);
      await p.createDirectory({ path: abs });
      // Contrôle réel : un `resolve()` du plugin ne suffit pas à déclarer
      // le dossier créé (volume démonté, quota, chemin invalide…).
      if (!(await nameExists(parent, clean))) {
        return { ok: false, error: t("ops.error.createFailed") };
      }
      recordOperation({
        kind: "mkdir",
        summary: t("ops.mkdir.summary", { name: clean }),
        source: parent,
        names: [clean],
        succeeded: 1,
        failed: 0,
      });
      dispatchFsPatch({
        op: "create",
        rootId: parent.rootId,
        segments: parent.segments,
        name: clean,
        isDirectory: true,
        mtime: Date.now(),
      });
      dispatchStorageChanged();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: humanizeIoError(err, t("ops.error.createFailed")) };
    }
  }
  // Mock (web preview).
  const result = mockMutate(parent, (node) => {
    if (!node.children) node.children = [];
    if (node.children.some((c) => c.name === clean)) return "EXISTS";
    node.children.push({ name: clean, isDirectory: true, children: [], mtime: Date.now() });
    return null;
  });
  if (result === "EXISTS") return { ok: false, error: t("ops.error.nameExists") };
  if (result) return { ok: false, error: result };
  recordOperation({
    kind: "mkdir",
    summary: t("ops.mkdir.summary", { name: clean }),
    source: parent,
    names: [clean],
    succeeded: 1,
    failed: 0,
  });
  dispatchFsPatch({
    op: "create",
    rootId: parent.rootId,
    segments: parent.segments,
    name: clean,
    isDirectory: true,
    mtime: Date.now(),
  });
  dispatchStorageChanged();
  return { ok: true };
}

export async function renameEntry(
  parent: PathRef,
  entry: FileEntry,
  newName: string,
): Promise<{ ok: boolean; error?: string }> {
  const clean = newName.trim();
  if (!clean || /[\\/]/.test(clean)) return { ok: false, error: t("ops.error.invalidName") };
  if (clean === entry.name) return { ok: true };
  if (isAndroidNative()) {
    const p = nativePlugin();
    if (!p) return { ok: false, error: t("ops.error.pluginUnavailable") };
    try {
      const abs = joinAbs(toAbsolutePath(parent), entry.name);
      await p.renamePath({ path: abs, newName: clean });
      // Vérification croisée : le nouveau nom doit exister et l'ancien
      // avoir disparu, sinon l'interface afficherait un faux succès.
      const present = await namesStillPresent(parent, [entry.name, clean]);
      if (!present.has(clean) || present.has(entry.name)) {
        return { ok: false, error: t("ops.error.renameFailed") };
      }
      recordOperation({
        kind: "rename",
        summary: t("ops.rename.summary", { from: entry.name, to: clean }),
        source: parent,
        names: [entry.name, clean],
        succeeded: 1,
        failed: 0,
      });
      dispatchFsPatch({
        op: "rename",
        rootId: parent.rootId,
        segments: parent.segments,
        oldName: entry.name,
        newName: clean,
        isDirectory: entry.isDirectory,
      });
      dispatchStorageChanged();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: humanizeIoError(err, t("ops.error.renameFailed")) };
    }
  }
  const result = mockMutate(parent, (node) => {
    if (!node.children) return "NOT_FOUND";
    const target = node.children.find((c) => c.name === entry.name);
    if (!target) return "NOT_FOUND";
    if (node.children.some((c) => c.name === clean)) return "EXISTS";
    target.name = clean;
    target.mtime = Date.now();
    return null;
  });
  if (result === "EXISTS") return { ok: false, error: t("ops.error.nameExists") };
  if (result) return { ok: false, error: t("ops.error.renameFailed") };
  recordOperation({
    kind: "rename",
    summary: t("ops.rename.summary", { from: entry.name, to: clean }),
    source: parent,
    names: [entry.name, clean],
    succeeded: 1,
    failed: 0,
  });
  dispatchFsPatch({
    op: "rename",
    rootId: parent.rootId,
    segments: parent.segments,
    oldName: entry.name,
    newName: clean,
    isDirectory: entry.isDirectory,
  });
  dispatchStorageChanged();
  return { ok: true };
}

/* ---------- delete (soft — moves to trash) ---------- */

/**
 * Taille d'un lot de suppression.
 *
 * Le lot est volontairement court : chaque aller-retour natif reste
 * bref (pas d'ANR), l'annulation est prise en compte entre deux lots et
 * la progression avance réellement. Surtout, GeniusFiles n'énumère JAMAIS
 * le contenu d'un dossier avant de le supprimer : la mise à la Corbeille
 * est un déplacement (rename) atomique côté système, donc un dossier de
 * 100 000 fichiers coûte autant qu'un fichier seul — aucun risque
 * d'OutOfMemory ni de récursion JS.
 */
const DELETE_CHUNK = 12;

export type DeleteOptions = {
  onProgress?: (p: ProgressEvent) => void;
  signal?: OperationSignal;
};

export async function deleteEntries(
  parent: PathRef,
  entries: FileEntry[],
  opts: DeleteOptions = {},
): Promise<OperationResult> {
  const targets = uniqueEntries(entries);
  if (targets.length === 0) return { ok: true, succeeded: 0, failed: [], cancelled: false };
  // Concurrence bornée : une suppression massive ne peut pas saturer
  // l'appareil pendant qu'une copie tourne déjà.
  return runQueued(() => runDelete(parent, targets, opts));
}

/** Retire un lot de l'arborescence simulée (aperçu web) + Corbeille. */
function mockRemoveBatch(parent: PathRef, names: string[]): void {
  const removed: MockNode[] = [];
  mockMutate(parent, (node) => {
    if (!node.children) return null;
    const set = new Set(names);
    for (const c of node.children) {
      if (set.has(c.name)) removed.push(JSON.parse(JSON.stringify(c)) as MockNode);
    }
    node.children = node.children.filter((c) => !set.has(c.name));
    return null;
  });
  if (removed.length === 0) return;
  const now = Date.now();
  const records: MockTrashRecord[] = removed.map((node, idx) => ({
    id: `${now}_${idx}_${node.name}`,
    name: node.name,
    originalPath: `/storage/emulated/0/${[...parent.segments, node.name].join("/")}`,
    isDirectory: node.isDirectory,
    size: sumMock(node),
    deletedAt: now,
    originalMtime: node.mtime,
    parentSegments: parent.segments,
    rootId: parent.rootId,
    snapshot: node,
  }));
  recordMockTrash(records);
}

async function runDelete(
  parent: PathRef,
  targets: FileEntry[],
  opts: DeleteOptions,
): Promise<OperationResult> {
  const failed: OperationResult["failed"] = [];
  const confirmed: FileEntry[] = [];
  const movedRecords: { id: string; originalPath: string; trashPath: string }[] = [];
  const total = targets.length;
  // Seules les tailles réellement connues sont annoncées : jamais de
  // volume inventé pour « faire avancer » la barre.
  const totalBytes = targets.reduce((s, e) => s + (e.isDirectory ? 0 : (e.size ?? 0)), 0);
  const started = Date.now();
  let bytesDone = 0;

  // Journal + notification permanente uniquement quand l'opération est
  // réellement longue : une suppression unitaire reste silencieuse.
  const jobId =
    total > 8
      ? beginJob({
          kind: "delete",
          title: total === 1 ? targets[0].name : `${total} éléments`,
          total,
          totalBytes,
          payload: { parent, entries: targets },
          foreground: total > 200,
        })
      : null;

  const emit = (currentName: string) => {
    const completed = confirmed.length + failed.length;
    const elapsedMs = Date.now() - started;
    const etaMs = estimateEta(elapsedMs, completed, total);
    if (jobId) {
      updateJob(jobId, {
        completed,
        total,
        bytes: bytesDone,
        totalBytes,
        currentName,
        etaMs,
      });
    }
    opts.onProgress?.({
      completed,
      total,
      bytes: bytesDone,
      totalBytes,
      currentName,
      elapsedMs,
      etaMs,
    });
  };
  emit(targets[0].name);

  const native = isAndroidNative();
  const p = native ? nativePlugin() : null;
  if (native && !p) {
    if (jobId) finishJob(jobId, "failed", t("ops.error.storageUnavailable"));
    return {
      ok: false,
      succeeded: 0,
      failed: targets.map((e) => ({ name: e.name, reason: t("ops.error.storageUnavailable") })),
      cancelled: false,
    };
  }
  const base = native ? toAbsolutePath(parent) : "";

  let cancelled = false;
  for (const batch of chunks(targets, DELETE_CHUNK)) {
    if (opts.signal?.cancelled) {
      cancelled = true;
      break;
    }
    const names = batch.map((e) => e.name);
    /** Motif remonté par le backend, par nom (peut rester vide). */
    const reported = new Map<string, string>();

    if (p) {
      try {
        const res = await p.moveToTrash({ paths: names.map((n) => joinAbs(base, n)) });
        for (const mv of res.moved ?? []) movedRecords.push(mv);
        for (const f of res.failed ?? []) {
          reported.set(f.split("/").pop() ?? f, t("ops.error.itemInaccessible"));
        }
      } catch (err) {
        // Une erreur globale n'implique pas que rien n'a été fait : la
        // vérification disque ci-dessous tranche, élément par élément.
        const reason = humanizeIoError(err, t("ops.error.deleteFailed"));
        for (const n of names) reported.set(n, reason);
      }
    } else {
      mockRemoveBatch(parent, names);
    }

    // ── Contrôle de l'état RÉEL du stockage. C'est lui, et non le code de
    // retour du plugin, qui décide de ce que l'interface affiche.
    let stillThere: Set<string>;
    try {
      stillThere = await namesStillPresent(parent, names);
    } catch {
      // Impossible de vérifier (volume retiré) : on ne prétend pas avoir
      // réussi, on signale honnêtement.
      stillThere = new Set(names);
    }

    for (const e of batch) {
      if (stillThere.has(e.name)) {
        failed.push({
          name: e.name,
          reason: reported.get(e.name) ?? t("ops.error.deleteFailedStillPresent"),
        });
      } else {
        confirmed.push(e);
        if (!e.isDirectory) bytesDone += e.size ?? 0;
        // Patch chirurgical : l'élément disparaît de toutes les vues
        // (dossier, catégories, recherche, récents, sélection) sans
        // relire le dossier ni perdre la position de défilement.
        dispatchFsPatch({
          op: "delete",
          rootId: parent.rootId,
          segments: parent.segments,
          name: e.name,
          isDirectory: e.isDirectory,
          size: e.isDirectory ? undefined : (e.size ?? 0),
        });
      }
    }
    emit(batch[batch.length - 1]?.name ?? "");
    // Respiration : le fil principal reste disponible pour le rendu.
    await tick();
  }

  const succeeded = confirmed.length;
  if (succeeded > 0 || failed.length > 0) {
    recordOperation({
      kind: "delete",
      summary: t("ops.delete.summary", {
        count: succeeded,
        name: confirmed[0]?.name ?? targets[0].name,
      }),
      source: parent,
      names: confirmed.map((e) => e.name),
      succeeded,
      failed: failed.length,
      ...(movedRecords.length > 0
        ? { restorable: { kind: "trash" as const, items: movedRecords } }
        : {}),
    });
  }
  if (succeeded > 0) dispatchStorageChanged();
  if (jobId) {
    finishJob(
      jobId,
      cancelled ? "cancelled" : failed.length === 0 ? "done" : "failed",
      failed.length ? `${failed.length} échec(s)` : undefined,
    );
  }
  return { ok: failed.length === 0 && !cancelled, succeeded, failed, cancelled };
}

function sumMock(node: MockNode): number {
  if (!node.isDirectory) return node.size ?? 0;
  return (node.children ?? []).reduce((s, c) => s + sumMock(c), 0);
}

/* ---------- copy / move ---------- */

type TransferOptions = {
  mode: "copy" | "move";
  onProgress?: (p: ProgressEvent) => void;
  signal?: OperationSignal;
};

/**
 * Copie / déplacement en flux d'une arborescence, sans plan mémoire.
 *
 * Le parcours est itératif et ne conserve qu'une pile de dossiers : un
 * dossier de 200 000 fichiers se copie avec une empreinte mémoire
 * constante. La main est rendue régulièrement au rendu, et l'annulation
 * est honorée entre deux fichiers.
 */
async function copyTreeStreaming(
  p: NonNullable<ReturnType<typeof nativePlugin>>,
  srcRoot: string,
  dstRoot: string,
  ctx: {
    signal?: OperationSignal;
    failed: OperationResult["failed"];
    onFile: (size: number, name: string) => void;
  },
): Promise<void> {
  const stack: { abs: string; dst: string }[] = [{ abs: srcRoot, dst: dstRoot }];
  let processed = 0;
  while (stack.length) {
    if (ctx.signal?.cancelled) return;
    const cur = stack.pop()!;
    try {
      await p.createDirectory({ path: cur.dst });
    } catch {
      /* déjà présent */
    }
    const res = await listNativeDirectory(cur.abs);
    if (!res.ok) continue;
    for (const e of res.listing.entries) {
      if (ctx.signal?.cancelled) return;
      if (e.name.startsWith(".")) continue;
      const target = joinAbs(cur.dst, e.name);
      if (e.isDirectory) {
        stack.push({ abs: e.path, dst: target });
        continue;
      }
      try {
        await p.copyFile({ source: e.path, destination: target, overwrite: false });
        ctx.onFile(e.size ?? 0, e.name);
      } catch (err) {
        ctx.failed.push({ name: e.name, reason: humanizeIoError(err, t("ops.error.copyFailed")) });
      }
      if (++processed % 24 === 0) await tick();
    }
  }
}

export async function transferEntries(
  source: PathRef,
  entries: FileEntry[],
  destination: PathRef,
  opts: TransferOptions,
): Promise<OperationResult> {
  const targets = uniqueEntries(entries);
  if (targets.length === 0) return { ok: true, succeeded: 0, failed: [], cancelled: false };
  return runQueued(() => runTransferEntries(source, targets, destination, opts));
}

async function runTransferEntries(
  source: PathRef,
  entries: FileEntry[],
  destination: PathRef,
  opts: TransferOptions,
): Promise<OperationResult> {
  const failed: OperationResult["failed"] = [];
  let succeeded = 0;

  if (!isAndroidNative()) {
    // Mock — moves and copies at once, ignoring progress detail.
    const dstOk = mockResolve(destination);
    if (!dstOk) {
      return {
        ok: false,
        succeeded: 0,
        failed: entries.map((e) => ({ name: e.name, reason: t("ops.error.destinationMissing") })),
        cancelled: false,
      };
    }
    mockMutate(source, (srcNode) => {
      if (!srcNode.children) return null;
      const names = new Set(entries.map((e) => e.name));
      const moving = srcNode.children.filter((c) => names.has(c.name));
      // clone for copy, extract for move
      const cloned = moving.map((n) => JSON.parse(JSON.stringify(n)));
      mockMutate(destination, (dstNode) => {
        if (!dstNode.children) dstNode.children = [];
        for (const n of cloned) {
          if (dstNode.children.some((c) => c.name === n.name)) {
            failed.push({ name: n.name, reason: t("ops.error.alreadyExists") });
            continue;
          }
          dstNode.children.push(n);
          succeeded++;
        }
        return null;
      });
      if (opts.mode === "move") {
        const successNames = new Set(
          cloned.map((n) => n.name).filter((n) => !failed.some((f) => f.name === n)),
        );
        srcNode.children = srcNode.children.filter((c) => !successNames.has(c.name));
      }
      return null;
    });
    recordOperation({
      kind: opts.mode,
      summary:
        succeeded === 1
          ? t(opts.mode === "copy" ? "files.op.copiedOne" : "files.op.movedOne", {
              name: entries[0]?.name ?? "",
            })
          : t(opts.mode === "copy" ? "files.op.copiedMany" : "files.op.movedMany", {
              count: succeeded,
            }),
      source,
      destination,
      names: entries.map((e) => e.name),
      succeeded,
      failed: failed.length,
    });
    // Mêmes patchs chirurgicaux qu'en natif : l'aperçu web se comporte
    // exactement comme l'appareil.
    const okNames = new Set(
      entries.map((e) => e.name).filter((n) => !failed.some((f) => f.name === n)),
    );
    for (const e of entries) {
      if (!okNames.has(e.name)) continue;
      if (opts.mode === "move") {
        dispatchFsPatch({
          op: "move",
          fromRootId: source.rootId,
          fromSegments: source.segments,
          fromName: e.name,
          toRootId: destination.rootId,
          toSegments: destination.segments,
          toName: e.name,
          isDirectory: e.isDirectory,
        });
      } else {
        dispatchFsPatch({
          op: "create",
          rootId: destination.rootId,
          segments: destination.segments,
          name: e.name,
          isDirectory: e.isDirectory,
          size: e.size,
          mtime: e.mtime,
        });
      }
    }
    if (succeeded > 0) dispatchStorageChanged();
    return { ok: failed.length === 0, succeeded, failed, cancelled: false };
  }

  const p = nativePlugin();
  if (!p) {
    return {
      ok: false,
      succeeded: 0,
      failed: entries.map((e) => ({ name: e.name, reason: t("ops.error.pluginUnavailable") })),
      cancelled: false,
    };
  }

  const srcAbs = toAbsolutePath(source);
  const dstAbs = toAbsolutePath(destination);
  const started = Date.now();
  let bytesDone = 0;
  let completed = 0;

  // Plan borné : détaillé quand c'est raisonnable, en flux au-delà.
  type Plan = { entry: FileEntry } & WalkPlan;
  const plans: Plan[] = [];
  let grandTotalBytes = 0;
  let grandTotalItems = 0;
  for (const e of entries) {
    if (opts.signal?.cancelled) break;
    const abs = joinAbs(srcAbs, e.name);
    const walk = await walkPlan(abs, e.isDirectory, opts.signal);
    plans.push({ entry: e, ...walk });
    grandTotalBytes += walk.totalBytes;
    grandTotalItems += walk.bulk ? walk.itemCount : walk.files.length + walk.dirs.length;
    await tick();
  }

  // Journal — enables resume if the process is killed mid-transfer.
  const jobId = beginJob({
    kind: opts.mode,
    title: entries.length === 1 ? entries[0].name : `${entries.length} éléments`,
    total: grandTotalItems,
    totalBytes: grandTotalBytes,
    payload: { source, destination, entries, mode: opts.mode },
    // Les transferts affichent toujours une notification permanente :
    // l'utilisateur peut quitter l'application sans perdre le suivi.
    foreground: true,
  });

  let lastSpeedTick = started;
  let lastSpeedBytes = 0;
  let speedBps = 0;
  const emit = (name: string) => {
    const now = Date.now();
    if (now - lastSpeedTick >= 400) {
      const inst = ((bytesDone - lastSpeedBytes) / (now - lastSpeedTick)) * 1000;
      speedBps = speedBps > 0 ? speedBps * 0.7 + Math.max(0, inst) * 0.3 : Math.max(0, inst);
      lastSpeedTick = now;
      lastSpeedBytes = bytesDone;
    }
    updateJob(jobId, {
      completed,
      bytes: bytesDone,
      totalBytes: grandTotalBytes,
      total: grandTotalItems,
      speedBps,
      currentName: name,
      etaMs: estimateEta(now - started, bytesDone || completed, grandTotalBytes || grandTotalItems),
    });
    opts.onProgress?.({
      completed,
      total: grandTotalItems,
      bytes: bytesDone,
      totalBytes: grandTotalBytes,
      currentName: name,
      elapsedMs: Date.now() - started,
      etaMs: estimateEta(
        Date.now() - started,
        bytesDone || completed,
        grandTotalBytes || grandTotalItems,
      ),
    });
  };
  emit(entries[0]?.name ?? "");

  outer: for (const plan of plans) {
    if (opts.signal?.cancelled) break;
    const srcRoot = joinAbs(srcAbs, plan.entry.name);
    const dstRoot = joinAbs(dstAbs, plan.entry.name);

    /**
     * Confirme le résultat sur le stockage réel : l'élément doit être
     * présent à destination et, pour un déplacement, absent de la source.
     * Sans cette confirmation, aucun succès n'est annoncé à l'interface.
     */
    const confirmed = async (): Promise<boolean> => {
      try {
        const arrived = await namesStillPresent(destination, [plan.entry.name]);
        if (!arrived.has(plan.entry.name)) return false;
        if (opts.mode === "move") {
          const left = await namesStillPresent(source, [plan.entry.name]);
          if (left.has(plan.entry.name)) return false;
        }
        return true;
      } catch {
        return false;
      }
    };

    /** Met à jour les vues de façon chirurgicale (ni rescan, ni reset). */
    const announce = () => {
      succeeded++;
      if (opts.mode === "move") {
        dispatchFsPatch({
          op: "move",
          fromRootId: source.rootId,
          fromSegments: source.segments,
          fromName: plan.entry.name,
          toRootId: destination.rootId,
          toSegments: destination.segments,
          toName: plan.entry.name,
          isDirectory: plan.entry.isDirectory,
        });
      } else {
        dispatchFsPatch({
          op: "create",
          rootId: destination.rootId,
          segments: destination.segments,
          name: plan.entry.name,
          isDirectory: plan.entry.isDirectory,
          size: plan.entry.size,
          mtime: plan.entry.mtime,
        });
      }
      emit(plan.entry.name);
    };

    // Voie rapide : un déplacement sur le même volume est un rename
    // atomique — instantané même pour un dossier énorme.
    if (opts.mode === "move") {
      let renamed = false;
      try {
        await p.moveFile({ source: srcRoot, destination: dstRoot, overwrite: false });
        renamed = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/EXISTS/i.test(msg)) {
          failed.push({ name: plan.entry.name, reason: t("ops.error.alreadyExistsAtDestination") });
          continue;
        }
        // Volumes différents → repli sur copie puis suppression.
      }
      if (renamed) {
        if (await confirmed()) {
          completed += plan.bulk ? plan.itemCount : plan.files.length + plan.dirs.length;
          bytesDone += plan.totalBytes;
          announce();
        } else {
          failed.push({
            name: plan.entry.name,
            reason: t("ops.error.moveUnconfirmed"),
          });
        }
        continue;
      }
    }

    if (plan.bulk) {
      // Trop volumineux pour un plan détaillé : copie en flux, empreinte
      // mémoire constante, progression réelle fichier par fichier.
      await copyTreeStreaming(p, srcRoot, dstRoot, {
        signal: opts.signal,
        failed,
        onFile: (size, name) => {
          bytesDone += size;
          completed++;
          emit(name);
        },
      });
    } else {
      // Squelette de dossiers.
      for (const relDir of plan.dirs) {
        if (opts.signal?.cancelled) break outer;
        try {
          await p.createDirectory({ path: joinAbs(dstAbs, relDir) });
        } catch {
          /* déjà présent */
        }
      }
      let done = 0;
      for (const file of plan.files) {
        if (opts.signal?.cancelled) break outer;
        const rel = file.relative;
        try {
          await p.copyFile({
            source: file.source,
            destination: joinAbs(dstAbs, rel),
            overwrite: false,
          });
          bytesDone += file.size;
          completed++;
          emit(rel.split("/").pop() ?? rel);
        } catch (err) {
          failed.push({ name: rel, reason: humanizeIoError(err, t("ops.error.copyFailed")) });
        }
        // Respiration périodique : le fil principal reste fluide.
        if (++done % 24 === 0) await tick();
      }
      completed += plan.dirs.length;
    }
    if (opts.signal?.cancelled) break outer;

    if (opts.mode === "move") {
      // La source n'est retirée qu'après une copie confirmée : aucune
      // perte de données possible en cas d'échec partiel.
      const arrived = await namesStillPresent(destination, [plan.entry.name]);
      if (!arrived.has(plan.entry.name)) {
        failed.push({ name: plan.entry.name, reason: t("ops.error.copyUnconfirmedSourceKept") });
        continue;
      }
      try {
        await p.deletePath({ path: srcRoot });
      } catch {
        /* source conservée — l'utilisateur peut réessayer */
      }
    }
    if (await confirmed()) announce();
    else failed.push({ name: plan.entry.name, reason: t("ops.error.transferUnconfirmed") });
    await tick();
  }

  const cancelled = Boolean(opts.signal?.cancelled);
  recordOperation({
    kind: opts.mode,
    summary: t(opts.mode === "copy" ? "ops.transfer.copySummary" : "ops.transfer.moveSummary", {
      count: succeeded,
      name: entries[0]?.name ?? "",
    }),
    source,
    destination,
    names: entries.map((e) => e.name),
    succeeded,
    failed: failed.length,
  });
  finishJob(
    jobId,
    cancelled ? "cancelled" : failed.length === 0 ? "done" : "failed",
    failed.length ? `${failed.length} échec(s)` : undefined,
  );
  if (succeeded > 0) dispatchStorageChanged();
  return { ok: failed.length === 0 && !cancelled, succeeded, failed, cancelled };
}

/* ---------- share ---------- */

export async function shareEntries(
  parent: PathRef,
  entries: FileEntry[],
): Promise<{ ok: boolean; error?: string }> {
  const files = entries.filter((e) => !e.isDirectory);
  if (files.length === 0)
    return {
      ok: false,
      error: t("ops.error.shareNoFiles"),
    };
  if (!isAndroidNative()) {
    recordOperation({
      kind: "share",
      summary: t("ops.share.summary", { count: files.length, name: files[0]?.name ?? "" }),
      source: parent,
      names: files.map((f) => f.name),
      succeeded: files.length,
      failed: 0,
    });
    return { ok: true };
  }
  const p = nativePlugin();
  if (!p) return { ok: false, error: t("ops.error.pluginUnavailable") };
  const paths = files.map((e) => joinAbs(toAbsolutePath(parent), e.name));
  try {
    await p.shareFiles({ paths });
    recordOperation({
      kind: "share",
      summary: t("ops.share.summary", { count: files.length, name: files[0]?.name ?? "" }),
      source: parent,
      names: files.map((f) => f.name),
      succeeded: files.length,
      failed: 0,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || t("ops.error.shareFailed") };
  }
}

/* ---------- details ---------- */

export type DetailsInfo = {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  mtime?: number;
  itemCount?: number;
  ext?: string;
};

export async function readDetails(parent: PathRef, entry: FileEntry): Promise<DetailsInfo> {
  const base: DetailsInfo = {
    name: entry.name,
    path: joinAbs(toAbsolutePath(parent), entry.name),
    isDirectory: entry.isDirectory,
    size: entry.size,
    mtime: entry.mtime,
    ext: entry.ext ?? extOf(entry.name),
  };
  if (isAndroidNative()) {
    const p = nativePlugin();
    if (!p) return base;
    try {
      const s: NativeStat = await p.stat({ path: base.path });
      return {
        ...base,
        size: entry.isDirectory ? (s.recursiveSize ?? 0) : (s.size ?? entry.size),
        mtime: s.mtime ?? entry.mtime,
        itemCount: entry.isDirectory ? s.itemCount : undefined,
      };
    } catch {
      return base;
    }
  }
  // Mock — walk children to compute size when directory.
  if (entry.isDirectory) {
    const node = mockResolve({ rootId: parent.rootId, segments: [...parent.segments, entry.name] });
    if (node) {
      let size = 0;
      let count = 0;
      const walk = (n: MockNode) => {
        if (!n.isDirectory) {
          size += n.size ?? 0;
          count++;
          return;
        }
        for (const c of n.children ?? []) walk(c);
      };
      walk(node);
      return { ...base, size, itemCount: count };
    }
  }
  return base;
}

export { kindOf };
