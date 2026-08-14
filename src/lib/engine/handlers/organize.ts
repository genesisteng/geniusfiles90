/**
 * Rangement réel d'un dossier.
 *
 * Aucune simulation : le handler liste réellement le dossier, crée les
 * sous-dossiers manquants et déplace véritablement les fichiers via
 * `@/lib/files/operations` (mêmes API Android, même journal, même
 * corbeille que l'explorateur). Il retourne des statistiques exactes —
 * c'est la seule source utilisée par l'assistant pour sa réponse.
 */
import { createDirectory, transferEntries } from "@/lib/files/operations";
import { listDirectory } from "@/lib/files/fs";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { EngineExecutionError } from "../errors";
import { ensurePermission } from "../permissions";
import type { CommandHandler, EngineExecuteOptions } from "../types";
import { t } from "@/lib/i18n";

export type OrganizeParams = {
  /** Dossier à ranger. */
  folder: PathRef;
  /** Règle de classement : par type (défaut) ou par date (AAAA-MM). */
  rule?: "type" | "date";
};

export type OrganizeResult = {
  folder: PathRef;
  rule: "type" | "date";
  filesSeen: number;
  moved: number;
  foldersLeft: number;
  skipped: { name: string; reason: string }[];
  failures: { name: string; reason: string }[];
  createdFolders: string[];
  /** Répartition réelle : sous-dossier → nombre de fichiers déplacés. */
  buckets: { folder: string; moved: number }[];
};

const TYPE_FOLDERS: Record<string, string> = {
  image: "Images",
  video: "Vidéos",
  audio: "Musique",
  document: "Documents",
  pdf: "Documents",
  text: "Documents",
  archive: "Archives",
  code: "Code",
  apk: "Applications",
  font: "Polices",
  other: "Autres",
};

function bucketFor(entry: FileEntry, rule: "type" | "date"): string {
  if (rule === "date") {
    const d = entry.mtime ? new Date(entry.mtime) : new Date();
    const m = d.getMonth() + 1;
    return `${d.getFullYear()}-${m < 10 ? `0${m}` : m}`;
  }
  return TYPE_FOLDERS[entry.kind] ?? "Autres";
}

export const organizeHandler: CommandHandler<OrganizeParams, OrganizeResult> = {
  type: "organize",
  sideEffect: true,
  validate(p) {
    if (!p?.folder)
      return { ok: false, code: "INVALID_PARAMS", message: t("ops.error.folderMissing") };
    if (p.rule && p.rule !== "type" && p.rule !== "date")
      return { ok: false, code: "INVALID_PARAMS", message: t("ops.error.unknownRule") };
    return { ok: true };
  },
  async run(p, ctx: EngineExecuteOptions): Promise<OrganizeResult> {
    await ensurePermission("storage.write");
    const rule = p.rule ?? "type";
    const listing = await listDirectory(p.folder);
    if (!listing.ok) {
      throw new EngineExecutionError(
        "NOT_FOUND",
        listing.message ?? t("ops.error.organizeFolderReadFailed"),
      );
    }

    const files = listing.entries.filter((e) => !e.isDirectory);
    const foldersLeft = listing.entries.length - files.length;
    const skipped: { name: string; reason: string }[] = [];
    const failures: { name: string; reason: string }[] = [];
    const createdFolders: string[] = [];

    // Regroupement en mémoire — aucune écriture à cette étape.
    const groups = new Map<string, FileEntry[]>();
    for (const f of files) {
      if (f.name.startsWith(".")) {
        skipped.push({ name: f.name, reason: t("system.fichierSystemeMasque") });
        continue;
      }
      const bucket = bucketFor(f, rule);
      const arr = groups.get(bucket) ?? [];
      arr.push(f);
      groups.set(bucket, arr);
    }

    const existing = new Set(
      listing.entries.filter((e) => e.isDirectory).map((e) => e.name.toLowerCase()),
    );

    let moved = 0;
    const buckets: { folder: string; moved: number }[] = [];
    let processed = 0;
    const total = files.length;

    for (const [bucket, entries] of groups) {
      if (ctx.signal?.aborted)
        throw new EngineExecutionError("CANCELLED", t("ops.error.organizeCancelled"));
      const destination: PathRef = {
        rootId: p.folder.rootId,
        segments: [...p.folder.segments, bucket],
      };
      if (!existing.has(bucket.toLowerCase())) {
        const created = await createDirectory(p.folder, bucket);
        if (!created.ok) {
          for (const e of entries)
            failures.push({
              name: e.name,
              reason: created.error ?? t("organize.handler.folderNotCreated"),
            });
          processed += entries.length;
          ctx.onProgress?.({ processed, total });
          continue;
        }
        existing.add(bucket.toLowerCase());
        createdFolders.push(bucket);
      }

      const res = await transferEntries(p.folder, entries, destination, { mode: "move" });
      moved += res.succeeded;
      buckets.push({ folder: bucket, moved: res.succeeded });
      for (const f of res.failed) failures.push({ name: f.name, reason: f.reason });
      processed += entries.length;
      ctx.onProgress?.({ processed, total, currentName: bucket });
    }

    if (moved === 0 && failures.length > 0) {
      throw new EngineExecutionError(
        "EXECUTION_FAILED",
        t("organize.handler.noFileMoved", { reason: failures[0].reason }),
        { failures },
      );
    }

    return {
      folder: p.folder,
      rule,
      filesSeen: files.length,
      moved,
      foldersLeft,
      skipped,
      failures,
      createdFolders,
      buckets: buckets.filter((b) => b.moved > 0),
    };
  },
};
