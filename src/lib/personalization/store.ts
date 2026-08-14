/**
 * Persistance des préférences de personnalisation.
 *
 * Un seul objet racine `gf.prefs.v1` en `localStorage`. Fusion défensive
 * avec `DEFAULT_PREFS` à chaque lecture : garantit qu'un ajout de champ
 * futur ne casse pas les installations existantes.
 *
 * Diffuse `gf:prefs-changed` — l'applier CSS et le hook `usePrefs` écoutent.
 */
import { DEFAULT_PREFS, type PersonalizationPrefs } from "./types";
import { mirrorPrefsToNative, readNativePrefs } from "./native-store";

const KEY = "gf.prefs.v1";

let cache: PersonalizationPrefs | null = null;
const listeners = new Set<(prefs: PersonalizationPrefs) => void>();
let nativeWrite = Promise.resolve();

function queueNativeMirror(serialized: string): void {
  nativeWrite = nativeWrite.catch(() => {}).then(() => mirrorPrefsToNative(serialized));
}

function deepMerge<T>(base: T, override: unknown): T {
  if (override == null || typeof override !== "object") return base;
  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }
  if (typeof base !== "object") return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    const bv = (base as Record<string, unknown>)[k];
    if (bv != null && typeof bv === "object" && !Array.isArray(bv)) {
      out[k] = deepMerge(bv as never, v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export function loadPrefs(): PersonalizationPrefs {
  if (cache) return cache;
  if (typeof localStorage === "undefined") {
    cache = { ...DEFAULT_PREFS };
    return cache;
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = { ...DEFAULT_PREFS };
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = deepMerge(DEFAULT_PREFS, parsed);
    return cache;
  } catch {
    cache = { ...DEFAULT_PREFS };
    return cache;
  }
}

export function savePrefs(prefs: PersonalizationPrefs) {
  cache = prefs;
  const serialized = JSON.stringify(prefs);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(KEY, serialized);
    } catch {
      /* quota — ignore */
    }
  }
  // Copie native (SharedPreferences) : survit à une purge du localStorage
  // de la WebView.
  queueNativeMirror(serialized);
  for (const l of listeners) {
    try {
      l(prefs);
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("gf:prefs-changed"));
    } catch {
      /* ignore */
    }
  }
}

export type PrefsUpdater = (prev: PersonalizationPrefs) => PersonalizationPrefs;

export function updatePrefs(updater: PrefsUpdater): PersonalizationPrefs {
  const prev = loadPrefs();
  const next = updater(prev);
  savePrefs(next);
  return next;
}

export function resetPrefs(): PersonalizationPrefs {
  savePrefs({ ...DEFAULT_PREFS });
  return loadPrefs();
}

export function subscribePrefs(cb: (prefs: PersonalizationPrefs) => void): () => void {
  listeners.add(cb);
  const handler = () => cb(loadPrefs());
  if (typeof window !== "undefined") {
    window.addEventListener("gf:prefs-changed", handler);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("gf:prefs-changed", handler);
    }
  };
}

/**
 * Restaure les préférences depuis la copie native si le `localStorage`
 * a été purgé (le thème choisi ne doit jamais revenir au clair par défaut).
 * Retourne les préférences restaurées, ou `null` si rien à faire.
 */
export async function hydratePrefsFromNative(): Promise<PersonalizationPrefs | null> {
  if (typeof window === "undefined") return null;
  let hasLocal = false;
  try {
    hasLocal = localStorage.getItem(KEY) != null;
  } catch {
    hasLocal = false;
  }
  const raw = await readNativePrefs();
  if (hasLocal) {
    // localStorage est la source autoritaire quand il existe. Répare aussi
    // une ancienne copie native (cause d'un splash sombre au cold start).
    const serialized = JSON.stringify(loadPrefs());
    if (raw !== serialized) queueNativeMirror(serialized);
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    const restored = deepMerge(DEFAULT_PREFS, JSON.parse(raw));
    cache = restored;
    try {
      localStorage.setItem(KEY, JSON.stringify(restored));
    } catch {
      /* ignore */
    }
    for (const l of listeners) {
      try {
        l(restored);
      } catch {
        /* ignore */
      }
    }
    window.dispatchEvent(new CustomEvent("gf:prefs-changed"));
    return restored;
  } catch {
    return null;
  }
}
