/**
 * Sélection multi-dossiers.
 *
 * La sélection ne vit plus dans l'état local d'un écran : elle est portée par
 * un petit store externe (module singleton). Naviguer, remonter d'un niveau,
 * utiliser le fil d'Ariane ou changer de stockage ne perd donc plus rien —
 * chaque élément reste coché tant que l'utilisateur ne le décoche pas.
 *
 * Chaque entrée est identifiée par son chemin absolu logique
 * `rootId:seg/seg\0nom`, ce qui autorise deux fichiers homonymes situés dans
 * deux dossiers différents.
 */
import { useSyncExternalStore } from "react";

import { subscribeFsPatch } from "@/lib/index/patches";

import type { FileEntry, PathRef } from "./types";

export type SelectionItem = { key: string; parent: PathRef; entry: FileEntry };

export function pathKeyOf(p: PathRef): string {
  return `${p.rootId}:${p.segments.join("/")}`;
}

export function selectionKey(parent: PathRef, name: string): string {
  return `${pathKeyOf(parent)}\u0000${name}`;
}

const EMPTY: ReadonlyMap<string, SelectionItem> = new Map();

let items = new Map<string, SelectionItem>();
const listeners = new Set<() => void>();

function emit() {
  // Nouvelle référence → `useSyncExternalStore` détecte le changement.
  items = new Map(items);
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Map courante (référence stable tant que rien ne change). */
export function getSelection(): ReadonlyMap<string, SelectionItem> {
  return items;
}

export function selectionCount(): number {
  return items.size;
}

export function isSelected(parent: PathRef, name: string): boolean {
  return items.has(selectionKey(parent, name));
}

export function toggleSelection(parent: PathRef, entry: FileEntry): void {
  const key = selectionKey(parent, entry.name);
  if (items.has(key)) items.delete(key);
  else items.set(key, { key, parent, entry });
  emit();
}

export function addSelection(parent: PathRef, entries: FileEntry[]): void {
  if (entries.length === 0) return;
  for (const entry of entries) {
    const key = selectionKey(parent, entry.name);
    items.set(key, { key, parent, entry });
  }
  emit();
}

export function removeSelection(parent: PathRef, names: string[]): void {
  let changed = false;
  for (const name of names) changed = items.delete(selectionKey(parent, name)) || changed;
  if (changed) emit();
}

export function replaceSelection(parent: PathRef, entries: FileEntry[]): void {
  items = new Map();
  addSelection(parent, entries);
}

export function clearSelectionStore(): void {
  if (items.size === 0) return;
  items = new Map();
  emit();
}

/** Retire les éléments d'un dossier qui n'existent plus après un rafraîchissement. */
export function reconcileSelection(parent: PathRef, existing: FileEntry[]): void {
  const prefix = `${pathKeyOf(parent)}\u0000`;
  const names = new Set(existing.map((e) => e.name));
  let changed = false;
  for (const key of [...items.keys()]) {
    if (!key.startsWith(prefix)) continue;
    if (!names.has(key.slice(prefix.length))) {
      items.delete(key);
      changed = true;
    }
  }
  if (changed) emit();
}

/** Regroupe la sélection par dossier parent (format attendu par les transferts). */
export function selectionGroups(
  source?: ReadonlyMap<string, SelectionItem>,
): { parent: PathRef; entries: FileEntry[] }[] {
  const map = new Map<string, { parent: PathRef; entries: FileEntry[] }>();
  for (const item of (source ?? items).values()) {
    const k = pathKeyOf(item.parent);
    const group = map.get(k);
    if (group) group.entries.push(item.entry);
    else map.set(k, { parent: item.parent, entries: [item.entry] });
  }
  return [...map.values()];
}

/** Liste à plat des entrées sélectionnées (ordre d'insertion). */
export function selectionEntries(source?: ReadonlyMap<string, SelectionItem>): FileEntry[] {
  return [...(source ?? items).values()].map((i) => i.entry);
}

/** Abonnement React à la sélection globale. */
export function useSelection(): ReadonlyMap<string, SelectionItem> {
  return useSyncExternalStore(
    subscribe,
    getSelection,
    () => EMPTY as ReadonlyMap<string, SelectionItem>,
  );
}

/* ─────────────────────────────────────────────────────────────
   Suivi automatique des mutations.

   Un renommage conserve la sélection (l'élément reste coché sous son
   nouveau nom), une suppression ou un déplacement la retire. Aucun
   rechargement n'est nécessaire et la barre d'actions reste cohérente.
   ───────────────────────────────────────────────────────────── */
subscribeFsPatch((patch) => {
  if (items.size === 0) return;
  if (patch.op === "rename") {
    const parent: PathRef = { rootId: patch.rootId, segments: patch.segments };
    const oldKey = selectionKey(parent, patch.oldName);
    const current = items.get(oldKey);
    if (!current) return;
    items.delete(oldKey);
    const newKey = selectionKey(parent, patch.newName);
    items.set(newKey, {
      key: newKey,
      parent,
      entry: { ...current.entry, name: patch.newName },
    });
    emit();
    return;
  }
  if (patch.op === "delete") {
    const key = selectionKey({ rootId: patch.rootId, segments: patch.segments }, patch.name);
    if (items.delete(key)) emit();
    return;
  }
  if (patch.op === "move") {
    const key = selectionKey(
      { rootId: patch.fromRootId, segments: patch.fromSegments },
      patch.fromName,
    );
    if (items.delete(key)) emit();
  }
});
