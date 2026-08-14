/**
 * Accès à la traduction depuis React.
 *
 * `useT()` renvoie une fonction `t` liée à la langue active ; tout composant
 * qui l'utilise se rafraîchit automatiquement au changement de langue,
 * sans rechargement ni remontage de l'application.
 */
import { useCallback, useEffect, useState } from "react";
import {
  getLocale,
  initLocale,
  readLocalePreference,
  setLocale,
  setLocalePreference,
  subscribeLocale,
  type LocalePreference,
} from "./store";
import { translate } from "./translate";
import { DEFAULT_LOCALE, type Locale, type TFunction, type TransValues } from "./types";

/** Langue active, réactive. */
export function useLocale(): Locale {
  // Le premier rendu utilise TOUJOURS la langue par défaut : il est ainsi
  // identique au HTML rendu côté serveur, même quand une partie de l'arbre
  // s'hydrate après l'application de la langue mémorisée (aucune erreur
  // d'hydratation). L'effet ci-dessous rétablit la langue réelle aussitôt.
  const [locale, setState] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => {
    setState(getLocale());
    return subscribeLocale(setState);
  }, []);
  return locale;
}

/** Fonction de traduction réactive. */
export function useT(): TFunction {
  const locale = useLocale();
  return useCallback(
    (key: string, values?: TransValues) => translate(locale, key, values),
    [locale],
  );
}

/** Couple `[langue, changerLangue]` pour le sélecteur des paramètres. */
export function useLocaleControl(): [Locale, (next: Locale) => void] {
  const locale = useLocale();
  return [locale, setLocale];
}

/**
 * Couple `[préférence, changerPréférence]` pour le sélecteur des paramètres :
 * une langue figée choisie manuellement, ou `"system"` (langue du téléphone).
 */
export function useLocalePreference(): [LocalePreference, (next: LocalePreference) => void] {
  // Premier rendu identique au HTML serveur, comme `useLocale`.
  const [pref, setPref] = useState<LocalePreference>("system");
  useEffect(() => {
    setPref(readLocalePreference());
  }, []);
  const change = useCallback((next: LocalePreference) => {
    setLocalePreference(next);
    setPref(next);
  }, []);
  return [pref, change];
}

/** Applique la langue mémorisée dès le montage de l'application. */
export function useInitLocale(): void {
  useEffect(() => {
    initLocale();
  }, []);
}
