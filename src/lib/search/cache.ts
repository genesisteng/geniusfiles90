/**
 * LRU cache for search results. Enables instantaneous back-navigation
 * to a recent query on very large catalogs, without re-scanning.
 *
 * Keys are derived from the query text and the active filters, so a
 * different filter set spawns a distinct cache entry.
 */
import type { SearchFilters, SearchResult } from "./types";

const MAX_ENTRIES = 12;
const ENTRY_TTL_MS = 2 * 60_000;

type Entry = {
  key: string;
  at: number;
  results: SearchResult[];
  scanned: number;
};

const store: Entry[] = [];

export function keyFor(query: string, filters: SearchFilters): string {
  return [
    query.trim().toLowerCase(),
    filters.kind,
    filters.size,
    filters.date,
    filters.rootId,
  ].join("|");
}

export function getCachedSearch(key: string): Entry | null {
  const idx = store.findIndex((e) => e.key === key);
  if (idx < 0) return null;
  const entry = store[idx];
  if (Date.now() - entry.at > ENTRY_TTL_MS) {
    store.splice(idx, 1);
    return null;
  }
  // Bump to MRU.
  store.splice(idx, 1);
  store.push(entry);
  return entry;
}

export function setCachedSearch(key: string, results: SearchResult[], scanned: number) {
  const idx = store.findIndex((e) => e.key === key);
  if (idx >= 0) store.splice(idx, 1);
  store.push({ key, at: Date.now(), results, scanned });
  while (store.length > MAX_ENTRIES) store.shift();
}

export function clearSearchCache() {
  store.length = 0;
}
