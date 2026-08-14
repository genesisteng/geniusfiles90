/**
 * Persistance et diffusion de la langue choisie.
 *
 * Même principe que les préférences de personnalisation : une valeur en
 * `localStorage`, un cache module, un événement `gf:locale-changed` pour
 * que chaque vue abonnée se rafraîchisse immédiatement (aucun rechargement).
 *
 * Le premier rendu client utilise toujours `DEFAULT_LOCALE` afin de rester
 * identique au HTML rendu côté serveur ; `initLocale()` applique ensuite la
 * langue mémorisée dès le montage de l'application.
 */
import { DEFAULT_LOCALE, LOCALE_TAGS, isLocale, type Locale } from "./types";

const KEY = "gf.lang.v1";

/** Valeur du sélecteur : une langue figée, ou « suivre le système ». */
export type LocalePreference = Locale | "system";

const SYSTEM = "system";

let current: Locale = DEFAULT_LOCALE;
let initialized = false;
const listeners = new Set<(locale: Locale) => void>();

/** Langue mémorisée, ou `null` si l'utilisateur n'a jamais choisi. */
export function readStoredLocale(): Locale | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Préférence enregistrée : une langue choisie manuellement, ou `"system"`
 * (valeur par défaut : la langue du téléphone est suivie).
 */
export function readLocalePreference(): LocalePreference {
  if (typeof localStorage === "undefined") return SYSTEM;
  try {
    const raw = localStorage.getItem(KEY);
    return isLocale(raw) ? raw : SYSTEM;
  } catch {
    return SYSTEM;
  }
}

/**
 * Langue du système traduite en langue prise en charge.
 * `fr` sert de secours quand la langue du téléphone n'est pas disponible :
 * l'interface n'est jamais partiellement traduite.
 */
export function detectSystemLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const tags: string[] = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language ?? "",
  ];
  for (const tag of tags) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Langue effective pour une préférence donnée. */
export function resolveLocale(pref: LocalePreference): Locale {
  return pref === SYSTEM ? detectSystemLocale() : pref;
}

export function getLocale(): Locale {
  return current;
}

function applyDocumentLang(locale: Locale) {
  if (typeof document === "undefined") return;
  try {
    document.documentElement.setAttribute("lang", LOCALE_TAGS[locale].slice(0, 2));
  } catch {
    /* ignore */
  }
}

function notify(locale: Locale) {
  for (const listener of listeners) {
    try {
      listener(locale);
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("gf:locale-changed"));
    } catch {
      /* ignore */
    }
  }
}

/** Change la langue et la mémorise. Sans effet si elle est déjà active. */
export function setLocale(locale: Locale): void {
  if (!isLocale(locale) || locale === current) return;
  current = locale;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(KEY, locale);
    } catch {
      /* quota — ignore */
    }
  }
  applyDocumentLang(locale);
  notify(locale);
}

/**
 * Enregistre la préférence du sélecteur. `"system"` efface le choix manuel
 * et applique immédiatement la langue du téléphone.
 */
export function setLocalePreference(pref: LocalePreference): void {
  if (typeof localStorage !== "undefined") {
    try {
      if (pref === SYSTEM) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch {
      /* quota — ignore */
    }
  }
  const next = resolveLocale(pref);
  if (next === current) {
    applyDocumentLang(next);
    return;
  }
  current = next;
  applyDocumentLang(next);
  notify(next);
}

/**
 * Applique la langue à utiliser après l'hydratation : le choix manuel
 * mémorisé s'il existe, sinon la langue du téléphone (français en secours).
 * En mode automatique, un changement de langue de l'appareil est suivi.
 */
export function initLocale(): Locale {
  if (initialized) return current;
  initialized = true;
  const pref = readLocalePreference();
  const next = resolveLocale(pref);
  applyDocumentLang(next);
  if (next !== current) {
    current = next;
    notify(next);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("languagechange", () => {
      if (readLocalePreference() !== SYSTEM) return;
      const updated = detectSystemLocale();
      if (updated === current) return;
      current = updated;
      applyDocumentLang(updated);
      notify(updated);
    });
  }
  return current;
}

export function subscribeLocale(cb: (locale: Locale) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
