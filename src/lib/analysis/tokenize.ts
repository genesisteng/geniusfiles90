/**
 * Tokenisation dédiée au contenu (texte long) et aux requêtes en langage
 * naturel. Séparée de `search/normalize.ts` pour ne pas parasiter le
 * scoring des noms de fichiers avec la liste de stopwords.
 */

const STOP_FR = new Set(
  "a ai au aux avec ce ces c'est dans de des du elle en et est etre eux il ils je la le les leur leurs lui ma mais me mes mon ne ni nos notre nous ou par pas pour qu que quel quelle qui sa sans se ses son sur ta te tes toi ton tous tout tu un une vos votre vous y ca cet cette d l m n s t j".split(
    " ",
  ),
);
const STOP_EN = new Set(
  "a an and are as at be but by for from has have i if in is it its me my no not of on or so than that the their them then there these they this to was we were what when where which who will with you your".split(
    " ",
  ),
);

const STOP = new Set([...STOP_FR, ...STOP_EN]);

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Découpe un texte de contenu en tokens filtrés (≥ 3 caractères, hors stopwords). */
export function tokenizeContent(text: string): string[] {
  if (!text) return [];
  const clean = stripDiacritics(text.toLowerCase()).replace(/[^\p{Letter}\p{Number}]+/gu, " ");
  const out: string[] = [];
  for (const raw of clean.split(/\s+/)) {
    if (raw.length < 3) continue;
    if (raw.length > 40) continue;
    if (STOP.has(raw)) continue;
    if (/^\d+$/.test(raw) && raw.length < 4) continue;
    out.push(raw);
  }
  return out;
}

/** Tokenise une requête utilisateur (moins agressif, garde les mots courts). */
export function tokenizeQuery(text: string): string[] {
  if (!text) return [];
  const clean = stripDiacritics(text.toLowerCase()).replace(/[^\p{Letter}\p{Number}]+/gu, " ");
  return clean.split(/\s+/).filter((t) => t.length >= 2 && !STOP.has(t));
}

/** Top-N mots-clés d'un texte, pondérés par fréquence normalisée. */
export function topKeywords(text: string, n = 8): string[] {
  const tokens = tokenizeContent(text);
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([t]) => t);
}

/** Détection de langue naïve (fr/en) à base de mots vides fréquents. */
export function guessLang(text: string): "fr" | "en" | "unknown" {
  const sample = text.slice(0, 4000).toLowerCase();
  let fr = 0;
  let en = 0;
  for (const w of ["le ", "la ", "les ", "des ", "une ", "avec ", "pour ", "dans "]) {
    if (sample.includes(w)) fr++;
  }
  for (const w of ["the ", "and ", "with ", "from ", "have ", "this ", "that "]) {
    if (sample.includes(w)) en++;
  }
  if (fr === 0 && en === 0) return "unknown";
  return fr >= en ? "fr" : "en";
}
