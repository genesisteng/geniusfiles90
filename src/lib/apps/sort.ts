/**
 * Pure sort / filter helpers for the App Manager. Kept out of the
 * React component so they can be reused later by AI insights and the
 * "duplicates / unused" detection layers.
 */
import type { AppFilter, AppSort, InstalledApp } from "./types";

export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function filterApps(apps: InstalledApp[], filter: AppFilter, query: string): InstalledApp[] {
  const q = normalizeName(query);
  return apps.filter((a) => {
    if (filter === "user" && a.isSystem) return false;
    if (filter === "system" && !a.isSystem) return false;
    if (!q) return true;
    return normalizeName(a.label).includes(q) || normalizeName(a.packageName).includes(q);
  });
}

export function sortApps(apps: InstalledApp[], sort: AppSort): InstalledApp[] {
  const arr = [...apps];
  switch (sort) {
    case "name":
      arr.sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }));
      break;
    case "size":
      arr.sort((a, b) => (b.totalBytes || b.apkSize) - (a.totalBytes || a.apkSize));
      break;
    case "installed":
      arr.sort((a, b) => b.firstInstallTime - a.firstInstallTime);
      break;
    case "updated":
      arr.sort((a, b) => b.lastUpdateTime - a.lastUpdateTime);
      break;
    case "used":
      arr.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
      break;
  }
  return arr;
}

export type AppStats = {
  total: number;
  user: number;
  system: number;
  totalBytes: number;
  userBytes: number;
  systemBytes: number;
  largest: InstalledApp[];
  recentlyInstalled: InstalledApp[];
  recentlyUpdated: InstalledApp[];
  unused: InstalledApp[];
  heavy: InstalledApp[];
  reclaimableBytes: number;
};

const UNUSED_DAYS = 60;
const HEAVY_BYTES = 250 * 1024 * 1024;

export function computeStats(apps: InstalledApp[]): AppStats {
  const now = Date.now();
  let totalBytes = 0;
  let userBytes = 0;
  let systemBytes = 0;
  let user = 0;
  let system = 0;
  for (const a of apps) {
    const size = a.totalBytes || a.apkSize;
    totalBytes += size;
    if (a.isSystem) {
      system++;
      systemBytes += size;
    } else {
      user++;
      userBytes += size;
    }
  }
  const bySize = [...apps].sort(
    (a, b) => (b.totalBytes || b.apkSize) - (a.totalBytes || a.apkSize),
  );
  const byInstall = [...apps].sort((a, b) => b.firstInstallTime - a.firstInstallTime);
  const byUpdate = [...apps].sort((a, b) => b.lastUpdateTime - a.lastUpdateTime);
  const unused = apps.filter(
    (a) =>
      !a.isSystem &&
      a.usageAvailable &&
      a.lastUsed > 0 &&
      now - a.lastUsed > UNUSED_DAYS * 24 * 60 * 60 * 1000,
  );
  const heavy = apps.filter((a) => !a.isSystem && (a.totalBytes || a.apkSize) >= HEAVY_BYTES);
  const reclaimableBytes =
    unused.reduce((s, a) => s + (a.totalBytes || a.apkSize), 0) +
    heavy
      .filter((a) => !unused.some((u) => u.packageName === a.packageName))
      .reduce((s, a) => s + Math.round(a.cacheBytes || 0), 0);

  return {
    total: apps.length,
    user,
    system,
    totalBytes,
    userBytes,
    systemBytes,
    largest: bySize.slice(0, 5),
    recentlyInstalled: byInstall.slice(0, 5),
    recentlyUpdated: byUpdate.slice(0, 5),
    unused: unused.slice(0, 10),
    heavy: heavy.slice(0, 10),
    reclaimableBytes,
  };
}
