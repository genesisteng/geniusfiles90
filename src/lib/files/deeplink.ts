/**
 * Liens profonds vers le gestionnaire de fichiers.
 *
 * Une seule porte d'entrée : `requestFileJump()`. Elle mémorise la cible
 * (dossier + fichier éventuel) puis notifie le gestionnaire. La page
 * Fichiers ouvre le bon dossier, sélectionne le fichier et — si demandé —
 * l'ouvre immédiatement. L'utilisateur n'a jamais à le chercher.
 *
 * Le format reste rétro-compatible avec l'ancien `PathRef` brut écrit par
 * la page Recherche.
 */
import type { PathRef, StorageRootId } from "@/lib/files/types";

export const FILE_JUMP_EVENT = "gf:files:jump";
const KEY = "gf.files.jumpTo";

export type FileJumpTarget = {
  rootId: StorageRootId;
  /** Segments du DOSSIER parent (sans le nom du fichier). */
  segments: string[];
  /** Nom du fichier à sélectionner dans ce dossier. */
  file?: string;
  /** Ouvrir directement le fichier (visionneuse / lecteur / système). */
  open?: boolean;
};

function isTarget(v: unknown): v is FileJumpTarget {
  const o = v as FileJumpTarget | null;
  return !!o && typeof o.rootId === "string" && Array.isArray(o.segments);
}

/** Mémorise la cible et prévient le gestionnaire s'il est déjà monté. */
export function requestFileJump(target: FileJumpTarget | PathRef): void {
  if (typeof window === "undefined") return;
  const payload: FileJumpTarget = {
    rootId: target.rootId,
    segments: [...target.segments],
    file: (target as FileJumpTarget).file,
    open: (target as FileJumpTarget).open,
  };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* stockage indisponible : l'évènement suffit */
  }
  window.dispatchEvent(new CustomEvent<FileJumpTarget>(FILE_JUMP_EVENT, { detail: payload }));
}

/** Lit puis efface la cible en attente (appelé par la page Fichiers). */
export function consumeFileJump(): FileJumpTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const parsed: unknown = JSON.parse(raw);
    return isTarget(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
