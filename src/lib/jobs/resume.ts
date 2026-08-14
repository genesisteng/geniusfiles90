/**
 * Resume dispatcher — replays an interrupted job using its persisted
 * payload. Each kind is responsible for its own idempotence: transfers
 * and archive operations use `overwrite:false` so already-processed
 * items are skipped natively; cleaner deletes rely on the fact that a
 * missing entry is a no-op.
 */
import type { FileEntry, PathRef } from "@/lib/files/types";
import { transferEntries } from "@/lib/files/operations";
import {
  createArchive,
  extractArchive,
  type ConflictPolicy,
  type ArchiveFormat,
} from "@/lib/files/archive";
import { runCleanup } from "@/lib/cleaner/deleter";
import type { CleanItem } from "@/lib/cleaner/types";
import { finishJob, updateJob, type JobRecord } from "./journal";

export type TransferPayload = {
  source: PathRef;
  destination: PathRef;
  entries: FileEntry[];
  mode: "copy" | "move";
};

export type CompressPayload = {
  parent: PathRef;
  destination: PathRef;
  entries: FileEntry[];
  archiveName: string;
  format: ArchiveFormat;
  level: number;
};

export type ExtractPayload = {
  parent: PathRef;
  destination: PathRef;
  entry: FileEntry;
  selection?: string[];
  conflict: ConflictPolicy;
};

export type CleanPayload = {
  items: CleanItem[];
};

export async function resumeJob(job: JobRecord): Promise<void> {
  try {
    if (job.kind === "copy" || job.kind === "move") {
      const p = job.payload as TransferPayload;
      const res = await transferEntries(p.source, p.entries, p.destination, {
        mode: p.mode,
        onProgress: (ev) =>
          updateJob(job.id, {
            completed: ev.completed,
            bytes: ev.bytes,
            totalBytes: ev.totalBytes,
            total: ev.total,
          }),
      });
      finishJob(
        job.id,
        res.cancelled ? "cancelled" : res.ok ? "done" : "failed",
        res.ok ? undefined : `${res.failed.length} échec(s)`,
      );
      return;
    }
    if (job.kind === "compress") {
      const p = job.payload as CompressPayload;
      const res = await createArchive({
        parent: p.parent,
        entries: p.entries,
        destination: p.destination,
        archiveName: p.archiveName,
        format: p.format,
        level: p.level,
        onProgress: (ev) =>
          updateJob(job.id, {
            completed: ev.completed,
            bytes: ev.bytes,
            totalBytes: ev.totalBytes,
            total: ev.total,
          }),
      });
      finishJob(
        job.id,
        res.cancelled ? "cancelled" : res.ok ? "done" : "failed",
        res.ok ? undefined : (res.error ?? undefined),
      );
      return;
    }
    if (job.kind === "extract") {
      const p = job.payload as ExtractPayload;
      const res = await extractArchive({
        parent: p.parent,
        entry: p.entry,
        destination: p.destination,
        entries: p.selection,
        conflict: p.conflict,
        onProgress: (ev) =>
          updateJob(job.id, {
            completed: ev.completed,
            bytes: ev.bytes,
            totalBytes: ev.totalBytes,
            total: ev.total,
          }),
      });
      finishJob(
        job.id,
        res.cancelled ? "cancelled" : res.ok ? "done" : "failed",
        res.ok ? undefined : (res.error ?? undefined),
      );
      return;
    }
    if (job.kind === "clean") {
      const p = job.payload as CleanPayload;
      const res = await runCleanup(p.items, (ev) =>
        updateJob(job.id, {
          completed: ev.processed,
          bytes: ev.bytes,
          totalBytes: ev.totalBytes,
          total: ev.total,
        }),
      );
      finishJob(job.id, "done", `${res.removed} élément(s) traité(s)`);
      return;
    }
  } catch (err) {
    finishJob(job.id, "failed", err instanceof Error ? err.message : String(err));
  }
}
