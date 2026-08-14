/**
 * Types for the App Manager module.
 *
 * These mirror what the native `listInstalledApps` bridge returns, kept
 * intentionally forward-compatible: fields marked optional are the ones
 * that require newer Android APIs (StorageStatsManager on 26+,
 * UsageStatsManager if the user grants "Usage access") and safely fall
 * back to `0` / `false` on older devices or when access is missing.
 *
 * Reserved fields (aiScore, isDuplicate, updateAvailable) exist so the
 * upcoming AI / backup / update-comparison layers can annotate the same
 * objects without touching the UI shape.
 */

export type InstalledApp = {
  packageName: string;
  label: string;
  versionName: string;
  versionCode: number;
  firstInstallTime: number;
  lastUpdateTime: number;
  isSystem: boolean;
  enabled: boolean;
  sourceDir: string;
  dataDir: string;
  targetSdk: number;
  minSdk: number;
  apkSize: number;
  codeBytes: number;
  dataBytes: number;
  cacheBytes: number;
  totalBytes: number;
  statsAvailable: boolean;
  lastUsed: number;
  usageAvailable: boolean;
  iconBase64?: string;
  // Reserved for future AI / update / duplicate layers.
  aiScore?: number;
  isDuplicate?: boolean;
  updateAvailable?: boolean;
};

export type AppListResult = {
  apps: InstalledApp[];
  statsSupported: boolean;
  usageAvailable: boolean;
  usable: boolean;
  reason?: "not-native" | "no-plugin" | "error";
};

export type AppFilter = "all" | "user" | "system";

export type AppSort = "name" | "size" | "installed" | "updated" | "used";

export type AppLayout = "list" | "grid";

export type AppPermissions = {
  granted: string[];
  declared: string[];
};

export type AppStorageBreakdown = {
  available: boolean;
  codeBytes?: number;
  dataBytes?: number;
  cacheBytes?: number;
  totalBytes?: number;
  error?: string;
};
