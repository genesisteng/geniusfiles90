/**
 * Collecte des dictionnaires de traduction.
 *
 * Chaque domaine fonctionnel possède son propre fichier dans
 * `messages/<langue>/<domaine>.ts`, ce qui évite un fichier géant et permet
 * d'ajouter une langue en créant simplement un dossier supplémentaire.
 * Les fichiers sont agrégés automatiquement : aucun index à maintenir.
 */
import { DEFAULT_LOCALE, LOCALES, type Locale, type Messages } from "./types";

type Module = { default?: Messages } & Messages;

const modules = import.meta.glob<Module>("./messages/*/*.ts", { eager: true });

function build(): Record<Locale, Messages> {
  const out = Object.fromEntries(LOCALES.map((l) => [l, {} as Messages])) as Record<
    Locale,
    Messages
  >;
  for (const [path, mod] of Object.entries(modules)) {
    const match = /\.\/messages\/([^/]+)\//.exec(path);
    const locale = match?.[1] as Locale | undefined;
    if (!locale || !out[locale]) continue;
    const dict = (mod.default ?? mod) as Messages;
    Object.assign(out[locale], dict);
  }
  return out;
}

export const MESSAGES: Record<Locale, Messages> = build();

/** Texte brut pour une clé, avec repli sur le français puis sur la clé. */
export function lookup(locale: Locale, key: string): string | undefined {
  return MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE]?.[key];
}
