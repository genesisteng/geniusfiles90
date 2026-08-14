/**
 * Dashboard recommendations engine.
 *
 * Purely informative for now — every recommendation points the user
 * to the right screen but never triggers an action automatically.
 */
import type { StorageStats } from "@/lib/native/use-storage-stats";
import type { ScanResult } from "./analyzer";
import type { FreeSnapshot } from "./snapshots";
import { formatSize } from "./format";
import { t } from "@/lib/i18n";

export type RecommendationSeverity = "info" | "warn" | "danger";

export type Recommendation = {
  id: string;
  severity: RecommendationSeverity;
  title: string;
  description: string;
  ctaLabel?: string;
  to?: string;
};

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

export function buildRecommendations(
  stats: StorageStats | null,
  scan: ScanResult | null,
  snapshots: FreeSnapshot[],
  trash?: { count: number; bytes: number } | null,
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (stats) {
    if (stats.usedPct >= 92) {
      recs.push({
        id: "storage-critical",
        severity: "danger",
        title: t("home.rec.storageCritical.title"),
        description: t("home.rec.storageCritical.description", {
          free: formatSize(stats.free),
          total: formatSize(stats.total),
        }),
        ctaLabel: t("home.rec.free"),
        to: "/nettoyeur",
      });
    } else if (stats.usedPct >= 80) {
      recs.push({
        id: "storage-warn",
        severity: "warn",
        title: t("home.rec.storageWarn.title"),
        description: t("home.rec.storageWarn.description", {
          pct: Math.round(stats.usedPct),
        }),
        ctaLabel: t("home.rec.analyze"),
        to: "/nettoyeur",
      });
    }
  }

  if (snapshots.length >= 3) {
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const delta = first.free - last.free;
    // >2 Go perdus sur la fenêtre = tendance à surveiller.
    if (delta > 2 * GB) {
      recs.push({
        id: "trend-down",
        severity: "warn",
        title: t("home.rec.trendDown.title"),
        description: t("home.rec.trendDown.description", { delta: formatSize(delta) }),
        ctaLabel: t("ops.recommendations.trendDown.cta"),
      });
    }
  }

  if (scan && scan.totalFiles > 0) {
    const apk = scan.categories.apk;
    if (apk.bytes > 300 * MB) {
      recs.push({
        id: "apk",
        severity: "info",
        title: t("home.rec.apk.title", { count: apk.count }),
        description: t("home.rec.apk.description", { size: formatSize(apk.bytes) }),
        ctaLabel: t("home.rec.open"),
        to: "/",
      });
    }
    const archive = scan.categories.archive;
    if (archive.bytes > GB) {
      recs.push({
        id: "archive",
        severity: "info",
        title: t("home.rec.archive.title"),
        description: t("home.rec.archive.description", { size: formatSize(archive.bytes) }),
      });
    }
    const video = scan.categories.video;
    if (video.bytes > 5 * GB) {
      recs.push({
        id: "video",
        severity: "info",
        title: t("ops.recommendations.video.title"),
        description: t("home.rec.video.description", { size: formatSize(video.bytes) }),
      });
    }
  }
  if (trash && trash.bytes > 500 * MB) {
    recs.push({
      id: "trash-large",
      severity: "info",
      title: t("ops.recommendations.trashLarge.title"),
      description: t("home.rec.trashLarge.description", {
        size: formatSize(trash.bytes),
        count: trash.count,
      }),
      ctaLabel: t("ops.recommendations.trashLarge.cta"),
      to: "/corbeille",
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: "all-good",
      severity: "info",
      title: t("ops.recommendations.allGood.title"),
      description: t("ops.recommendations.allGood.desc"),
    });
  }

  return recs;
}
