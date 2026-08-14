/**
 * Édition DOCX en place — round-trip XML, formatage préservé.
 *
 * Principe (volontairement minimal et robuste) :
 * - le paquet OOXML n'est jamais reconstruit : seul `word/document.xml` est
 *   réécrit, tout le reste du zip (styles, polices, images, en-têtes,
 *   numérotation, relations) est conservé octet pour octet ;
 * - un document = une liste de paragraphes `<w:p>`. L'éditeur manipule un
 *   texte plat où une ligne = un paragraphe : la correspondance est donc
 *   exacte et réversible ;
 * - modifier un paragraphe réécrit le texte de son *premier* run et vide les
 *   suivants : la mise en forme du paragraphe (style, police, alignement)
 *   reste celle du document d'origine ;
 * - une ligne ajoutée clone le `<w:pPr>` du paragraphe précédent ;
 * - une ligne supprimée retire le `<w:p>` correspondant.
 *
 * Aucune dépendance nouvelle : `jszip` est déjà utilisé par le lecteur
 * Office. Le zip est gardé une seule fois en mémoire (pas de copie
 * supplémentaire du document), et la sérialisation est asynchrone.
 */
import JSZip from "jszip";
import { t } from "@/lib/i18n";

export type DocxDraft = {
  /** Paragraphes du document, dans l'ordre de lecture. */
  paragraphs: string[];
  /** Sérialise le document avec les paragraphes fournis. */
  serialize: (paragraphs: string[]) => Promise<Uint8Array>;
};

const P_RE = /<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const T_RE = /<w:t(?:\s[^>]*)?\/>|<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g;

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

function encodeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "");
}

/** Texte lisible d'un paragraphe (`<w:t>` concaténés, tabulations incluses). */
function paragraphText(xml: string): string {
  let out = "";
  const parts = xml.match(/<w:tab\s*\/>|<w:br\s*\/>|<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g);
  if (!parts) return "";
  for (const part of parts) {
    if (part.startsWith("<w:tab")) out += "\t";
    else if (part.startsWith("<w:br")) out += " ";
    else out += decodeXml(part.replace(/^<w:t(?:\s[^>]*)?>/, "").replace(/<\/w:t>$/, ""));
  }
  return out;
}

/** Réécrit le texte d'un paragraphe sans toucher à sa mise en forme. */
function setParagraphText(xml: string, text: string): string {
  const encoded = encodeXml(text);
  const hasT = T_RE.test(xml);
  T_RE.lastIndex = 0;
  if (hasT) {
    let first = true;
    return xml.replace(T_RE, () => {
      if (first) {
        first = false;
        return `<w:t xml:space="preserve">${encoded}</w:t>`;
      }
      return `<w:t xml:space="preserve"></w:t>`;
    });
  }
  if (!text) return xml;
  // Paragraphe sans run (ligne vide d'origine) : on en ajoute un.
  if (/<w:p(?:\s[^>]*)?\/>/.test(xml)) {
    const attrs = xml.slice(4, -2);
    return `<w:p${attrs}><w:r><w:t xml:space="preserve">${encoded}</w:t></w:r></w:p>`;
  }
  return xml.replace(/<\/w:p>$/, `<w:r><w:t xml:space="preserve">${encoded}</w:t></w:r></w:p>`);
}

/** Nouveau paragraphe héritant du `<w:pPr>` du modèle fourni. */
function newParagraph(template: string | undefined, text: string): string {
  const pPr = template?.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const rPr = template?.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  const body = text ? `<w:r>${rPr}<w:t xml:space="preserve">${encodeXml(text)}</w:t></w:r>` : "";
  return `<w:p>${pPr}${body}</w:p>`;
}

/**
 * Ouvre un DOCX pour édition. Lève une erreur explicite si le paquet n'est
 * pas un DOCX exploitable (ex. ancien `.doc` binaire).
 */
export async function openDocxDraft(bytes: Uint8Array): Promise<DocxDraft> {
  const zip = await JSZip.loadAsync(bytes).catch(() => null);
  const entry = zip?.file("word/document.xml");
  if (!zip || !entry) {
    throw new Error(t("viewer.word.notDocx"));
  }
  const xml = await entry.async("string");
  const matches = Array.from(xml.matchAll(P_RE));
  const paragraphs = matches.map((m) => paragraphText(m[0]));

  const serialize = async (next: string[]): Promise<Uint8Array> => {
    let cursor = 0;
    let out = "";
    const last = matches.length;
    matches.forEach((m, i) => {
      const start = m.index ?? 0;
      out += xml.slice(cursor, start);
      cursor = start + m[0].length;
      if (i < next.length) {
        out += next[i] === paragraphs[i] ? m[0] : setParagraphText(m[0], next[i]);
      }
      // i >= next.length → paragraphe supprimé : rien n'est réémis.
    });
    out += xml.slice(cursor);

    if (next.length > last) {
      const template = matches[last - 1]?.[0];
      const extra = next
        .slice(last)
        .map((t) => newParagraph(template, t))
        .join("");
      // Toujours avant `<w:sectPr>` (propriétés de section finales).
      out = /<w:sectPr[\s>]/.test(out)
        ? out.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/, (s) => extra + s)
        : out.replace(/<\/w:body>/, `${extra}</w:body>`);
    }

    zip.file("word/document.xml", out);
    return zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
  };

  return { paragraphs, serialize };
}

/** Vrai si l'extension désigne un document Word modifiable en place. */
export function isEditableWord(name: string): boolean {
  return /\.docx$/i.test(name);
}
