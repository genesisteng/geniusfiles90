/**
 * Point d'entrée du moteur d'organisation intelligente.
 *
 * Aucune modification de fichiers n'a lieu sans que l'utilisateur ait
 * validé un plan explicite. Tout est local et fonctionne hors connexion.
 */
export * from "./types";
export * from "./preferences";
export * from "./classifier";
export * from "./collections";
export * from "./renamer";
export * from "./recommender";
export * from "./scanner";
export * from "./preview";
export * from "./executor";
export * from "./events";
export * as reserved from "./reserved";

import { scanOrganization } from "./scanner";
import { buildRecommendations } from "./recommender";
import { emitOrganizerUpdated } from "./events";
import type { OrgRecommendation, OrgReport } from "./types";
import type { StorageRootId } from "@/lib/files/types";

/* ---------- cache mémoire + snapshot localStorage ---------- */

const CACHE_KEY = "gf.organizer.report.v1";
let cachedReport: OrgReport | null = null;
let cachedRecs: OrgRecommendation[] | null = null;
let inflight: Promise<{ report: OrgReport; recommendations: OrgRecommendation[] }> | null = null;

function readCache(): OrgReport | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OrgReport;
  } catch {
    return null;
  }
}
function writeCache(r: OrgReport) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("gf:storage-changed", () => {
    cachedReport = null;
    cachedRecs = null;
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
  });
}

/** Retourne le rapport en cache (mémoire ou localStorage) sans scanner. */
export function getCachedReport(): OrgReport | null {
  if (cachedReport) return cachedReport;
  cachedReport = readCache();
  return cachedReport;
}

export function getCachedRecommendations(): OrgRecommendation[] | null {
  const r = getCachedReport();
  if (!r) return null;
  if (!cachedRecs) cachedRecs = buildRecommendations(r);
  return cachedRecs;
}

export async function refreshOrganization(
  roots: { rootId: StorageRootId; segments: string[] }[] = [{ rootId: "internal", segments: [] }],
  signal?: AbortSignal,
): Promise<{ report: OrgReport; recommendations: OrgRecommendation[] }> {
  if (inflight) return inflight;
  inflight = (async () => {
    const report = await scanOrganization({ roots, signal });
    const recommendations = buildRecommendations(report);
    cachedReport = report;
    cachedRecs = recommendations;
    writeCache(report);
    emitOrganizerUpdated();
    return { report, recommendations };
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
