/**
 * Libellés « fichiers / dossiers / éléments ».
 *
 * Une opération portant sur deux dossiers ne doit jamais annoncer « 2
 * fichiers » : on distingue les trois cas (que des fichiers, que des
 * dossiers, mélange).
 */
import { countLabel } from "@/lib/copy";
import type { FileEntry } from "./types";

/** Jeton d'unité neutre : le nom affiché est résolu par la traduction. */
export type CountUnit = "file" | "folder" | "item";

export function unitFor(entries: readonly { isDirectory?: boolean }[]): CountUnit {
  if (entries.length === 0) return "item";
  const dirs = entries.filter((e) => e.isDirectory).length;
  if (dirs === 0) return "file";
  if (dirs === entries.length) return "folder";
  return "item";
}

/** « 18 fichiers », « 2 dossiers », « 12 éléments », « 1 dossier ». */
export function describeEntries(entries: readonly FileEntry[]): string {
  return countLabel(entries.length, unitFor(entries));
}
