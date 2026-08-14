/**
 * Cleaner deletion pipeline.
 *
 * Groups selected `CleanItem`s by parent PathRef and delegates to the
 * shared `deleteEntries` helper, which performs a SOFT delete (move to
 * Trash on Android via the native plugin, mock removal on the web).
 *
 * Sécurité : rien n'est déclaré supprimé sur la foi du plugin.
 *  - avant chaque lot, l'existence réelle est contrôlée (un fichier
 *    disparu entre l'analyse et la confirmation est simplement ignoré,
 *    jamais compté comme succès) ;
 *  - après chaque lot, la disparition est re-vérifiée sur le disque ;
 *  - chaque échec porte un motif lisible, remonté à l'interface.
 *
 * Emits progress after each batch and fires a global
 * `gf:storage-changed` event so the dashboard / storage stats refresh
 * immediately after the cleanup completes.
 */
import { deleteEntries } from "@/lib/files/operations";
import { namesStillPresent } from "@/lib/files/verify";
import type { PathRef } from "@/lib/files/types";
import type { CleanItem } from "./types";
import { beginJob, finishJob, updateJob } from "@/lib/jobs/journal";
import { t } from "@/lib/i18n";
import { countLabel } from "@/lib/copy";

export type CleanupProgress = {
  processed: number;
  total: number;
  bytes: number;
  totalBytes: number;
  currentName?: string;
};

export type CleanupFailure = {
  name: string;
  reason: string;
};

export type CleanupResult = {
  removed: number;
  failed: number;
  /** Éléments déjà absents avant la suppression (ni succès, ni échec). */
  missing: number;
  reclaimedBytes: number;
  failures: CleanupFailure[];
};

function keyOf(p: PathRef): string {
  return `${p.rootId}::${p.segments.join("/")}`;
}

export async function runCleanup(
  items: CleanItem[],
  onProgress?: (p: CleanupProgress) => void,
): Promise<CleanupResult> {
  /* Un « keeper » de doublon n'est jamais supprimable, quoi qu'il arrive. */
  const safeItems = items.filter((i) => !i.keeper);
  const totalBytes = safeItems.reduce((sum, i) => sum + (i.entry.size ?? 0), 0);
  const total = safeItems.length;

  // Group by parent so each native call minimises IPC round-trips.
  const groups = new Map<string, { parent: PathRef; items: CleanItem[] }>();
  for (const it of safeItems) {
    const k = keyOf(it.parent);
    const g = groups.get(k) ?? { parent: it.parent, items: [] };
    g.items.push(it);
    groups.set(k, g);
  }

  // Journal — enables resume if the process is killed mid-cleanup.
  const jobId = beginJob({
    kind: "clean",
    title: countLabel(total, "item"),
    total,
    totalBytes,
    payload: { items: safeItems },
  });

  let processed = 0;
  let bytes = 0;
  let removed = 0;
  let missing = 0;
  const failures: CleanupFailure[] = [];

  try {
    for (const g of groups.values()) {
      const names = g.items.map((i) => i.entry.name);

      onProgress?.({
        processed,
        total,
        bytes,
        totalBytes,
        currentName: names[0],
      });

      /* 1. Contrôle d'existence AVANT toute suppression. */
      const present = await namesStillPresent(g.parent, names);
      const live = g.items.filter((i) => present.has(i.entry.name));
      const gone = g.items.filter((i) => !present.has(i.entry.name));
      missing += gone.length;
      processed += gone.length;

      if (live.length > 0) {
        const res = await deleteEntries(
          g.parent,
          live.map((i) => i.entry),
        );
        for (const f of res.failed ?? []) {
          failures.push({ name: f.name, reason: f.reason });
        }

        /* 2. Contrôle de disparition APRÈS suppression. */
        const failedNames = new Set((res.failed ?? []).map((f) => f.name));
        const claimed = live.filter((i) => !failedNames.has(i.entry.name));
        const stillThere = await namesStillPresent(
          g.parent,
          claimed.map((i) => i.entry.name),
        );
        for (const it of claimed) {
          if (stillThere.has(it.entry.name)) {
            failures.push({
              name: it.entry.name,
              reason: t("system.engine.stillPresentAfterDelete"),
            });
          } else {
            removed += 1;
            bytes += it.entry.size ?? 0;
          }
        }
        processed += live.length;
      }

      updateJob(jobId, { completed: processed, bytes, totalBytes });
      onProgress?.({ processed, total, bytes, totalBytes });
    }
    finishJob(jobId, "done");
  } catch (err) {
    finishJob(jobId, "failed", err instanceof Error ? err.message : String(err));
    throw err;
  }

  // Notify listeners (dashboard, storage stats) that the filesystem changed.
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("gf:storage-changed"));
    } catch {
      /* ignore */
    }
  }

  return { removed, failed: failures.length, missing, reclaimedBytes: bytes, failures };
}
