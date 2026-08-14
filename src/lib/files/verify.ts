/**
 * Vérification de l'état RÉEL du stockage après une opération.
 *
 * Aucune opération de GeniusFiles ne déclare un succès sur la seule foi
 * du code de retour du plugin : après chaque écriture, l'existence (ou la
 * disparition) est contrôlée sur le disque. C'est ce qui empêche
 * définitivement les « faux succès », les fichiers fantômes et les
 * éléments réellement supprimés qui restent affichés.
 *
 * Coût maîtrisé :
 * - un seul appel natif groupé (`existsBatch`) quand le plugin le fournit ;
 * - repli automatique sur `stat` par lots bornés pour les anciens APK ;
 * - en aperçu web, lecture directe de l'arborescence simulée (O(1)).
 */
import { isAndroidNative, nativePlugin } from "@/lib/native/geniusfiles-native";

import { mockResolve, toAbsolutePath } from "./fs";
import type { PathRef } from "./types";

/** Nombre de `stat` lancés en parallèle sur le repli (anciens APK). */
const PROBE_CONCURRENCY = 8;

function joinAbs(base: string, name: string): string {
  return `${base.replace(/\/$/, "")}/${name}`;
}

async function nativeExisting(paths: string[]): Promise<Set<string>> {
  const p = nativePlugin();
  const present = new Set<string>();
  if (!p || paths.length === 0) return present;

  // Chemin rapide : une seule traversée du pont natif.
  if (typeof p.existsBatch === "function") {
    try {
      const res = await p.existsBatch({ paths });
      for (const abs of res?.present ?? []) present.add(abs);
      return present;
    } catch {
      /* repli ci-dessous */
    }
  }

  // Repli borné : jamais plus de PROBE_CONCURRENCY appels simultanés.
  let cursor = 0;
  const workers = Array.from({ length: Math.min(PROBE_CONCURRENCY, paths.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= paths.length) return;
      const abs = paths[index];
      try {
        await p.stat({ path: abs });
        present.add(abs);
      } catch {
        /* absent — c'est le résultat attendu après une suppression */
      }
    }
  });
  await Promise.all(workers);
  return present;
}

/**
 * Parmi `names`, renvoie ceux qui existent ENCORE réellement dans `parent`.
 * Un ensemble vide après une suppression = suppression confirmée.
 */
export async function namesStillPresent(parent: PathRef, names: string[]): Promise<Set<string>> {
  if (names.length === 0) return new Set();
  if (isAndroidNative()) {
    const base = toAbsolutePath(parent);
    const paths = names.map((n) => joinAbs(base, n));
    const present = await nativeExisting(paths);
    const out = new Set<string>();
    names.forEach((name, i) => {
      if (present.has(paths[i])) out.add(name);
    });
    return out;
  }
  // Aperçu web : l'arborescence simulée est la source de vérité.
  const node = mockResolve(parent);
  const children = new Set((node?.children ?? []).map((c) => c.name));
  return new Set(names.filter((n) => children.has(n)));
}

/** L'élément existe-t-il réellement ? (création / restauration / copie) */
export async function nameExists(parent: PathRef, name: string): Promise<boolean> {
  return (await namesStillPresent(parent, [name])).has(name);
}

/** Vérifie une liste de chemins absolus (corbeille, destinations natives). */
export async function absolutePathsPresent(paths: string[]): Promise<Set<string>> {
  if (paths.length === 0) return new Set();
  if (isAndroidNative()) return nativeExisting(paths);
  return new Set();
}
