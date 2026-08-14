/**
 * Taille réelle d'une sélection (fichiers + dossiers récursifs).
 *
 * Contraintes : jamais de calcul sur le rendu, jamais de blocage. Les tailles
 * de dossiers sont résolues en arrière-plan (natif `stat` → `recursiveSize`,
 * une seule traversée Kotlin), mémorisées dans un cache module et
 * dédupliquées ; la valeur affichée se met à jour par paliers pendant que le
 * reste continue de se calculer.
 */
import { useEffect, useRef, useState } from "react";

import { isAndroidNative, nativePlugin } from "@/lib/native/geniusfiles-native";
import { subscribeFsPatch } from "@/lib/index/patches";
import { listDirectory, toAbsolutePath } from "./fs";
import { pathKeyOf, type SelectionItem } from "./selection-store";
import type { FileEntry, PathRef } from "./types";

const cache = new Map<string, number>();
const inflight = new Map<string, Promise<number>>();

function dirKey(parent: PathRef, name: string): string {
  return `${pathKeyOf(parent)}/${name}`;
}

/** Invalide les tailles mémorisées (après une mutation). */
export function invalidateSizes(): void {
  cache.clear();
}

// Toute mutation du stockage périme les tailles de dossiers mémorisées :
// le cache ne peut jamais devenir une source de vérité obsolète.
if (typeof window !== "undefined") {
  subscribeFsPatch(() => cache.clear());
  window.addEventListener("gf:storage-changed", () => cache.clear());
}

async function walkSize(path: PathRef, depth = 0): Promise<number> {
  if (depth > 24) return 0;
  const res = await listDirectory(path);
  if (!res.ok) return 0;
  let total = 0;
  for (const entry of res.entries) {
    if (entry.isDirectory) {
      total += await walkSize(
        { rootId: path.rootId, segments: [...path.segments, entry.name] },
        depth + 1,
      );
    } else {
      total += entry.size ?? 0;
    }
  }
  return total;
}

async function computeDirSize(parent: PathRef, name: string): Promise<number> {
  if (isAndroidNative()) {
    const plugin = nativePlugin();
    if (plugin?.stat) {
      try {
        const res = await plugin.stat({ path: `${toAbsolutePath(parent)}/${name}` });
        if (typeof res?.recursiveSize === "number") return res.recursiveSize;
      } catch {
        /* repli sur la traversée JS */
      }
    }
  }
  return walkSize({ rootId: parent.rootId, segments: [...parent.segments, name] });
}

/** Taille d'une entrée : immédiate pour un fichier, asynchrone pour un dossier. */
export function measureEntry(parent: PathRef, entry: FileEntry): number | Promise<number> {
  if (!entry.isDirectory) return entry.size ?? 0;
  const key = dirKey(parent, entry.name);
  const cached = cache.get(key);
  if (cached != null) return cached;
  let pending = inflight.get(key);
  if (!pending) {
    pending = computeDirSize(parent, entry.name).then((value) => {
      cache.set(key, value);
      return value;
    });
    inflight.set(key, pending);
    void pending.finally(() => inflight.delete(key));
  }
  return pending;
}

export type SelectionSize = { bytes: number; pending: boolean };

/**
 * Somme des tailles de la sélection. Les fichiers sont comptés immédiatement,
 * les dossiers résolus un par un en tâche de fond (`pending` reste vrai tant
 * qu'au moins un dossier est en cours de mesure).
 */
export function useSelectionSize(items: ReadonlyMap<string, SelectionItem>): SelectionSize {
  const [state, setState] = useState<SelectionSize>({ bytes: 0, pending: false });
  const runRef = useRef(0);

  useEffect(() => {
    const run = ++runRef.current;
    let base = 0;
    const dirs: SelectionItem[] = [];

    // Anti-double-comptage : un élément contenu dans un dossier déjà
    // sélectionné n'est pas compté une seconde fois.
    const selectedDirs: string[] = [];
    for (const item of items.values()) {
      if (item.entry.isDirectory) {
        selectedDirs.push(`${pathKeyOf(item.parent)}/${item.entry.name}`);
      }
    }
    const isCovered = (item: SelectionItem) => {
      const parent = pathKeyOf(item.parent);
      const self = `${parent}/${item.entry.name}`;
      for (const dir of selectedDirs) {
        if (dir === self) continue;
        if (parent === dir || parent.startsWith(`${dir}/`)) return true;
      }
      return false;
    };

    for (const item of items.values()) {
      if (isCovered(item)) continue;
      if (!item.entry.isDirectory) {
        base += item.entry.size ?? 0;
        continue;
      }
      const cached = cache.get(dirKey(item.parent, item.entry.name));
      if (cached != null) base += cached;
      else dirs.push(item);
    }

    setState({ bytes: base, pending: dirs.length > 0 });
    if (dirs.length === 0) return;

    let cancelled = false;
    let total = base;
    let raf = 0;
    const flush = () => {
      if (cancelled || runRef.current !== run) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setState({ bytes: total, pending: true }));
    };

    void (async () => {
      for (const item of dirs) {
        if (cancelled || runRef.current !== run) return;
        const value = await measureEntry(item.parent, item.entry);
        total += typeof value === "number" ? value : 0;
        flush();
      }
      if (cancelled || runRef.current !== run) return;
      cancelAnimationFrame(raf);
      setState({ bytes: total, pending: false });
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [items]);

  return state;
}
