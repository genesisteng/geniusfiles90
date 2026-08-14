/**
 * GeniusFiles — moteur d'organisation intelligente.
 *
 * Types partagés. Rien n'est jamais appliqué sans validation explicite :
 * le moteur produit un `OrgReport` (diagnostic), une liste
 * `OrgRecommendation` (propositions humaines) et un `OrgPlan` sérialisable
 * (actions concrètes rejouables). L'exécution passe intégralement par
 * `@/lib/files/operations` — donc l'historique et la Corbeille assurent
 * un « annuler » gratuit.
 *
 * Zone réservée pour extensions futures.
 */
import type { FileEntry, FileKind, PathRef, StorageRootId } from "@/lib/files/types";

/* ---------- catégories logiques ---------- */

export type OrgCategoryId =
  | "admin"
  | "factures"
  | "contrats"
  | "photos"
  | "videos"
  | "musique"
  | "telechargements"
  | "archives"
  | "captures"
  | "scans"
  | "code"
  | "apk"
  | "polices"
  | "autres";

export type OrgCategory = {
  id: OrgCategoryId;
  label: string;
  /** Dossier suggéré sous la racine interne (segments). */
  suggestedFolder: string[];
  /** Kinds « natifs ». */
  kinds: FileKind[];
};

/* ---------- diagnostic ---------- */

export type OrgIssueKind =
  | "messy_folder" // mélange fort de kinds
  | "overloaded_folder" // > seuil de fichiers
  | "misplaced_file" // kind ≠ dossier attendu
  | "unclear_name" // IMG_*, Screenshot_*, « Nouveau document (2) »…
  | "isolated_files" // fichiers seuls regroupables
  | "hard_to_browse"; // profondeur / mixité globale

export type OrgIssue = {
  id: string;
  kind: OrgIssueKind;
  severity: "info" | "warn" | "danger";
  path: PathRef;
  label: string;
  detail: string;
  /** Fichiers concernés (facultatif — pour issues locales). */
  entries?: FileEntry[];
  /** Chiffres bruts (taille, nb, %). */
  metrics?: Record<string, number>;
};

export type OrgReport = {
  generatedAt: number;
  scannedFolders: number;
  scannedFiles: number;
  totalBytes: number;
  issues: OrgIssue[];
  /** Fichiers récemment ajoutés non classés. */
  recentlyAdded: { entry: FileEntry; parent: PathRef }[];
  /** Distribution actuelle par catégorie (compte + octets). */
  distribution: Partial<Record<OrgCategoryId, { count: number; bytes: number }>>;
  /** Espace potentiellement mieux organisable (octets). */
  reorganizableBytes: number;
};

/* ---------- recommandations & plans ---------- */

export type OrgActionKind =
  | "move" // vers un dossier existant/créé
  | "rename" // via propositions du renommeur
  | "group" // créer un dossier + y déplacer
  | "archive" // envelopper dans un dossier « Archives »
  | "collection_add"; // rattacher à une collection (virtuel)

export type OrgActionMove = {
  kind: "move";
  from: PathRef;
  entryName: string;
  toParent: PathRef;
  createParent?: boolean;
  /** Raison lisible. */
  reason: string;
};
export type OrgActionRename = {
  kind: "rename";
  parent: PathRef;
  from: string;
  to: string;
  reason: string;
};
export type OrgActionGroup = {
  kind: "group";
  parent: PathRef;
  folderName: string;
  entryNames: string[];
  reason: string;
};
export type OrgActionArchive = {
  kind: "archive";
  parent: PathRef;
  entryNames: string[];
  reason: string;
};
export type OrgActionCollection = {
  kind: "collection_add";
  collectionId: string;
  entry: FileEntry;
  parent: PathRef;
  reason: string;
};

export type OrgAction =
  | OrgActionMove
  | OrgActionRename
  | OrgActionGroup
  | OrgActionArchive
  | OrgActionCollection;

export type OrgPlan = {
  id: string;
  title: string;
  description: string;
  actions: OrgAction[];
  /** Actions qui écrivent réellement le disque. */
  destructive: boolean;
};

export type OrgRecommendation = {
  id: string;
  severity: "info" | "warn" | "danger";
  title: string;
  /** Explication en français simple : pourquoi cette action ? */
  why: string;
  cta: string;
  plan: OrgPlan;
  /** Issue d'origine si applicable. */
  issueId?: string;
};

/* ---------- aperçu / preview ---------- */

export type OrgPreviewNode = {
  parent: PathRef;
  before: string[];
  after: string[];
  /** Ajouts, renommages, retraits. */
  additions: string[];
  removals: string[];
  renames: { from: string; to: string }[];
};

export type OrgPreview = {
  planId: string;
  nodes: OrgPreviewNode[];
  createdFolders: PathRef[];
};

/* ---------- renommage intelligent ---------- */

export type RenameProposal = {
  entryName: string;
  parent: PathRef;
  proposed: string;
  /** Utilisateur peut éditer sur place. */
  edited?: string;
  /** Sélectionné pour application. */
  selected: boolean;
  reason: string;
  signals: string[];
};

/* ---------- collections dynamiques ---------- */

export type CollectionRuleClause =
  | { kind: "kind"; kinds: FileKind[] }
  | { kind: "ext"; exts: string[] }
  | { kind: "name_regex"; pattern: string }
  | { kind: "doctype"; types: string[] } // via AnalysisRecord.content.docType
  | { kind: "path_contains"; needles: string[] }
  | {
      kind: "flag";
      flag: "isScreenshot" | "isDocument" | "isReceipt" | "isInvoice" | "isBusinessCard";
    }
  | { kind: "mtime_within_days"; days: number };

export type CollectionRule = {
  /** Toutes les clauses doivent matcher (ET logique). */
  all?: CollectionRuleClause[];
  /** Au moins une clause doit matcher (OU logique). Prioritaire sur `all`. */
  any?: CollectionRuleClause[];
};

export type SmartCollection = {
  id: string;
  label: string;
  icon?: string;
  rule: CollectionRule;
};

export type CollectionMatch = {
  collectionId: string;
  entries: { entry: FileEntry; parent: PathRef }[];
  totalBytes: number;
};

/* ---------- exécution ---------- */

export type OrgProgress = {
  processed: number;
  total: number;
  currentLabel?: string;
};

export type OrgExecutionResult = {
  ok: boolean;
  applied: number;
  failed: { action: OrgAction; reason: string }[];
  cancelled: boolean;
};

/* ---------- entrée générique parcourue ---------- */

export type ScannedEntry = {
  entry: FileEntry;
  parent: PathRef;
  rootId: StorageRootId;
};
