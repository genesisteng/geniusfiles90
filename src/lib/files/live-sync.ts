/**
 * Synchronisation « live » des listes de fichiers.
 *
 * Chaque mutation du stockage (création, renommage, suppression,
 * déplacement, copie, extraction, enregistrement…) émet un patch
 * `gf:fs-patch` depuis `@/lib/files/operations`. Ce module applique ces
 * patchs **chirurgicalement** à une liste déjà affichée :
 *
 * - aucune relecture du dossier, donc aucun clignotement ;
 * - aucun saut de liste ni perte de position de défilement ;
 * - aucune perte de sélection ;
 * - coût O(n) sur la seule liste concernée, jamais un parcours du stockage.
 *
 * Les vues qui ne peuvent pas être mises à jour localement (statistiques,
 * index de recherche) continuent d'écouter `gf:storage-changed`.
 */
import { useEffect } from "react";

import { subscribeFsPatch, type FsPatchOp } from "@/lib/index/patches";
import { extOf, kindOf } from "./format";
import type { FileEntry, ListingState, PathRef } from "./types";

function keyOf(rootId: PathRef["rootId"], segments: string[]): string {
  return `${rootId}:${segments.join("/")}`;
}

function pathKey(p: PathRef): string {
  return keyOf(p.rootId, p.segments);
}

/** Préfixe de chemin déduit des entrées déjà présentes (natif ou mock). */
function prefixFor(entries: FileEntry[], path: PathRef): string {
  const sample = entries[0];
  if (sample?.path && sample.path.endsWith(sample.name)) {
    return sample.path.slice(0, sample.path.length - sample.name.length);
  }
  return path.segments.length ? `${path.segments.join("/")}/` : "";
}

function makeEntry(
  entries: FileEntry[],
  path: PathRef,
  name: string,
  isDirectory: boolean,
  size?: number,
  mtime?: number,
): FileEntry {
  return {
    name,
    path: `${prefixFor(entries, path)}${name}`,
    isDirectory,
    size: isDirectory ? undefined : size,
    mtime: mtime ?? Date.now(),
    kind: kindOf(name, isDirectory),
    ext: isDirectory ? undefined : extOf(name),
  };
}

/**
 * Applique un patch à la liste d'un dossier.
 * Renvoie `null` quand le dossier n'est pas concerné (aucun re-rendu).
 */
export function applyPatchToEntries(
  path: PathRef,
  entries: FileEntry[],
  patch: FsPatchOp,
): FileEntry[] | null {
  const here = pathKey(path);

  switch (patch.op) {
    case "create": {
      if (keyOf(patch.rootId, patch.segments) !== here) return null;
      if (entries.some((e) => e.name === patch.name)) return null;
      return [
        ...entries,
        makeEntry(entries, path, patch.name, patch.isDirectory, patch.size, patch.mtime),
      ];
    }
    case "delete": {
      if (keyOf(patch.rootId, patch.segments) !== here) return null;
      const next = entries.filter((e) => e.name !== patch.name);
      return next.length === entries.length ? null : next;
    }
    case "rename": {
      if (keyOf(patch.rootId, patch.segments) !== here) return null;
      let touched = false;
      const next = entries.map((e) => {
        if (e.name !== patch.oldName) return e;
        touched = true;
        return {
          ...e,
          name: patch.newName,
          path: `${prefixFor(entries, path)}${patch.newName}`,
          kind: kindOf(patch.newName, e.isDirectory),
          ext: e.isDirectory ? undefined : extOf(patch.newName),
          mtime: Date.now(),
        };
      });
      return touched ? next : null;
    }
    case "move": {
      const from = keyOf(patch.fromRootId, patch.fromSegments) === here;
      const to = keyOf(patch.toRootId, patch.toSegments) === here;
      if (!from && !to) return null;
      let next = entries;
      if (from) next = next.filter((e) => e.name !== patch.fromName);
      if (to && !next.some((e) => e.name === patch.toName)) {
        const origin = entries.find((e) => e.name === patch.fromName);
        next = [
          ...next,
          makeEntry(
            entries,
            path,
            patch.toName,
            patch.isDirectory ?? origin?.isDirectory ?? false,
            origin?.size,
            Date.now(),
          ),
        ];
      }
      return next === entries ? null : next;
    }
    default:
      return null;
  }
}

/**
 * Le dossier courant lui-même a-t-il été renommé / déplacé ?
 * Permet au fil d'Ariane de suivre sans rechargement.
 */
export function rebasePath(path: PathRef, patch: FsPatchOp): PathRef | null {
  if (patch.op === "rename") {
    if (patch.rootId !== path.rootId) return null;
    const depth = patch.segments.length;
    if (path.segments.length <= depth) return null;
    if (patch.segments.some((s, i) => path.segments[i] !== s)) return null;
    if (path.segments[depth] !== patch.oldName) return null;
    const segments = [...path.segments];
    segments[depth] = patch.newName;
    return { rootId: path.rootId, segments };
  }
  return null;
}

/**
 * Branche une liste de dossier sur le bus de patchs.
 * Le `setListing` reçoit une nouvelle liste uniquement quand le dossier
 * affiché est réellement concerné.
 */
export function useLiveListing(
  path: PathRef | null,
  setListing: (updater: (current: ListingState) => ListingState) => void,
  onRebase?: (next: PathRef) => void,
): void {
  const key = path ? pathKey(path) : null;
  useEffect(() => {
    if (!path || !key) return;
    return subscribeFsPatch((patch) => {
      const rebased = rebasePath(path, patch);
      if (rebased && onRebase) {
        onRebase(rebased);
        return;
      }
      setListing((current) => {
        if (current.status === "ready") {
          const next = applyPatchToEntries(path, current.entries, patch);
          if (!next) return current;
          return next.length === 0 ? { status: "empty" } : { status: "ready", entries: next };
        }
        if (current.status === "empty") {
          const next = applyPatchToEntries(path, [], patch);
          if (!next || next.length === 0) return current;
          return { status: "ready", entries: next };
        }
        return current;
      });
    });
    // `path` est reconstruit à chaque rendu : la clé sérialisée fait foi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setListing, onRebase]);
}
