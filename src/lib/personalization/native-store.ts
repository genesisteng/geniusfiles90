/**
 * Miroir natif des préférences (Android).
 *
 * `localStorage` d'une WebView Android peut être purgé par le système
 * (nettoyage de cache, "Vider les données de navigation", mise à jour du
 * WebView…). Le choix de thème serait alors perdu et l'application
 * redémarrerait en thème clair.
 *
 * On duplique donc les préférences dans les `SharedPreferences` natives
 * via `@capacitor/preferences` :
 * - à chaque écriture (`mirrorPrefsToNative`) ;
 * - au démarrage (`hydrateFromNative`) : si `localStorage` est vide ou
 *   obsolète, on restaure la copie native.
 *
 * Tous les appels sont dynamiques → no-op sur le web / SSR.
 */
const NATIVE_KEY = "gf.prefs.v1";

type PreferencesApi = {
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
};

type NativeThemeApi = {
  setThemeMode(o: { mode: "system" | "light" | "dark" }): Promise<void>;
};

async function preferences(): Promise<PreferencesApi | null> {
  if (typeof window === "undefined") return null;
  try {
    const mod = await import("@capacitor/preferences");
    const api = mod.Preferences;
    // On enveloppe le plugin : renvoyer le proxy Capacitor directement
    // depuis une fonction async ferait sonder `.then` par le runtime,
    // ce que le proxy web refuse (« Preferences.then() is not implemented »).
    return {
      get: (o) => api.get(o),
      set: (o) => api.set(o),
    };
  } catch {
    return null;
  }
}

export async function mirrorPrefsToNative(serialized: string): Promise<void> {
  const p = await preferences();
  try {
    if (p) await p.set({ key: NATIVE_KEY, value: serialized });
  } catch {
    /* stockage indisponible — le localStorage reste la source primaire */
  }
  // Le mode est également transmis au pont natif. MainActivity peut ainsi
  // préparer le bon thème et les bonnes icônes système avant la WebView.
  try {
    const parsed = JSON.parse(serialized) as { appearance?: { theme?: string } };
    const raw = parsed.appearance?.theme;
    const mode = raw === "light" || raw === "dark" ? raw : "system";
    const { nativeBridge } = await import("@/lib/native/geniusfiles-native");
    const native = nativeBridge<NativeThemeApi>();
    await native.setThemeMode({ mode });
  } catch {
    /* web / ancien APK : le plugin StatusBar reste le filet de sécurité */
  }
}

/** Lit la copie native. `null` si absente / indisponible. */
export async function readNativePrefs(): Promise<string | null> {
  const p = await preferences();
  if (!p) return null;
  try {
    const { value } = await p.get({ key: NATIVE_KEY });
    return value ?? null;
  } catch {
    return null;
  }
}
