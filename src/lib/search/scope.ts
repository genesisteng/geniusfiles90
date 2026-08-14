/**
 * Portée de recherche contextuelle.
 *
 * Le bouton « Rechercher » du gestionnaire de fichiers transmet le
 * contexte courant (stockage ou dossier ouvert) à l'écran de recherche :
 * celui-ci n'explore alors que cette portée et adapte son libellé.
 * Depuis l'accueil, aucune portée n'est posée → recherche globale.
 */
import type { PathRef } from "@/lib/files/types";

export type SearchScope = {
  /** Libellé affiché : nom du stockage ou du dossier ouvert. */
  label: string;
  path: PathRef;
};

const KEY = "gf.search.scope";

export function setSearchScope(scope: SearchScope | null): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (!scope) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(scope));
  } catch {
    /* ignore */
  }
}

/** Lit la portée en attente et la consomme (une recherche = une portée). */
export function takeSearchScope(): SearchScope | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SearchScope;
    if (!parsed?.label || !parsed?.path?.rootId) return null;
    return { label: parsed.label, path: { ...parsed.path, segments: parsed.path.segments ?? [] } };
  } catch {
    return null;
  }
}
