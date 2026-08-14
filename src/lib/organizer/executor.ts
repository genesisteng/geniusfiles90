/**
 * Exécution d'un `OrgPlan`.
 *
 * Chaque action est déléguée à `@/lib/files/operations` — donc l'historique
 * et la Corbeille assurent un annulé propre. La progression est diffusée
 * via `onProgress`, et un `AbortController` autorise l'interruption.
 *
 * Aucune modification n'a lieu sans que le plan ait été construit à partir
 * d'un choix explicite de l'utilisateur (recommandation acceptée ou
 * renommage validé).
 */
import {
  createDirectory,
  createSignal,
  renameEntry,
  transferEntries,
} from "@/lib/files/operations";
import type { PathRef, FileEntry } from "@/lib/files/types";
import { listDirectory } from "@/lib/files/fs";
import { emitOrganizerUpdated } from "./events";
import type { OrgAction, OrgExecutionResult, OrgPlan, OrgProgress } from "./types";
import { t } from "@/lib/i18n";

async function findEntry(parent: PathRef, name: string): Promise<FileEntry | null> {
  const res = await listDirectory(parent);
  if (!res.ok) return null;
  return res.entries.find((e) => e.name === name) ?? null;
}

export type ExecuteOptions = {
  onProgress?: (p: OrgProgress) => void;
  signal?: AbortController;
};

export async function executePlan(
  plan: OrgPlan,
  opts: ExecuteOptions = {},
): Promise<OrgExecutionResult> {
  const failed: OrgExecutionResult["failed"] = [];
  let applied = 0;
  const total = plan.actions.length;
  const emit = (label?: string) =>
    opts.onProgress?.({ processed: applied, total, currentLabel: label });
  emit();

  for (const action of plan.actions) {
    if (opts.signal?.signal.aborted) {
      return { ok: false, applied, failed, cancelled: true };
    }
    try {
      await runAction(action);
      applied++;
      emit(labelOf(action));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failed.push({ action, reason });
    }
  }
  emitOrganizerUpdated();
  return { ok: failed.length === 0, applied, failed, cancelled: false };
}

function labelOf(a: OrgAction): string {
  switch (a.kind) {
    case "rename":
      return `${a.from} → ${a.to}`;
    case "move":
      return `${a.entryName}`;
    case "group":
      return `${a.folderName} (${a.entryNames.length})`;
    case "archive":
      return t("organize.executor.archivesLabel", { count: a.entryNames.length });
    case "collection_add":
      return t("organize.executor.collectionLabel");
  }
}

async function runAction(action: OrgAction): Promise<void> {
  switch (action.kind) {
    case "rename": {
      const entry = await findEntry(action.parent, action.from);
      if (!entry) throw new Error(t("vault.error.fileNotFound"));
      const res = await renameEntry(action.parent, entry, action.to);
      if (!res.ok) throw new Error(res.error || t("system.engine.renameFailed"));
      return;
    }
    case "move": {
      if (action.createParent) {
        await ensureFolderChain(action.toParent);
      }
      const entry = await findEntry(action.from, action.entryName);
      if (!entry) throw new Error(t("vault.error.fileNotFound"));
      const signal = createSignal();
      const res = await transferEntries(action.from, [entry], action.toParent, {
        mode: "move",
        signal,
      });
      if (!res.ok && res.failed.length > 0)
        throw new Error(res.failed[0].reason || t("pdf.post.moveFailed"));
      return;
    }
    case "group": {
      const folderPath: PathRef = {
        rootId: action.parent.rootId,
        segments: [...action.parent.segments, action.folderName],
      };
      const mk = await createDirectory(action.parent, action.folderName);
      if (!mk.ok && !/existe/i.test(mk.error ?? "")) {
        throw new Error(mk.error || t("organize.executor.createFolderFailed"));
      }
      const entries: FileEntry[] = [];
      for (const name of action.entryNames) {
        const e = await findEntry(action.parent, name);
        if (e) entries.push(e);
      }
      if (entries.length === 0) return;
      const signal = createSignal();
      const res = await transferEntries(action.parent, entries, folderPath, {
        mode: "move",
        signal,
      });
      if (!res.ok && res.failed.length > 0)
        throw new Error(res.failed[0].reason || t("pdf.post.moveFailed"));
      return;
    }
    case "archive": {
      const folderPath: PathRef = {
        rootId: action.parent.rootId,
        segments: [...action.parent.segments, "Archives"],
      };
      const mk = await createDirectory(action.parent, "Archives");
      if (!mk.ok && !/existe/i.test(mk.error ?? "")) {
        throw new Error(mk.error || t("organize.executor.createFolderFailed"));
      }
      const entries: FileEntry[] = [];
      for (const name of action.entryNames) {
        const e = await findEntry(action.parent, name);
        if (e) entries.push(e);
      }
      if (entries.length === 0) return;
      const signal = createSignal();
      const res = await transferEntries(action.parent, entries, folderPath, {
        mode: "move",
        signal,
      });
      if (!res.ok && res.failed.length > 0)
        throw new Error(res.failed[0].reason || t("organize.executor.archiveFailed"));
      return;
    }
    case "collection_add":
      // Virtuel — pas d'écriture disque.
      return;
  }
}

/** Crée la chaîne de dossiers manquants pour `target`. */
async function ensureFolderChain(target: PathRef): Promise<void> {
  const segments = target.segments;
  for (let i = 1; i <= segments.length; i++) {
    const parent: PathRef = { rootId: target.rootId, segments: segments.slice(0, i - 1) };
    const name = segments[i - 1];
    const mk = await createDirectory(parent, name);
    if (!mk.ok && !/existe/i.test(mk.error ?? "")) {
      throw new Error(mk.error || t("organize.executor.createNamedFailed", { name }));
    }
  }
}
