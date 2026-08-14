/**
 * Petit magasin global de la fiche « paquet Android ».
 *
 * Chaque écran qui liste des fichiers (accueil, dossiers, catégories,
 * récents, recherche…) appelle `openPackageSheet` : la fiche est montée
 * une seule fois dans l'AppShell, ce qui garantit un comportement
 * strictement identique quel que soit le point d'entrée.
 */
import { useSyncExternalStore } from "react";
import type { FileEntry, PathRef } from "./types";

export type PackageRequest = {
  parent: PathRef;
  entry: FileEntry;
  /** Exploration du contenu (fournie par les écrans dotés d'un gestionnaire d'archives). */
  onExplore?: (entry: FileEntry) => void;
};

let current: PackageRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function openPackageSheet(req: PackageRequest) {
  current = req;
  emit();
}

export function closePackageSheet() {
  if (!current) return;
  current = null;
  emit();
}

export function usePackageRequest(): PackageRequest | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}
