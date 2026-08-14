/**
 * Gestionnaire global des copies / déplacements.
 *
 * Les tâches vivent en dehors de React : démarrer un transfert ne dépend
 * plus de l'écran qui l'a lancé. Fermer la fenêtre de progression
 * (« Masquer »), naviguer, lire une vidéo ou ouvrir les paramètres ne
 * touche jamais la tâche — elle poursuit exactement au même rythme.
 *
 * Plusieurs tâches peuvent tourner simultanément : chacune possède son
 * propre signal d'annulation, ses compteurs, sa vitesse et son ETA.
 * L'état est exposé via `useTransferTasks()` (useSyncExternalStore) donc
 * n'importe quel écran peut afficher / reprendre la supervision d'une
 * tâche à tout moment, sans recalcul ni redémarrage.
 *
 * La persistance dans le journal (`src/lib/jobs/journal.ts`) est assurée
 * par `transferEntries` lui-même : si le process est tué, la reprise
 * reste possible via la bannière d'accueil. Une notification Android
 * (service au premier plan) est maintenue tant qu'une tâche tourne.
 */
import { createSignal, transferEntries, type OperationSignal } from "@/lib/files/operations";
import { t } from "@/lib/i18n";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { requestFileJump } from "@/lib/files/deeplink";
import { showNotification } from "@/lib/native/notifications";
import { formatSize } from "@/lib/files/format";
import { toAbsolutePath } from "@/lib/files/fs";
import {
  cancelNativeTask,
  isNativeTransferAvailable,
  listNativeTasks,
  onNativeTaskEvent,
  startNativeTask,
  type NativeTaskSnapshot,
} from "./native-engine";

export type TransferStatus = "running" | "done" | "failed" | "cancelled";

export type TransferFailure = { name: string; reason: string };

export type TransferTask = {
  id: string;
  mode: "copy" | "move";
  status: TransferStatus;
  /** Libellé court : nom du fichier ou « 12 éléments ». */
  title: string;
  sourceLabel: string;
  destLabel: string;
  destination: PathRef;
  startedAt: number;
  endedAt?: number;
  /** Éléments (fichiers + dossiers) planifiés / traités. */
  total: number;
  completed: number;
  bytes: number;
  totalBytes: number;
  /** Octets par seconde, lissés. */
  speedBps: number;
  etaMs?: number;
  currentName?: string;
  succeeded: number;
  failures: TransferFailure[];
  message?: string;
};

type Internal = TransferTask & {
  signal: OperationSignal & { cancel: () => void };
  lastTick: number;
  lastBytes: number;
  /** Exécutée par le service Android : rien ne tourne dans la WebView. */
  native?: boolean;
  onDone?: (task: TransferTask) => void;
};

const tasks = new Map<string, Internal>();
const listeners = new Set<() => void>();
let snapshot: TransferTask[] = [];

function publish() {
  snapshot = [...tasks.values()].map(
    ({ signal: _s, lastTick: _t, lastBytes: _b, onDone: _d, ...t }) => t,
  );
  for (const l of listeners) l();
}

export function subscribeTransfers(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTransferSnapshot(): TransferTask[] {
  return snapshot;
}

export function getTask(id: string | null | undefined): TransferTask | null {
  if (!id) return null;
  return snapshot.find((t) => t.id === id) ?? null;
}

export function activeTransfers(): TransferTask[] {
  return snapshot.filter((t) => t.status === "running");
}

export function cancelTransfer(id: string) {
  const t = tasks.get(id);
  if (!t) return;
  if (t.native) cancelNativeTask(id);
  else t.signal.cancel();
}

export function dismissTransfer(id: string) {
  const t = tasks.get(id);
  if (!t || t.status === "running") return;
  tasks.delete(id);
  publish();
}

export function clearFinishedTransfers() {
  for (const [id, t] of tasks) if (t.status !== "running") tasks.delete(id);
  publish();
}

/* ---------- vitesse / ETA ---------- */

function tickSpeed(t: Internal) {
  const now = Date.now();
  const dt = now - t.lastTick;
  if (dt < 350) return;
  const db = t.bytes - t.lastBytes;
  const inst = db > 0 ? (db / dt) * 1000 : 0;
  // Lissage exponentiel : évite les à-coups de l'affichage.
  t.speedBps = t.speedBps > 0 ? t.speedBps * 0.7 + inst * 0.3 : inst;
  t.lastTick = now;
  t.lastBytes = t.bytes;
  if (t.speedBps > 0 && t.totalBytes > t.bytes) {
    t.etaMs = ((t.totalBytes - t.bytes) / t.speedBps) * 1000;
  }
}

export function formatSpeed(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return "—";
  return `${formatSize(bps)}/s`;
}

export function formatEta(ms?: number): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return rest ? `${m} min ${rest} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

/* ---------- démarrage ---------- */

export type TransferGroup = { parent: PathRef; entries: FileEntry[] };

export type StartTransferInput = {
  mode: "copy" | "move";
  groups: TransferGroup[];
  destination: PathRef;
  /** Rafraîchissement de l'écran appelant, exécuté à la fin. */
  onDone?: (task: TransferTask) => void;
};

function labelOf(ref: PathRef): string {
  return ref.segments.length ? ref.segments.join(" / ") : t("home.transfer.rootLabel");
}

export function startTransfer(input: StartTransferInput): string {
  const { mode, groups, destination } = input;
  const all = groups.flatMap((g) => g.entries);
  const id = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const task: Internal = {
    id,
    mode,
    status: "running",
    title: all.length === 1 ? all[0].name : `${all.length} éléments`,
    sourceLabel: groups[0] ? labelOf(groups[0].parent) : "—",
    destLabel: labelOf(destination),
    destination,
    startedAt: now,
    total: all.length,
    completed: 0,
    bytes: 0,
    totalBytes: 0,
    speedBps: 0,
    succeeded: 0,
    failures: [],
    signal: createSignal(),
    lastTick: now,
    lastBytes: 0,
  };
  task.onDone = input.onDone;
  tasks.set(id, task);
  publish();

  // Chemin privilégié : moteur natif (service Android). Aucun octet n'est
  // copié par la WebView, la tâche survit à la fermeture de l'application.
  if (isNativeTransferAvailable()) {
    task.native = true;
    const sources = groups.flatMap((g) =>
      g.entries.map((e) => `${toAbsolutePath(g.parent)}/${e.name}`),
    );
    ensureNativeBridge();
    void startNativeTask({
      id,
      mode,
      sources,
      destination: toAbsolutePath(destination),
      title: task.title,
    }).then((ok) => {
      // Le natif a refusé (ancien build) : bascule transparente sur le JS.
      if (!ok) {
        task.native = false;
        void run(task, groups, destination, input.onDone);
      }
    });
    return id;
  }

  void run(task, groups, destination, input.onDone);
  return id;
}

/* ---------- moteur natif : synchronisation ---------- */

let nativeWired = false;

function applyNative(snap: NativeTaskSnapshot, task: Internal) {
  task.total = snap.total;
  task.completed = snap.completed;
  task.bytes = snap.bytes;
  task.totalBytes = snap.totalBytes;
  task.speedBps = snap.speedBps;
  task.etaMs = snap.etaMs >= 0 ? snap.etaMs : undefined;
  task.currentName = snap.currentName || undefined;
  task.failures = snap.failures ?? [];
  task.succeeded = Math.max(0, snap.completed - task.failures.length);
  task.status = snap.status;
  if (snap.status !== "running") {
    task.endedAt = snap.endedAt || Date.now();
    task.speedBps = 0;
    task.etaMs = 0;
    task.message = summaryMessage(task);
  }
}

function ensureNativeBridge() {
  if (nativeWired || !isNativeTransferAvailable()) return;
  nativeWired = true;
  onNativeTaskEvent((event, snap) => {
    const task = tasks.get(snap.id) ?? adopt(snap);
    if (!task) return;
    applyNative(snap, task);
    publish();
    if (event === "done") {
      notifyEnd(task);
      task.onDone?.(getTask(task.id) ?? task);
      if (task.status === "done") setTimeout(() => dismissTransfer(task.id), 15_000);
    }
  });
}

function adopt(snap: NativeTaskSnapshot): Internal | null {
  if (tasks.has(snap.id)) return tasks.get(snap.id)!;
  const task: Internal = {
    id: snap.id,
    mode: snap.mode,
    status: snap.status,
    title: snap.title,
    sourceLabel: "—",
    destLabel: snap.destination.split("/").filter(Boolean).slice(-2).join(" / ") || "—",
    destination: { rootId: "internal", segments: [] },
    startedAt: snap.startedAt,
    total: snap.total,
    completed: snap.completed,
    bytes: snap.bytes,
    totalBytes: snap.totalBytes,
    speedBps: snap.speedBps,
    succeeded: snap.completed,
    failures: snap.failures ?? [],
    signal: createSignal(),
    lastTick: Date.now(),
    lastBytes: snap.bytes,
    native: true,
  };
  tasks.set(snap.id, task);
  return task;
}

/**
 * Récupère les tâches natives encore vivantes (retour dans l'app après
 * une fermeture) afin que l'interface reprenne la supervision sans
 * relancer quoi que ce soit.
 */
export async function adoptNativeTransfers(): Promise<void> {
  if (!isNativeTransferAvailable()) return;
  ensureNativeBridge();
  for (const snap of await listNativeTasks()) {
    const task = adopt(snap);
    if (task) applyNative(snap, task);
  }
  publish();
}

async function run(
  task: Internal,
  groups: TransferGroup[],
  destination: PathRef,
  onDone?: (task: TransferTask) => void,
) {
  // Bases cumulées : chaque groupe planifie ses propres totaux, on les
  // additionne pour ne jamais faire reculer la barre de progression.
  let baseCompleted = 0;
  let baseBytes = 0;
  let baseTotal = 0;
  let baseTotalBytes = 0;

  for (const group of groups) {
    if (task.signal.cancelled) break;
    let lastTotal = 0;
    let lastTotalBytes = 0;
    let lastCompleted = 0;
    let lastBytes = 0;
    const res = await transferEntries(group.parent, group.entries, destination, {
      mode: task.mode,
      signal: task.signal,
      onProgress: (p) => {
        lastTotal = p.total;
        lastTotalBytes = p.totalBytes;
        lastCompleted = p.completed;
        lastBytes = p.bytes;
        task.total = baseTotal + p.total;
        task.totalBytes = baseTotalBytes + p.totalBytes;
        task.completed = baseCompleted + p.completed;
        task.bytes = baseBytes + p.bytes;
        task.currentName = p.currentName;
        tickSpeed(task);
        publish();
      },
    });
    baseTotal += lastTotal;
    baseTotalBytes += lastTotalBytes;
    baseCompleted += lastCompleted;
    baseBytes += lastBytes;
    task.succeeded += res.succeeded;
    task.failures.push(...res.failed);
    if (res.cancelled) break;
  }

  const cancelled = task.signal.cancelled;
  task.status = cancelled ? "cancelled" : task.failures.length ? "failed" : "done";
  task.endedAt = Date.now();
  task.etaMs = 0;
  task.speedBps = 0;
  task.message = summaryMessage(task);
  publish();

  notifyEnd(task);
  onDone?.(getTask(task.id) ?? task);

  // La fiche reste consultable un moment, puis disparaît d'elle-même.
  if (task.status === "done") {
    setTimeout(() => dismissTransfer(task.id), 15_000);
  }
}

export function summaryMessage(task: TransferTask): string {
  const verb = task.mode === "copy" ? t("ops.transfer.verbCopied") : t("ops.transfer.verbMoved");
  const parts = [`${task.succeeded} élément(s) ${verb}`];
  if (task.failures.length) parts.push(`${task.failures.length} échec(s)`);
  if (task.bytes > 0) parts.push(formatSize(task.bytes));
  const secs = Math.max(1, Math.round(((task.endedAt ?? Date.now()) - task.startedAt) / 1000));
  parts.push(`en ${formatEta(secs * 1000)}`);
  return parts.join(" · ");
}

function notifyEnd(task: TransferTask) {
  const done = task.mode === "copy" ? t("ops.transfer.copyDone") : t("ops.transfer.moveDone");
  const title =
    task.status === "cancelled"
      ? task.mode === "copy"
        ? t("ops.transfer.copyCancelled")
        : t("ops.transfer.moveCancelled")
      : task.status === "failed"
        ? task.mode === "copy"
          ? t("ops.transfer.copyIncomplete")
          : t("ops.transfer.moveIncomplete")
        : done;
  void showNotification({
    title,
    body: `${task.title} → ${task.destLabel} — ${task.message ?? ""}`,
    route: "/",
  });
}

/** Ouvre le dossier de destination d'une tâche dans le gestionnaire. */
export function openTransferDestination(task: TransferTask) {
  requestFileJump({ rootId: task.destination.rootId, segments: [...task.destination.segments] });
}
