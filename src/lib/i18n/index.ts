/**
 * Point d'entrée de l'internationalisation de GeniusFiles.
 *
 * Deux usages :
 *  - dans un composant React : `const t = useT();` puis `t("home.title")` ;
 *  - hors React (services, toasts, moteurs) : `import { t } from "@/lib/i18n"`.
 *
 * Les textes vivent dans `messages/<langue>/<domaine>.ts`. Ajouter une
 * langue = créer un dossier ; aucun composant n'a besoin d'être dupliqué.
 */
import { getLocale } from "./store";
import { translate } from "./translate";
import type { TransValues } from "./types";

export * from "./types";
export * from "./format";
export {
  getLocale,
  setLocale,
  initLocale,
  subscribeLocale,
  readStoredLocale,
  readLocalePreference,
  setLocalePreference,
  detectSystemLocale,
  resolveLocale,
  type LocalePreference,
} from "./store";
export { translate, pluralCategory } from "./translate";
export { useT, useLocale, useLocaleControl, useLocalePreference, useInitLocale } from "./react";

/** Traduction immédiate dans la langue active (hors composants React). */
export function t(key: string, values?: TransValues): string {
  return translate(getLocale(), key, values);
}
