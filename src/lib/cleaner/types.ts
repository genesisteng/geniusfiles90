/**
 * Type contracts for the Nettoyeur intelligent (Smart Cleaner) module.
 *
 * A "clean item" is any file or folder that a scanner has proposed for
 * removal. Items always carry their parent `PathRef` and a fully-formed
 * `FileEntry`, so the same delete pipeline (`deleteEntries`) can act on
 * them — the cleaner deliberately reuses the validated soft-delete path
 * used by the rest of the app (moves to Trash on Android, mock removal
 * on the web preview). Nothing is ever hard-deleted.
 *
 * Invariants enforced by the scanner:
 *  - a file belongs to AT MOST one category (no double counting) ;
 *  - a "keeper" duplicate is never proposed for deletion ;
 *  - protected locations (Android/data, obb, system folders) are never
 *    proposed, whatever their name or extension.
 */
import type { FileEntry, PathRef } from "@/lib/files/types";

export type CleanCategoryKey =
  | "duplicates"
  | "large"
  | "old_downloads"
  | "empty_folders"
  | "temp"
  | "extracted_archives"
  | "apk"
  | "messaging_media";

/** Comment la proposition a été établie — affiché à l'utilisateur. */
export type CleanEvidence =
  /** Contenu réellement comparé (empreinte lue sur le disque). */
  | "content"
  /** Taille exacte + nom normalisé identiques. */
  | "size-name"
  /** Règle d'emplacement + âge (jamais l'extension seule). */
  | "location"
  /** Mesure directe (taille, dossier vide). */
  | "measured";

export type CleanItem = {
  /** Stable identity — absolute path when native, PathRef-derived on web. */
  id: string;
  parent: PathRef;
  entry: FileEntry;
  /** Human explanation shown next to the item. */
  reason: string;
  /** Optional group identifier (e.g. duplicate cluster id). */
  group?: string;
  /** Copie conservée d'un groupe de doublons : jamais supprimable. */
  keeper?: boolean;
  /** Base de la proposition, affichée pour rester vérifiable. */
  evidence?: CleanEvidence;
};

/** Cycle de vie d'une catégorie pendant l'analyse. */
export type CleanCategoryStatus = "pending" | "scanning" | "ready";

export type CleanCategory = {
  key: CleanCategoryKey;
  label: string;
  /** One-sentence explanation shown in the category card. */
  description: string;
  items: CleanItem[];
  /** Total recoverable bytes if EVERY item were removed. */
  bytes: number;
  status: CleanCategoryStatus;
  /** `safe` = suppression sans risque, `review` = à vérifier une par une. */
  safety: "safe" | "review";
};

/** Emplacement qui n'a pas pu être lu pendant l'analyse. */
export type CleanScanIssue = {
  path: string;
  reason: string;
};

export type CleanScanPhase = "starting" | "walking" | "matching" | "done";

export type CleanScanResult = {
  categories: Record<CleanCategoryKey, CleanCategory>;
  totalItems: number;
  totalBytes: number;
  scannedFolders: number;
  scannedFiles: number;
  /** Dossier en cours de lecture — retour visuel honnête. */
  currentPath: string | null;
  phase: CleanScanPhase;
  /** Emplacements illisibles (permission, volume retiré…). */
  issues: CleanScanIssue[];
  done: boolean;
  cancelled: boolean;
};

export type CleanScanHandle = {
  cancel: () => void;
};
