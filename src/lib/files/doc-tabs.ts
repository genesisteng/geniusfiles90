import { t } from "@/lib/i18n";
/**
 * Sous-onglets de la catégorie Documents (Toutes / WORD / PDF / TXT / Autres).
 * Le classement se fait sur l'extension, sans re-parcourir le stockage :
 * l'index de catégorie déjà en mémoire est simplement filtré.
 */
export type DocTabId = "all" | "word" | "pdf" | "txt" | "other";

export const DOC_TABS: { id: DocTabId; label: string }[] = [
  { id: "all", label: t("organize.apps.filter.all") },
  { id: "word", label: "WORD" },
  { id: "pdf", label: "PDF" },
  { id: "txt", label: "TXT" },
  { id: "other", label: "Autres" },
];

const WORD = new Set(["doc", "docx", "dot", "dotx", "wps"]);
const PDF = new Set(["pdf"]);
const TXT = new Set([
  "txt",
  "log",
  "csv",
  "tsv",
  "xml",
  "json",
  "ini",
  "cfg",
  "conf",
  "yml",
  "yaml",
]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function isDocTab(x: string): x is DocTabId {
  return DOC_TABS.some((t) => t.id === x);
}

export function matchesDocTab(tab: DocTabId, name: string): boolean {
  if (tab === "all") return true;
  const ext = extOf(name);
  if (tab === "word") return WORD.has(ext);
  if (tab === "pdf") return PDF.has(ext);
  if (tab === "txt") return TXT.has(ext);
  return !WORD.has(ext) && !PDF.has(ext) && !TXT.has(ext);
}
