/**
 * Moteur de traduction : interpolation et pluriels.
 *
 * Conventions de clés :
 *  - `module.section.element` en minuscules ;
 *  - variables entre accolades : `"{count} fichiers"`, `"Déplacé vers {folder}"` ;
 *  - pluriels : deux clés `xxx_one` / `xxx_other`, choisies via `{ count }`.
 *
 * Les nombres passés en variables sont mis en forme selon la langue
 * (« 1 250 » en français, « 1,250 » en anglais).
 */
import { lookup } from "./messages";
import { DEFAULT_LOCALE, LOCALE_TAGS, type Locale, type TransValues } from "./types";

const pluralRules = new Map<Locale, Intl.PluralRules>();

function rulesFor(locale: Locale): Intl.PluralRules {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(LOCALE_TAGS[locale]);
    pluralRules.set(locale, rules);
  }
  return rules;
}

/** Catégorie de pluriel simplifiée : uniquement `one` / `other`. */
export function pluralCategory(locale: Locale, count: number): "one" | "other" {
  try {
    return rulesFor(locale).select(count) === "one" ? "one" : "other";
  } catch {
    return Math.abs(count) <= 1 ? "one" : "other";
  }
}

function formatValue(locale: Locale, value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);
    try {
      return new Intl.NumberFormat(LOCALE_TAGS[locale]).format(value);
    } catch {
      return String(value);
    }
  }
  return value;
}

function interpolate(locale: Locale, template: string, values?: TransValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = values[name];
    return value === undefined ? whole : formatValue(locale, value);
  });
}

/**
 * Traduit une clé dans la langue donnée.
 * Repli : langue demandée → français → clé brute (jamais de texte vide).
 */
export function translate(locale: Locale, key: string, values?: TransValues): string {
  let resolved: string | undefined;
  const count = values?.count;
  if (typeof count === "number") {
    const suffix = pluralCategory(locale, count);
    resolved = lookup(locale, `${key}_${suffix}`) ?? lookup(locale, `${key}_other`);
  }
  resolved ??= lookup(locale, key);
  if (resolved === undefined) {
    if (import.meta.env?.DEV && locale !== DEFAULT_LOCALE) {
      console.warn(`[i18n] clé manquante : ${key} (${locale})`);
    }
    return key;
  }
  return interpolate(locale, resolved, values);
}
