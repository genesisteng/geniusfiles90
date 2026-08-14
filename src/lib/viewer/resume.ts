/**
 * Resume positions for the Universal Viewer.
 *
 * Persists the last read position of a file (video/audio time in seconds,
 * PDF page number, text scroll ratio) in localStorage. Foundations only —
 * a richer history module can consume the same storage keys later.
 */
const STORAGE_KEY = "gf.viewer.resume.v1";
const MAX_ENTRIES = 200;

type Store = Record<string, { at: number; pos: number; extra?: number }>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  // Cap size — evict oldest.
  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort((a, b) => (store[a].at ?? 0) - (store[b].at ?? 0));
    for (const k of sorted.slice(0, keys.length - MAX_ENTRIES)) delete store[k];
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

export function getResume(key: string): { pos: number; extra?: number } | null {
  const s = read();
  const r = s[key];
  return r ? { pos: r.pos, extra: r.extra } : null;
}

export function setResume(key: string, pos: number, extra?: number) {
  const s = read();
  s[key] = { at: Date.now(), pos, extra };
  write(s);
}

export function clearResume(key: string) {
  const s = read();
  delete s[key];
  write(s);
}
