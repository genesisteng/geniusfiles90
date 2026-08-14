export type FileKind =
  | "folder"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "code"
  | "app"
  | "other";

export interface FsEntry {
  name: string;
  /** Full path within the current storage root (POSIX style). */
  path: string;
  kind: FileKind;
  isDirectory: boolean;
  size: number;
  mtime: number;
  mime?: string;
}

/**
 * A storage root the file manager can browse. Locations are either
 * addressed via a Capacitor `Directory` enum key (e.g. `ExternalStorage`
 * for the shared internal storage) OR via a raw absolute POSIX path
 * (e.g. `/storage/XXXX-XXXX` for an SD card or USB drive).
 */
export interface StorageLocation {
  id: string;
  label: string;
  hint: string;
  kind: "internal" | "external";
  /** Capacitor Directory key. Mutually exclusive with `absolutePath`. */
  directory?: string;
  /** Absolute POSIX path when the location isn't a Capacitor Directory. */
  absolutePath?: string;
  removable?: boolean;
}

export interface StorageStats {
  total: number;
  free: number;
  used: number;
  percent: number;
  /** Optional per-kind breakdown when we've been able to compute it. */
  breakdown?: Partial<Record<FileKind, number>>;
  approximate?: boolean;
}

export interface OpProgress {
  id: string;
  label: string;
  processed: number;
  total: number;
  status: "running" | "paused" | "done" | "error" | "cancelled";
  message?: string;
}
