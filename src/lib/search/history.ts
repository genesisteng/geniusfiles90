/**
 * Search history — persisted in localStorage, deduplicated, capped.
 */

const KEY = "gf.search.history";
const MAX = 20;

function safeGet(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function safeSet(v: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
}
function safeDel() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export type SearchHistoryItem = {
  query: string;
  at: number;
};

export function loadSearchHistory(): SearchHistoryItem[] {
  const raw = safeGet();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SearchHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushSearchHistory(query: string): SearchHistoryItem[] {
  const q = query.trim();
  if (!q) return loadSearchHistory();
  const list = loadSearchHistory().filter((h) => h.query.toLowerCase() !== q.toLowerCase());
  const next = [{ query: q, at: Date.now() }, ...list].slice(0, MAX);
  safeSet(JSON.stringify(next));
  return next;
}

export function removeSearchHistoryItem(query: string): SearchHistoryItem[] {
  const list = loadSearchHistory().filter((h) => h.query.toLowerCase() !== query.toLowerCase());
  safeSet(JSON.stringify(list));
  return list;
}

export function clearSearchHistory(): void {
  safeDel();
}
