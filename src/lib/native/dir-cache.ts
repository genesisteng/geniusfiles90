/**
 * mtime-based directory cache.
 *
 * Wraps the native `listDirectory` bridge so repeat opens of the same
 * folder are instantaneous. A cheap `statDirectory` call verifies the
 * directory's own mtime + entry count before we return cached data;
 * we only re-list when Android reports the folder actually changed.
 *
 * This is the primitive that lets Galerie/Nettoyeur/Explorateur stop
 * re-scanning the whole device on every app resume.
 */
import type { NativeDirEntry, NativeListing } from "./geniusfiles-native";
import { listNativeDirectory, nativePlugin } from "./geniusfiles-native";

type Entry = { mtime: number; count: number; entries: NativeDirEntry[]; at: number };

const MAX_ENTRIES = 128; // LRU cap — plenty for typical navigation depth
const cache = new Map<string, Entry>();

function touch(path: string, entry: Entry) {
  cache.delete(path);
  cache.set(path, entry);
  while (cache.size > MAX_ENTRIES) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

type StatResult =
  | { ok: true; mtime: number; count: number }
  | { ok: false; reason: "denied" | "not_found" | "error" };

async function statDirectory(path: string): Promise<StatResult> {
  const p = nativePlugin() as unknown as {
    statDirectory?: (o: { path: string }) => Promise<{ mtime: number; count: number }>;
  } | null;
  if (!p?.statDirectory) return { ok: false, reason: "error" };
  try {
    const r = await p.statDirectory({ path });
    return { ok: true, mtime: r.mtime, count: r.count };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/DENIED|permission/i.test(message)) return { ok: false, reason: "denied" };
    if (/NOT_FOUND|NOT_A_DIRECTORY/i.test(message)) return { ok: false, reason: "not_found" };
    return { ok: false, reason: "error" };
  }
}

export type CachedListing =
  | { ok: true; listing: NativeListing; fromCache: boolean }
  | { ok: false; reason: "denied" | "not_found" | "error"; message?: string };

/**
 * List a directory, reusing the cached entries when the native side
 * reports the folder is unchanged.
 */
export async function listDirectoryCached(
  path: string,
  opts: { force?: boolean } = {},
): Promise<CachedListing> {
  const cached = opts.force ? undefined : cache.get(path);
  if (opts.force) cache.delete(path);
  if (cached) {
    const s = await statDirectory(path);
    if (s.ok && s.mtime === cached.mtime && s.count === cached.count) {
      cached.at = Date.now();
      return {
        ok: true,
        listing: { path, entries: cached.entries },
        fromCache: true,
      };
    }
    if (!s.ok && s.reason === "not_found") {
      cache.delete(path);
      return { ok: true, listing: { path, entries: [] }, fromCache: false };
    }
    if (!s.ok && s.reason === "denied") {
      cache.delete(path);
      return { ok: false, reason: "denied" };
    }
  }

  const res = await listNativeDirectory(path);
  if (!res.ok) {
    cache.delete(path);
    return res;
  }
  // Best-effort: compute a synthetic mtime = max(entry.mtime). Not exact,
  // but combined with entry count it detects any add/remove/modify.
  let mtime = 0;
  for (const e of res.listing.entries) if (e.mtime > mtime) mtime = e.mtime;
  touch(path, {
    mtime,
    count: res.listing.entries.length,
    entries: res.listing.entries,
    at: Date.now(),
  });
  return { ok: true, listing: res.listing, fromCache: false };
}

/**
 * Lecture synchrone du cache — sert à peindre un dossier déjà visité
 * immédiatement (0 ms), pendant que `listDirectoryCached` revalide en
 * arrière-plan. Aucun écran de chargement lors des retours/renavigations.
 */
export function peekCachedEntries(path: string): NativeDirEntry[] | null {
  return cache.get(path)?.entries ?? null;
}

/**
 * Préchauffe le cache d'un dossier pendant les temps morts, pour que son
 * ouverture soit instantanée. Sans effet si déjà en cache.
 */
export function prefetchDirectory(path: string): void {
  if (cache.has(path)) return;
  const run = () => {
    if (cache.has(path)) return;
    void listNativeDirectory(path).then((res) => {
      if (!res.ok) return;
      let mtime = 0;
      for (const e of res.listing.entries) if (e.mtime > mtime) mtime = e.mtime;
      touch(path, {
        mtime,
        count: res.listing.entries.length,
        entries: res.listing.entries,
        at: Date.now(),
      });
    });
  };
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 120);
}

/** Drop a single directory from the cache (call after a mutation). */
export function invalidateDirectory(path: string): void {
  cache.delete(path);
  // Also drop the parent so parent listings pick up size/mtime changes.
  const idx = path.lastIndexOf("/");
  if (idx > 0) cache.delete(path.slice(0, idx));
}

/** Drop every cached directory whose path starts with `rootPath`.
 *  Use after bulk mutations (a plan step that moved/copied under a
 *  destination root) to invalidate the entire subtree at once. */
export function invalidateUnder(rootPath: string): void {
  const prefix = rootPath.replace(/\/+$/, "");
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of Array.from(cache.keys())) {
    if (key === prefix || key.startsWith(prefix + "/")) cache.delete(key);
  }
}

/** Drop the entire cache (rare — permission changes, root switch). */
export function invalidateAll(): void {
  cache.clear();
}

/**
 * Mise à jour chirurgicale d'un dossier déjà en cache.
 *
 * Après une mutation, on préfère corriger les entrées connues plutôt que
 * jeter le cache : un dossier de 100 000 fichiers n'est jamais relu pour
 * un simple renommage. `mutate` renvoie `null` quand rien ne change.
 */
export function updateCachedEntries(
  absDir: string,
  mutate: (entries: NativeDirEntry[]) => NativeDirEntry[] | null,
): void {
  const cached = cache.get(absDir);
  if (!cached) return;
  const next = mutate(cached.entries);
  if (!next) return;
  let mtime = 0;
  for (const e of next) if (e.mtime > mtime) mtime = e.mtime;
  touch(absDir, { mtime, count: next.length, entries: next, at: Date.now() });
}

/** Le dossier est-il connu du cache ? */
export function hasCachedDirectory(absDir: string): boolean {
  return cache.has(absDir);
}
