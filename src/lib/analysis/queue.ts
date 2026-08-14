/**
 * File d'analyse en arrière-plan — priorités, pause/reprise/annulation.
 *
 * Concurrence limitée (1 par défaut, réglable) pour ne pas saturer la
 * WebView Android. Chaque tick cède la boucle d'événements via
 * `requestIdleCallback` (fallback setTimeout) afin de ne pas bloquer la
 * navigation ou le rendu.
 *
 * Les jobs déjà présents dans le cache et dont l'empreinte est encore
 * valide sont marqués `skipped` sans retraitement.
 */
import { analyzeEntry } from "./extractors";
import { getFreshRecord, invalidateIfStale, saveRecord } from "./store";
import {
  keyOf,
  type AnalysisJob,
  type FileFingerprint,
  type JobKind,
  type JobPriority,
  type JobStatus,
  type QueueSnapshot,
} from "./types";
import { fingerprintOf } from "./types";
import type { FileEntry, PathRef } from "@/lib/files/types";

type Listener = (snap: QueueSnapshot) => void;

let jobs: AnalysisJob[] = [];
const listeners = new Set<Listener>();
let paused = false;
let running = 0;
let counter = 0;
const MAX_CONCURRENT = 1;
const MAX_HISTORY = 200;

function idle(cb: () => void) {
  if (typeof window === "undefined") return setTimeout(cb, 0);
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (w.requestIdleCallback) return w.requestIdleCallback(cb, { timeout: 300 });
  return window.setTimeout(cb, 40);
}

function snapshot(): QueueSnapshot {
  let queued = 0,
    run = 0,
    done = 0,
    failed = 0,
    skipped = 0,
    cancelled = 0;
  let currentLabel: string | undefined;
  for (const j of jobs) {
    if (j.status === "queued") queued++;
    else if (j.status === "running") {
      run++;
      currentLabel = j.entry.name;
    } else if (j.status === "done") done++;
    else if (j.status === "failed") failed++;
    else if (j.status === "skipped") skipped++;
    else if (j.status === "cancelled") cancelled++;
  }
  return { queued, running: run, done, failed, skipped, cancelled, paused, currentLabel };
}

function emit() {
  const snap = snapshot();
  for (const l of listeners) l(snap);
}

export function subscribeQueue(fn: Listener): () => void {
  listeners.add(fn);
  fn(snapshot());
  return () => listeners.delete(fn);
}

export function getSnapshot(): QueueSnapshot {
  return snapshot();
}

export function listJobs(): AnalysisJob[] {
  return jobs.slice();
}

export function pauseQueue() {
  paused = true;
  emit();
}
export function resumeQueue() {
  paused = false;
  emit();
  tick();
}
export function cancelAll() {
  for (const j of jobs) if (j.status === "queued" || j.status === "running") j.status = "cancelled";
  emit();
}
export function cancelJob(id: string) {
  const j = jobs.find((x) => x.id === id);
  if (j && (j.status === "queued" || j.status === "running")) {
    j.status = "cancelled";
    emit();
  }
}
export function clearFinished() {
  jobs = jobs.filter((j) => j.status === "queued" || j.status === "running");
  emit();
}

export type EnqueueOptions = {
  priority?: JobPriority;
  jobKind?: JobKind;
  force?: boolean;
};

/**
 * Enfile une analyse pour un fichier. Si un record frais existe déjà
 * (empreinte identique), le job est marqué `skipped` sans traitement.
 */
export function enqueueAnalysis(
  parent: PathRef,
  entry: FileEntry,
  opts: EnqueueOptions = {},
): AnalysisJob | null {
  if (entry.isDirectory) return null;
  const segments = [...parent.segments, entry.name];
  const fp: FileFingerprint = fingerprintOf(parent.rootId, segments, entry);
  const key = keyOf(fp);
  // Invalidation : empreinte changée → on repart de zéro
  invalidateIfStale(key, fp);
  const existing = getFreshRecord(key, fp);
  if (existing && !opts.force) {
    const job: AnalysisJob = {
      id: `job_${++counter}`,
      key,
      fingerprint: fp,
      entry,
      path: parent,
      jobKind: opts.jobKind ?? "content",
      priority: opts.priority ?? "normal",
      status: "skipped",
      enqueuedAt: Date.now(),
      finishedAt: Date.now(),
    };
    jobs.push(job);
    trimHistory();
    emit();
    return job;
  }
  // Dédoublonnage : même clé déjà en file ?
  const dup = jobs.find((j) => j.key === key && (j.status === "queued" || j.status === "running"));
  if (dup) return dup;
  const job: AnalysisJob = {
    id: `job_${++counter}`,
    key,
    fingerprint: fp,
    entry,
    path: parent,
    jobKind: opts.jobKind ?? "content",
    priority: opts.priority ?? "normal",
    status: "queued",
    enqueuedAt: Date.now(),
  };
  jobs.push(job);
  trimHistory();
  emit();
  tick();
  return job;
}

/** Enfile plusieurs entrées d'un même dossier. */
export function enqueueBatch(parent: PathRef, entries: FileEntry[], opts: EnqueueOptions = {}) {
  for (const e of entries) enqueueAnalysis(parent, e, opts);
}

function trimHistory() {
  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const done = jobs.filter((j) => j.status !== "queued" && j.status !== "running");
  if (done.length > MAX_HISTORY) done.splice(0, done.length - MAX_HISTORY);
  jobs = [...active, ...done];
}

function nextJob(): AnalysisJob | null {
  const rank: Record<JobPriority, number> = { high: 0, normal: 1, low: 2 };
  const queued = jobs
    .filter((j) => j.status === "queued")
    .sort((a, b) => rank[a.priority] - rank[b.priority]);
  return queued[0] ?? null;
}

async function runJob(job: AnalysisJob) {
  job.status = "running";
  job.startedAt = Date.now();
  emit();
  try {
    const partial = await analyzeEntry(job.path, job.entry);
    if ((job.status as JobStatus) === "cancelled") return;
    saveRecord({
      key: job.key,
      fingerprint: job.fingerprint,
      analyzedAt: Date.now(),
      version: 1,
      kind: job.entry.kind,
      ...partial,
    });
    job.status = "done";
  } catch (e) {
    job.status = "failed";
    job.message = e instanceof Error ? e.message : String(e);
  }
  job.finishedAt = Date.now();
  emit();
}

function tick() {
  if (paused) return;
  while (running < MAX_CONCURRENT) {
    const job = nextJob();
    if (!job) return;
    running++;
    idle(() => {
      runJob(job).finally(() => {
        running--;
        tick();
      });
    });
  }
}

/** À appeler quand la fenêtre reprend le focus — relance si nécessaire. */
export function kick() {
  tick();
}
