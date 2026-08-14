/**
 * Native bridge to the GeniusFiles Android plugin.
 *
 * The plugin exposes exactly what a file manager needs:
 *   - MANAGE_EXTERNAL_STORAGE probing / requesting
 *   - Real device storage statistics (StatFs on the primary volume)
 *   - java.io.File-based directory listing that works once the "all files"
 *     permission has been granted.
 *
 * Web / SSR calls resolve to `null` so the same modules can render inside
 * the Lovable preview without a native runtime.
 */
import { registerPlugin } from "@capacitor/core";

import { isNativeRuntime, nativePlatform } from "./platform";
import { t } from "@/lib/i18n";

export type StoragePermissionState = "granted" | "denied" | "unavailable";

export type NativeStoragePermissionPayload = {
  granted: boolean;
  sdk: number;
  requiresSettings?: boolean;
  openedSettings?: boolean;
  destination?: string;
};

export type StoragePermissionRequestResult = {
  ok: boolean;
  state: StoragePermissionState;
  openedSettings: boolean;
  destination?: string;
  requiresSettings?: boolean;
  message?: string;
};

export type NativeStorageStats = {
  total: number;
  free: number;
  used: number;
  path: string;
};

export type NativeStorageVolume = {
  path: string;
  primary: boolean;
  removable: boolean;
  state: string;
  label: string;
  uuid?: string;
  kind: "internal" | "sdcard" | "usb" | "external";
  total: number;
  free: number;
  used: number;
};

export type NativeDirEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: number;
};

export type NativeListing = {
  path: string;
  entries: NativeDirEntry[];
};

export type NativeStat = NativeDirEntry & {
  recursiveSize?: number;
  itemCount?: number;
};

export type NativeTrashItem = {
  id: string;
  trashPath: string;
  originalPath: string;
  name: string;
  isDirectory: boolean;
  size: number;
  deletedAt: number;
};

export type NativeTrashListing = {
  items: NativeTrashItem[];
  totalBytes: number;
  trashPath: string;
};

export type NativeRestoreResult = {
  restored: { id: string; restoredPath: string }[];
  failed: {
    id: string;
    reason: "MISSING" | "NO_TARGET" | "PARENT_MISSING" | "MOVE_FAILED";
    originalPath?: string;
  }[];
};

export type NativeArchiveEntry = {
  name: string;
  isDirectory: boolean;
  size: number;
  compressedSize: number;
  mtime: number;
  crc: number;
};

export type NativeArchiveListing = {
  path: string;
  format: string;
  archiveSize: number;
  mtime: number;
  fileCount: number;
  dirCount: number;
  totalUncompressed: number;
  entries: NativeArchiveEntry[];
};

export type NativeArchiveProgress = {
  completed: number;
  total: number;
  bytes: number;
  totalBytes: number;
  currentName: string;
};

export type NativeAppSigningInfo = {
  packageName: string;
  certificates: {
    sha1: string;
    sha256: string;
    subject?: string;
  }[];
};

type Plugin = {
  checkAllFilesAccess: () => Promise<NativeStoragePermissionPayload>;
  requestAllFilesAccess: () => Promise<NativeStoragePermissionPayload>;
  getStorageStats: () => Promise<NativeStorageStats>;
  getAppSigningInfo?: () => Promise<NativeAppSigningInfo>;
  listStorageVolumes?: () => Promise<{ volumes: NativeStorageVolume[] }>;
  getVolumeStats?: (opts: { path: string }) => Promise<NativeStorageStats>;
  rootPath: () => Promise<{ path: string }>;
  listDirectory: (opts: { path: string }) => Promise<NativeListing>;
  statDirectory?: (opts: { path: string }) => Promise<{
    path: string;
    mtime: number;
    count: number;
  }>;
  stat: (opts: { path: string }) => Promise<NativeStat>;
  /**
   * Contrôle groupé d'existence — un seul passage du pont natif pour
   * vérifier N chemins après une opération. Optionnel : les APK plus
   * anciens n'exposent pas la méthode, le JS retombe alors sur `stat`.
   */
  existsBatch?: (opts: { paths: string[] }) => Promise<{
    present: string[];
    missing: string[];
  }>;
  createDirectory: (opts: { path: string }) => Promise<{ path: string }>;

  renamePath: (opts: { path: string; newName: string }) => Promise<{ path: string }>;
  copyFile: (opts: {
    source: string;
    destination: string;
    overwrite?: boolean;
  }) => Promise<{ path: string; size: number }>;
  moveFile: (opts: {
    source: string;
    destination: string;
    overwrite?: boolean;
  }) => Promise<{ path: string }>;
  deletePath: (opts: { path: string }) => Promise<void>;
  moveToTrash: (opts: { paths: string[] }) => Promise<{
    moved: { id: string; originalPath: string; trashPath: string }[];
    failed: string[];
  }>;
  listTrash: () => Promise<NativeTrashListing>;
  restoreFromTrash: (opts: {
    items: { id: string; targetPath?: string }[];
  }) => Promise<NativeRestoreResult>;
  permanentDeleteInTrash: (opts: {
    ids: string[];
  }) => Promise<{ deleted: string[]; failed: string[] }>;
  emptyTrash: () => Promise<{ deleted: number; failed: number }>;
  shareFiles: (opts: { paths: string[] }) => Promise<void>;
  openFile: (opts: { path: string }) => Promise<{ opened: boolean }>;
  /* Paquets Android (APK) — installation réelle via l'installateur système. */
  canInstallPackages?: () => Promise<{ allowed: boolean }>;
  openInstallPermissionSettings?: () => Promise<{ screen: string }>;
  packageInfo?: (opts: { path: string }) => Promise<NativePackageInfo>;
  installPackage?: (opts: { path: string }) => Promise<{ started: boolean }>;
  archiveInfo: () => Promise<{
    supportedCreate: string[];
    supportedRead: string[];
    passwordSupported: boolean;
    splitSupported: boolean;
  }>;
  listArchive: (opts: { path: string }) => Promise<NativeArchiveListing>;
  createZipArchive: (opts: {
    sources: string[];
    destination: string;
    level?: number;
    overwrite?: boolean;
  }) => Promise<{ path: string; size: number; fileCount: number }>;
  extractArchive: (opts: {
    source: string;
    destination: string;
    entries?: string[];
    conflict?: "replace" | "skip" | "rename" | "keepBoth";
  }) => Promise<{ path: string; completed: number; skipped: number; overwritten: number }>;
  readFileBase64: (opts: { path: string }) => Promise<{ data: string; size: number }>;
  writeFileBase64: (opts: {
    path: string;
    data: string;
    overwrite?: boolean;
  }) => Promise<{ path: string; size: number }>;

  addListener?: {
    (
      event: "archiveProgress" | "extractProgress",
      handler: (payload: NativeArchiveProgress) => void,
    ): Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
    (
      event: "storagePermissionChanged",
      handler: (payload: NativeStoragePermissionPayload) => void,
    ): Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
    (
      event: "storageVolumesChanged",
      handler: (payload: { volumes: NativeStorageVolume[] }) => void,
    ): Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
  };
};

const nativeProxy = registerPlugin<Plugin>("GeniusFilesNative");

/**
 * Accès typé au *même* proxy `GeniusFilesNative`. À utiliser partout ailleurs :
 * appeler `registerPlugin("GeniusFilesNative")` une seconde fois déclenche
 * l'avertissement Capacitor « Cannot register plugins twice ».
 */
export function nativeBridge<T>(): T {
  return nativeProxy as unknown as T;
}

export function nativePlugin(): Plugin | null {
  return plugin();
}

export function isAndroidNative(): boolean {
  return isNativeRuntime() && nativePlatform() === "android";
}

function plugin(): Plugin | null {
  if (!isAndroidNative()) return null;
  const w = window as unknown as {
    Capacitor?: { Plugins?: Record<string, unknown> };
  };
  const p = w.Capacitor?.Plugins?.GeniusFilesNative as Plugin | undefined;
  // Capacitor 8 may expose manually registered plugins through the proxy even
  // when `window.Capacitor.Plugins.*` is not populated yet. Always keep that
  // proxy as a fallback so the permission button never becomes a silent no-op.
  return p ?? nativeProxy;
}

export async function checkAllFilesAccess(): Promise<StoragePermissionState> {
  if (!isAndroidNative()) return "unavailable";
  const p = plugin();
  // Plugin missing on a native build means the Kotlin plugin failed to
  // register (bad merge, wrong build). Treat as "denied" so the onboarding
  // gate re-prompts the user rather than silently letting listings fail.
  if (!p) return "denied";
  try {
    const { granted } = await p.checkAllFilesAccess();
    return granted ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

export async function requestAllFilesAccess(): Promise<StoragePermissionRequestResult> {
  const p = plugin();
  if (!p) {
    return {
      ok: false,
      state: "denied",
      openedSettings: false,
      message: friendlyError("DENIED"),
    };
  }
  try {
    const payload = await p.requestAllFilesAccess();
    const state = payload.granted ? "granted" : "denied";
    return {
      ok: true,
      state,
      openedSettings: payload.openedSettings === true,
      destination: payload.destination,
      requiresSettings: payload.requiresSettings,
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      state: "denied",
      openedSettings: false,
      message: friendlyError(raw),
    };
  }
}

export function onStoragePermissionChanged(
  handler: (state: StoragePermissionState) => void,
): () => void {
  const p = plugin();
  if (!p?.addListener || !isAndroidNative()) return () => {};
  let active = true;
  let handle: Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> } | null =
    null;

  try {
    handle = p.addListener("storagePermissionChanged", (payload) => {
      if (!active || !("granted" in payload)) return;
      handler(payload.granted ? "granted" : "denied");
    });
  } catch {
    return () => {};
  }

  return () => {
    active = false;
    Promise.resolve(handle)
      .then((h) => h?.remove?.())
      .catch(() => {});
  };
}

export async function getStorageStats(): Promise<NativeStorageStats | null> {
  const p = plugin();
  if (!p) return null;
  try {
    return await p.getStorageStats();
  } catch {
    return null;
  }
}

export async function getAppSigningInfo(): Promise<NativeAppSigningInfo | null> {
  const p = plugin();
  if (!p?.getAppSigningInfo) return null;
  try {
    return await p.getAppSigningInfo();
  } catch {
    return null;
  }
}

/**
 * List every mounted storage volume (primary, SD card, USB OTG…) with
 * per-volume capacity. Returns [] on web and when the plugin is missing.
 */
export async function listStorageVolumes(): Promise<NativeStorageVolume[]> {
  const p = plugin();
  if (!p?.listStorageVolumes) return [];
  try {
    const res = await p.listStorageVolumes();
    return Array.isArray(res?.volumes) ? res.volumes : [];
  } catch {
    return [];
  }
}

/** Per-volume StatFs. Uses the absolute mount path (e.g. /storage/XXXX-XXXX). */
export async function getVolumeStats(path: string): Promise<NativeStorageStats | null> {
  const p = plugin();
  if (!p?.getVolumeStats) return null;
  try {
    return await p.getVolumeStats({ path });
  } catch {
    return null;
  }
}

export function onStorageVolumesChanged(
  handler: (volumes: NativeStorageVolume[]) => void,
): () => void {
  const p = plugin();
  if (!p?.addListener || !isAndroidNative()) return () => {};
  let active = true;
  let handle: Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> } | null =
    null;
  try {
    handle = p.addListener("storageVolumesChanged", (payload) => {
      if (!active) return;
      handler(Array.isArray(payload?.volumes) ? payload.volumes : []);
    });
  } catch {
    return () => {};
  }
  return () => {
    active = false;
    Promise.resolve(handle)
      .then((h) => h?.remove?.())
      .catch(() => {});
  };
}

export async function getRootPath(): Promise<string | null> {
  const p = plugin();
  if (!p) return null;
  try {
    const { path } = await p.rootPath();
    return path;
  } catch {
    return null;
  }
}

/**
 * Ouvre un fichier avec l'application par défaut de l'utilisateur
 * (ACTION_VIEW + FileProvider côté Android).
 */
export async function openNativeFile(
  path: string,
): Promise<
  { ok: true } | { ok: false; reason: "no_app" | "not_found" | "denied" | "error"; message: string }
> {
  const p = plugin();
  if (!p?.openFile) {
    return { ok: false, reason: "error", message: friendlyError("unavailable") };
  }
  try {
    await p.openFile({ path });
    return { ok: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/NO_APP/i.test(raw))
      return {
        ok: false,
        reason: "no_app",
        message: t("system.native.openFailed.noApp"),
      };
    if (/NOT_FOUND/i.test(raw))
      return { ok: false, reason: "not_found", message: t("system.native.fileGone") };
    if (/DENIED/i.test(raw))
      return { ok: false, reason: "denied", message: friendlyError("DENIED") };
    return { ok: false, reason: "error", message: friendlyError(raw) };
  }
}

/**
 * Map raw plugin errors / native codes to short French messages the UI can
 * render as-is. Never surface "Plugin unavailable" or English stack traces
 * to the end user.
 */
function friendlyError(raw: string): string {
  const m = raw || "";
  if (/SETTINGS_UNAVAILABLE|ActivityNotFound|not implemented|unavailable|Plugin/i.test(m)) {
    return t("system.native.settingsUnavailable");
  }
  if (/DENIED|permission|not allowed|not permitted/i.test(m))
    return t("system.native.storagePermission");
  if (/NOT_FOUND|no such|NOT_A_DIRECTORY/i.test(m)) return t("system.native.folderGone");
  if (/EXISTS/i.test(m)) return t("system.native.nameExists");
  if (/UNSUPPORTED/i.test(m)) return t("system.native.unsupported");
  return t("system.native.storageUnavailable");
}

export async function listNativeDirectory(
  path: string,
): Promise<
  | { ok: true; listing: NativeListing }
  | { ok: false; reason: "denied" | "not_found" | "error"; message?: string }
> {
  const p = plugin();
  if (!p) {
    // Native build without the plugin registered — surface as "denied" so
    // the permission gate can guide the user, never as a raw English error.
    return { ok: false, reason: "denied", message: friendlyError("DENIED") };
  }
  try {
    const listing = await p.listDirectory({ path });
    return { ok: true, listing };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const message = friendlyError(raw);
    if (/DENIED|permission|not allowed/i.test(raw)) {
      return { ok: false, reason: "denied", message };
    }
    if (/NOT_FOUND|no such|NOT_A_DIRECTORY/i.test(raw)) {
      return { ok: false, reason: "not_found", message };
    }
    return { ok: false, reason: "error", message };
  }
}

/* ---------- Paquets Android (APK / AAB / XAPK) ---------- */

/**
 * Métadonnées d'un paquet Android lues via `PackageManager
 * .getPackageArchiveInfo` : seule l'entrée AndroidManifest.xml du fichier
 * est analysée, jamais l'intégralité de l'APK.
 */
export type NativePackageInfo = {
  path: string;
  size: number;
  mtime: number;
  valid: boolean;
  label?: string;
  /** Icône réelle du paquet, encodée en data-URL PNG (base64). */
  iconBase64?: string;

  packageName?: string;
  versionName?: string;
  versionCode?: number;
  minSdk?: number;
  targetSdk?: number;
  compatible?: boolean;
  installed?: boolean;
  installedVersionName?: string;
  error?: string;
};

export type InstallOutcome =
  | { ok: true }
  | {
      ok: false;
      reason: "unavailable" | "needs_permission" | "not_found" | "denied" | "invalid" | "error";
      message: string;
    };

/** L'autorisation « installer des applications inconnues » est-elle accordée ? */
export async function canInstallPackages(): Promise<boolean> {
  const p = plugin();
  if (!p?.canInstallPackages) return false;
  try {
    const { allowed } = await p.canInstallPackages();
    return !!allowed;
  } catch {
    return false;
  }
}

/** Ouvre le réglage Android correspondant (sources inconnues). */
export async function openInstallPermissionSettings(): Promise<boolean> {
  const p = plugin();
  if (!p?.openInstallPermissionSettings) return false;
  try {
    await p.openInstallPermissionSettings();
    return true;
  } catch {
    return false;
  }
}

/** Lit les métadonnées d'un APK (léger : manifeste uniquement). */
export async function readPackageInfo(path: string): Promise<NativePackageInfo | null> {
  const p = plugin();
  if (!p?.packageInfo) return null;
  try {
    return await p.packageInfo({ path });
  } catch {
    return null;
  }
}

/** Lance l'installateur système Android pour un .apk réel. */
export async function installNativePackage(path: string): Promise<InstallOutcome> {
  const p = plugin();
  if (!p?.installPackage) {
    return {
      ok: false,
      reason: "unavailable",
      message: t("system.native.installUnavailable"),
    };
  }
  try {
    await p.installPackage({ path });
    return { ok: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/NEEDS_PERMISSION/i.test(raw))
      return {
        ok: false,
        reason: "needs_permission",
        message: t("system.native.installNeedsPermission"),
      };
    if (/NOT_FOUND/i.test(raw))
      return { ok: false, reason: "not_found", message: t("system.native.fileGone") };
    if (/NOT_INSTALLABLE/i.test(raw))
      return { ok: false, reason: "invalid", message: t("system.native.notInstallable") };
    if (/NO_INSTALLER/i.test(raw))
      return {
        ok: false,
        reason: "error",
        message: t("system.native.noInstallerAvailable"),
      };
    if (/DENIED/i.test(raw))
      return { ok: false, reason: "denied", message: friendlyError("DENIED") };
    return { ok: false, reason: "error", message: friendlyError(raw) };
  }
}
