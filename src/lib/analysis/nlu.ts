/**
 * Interpréteur de requêtes en langage naturel pour la Recherche.
 *
 * Traduit une requête utilisateur (« mes factures de mars », « photos de
 * reçus », « pdf contrat 2025 ») en tokens + filtres exploitables par le
 * moteur de recherche et l'index de contenu. Fonctionne 100 % hors ligne.
 *
 * Volontairement séparé du NLU global : la portée est plus étroite
 * (retrouver un fichier) et la sortie est un `NaturalQuery` sérialisable
 * consommé par le provider de contenu.
 */
import type { KindFilter, DateBand } from "@/lib/search/types";
import { tokenizeQuery } from "./tokenize";

export type NaturalQuery = {
  raw: string;
  tokens: string[];
  /** Contraintes déduites du langage naturel. */
  kind?: KindFilter;
  date?: DateBand;
  /** Type de document ciblé (facture, reçu, contrat…). */
  docType?: string;
  /** Tags visuels (screenshot, carte de visite…). */
  visualTags?: string[];
  /** Recherche par contenu explicitement demandée (« qui contient … »). */
  contentIntent?: boolean;
};

const MONTHS_FR = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];

function stripDia(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function parseNaturalQuery(raw: string): NaturalQuery {
  const n = stripDia(raw);
  const out: NaturalQuery = { raw, tokens: [] };

  if (/\b(qui contient|contenant|avec le mot|dans le texte|dans le contenu)\b/.test(n)) {
    out.contentIntent = true;
  }

  if (/\b(photo|photos|image|images)\b/.test(n)) out.kind = "image";
  else if (/\b(video|videos|film|films)\b/.test(n)) out.kind = "video";
  else if (/\b(audio|musique|son|chanson)\b/.test(n)) out.kind = "audio";
  else if (/\b(pdf|document|documents|texte)\b/.test(n)) out.kind = "document";
  else if (/\b(archive|zip|rar|7z)\b/.test(n)) out.kind = "archive";
  else if (/\b(dossier|dossiers|folder)\b/.test(n)) out.kind = "folder";

  if (/\baujourd'?hui\b/.test(n)) out.date = "today";
  else if (/\b(cette semaine|derniers? 7 jours?|7 jours)\b/.test(n)) out.date = "week";
  else if (/\b(ce mois|dernier mois|30 jours)\b/.test(n)) out.date = "month";
  else if (/\b(cette annee|derniere annee|12 mois)\b/.test(n)) out.date = "year";

  const visual: string[] = [];
  if (/\b(screenshot|capture d ?ecran|capture)\b/.test(n)) {
    visual.push("screenshot", "capture", "ecran");
    out.kind = out.kind ?? "image";
  }
  if (/\b(recu|recus|ticket|tickets)\b/.test(n)) {
    visual.push("recu", "ticket");
    out.docType = "recu";
  }
  if (/\bfacture|factures|invoice\b/.test(n)) {
    visual.push("facture");
    out.docType = "facture";
  }
  if (/\bcarte de visite|business card|contact\b/.test(n)) {
    visual.push("carte", "visite");
    out.docType = "carte_visite";
  }
  if (/\bcontrat|contrats|agreement\b/.test(n)) {
    visual.push("contrat");
    out.docType = "contrat";
  }
  if (/\bcv|curriculum\b/.test(n)) {
    visual.push("cv");
    out.docType = "cv";
  }
  if (visual.length) out.visualTags = Array.from(new Set(visual));

  // Retire les mots grammaticaux / mois isolés pour ne garder que les
  // termes utiles à l'indexation.
  const dropped = new Set([
    ...MONTHS_FR,
    "cherche",
    "trouve",
    "trouver",
    "chercher",
    "mes",
    "mon",
    "ma",
    "le",
    "la",
    "les",
    "un",
    "une",
    "des",
    "de",
    "du",
    "avec",
    "qui",
    "contient",
    "contenant",
    "dans",
    "mot",
    "texte",
    "contenu",
  ]);
  out.tokens = tokenizeQuery(n).filter((t) => !dropped.has(t));

  return out;
}
