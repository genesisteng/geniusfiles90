/**
 * Persistent job journal — tracks long-running operations (copy, move,
 * compress, extract, cleaner) so they can be resumed after an
 * interruption (crash, force-close, OS eviction) or restart.
 *
 * The journal is kept in localStorage under a single key. Payloads are
 * plain JSON snapshots of the arguments needed to replay the operation,
 * plus incremental progress so the UI can show a meaningful state.
 *
 * Design goals:
 * - Zero-cost when nothing runs: read-only checks are O(1) via cache.
 * - Non-blocking writes: fire-and-forget, ignore quota errors.
 * - Deterministic recovery: an entry stays `running` in storage; on next
 *   boot we age it into `interrupted` if it hasn't been updated recently.
 */

import { t } from "@/lib/i18n";
import {
  isLongJob,
  startForegroundJob,
  stopForegroundJob,
  updateForegroundJob,
} from "@/lib/native/foreground-job";

const STORAGE_KEY = "gf.jobs.journal.v1";
const STALE_MS = 25_000; // no update for 25s -> considered interrupted
const MAX_ENTRIES = 30;
const FG_UPDATE_THROTTLE_MS = 800;

export type JobKind = "copy" | "move" | "compress" | "extract" | "clean" | "delete";

export type JobStatus = "running" | "interrupted" | "done" | "failed" | "cancelled";

export type JobRecord = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  title: string;
  startedAt: number;
  updatedAt: number;
  total: number;
  completed: number;
  bytes: number;
  totalBytes: number;
  /** Serializable payload used to replay the job. Shape depends on kind. */
  payload: unknown;
  /** Items already processed successfully (by opaque key). Used to skip. */
  done?: string[];
  /** Human message for the UI when failed/interrupted. */
  message?: string;
  /** Débit instantané lissé (octets/s) — sert au texte de notification. */
  speedBps?: number;
  /** Temps restant estimé (ms). */
  etaMs?: number;
  /** Élément en cours de traitement. */
  currentName?: string;
};

function read(): JobRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JobRecord[]) : [];
  } catch {
    return [];
  }
}

function write(records: JobRecord[]) {
  if (typeof window === "undefined") return;
  try {
    const capped = records.slice(-MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
    window.dispatchEvent(new CustomEvent("gf:jobs-changed"));
  } catch {
    /* quota — ignore */
  }
}

/** Age stale `running` jobs into `interrupted` state. */
function reconcile(records: JobRecord[]): JobRecord[] {
  const now = Date.now();
  let mutated = false;
  const out = records.map((r) => {
    if (r.status === "running" && now - r.updatedAt > STALE_MS) {
      mutated = true;
      return { ...r, status: "interrupted" as JobStatus };
    }
    return r;
  });
  if (mutated) write(out);
  return out;
}

export function listJobs(): JobRecord[] {
  return reconcile(read());
}

export function listResumableJobs(): JobRecord[] {
  return listJobs().filter((j) => j.status === "interrupted");
}

/* ---------- Foreground service coordination ---------- */

function kindLabel(kind: JobKind): string {
  switch (kind) {
    case "copy":
      return t("ops.jobs.copy");
    case "move":
      return t("ops.jobs.move");
    case "compress":
      return t("ops.jobs.compress");
    case "extract":
      return t("ops.jobs.extract");
    case "clean":
      return t("ops.jobs.clean");
    case "delete":
      return t("ops.jobs.delete");
  }
}

const activeFgJobs = new Set<string>();
const lastFgTick = new Map<string, number>();

function computeProgress(cur: JobRecord): number {
  if (cur.totalBytes > 0) return Math.round((cur.bytes / cur.totalBytes) * 100);
  if (cur.total > 0) return Math.round((cur.completed / cur.total) * 100);
  return -1;
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function formatDelay(ms?: number): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/**
 * Texte riche de la notification permanente : progression, volume,
 * vitesse, temps restant et fichier en cours — comme les gestionnaires
 * de fichiers Android natifs.
 */
function fgTextFor(cur: JobRecord): string {
  const bits: string[] = [];
  if (cur.total > 0) bits.push(`${cur.completed}/${cur.total}`);
  if (cur.totalBytes > 0) bits.push(`${formatBytes(cur.bytes)} / ${formatBytes(cur.totalBytes)}`);
  if (cur.speedBps && cur.speedBps > 0) bits.push(`${formatBytes(cur.speedBps)}/s`);
  const eta = formatDelay(cur.etaMs);
  if (eta) bits.push(`reste ${eta}`);
  bits.push(cur.currentName || cur.title);
  return bits.join(" · ");
}

export function beginJob(input: {
  kind: JobKind;
  title: string;
  total: number;
  totalBytes?: number;
  payload: unknown;
  /** Force la notification permanente, quelle que soit la taille. */
  foreground?: boolean;
}): string {
  const now = Date.now();
  const id = `${input.kind}_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const record: JobRecord = {
    id,
    kind: input.kind,
    status: "running",
    title: input.title,
    startedAt: now,
    updatedAt: now,
    total: input.total,
    completed: 0,
    bytes: 0,
    totalBytes: input.totalBytes ?? 0,
    payload: input.payload,
    done: [],
  };
  write([...read(), record]);
  if (input.foreground || isLongJob({ total: input.total, totalBytes: input.totalBytes })) {
    activeFgJobs.add(id);
    void startForegroundJob({
      title: kindLabel(input.kind),
      text: fgTextFor(record),
      progress: -1,
    });
  }
  return id;
}

export function updateJob(
  id: string,
  patch: Partial<
    Pick<
      JobRecord,
      "completed" | "bytes" | "totalBytes" | "total" | "speedBps" | "etaMs" | "currentName"
    >
  > & {
    doneKey?: string;
  },
) {
  const list = read();
  const idx = list.findIndex((j) => j.id === id);
  if (idx < 0) return;
  const cur = list[idx];
  const nextDone = patch.doneKey ? [...(cur.done ?? []), patch.doneKey] : cur.done;
  const next = {
    ...cur,
    completed: patch.completed ?? cur.completed,
    bytes: patch.bytes ?? cur.bytes,
    totalBytes: patch.totalBytes ?? cur.totalBytes,
    total: patch.total ?? cur.total,
    speedBps: patch.speedBps ?? cur.speedBps,
    etaMs: patch.etaMs ?? cur.etaMs,
    currentName: patch.currentName ?? cur.currentName,
    done: nextDone,
    updatedAt: Date.now(),
  };
  list[idx] = next;
  write(list);

  // Throttle notification updates so we don't spam the OS on tight loops.
  if (activeFgJobs.has(id)) {
    const now = Date.now();
    const last = lastFgTick.get(id) ?? 0;
    if (now - last >= FG_UPDATE_THROTTLE_MS) {
      lastFgTick.set(id, now);
      void updateForegroundJob({
        title: kindLabel(next.kind),
        text: fgTextFor(next),
        progress: computeProgress(next),
      });
    }
  }
}

export function finishJob(
  id: string,
  status: Exclude<JobStatus, "running" | "interrupted">,
  message?: string,
) {
  const list = read();
  const idx = list.findIndex((j) => j.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], status, message, updatedAt: Date.now() };
  write(list);

  if (activeFgJobs.delete(id)) {
    lastFgTick.delete(id);
    if (activeFgJobs.size === 0) void stopForegroundJob();
  }
}

export function dismissJob(id: string) {
  write(read().filter((j) => j.id !== id));
}

export function clearFinishedJobs() {
  write(read().filter((j) => j.status === "running" || j.status === "interrupted"));
}

export function subscribeJobs(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => fn();
  window.addEventListener("gf:jobs-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("gf:jobs-changed", handler);
    window.removeEventListener("storage", handler);
  };
}
