/**
 * Foundations for the future Operations History screen.
 *
 * Each completed operation is appended to a bounded log kept in
 * localStorage. The shape captures everything needed to eventually
 * offer per-operation undo (restore-from-trash for deletes, reverse
 * copy/move for structural changes) without shipping the full history
 * UI yet.
 */
import type { PathRef } from "./types";
import { forgetRecents, touchRecentNames } from "@/lib/recents/store";

export type OperationKind =
  | "copy"
  | "move"
  | "delete"
  | "rename"
  | "mkdir"
  | "share"
  | "archive.create"
  | "archive.extract";

export type OperationRecord = {
  id: string;
  kind: OperationKind;
  at: number;
  /** Human-readable summary shown by the future history screen. */
  summary: string;
  /** Source folder (where the action happened). */
  source?: PathRef;
  /** Destination folder for copy/move. */
  destination?: PathRef;
  /** Names of touched entries. */
  names: string[];
  /** Undo hint — populated for trash deletions. */
  restorable?: {
    kind: "trash";
    items: { id: string; originalPath: string; trashPath: string }[];
  };
  /** How many items failed vs succeeded. */
  succeeded: number;
  failed: number;
};

const KEY = "gf.files.history";
const MAX = 200;

function safeGet(): OperationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OperationRecord[]) : [];
  } catch {
    return [];
  }
}

function safeSet(items: OperationRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function loadHistory(): OperationRecord[] {
  return safeGet();
}

export function recordOperation(op: Omit<OperationRecord, "id" | "at">): OperationRecord {
  const record: OperationRecord = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    ...op,
  };
  safeSet([record, ...safeGet()]);
  syncRecents(record);
  return record;
}

/**
 * Reflète chaque opération terminée dans le journal « Fichiers récents »
 * afin que la page d'accueil reste à jour sans relancer d'analyse.
 */
function syncRecents(record: OperationRecord) {
  const { source, destination, names } = record;
  if (names.length === 0) return;
  try {
    switch (record.kind) {
      case "copy":
        if (destination) touchRecentNames(destination.rootId, destination.segments, names, "copy");
        break;
      case "move":
        if (destination) touchRecentNames(destination.rootId, destination.segments, names, "move");
        if (source) forgetRecents(source.rootId, source.segments, names);
        break;
      case "rename": {
        if (!source) break;
        const [oldName, newName] = names;
        if (oldName) forgetRecents(source.rootId, source.segments, [oldName]);
        if (newName) touchRecentNames(source.rootId, source.segments, [newName], "rename");
        break;
      }
      case "delete":
        if (source) forgetRecents(source.rootId, source.segments, names);
        break;
      case "share":
        if (source) touchRecentNames(source.rootId, source.segments, names, "share");
        break;
      case "archive.create":
        if (destination)
          touchRecentNames(destination.rootId, destination.segments, names, "create");
        break;
      default:
        break;
    }
  } catch {
    /* le journal des récents ne doit jamais bloquer une opération */
  }
}

export function clearHistory() {
  safeSet([]);
}
