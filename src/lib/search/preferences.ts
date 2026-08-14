/**
 * Persistance des filtres de recherche.
 *
 * L'utilisateur retrouve ses filtres (type, taille, date, stockage)
 * exactement comme il les avait laissés, y compris après avoir quitté
 * l'application — aucun réglage à refaire à chaque recherche.
 */
import { DEFAULT_FILTERS, type SearchFilters } from "./types";

const KEY = "gf.search.filters.v1";

export function loadSearchFilters(): SearchFilters {
  if (typeof localStorage === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<SearchFilters>;
    return { ...DEFAULT_FILTERS, ...parsed };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function saveSearchFilters(filters: SearchFilters): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(filters));
  } catch {
    /* quota — sans conséquence */
  }
}
