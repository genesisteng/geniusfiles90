/**
 * Regroupement d'images similaires à partir de leurs aHash.
 *
 * Distance de Hamming ≤ seuil (par défaut 10 bits sur 64) → même groupe.
 * Fonctionne exclusivement sur les records déjà analysés — aucune I/O.
 *
 * Réservé pour évolutions futures : ce module servira de socle à la
 * « détection avancée des doublons visuels » (pHash / dHash) sans exiger
 * de changement d'API.
 */
import { allRecords } from "./store";
import type { AnalysisRecord } from "./types";

function hammingHex(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  let d = 0;
  for (let i = 0; i < len; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    d += (x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1) + ((x >> 3) & 1);
  }
  d += Math.abs(a.length - b.length) * 4;
  return d;
}

export type SimilarityGroup = {
  hash: string;
  members: AnalysisRecord[];
};

export function groupSimilarImages(threshold = 10): SimilarityGroup[] {
  const withHash = allRecords().filter((r) => r.kind === "image" && r.image?.aHash);
  const groups: SimilarityGroup[] = [];
  const assigned = new Set<string>();
  for (const rec of withHash) {
    if (assigned.has(rec.key)) continue;
    const hash = rec.image!.aHash!;
    const group: SimilarityGroup = { hash, members: [rec] };
    assigned.add(rec.key);
    for (const other of withHash) {
      if (assigned.has(other.key)) continue;
      if (hammingHex(hash, other.image!.aHash!) <= threshold) {
        group.members.push(other);
        assigned.add(other.key);
      }
    }
    if (group.members.length > 1) groups.push(group);
  }
  return groups;
}
