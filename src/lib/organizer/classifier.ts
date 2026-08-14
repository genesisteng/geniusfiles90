/**
 * Classifieur multi-signaux.
 *
 * Combine extension / kind / dossier d'origine / record d'analyse (docType,
 * flags OCR) pour produire une catégorie logique stable. 100 % local.
 */
import type { FileEntry, PathRef } from "@/lib/files/types";
import { getAnalysis } from "@/lib/analysis";
import type { OrgCategory, OrgCategoryId } from "./types";
import { t } from "@/lib/i18n";

export const CATEGORIES: Record<OrgCategoryId, OrgCategory> = {
  admin: {
    id: "admin",
    label: "Documents administratifs",
    suggestedFolder: ["Documents", "Administratif"],
    kinds: ["document", "pdf"],
  },
  factures: {
    id: "factures",
    label: "Factures",
    suggestedFolder: ["Documents", "Factures"],
    kinds: ["document", "pdf"],
  },
  contrats: {
    id: "contrats",
    label: "Contrats",
    suggestedFolder: ["Documents", "Contrats"],
    kinds: ["document", "pdf"],
  },
  photos: {
    id: "photos",
    label: "Photos",
    suggestedFolder: ["Pictures"],
    kinds: ["image"],
  },
  videos: {
    id: "videos",
    label: t("home.category.videos"),
    suggestedFolder: ["Movies"],
    kinds: ["video"],
  },
  musique: {
    id: "musique",
    label: "Musique",
    suggestedFolder: ["Music"],
    kinds: ["audio"],
  },
  telechargements: {
    id: "telechargements",
    label: t("home.category.downloads"),
    suggestedFolder: ["Download"],
    kinds: ["other"],
  },
  archives: {
    id: "archives",
    label: "Archives",
    suggestedFolder: ["Documents", "Archives"],
    kinds: ["archive"],
  },
  captures: {
    id: "captures",
    label: t("organize.capturesDEcran"),
    suggestedFolder: ["Pictures", "Screenshots"],
    kinds: ["image"],
  },
  scans: {
    id: "scans",
    label: t("organize.documentsNumerises"),
    suggestedFolder: ["Documents", "Scans"],
    kinds: ["image", "pdf"],
  },
  code: {
    id: "code",
    label: "Code",
    suggestedFolder: ["Documents", "Code"],
    kinds: ["code"],
  },
  apk: {
    id: "apk",
    label: "Applications",
    suggestedFolder: ["Download", "Apps"],
    kinds: ["apk"],
  },
  polices: {
    id: "polices",
    label: "Polices",
    suggestedFolder: ["Documents", "Polices"],
    kinds: ["font"],
  },
  autres: {
    id: "autres",
    label: "Autres",
    suggestedFolder: ["Documents", "Autres"],
    kinds: ["other"],
  },
};

const NAME_PATTERNS: { rx: RegExp; id: OrgCategoryId }[] = [
  { rx: /screenshot|capture[- ]?ecran|screen[- ]?shot/i, id: "captures" },
  { rx: /scan[- ]?doc|doc[- ]?scan|numeris(e|ation)/i, id: "scans" },
  { rx: /facture|invoice|receipt|recu|ticket/i, id: "factures" },
  { rx: /contrat|contract|bail|accord/i, id: "contrats" },
  { rx: /cv|resume|attestation|releve|declaration|impots|taxe/i, id: "admin" },
];

export function classify(entry: FileEntry, parent: PathRef): OrgCategoryId {
  if (entry.isDirectory) return "autres";
  const record = getAnalysis(parent, entry);
  const img = record?.image;
  const content = record?.content;

  // Signaux visuels prioritaires
  if (img?.isScreenshot) return "captures";
  if (img?.isReceipt || img?.isInvoice) return "factures";
  if (img?.isBusinessCard) return "admin";
  if (img?.isDocument) return "scans";

  // docType via extraction texte
  if (content?.docType === "facture" || content?.docType === "recu") return "factures";
  if (content?.docType === "contrat") return "contrats";
  if (content?.docType === "cv" || content?.docType === "rapport") return "admin";

  // Dossier d'origine
  const path = parent.segments.join("/").toLowerCase();
  if (/screenshots?/.test(path)) return "captures";
  if (/download|telecharg/.test(path) && entry.kind !== "image" && entry.kind !== "video") {
    if (entry.kind === "apk") return "apk";
    if (entry.kind === "archive") return "archives";
    return "telechargements";
  }
  if (/dcim|camera|pictures/.test(path) && entry.kind === "image") return "photos";
  if (/music/.test(path) && entry.kind === "audio") return "musique";
  if (/movies|videos/.test(path) && entry.kind === "video") return "videos";

  // Nom du fichier
  for (const p of NAME_PATTERNS) if (p.rx.test(entry.name)) return p.id;

  // Kind par défaut
  switch (entry.kind) {
    case "image":
      return "photos";
    case "video":
      return "videos";
    case "audio":
      return "musique";
    case "archive":
      return "archives";
    case "apk":
      return "apk";
    case "code":
      return "code";
    case "font":
      return "polices";
    case "pdf":
    case "document":
      return "admin";
    default:
      return "autres";
  }
}

export function categoryOf(id: OrgCategoryId): OrgCategory {
  return CATEGORIES[id];
}

export function listCategories(): OrgCategory[] {
  return Object.values(CATEGORIES);
}
