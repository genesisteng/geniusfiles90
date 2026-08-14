/**
 * GeniusFiles — internationalisation : types partagés.
 *
 * Sept langues officielles (français par défaut).
 * L'architecture est prête pour l'ajout d'autres langues : il suffira
 * d'ajouter le code dans `LOCALES` et un dossier `messages/<code>/`.
 */

export const LOCALES = ["fr", "en", "es", "de", "pt", "it", "tr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Étiquette affichée dans le sélecteur (toujours dans sa propre langue). */
export const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  de: "Deutsch",
  pt: "Português",
  it: "Italiano",
  tr: "Türkçe",
};

/** Balise BCP-47 utilisée pour `Intl` et l'attribut `lang` du document. */
export const LOCALE_TAGS: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
  pt: "pt-PT",
  it: "it-IT",
  tr: "tr-TR",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Dictionnaire plat : clé de traduction → texte. */
export type Messages = Record<string, string>;

/** Valeurs interpolables dans un texte (`{name}`, `{count}`…). */
export type TransValues = Record<string, string | number>;

/** Signature de la fonction de traduction utilisée partout dans l'app. */
export type TFunction = (key: string, values?: TransValues) => string;
