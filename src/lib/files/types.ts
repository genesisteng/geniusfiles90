/**
 * GeniusFiles — filesystem type contracts.
 *
 * These types are the stable surface between the UI (routes/components)
 * and the native/web bridges. Keeping them free of any Capacitor import
 * lets the app render safely on the Lovable preview and during SSR.
 */

export type FileKind =
  | "folder"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "pdf"
  | "archive"
  | "code"
  | "apk"
  | "text"
  | "font"
  | "other";

export type FileEntry = {
  /** Display name (basename). */
  name: string;
  /** Absolute-ish path inside the current root (segments joined by "/"). */
  path: string;
  /** True when the entry is a directory. */
  isDirectory: boolean;
  /** Bytes — undefined for directories or when unavailable. */
  size?: number;
  /** Last modification timestamp (ms since epoch). */
  mtime?: number;
  /** Coarse category, derived from name/extension. */
  kind: FileKind;
  /** Lowercase extension without the dot, when present. */
  ext?: string;
};

export type StorageRootId =
  | "internal"
  | "documents"
  | "downloads"
  | "pictures"
  | "movies"
  | "music"
  | "sdcard"
  /** Dynamically-detected external volume, e.g. `ext:XXXX-XXXX` (SD card or USB OTG). */
  | `ext:${string}`
  /** Racine libre pointant vers un chemin absolu, ex. `abs:/data/.../trash`. */
  | `abs:${string}`;

export type StorageRoot = {
  id: StorageRootId;
  label: string;
  hint?: string;
  available: boolean;
};

export type PathRef = {
  rootId: StorageRootId;
  /** Relative segments inside the root. Empty array = root of the root. */
  segments: string[];
};

export type SortKey = "name" | "date" | "size" | "type";
export type SortOrder = "asc" | "desc";
export type ViewMode = "list" | "grid";

export type ListingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; entries: FileEntry[] }
  | { status: "empty" }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "error"; message: string };
