/**
 * IndexedDB-backed persistence for GeniusFiles local indexes.
 *
 * Stores JSON-serialisable snapshots keyed by an arbitrary string. Used
 * by the home-screen modules (categories, gallery) so the file lists
 * come back instantly on next open — no fresh scan required.
 *
 * All operations are best-effort: on unsupported environments (SSR,
 * incognito private tabs, storage quota exhausted) the helpers resolve
 * quietly and callers fall back to a live scan.
 */
const DB_NAME = "gf-index";
const DB_VERSION = 1;
const STORE = "snapshots";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result ?? null) as T | null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Bounded in-memory memoisation layered on top of IndexedDB so repeated
 * reads inside the same session don't hit the disk twice. Callers pass
 * the loader lazily; the second call returns the cached value directly.
 */
const memo = new Map<string, unknown>();

export async function idbGetCached<T>(key: string): Promise<T | null> {
  if (memo.has(key)) return memo.get(key) as T;
  const v = await idbGet<T>(key);
  if (v != null) memo.set(key, v);
  return v;
}

export async function idbSetCached<T>(key: string, value: T): Promise<void> {
  memo.set(key, value);
  await idbSet(key, value);
}
