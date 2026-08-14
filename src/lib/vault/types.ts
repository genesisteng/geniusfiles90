/**
 * GeniusFiles — Coffre-fort sécurisé — public type contracts.
 *
 * Kept intentionally minimal and dependency-free so the vault API can be
 * imported from any layer (route, component, native bridge helper)
 * without dragging in Capacitor code.
 *
 * Foundations left open on purpose for future modules:
 *  - `encrypted` / `cipherAlgo`  → chiffrement avancé AES-GCM
 *  - `remoteBackupId`             → sauvegarde sécurisée + sync chiffrée
 *  - `sharedLink`                 → partage limité dans le temps
 *  - `albumId`, `privateDocId`    → albums / documents privés
 *  - `accessLog`                  → journal des accès et opérations
 * These fields never leak to the current UI: they're read defensively
 * and stay `undefined` in phase 1.
 */
import type { FileKind, PathRef, StorageRootId } from "@/lib/files/types";

export type VaultAuthMethod = "pin" | "password" | "pattern";

export type VaultCredential = {
  method: VaultAuthMethod;
  /** Hex-encoded PBKDF2 hash of the secret. */
  hash: string;
  /** Hex-encoded random salt, 16 bytes. */
  salt: string;
  /** PBKDF2 iteration count so we can bump it without invalidating older vaults. */
  iterations: number;
  /** True when the user opted in for biometric quick-unlock. */
  biometricEnabled: boolean;
  createdAt: number;
  updatedAt: number;
};

/** Access log entry — foundations for the future audit trail screen. */
export type VaultAccessLogEntry = {
  id: string;
  at: number;
  action:
    | "setup"
    | "unlock"
    | "lock"
    | "unlock.failed"
    | "add"
    | "restore"
    | "delete"
    | "folder.create"
    | "folder.rename"
    | "folder.delete"
    | "favorite"
    | "preferences.update";
  detail?: string;
};

export type VaultFolder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  favorite?: boolean;
};

export type VaultItem = {
  id: string;
  /** User-facing name (original basename). */
  name: string;
  /** null = at the vault root, else a VaultFolder.id. */
  folderId: string | null;
  size: number;
  isDirectory: boolean;
  kind: FileKind;
  ext?: string;
  addedAt: number;
  /**
   * Date réelle du fichier (dernière modification) avant son entrée dans
   * le coffre-fort. Réappliquée à la restauration : l'élément retrouve
   * son ancienneté d'origine au lieu de la date de restauration.
   */
  originalMtime?: number;
  favorite?: boolean;

  /** Original absolute location (native) or mock display path. */
  originalPath: string;
  /** Root + segments of the parent, so we can splice items back into the mock fs. */
  originalRootId?: StorageRootId;
  originalParentSegments?: string[];

  /** Absolute location where the physical file/dir now lives (native). */
  vaultAbsolutePath?: string;
  /** Serialised mock node so we can restore inside the Lovable preview. */
  mockSnapshot?: unknown;

  /* Reserved for future modules — never rendered in phase 1 */
  encrypted?: boolean;
  cipherAlgo?: string;
  remoteBackupId?: string;
  sharedLinkId?: string;
  albumId?: string;
  privateDocId?: string;
};

export type VaultSortKey = "name" | "date" | "size" | "type";
export type VaultSortOrder = "asc" | "desc";

export type VaultListing = {
  folders: VaultFolder[];
  items: VaultItem[];
};

export type VaultAddResult = {
  added: number;
  failed: { name: string; reason: string }[];
  cancelled: boolean;
};

export type VaultRestoreResult = {
  restored: number;
  failed: { id: string; name: string; reason: string }[];
};

export type VaultDeleteResult = {
  deleted: number;
  failed: string[];
};

/**
 * Progress event emitted by long-running vault operations.
 * Shape mirrors `ProgressEvent` from files/operations.ts so the existing
 * `ProgressDialog` can consume it directly.
 */
export type VaultProgress = {
  completed: number;
  total: number;
  bytes: number;
  totalBytes: number;
  currentName: string;
  elapsedMs: number;
  etaMs?: number;
};

export type VaultPath = { folderId: string | null };

export type PublicSource = {
  parent: PathRef;
  /** Basename of the file or folder to move into the vault. */
  name: string;
  isDirectory: boolean;
  size: number;
};
