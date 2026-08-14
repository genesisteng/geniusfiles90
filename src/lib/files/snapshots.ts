/**
 * Free-space evolution snapshots.
 *
 * Every visit to the dashboard records (or updates) today's data
 * point. We keep the last 14 days so the home page can render a
 * simple sparkline of available space over time — entirely from
 * on-device values.
 */
export type FreeSnapshot = {
  /** ms since epoch */
  at: number;
  /** free bytes */
  free: number;
  /** total bytes */
  total: number;
};

const KEY = "gf.dashboard.snapshots";
const MAX = 14;

function safeGet(): FreeSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FreeSnapshot[]) : [];
  } catch {
    return [];
  }
}

function safeSet(items: FreeSnapshot[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function loadSnapshots(): FreeSnapshot[] {
  return safeGet();
}

export function recordSnapshot(free: number, total: number): FreeSnapshot[] {
  const now = Date.now();
  const list = safeGet();
  const last = list[list.length - 1];
  const point: FreeSnapshot = { at: now, free, total };
  const next = last && isSameDay(last.at, now) ? [...list.slice(0, -1), point] : [...list, point];
  const trimmed = next.slice(-MAX);
  safeSet(trimmed);
  return trimmed;
}
