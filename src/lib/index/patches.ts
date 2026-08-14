/**
 * Filesystem patch bus.
 *
 * Every mutating operation in operations.ts dispatches a `gf:fs-patch`
 * CustomEvent so the home-module indexes can update surgically without
 * rescanning. The generic `gf:storage-changed` event stays for legacy
 * listeners.
 *
 * Payloads carry enough information to reconstruct the affected paths
 * on every root — path segments, kind, and the previous location for
 * moves / renames.
 */
import type { StorageRootId } from "@/lib/files/types";

export type FsPatchOp =
  | {
      op: "create";
      rootId: StorageRootId;
      segments: string[];
      name: string;
      isDirectory: boolean;
      size?: number;
      mtime?: number;
    }
  | {
      op: "delete";
      rootId: StorageRootId;
      segments: string[];
      name: string;
      isDirectory?: boolean;
      /** Taille réelle de l'élément supprimé (fichiers) — sert à décrémenter
       *  exactement les totaux de catégorie sans relancer d'analyse. */
      size?: number;
    }
  | {
      op: "rename";
      rootId: StorageRootId;
      segments: string[];
      oldName: string;
      newName: string;
      isDirectory?: boolean;
    }
  | {
      op: "move";
      fromRootId: StorageRootId;
      fromSegments: string[];
      fromName: string;
      toRootId: StorageRootId;
      toSegments: string[];
      toName: string;
      isDirectory?: boolean;
    };

export function dispatchFsPatch(patch: FsPatchOp) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("gf:fs-patch", { detail: patch }));
  } catch {
    /* ignore */
  }
}

export function subscribeFsPatch(handler: (p: FsPatchOp) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const ce = e as CustomEvent<FsPatchOp>;
    if (ce?.detail) handler(ce.detail);
  };
  window.addEventListener("gf:fs-patch", listener);
  return () => window.removeEventListener("gf:fs-patch", listener);
}
