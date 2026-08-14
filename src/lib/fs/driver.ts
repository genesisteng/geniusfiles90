import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import type { FsEntry, StorageLocation, StorageStats, FileKind } from "./types";
import { kindFromName } from "./kind";
import { ZaStorage, hasZaStorage } from "@/lib/native/za-storage";
import { t } from "@/lib/i18n";

/** True when running inside the Capacitor Android/iOS shell. */
export const isNative = () => Capacitor.isNativePlatform();

function toDirectory(dir?: string): Directory | undefined {
  if (!dir) return undefined;
  return (Directory as unknown as Record<string, Directory>)[dir];
}

/** Build Filesystem args from a location + path, supporting both
 *  Directory-based roots and raw absolute-path roots. */
function args(location: Pick<StorageLocation, "directory" | "absolutePath">, path: string) {
  if (location.absolutePath) {
    const abs = path
      ? `${location.absolutePath}/${path}`.replace(/\/+/g, "/")
      : location.absolutePath;
    return { path: abs } as const;
  }
  return { directory: toDirectory(location.directory), path } as const;
}

export interface ListResult {
  entries: FsEntry[];
  supported: boolean;
  reason?: string;
  needsPermission?: boolean;
}

function friendlyError(err: unknown): { reason: string; needsPermission?: boolean } {
  const raw = err instanceof Error ? err.message : String(err);
  const low = raw.toLowerCase();
  if (low.includes("permission") || low.includes("eacces") || low.includes("denied")) {
    return {
      reason: t("system.accesRefuseParAndroidAutorisezAcces"),
      needsPermission: true,
    };
  }
  if (low.includes("enoent") || low.includes("not exist") || low.includes("no such")) {
    return { reason: t("system.ceDossierNExistePlusOu") };
  }
  if (low.includes("directory not readable")) {
    return { reason: t("system.dossierIllisibleSurCetAppareil") };
  }
  return { reason: raw };
}

/** Low-level listing that skips the platform check — used by location probes. */
export async function listDirRaw(
  location: Pick<StorageLocation, "directory" | "absolutePath">,
  path: string,
): Promise<ListResult> {
  try {
    const res = await Filesystem.readdir(args(location, path));
    const entries: FsEntry[] = res.files.map((f) => {
      const isDirectory = f.type === "directory";
      return {
        name: f.name,
        path: path ? `${path}/${f.name}` : f.name,
        kind: kindFromName(f.name, isDirectory),
        isDirectory,
        size: (f as { size?: number }).size ?? 0,
        mtime: (f as { mtime?: number }).mtime ?? 0,
      };
    });
    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
    return { entries, supported: true };
  } catch (err) {
    const { reason, needsPermission } = friendlyError(err);
    return { entries: [], supported: true, reason, needsPermission };
  }
}

export async function listDir(location: StorageLocation, path: string): Promise<ListResult> {
  if (!isNative()) {
    return {
      entries: [],
      supported: false,
      reason: t("system.leNavigateurNePeutPasAcceder"),
    };
  }
  return listDirRaw(location, path);
}

/** Whether "All files access" (MANAGE_EXTERNAL_STORAGE) has been granted. */
export async function hasStoragePermission(): Promise<boolean> {
  if (!isNative()) return true;
  if (!hasZaStorage()) return true;
  try {
    const { granted } = await ZaStorage.check();
    return granted;
  } catch {
    return false;
  }
}

/** Open the Android "All files access" settings screen for ZarchivAi.
 *  Returns true only when the permission is already granted at call time. */
export async function requestStoragePermission(): Promise<boolean> {
  if (!isNative()) return true;
  if (!hasZaStorage()) return false;
  try {
    const res = await ZaStorage.request();
    return !!res.granted;
  } catch {
    return false;
  }
}

export async function makeDir(location: StorageLocation, path: string): Promise<void> {
  await Filesystem.mkdir({ ...args(location, path), recursive: true } as never);
}

export async function removeEntry(
  location: StorageLocation,
  path: string,
  isDirectory: boolean,
): Promise<void> {
  if (isDirectory) {
    await Filesystem.rmdir({ ...args(location, path), recursive: true } as never);
  } else {
    await Filesystem.deleteFile(args(location, path) as never);
  }
}

export async function rename(location: StorageLocation, from: string, to: string): Promise<void> {
  const a = args(location, from);
  const b = args(location, to);
  await Filesystem.rename({
    ...(a as object),
    from: (a as { path: string }).path,
    to: (b as { path: string }).path,
    toDirectory: (b as { directory?: Directory }).directory,
  } as never);
}

export async function copy(location: StorageLocation, from: string, to: string): Promise<void> {
  const a = args(location, from);
  const b = args(location, to);
  await Filesystem.copy({
    ...(a as object),
    from: (a as { path: string }).path,
    to: (b as { path: string }).path,
    toDirectory: (b as { directory?: Directory }).directory,
  } as never);
}

export async function fileUri(location: StorageLocation, path: string): Promise<string> {
  const r = await Filesystem.getUri(args(location, path) as never);
  return r.uri;
}

export interface EntryStat {
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
  mtime?: number;
  uri?: string;
  error?: string;
}

/** Cheap existence/metadata probe on a single entry. Never throws;
 *  returns `{ exists: false }` (with optional `error`) when unreachable. */
export async function statEntry(location: StorageLocation, path: string): Promise<EntryStat> {
  try {
    const s = (await Filesystem.stat(args(location, path) as never)) as unknown as {
      type?: string;
      size?: number;
      mtime?: number;
      uri?: string;
    };
    return {
      exists: true,
      isDirectory: s.type === "directory",
      size: s.size ?? 0,
      mtime: s.mtime ?? 0,
      uri: s.uri,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // "File does not exist" / ENOENT → not really an error, just absent.
    if (/not exist|enoent|no such/i.test(msg)) return { exists: false };
    return { exists: false, error: msg };
  }
}

/** True iff the entry exists on the filesystem at the moment of the call. */
export async function entryExists(location: StorageLocation, path: string): Promise<boolean> {
  return (await statEntry(location, path)).exists;
}

/** Storage capacity + usage. Uses the native StatFs bridge on Android
 *  (accurate to the byte) and navigator.storage.estimate() as a web fallback. */
export async function getStorageStats(location: StorageLocation): Promise<StorageStats | null> {
  if (isNative() && hasZaStorage()) {
    try {
      const path = location.absolutePath ?? "/storage/emulated/0";
      const s = await ZaStorage.stats({ path });
      if (s.total > 0) {
        return {
          total: s.total,
          free: s.free,
          used: s.used,
          percent: Math.round((s.used / s.total) * 100),
          approximate: false,
        };
      }
    } catch {
      /* fall through */
    }
  }
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const e = await navigator.storage.estimate();
      const total = e.quota ?? 0;
      const used = e.usage ?? 0;
      if (total > 0) {
        return {
          total,
          used,
          free: Math.max(0, total - used),
          percent: Math.round((used / total) * 100),
          approximate: true,
        };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Category breakdown of the immediate contents of a folder. Cheap
 *  aggregation — doesn't recurse to keep large trees responsive. */
export function summarizeByKind(entries: FsEntry[]): Partial<Record<FileKind, number>> {
  const out: Partial<Record<FileKind, number>> = {};
  for (const e of entries) {
    if (e.isDirectory) continue;
    out[e.kind] = (out[e.kind] ?? 0) + (e.size || 0);
  }
  return out;
}
