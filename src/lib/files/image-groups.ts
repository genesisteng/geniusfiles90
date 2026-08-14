/**
 * Regroupement automatique des images selon le mode de tri actif
 * (comme les galeries Android natives) :
 *   date  → Aujourd'hui / Hier / JJ/MM/AAAA
 *   nom   → initiale (A, B, C… / #)
 *   type  → extension (JPG, PNG, WEBP…)
 *   taille→ plages de taille
 * Le calcul est purement dérivé de la liste déjà triée : changer de tri
 * reconstruit les groupes instantanément, sans rechargement.
 */
import type { SortKey } from "./types";
import { t } from "@/lib/i18n";

export type FileGroup<T> = { key: string; label: string; items: T[] };

type Groupable = { name: string; mtime?: number; size?: number; ext?: string };

const dayStart = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function dateLabel(mtime?: number): { key: string; label: string } {
  if (!mtime) return { key: "no-date", label: "Date inconnue" };
  const today = dayStart(Date.now());
  const day = dayStart(mtime);
  if (day === today) return { key: "today", label: "Aujourd'hui" };
  if (day === today - 86400000) return { key: "yesterday", label: "Hier" };
  const d = new Date(day);
  const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return { key: `d-${day}`, label };
}

function nameLabel(name: string): { key: string; label: string } {
  const first = name.trim().charAt(0).toUpperCase();
  if (!first) return { key: "#", label: "#" };
  if (/[A-Z]/.test(first)) return { key: first, label: first };
  if (/[ÀÁÂÄÃÅ]/.test(first)) return { key: "A", label: "A" };
  if (/[ÈÉÊË]/.test(first)) return { key: "E", label: "E" };
  if (/[ÌÍÎÏ]/.test(first)) return { key: "I", label: "I" };
  if (/[ÒÓÔÖÕ]/.test(first)) return { key: "O", label: "O" };
  if (/[ÙÚÛÜ]/.test(first)) return { key: "U", label: "U" };
  if (/[0-9]/.test(first)) return { key: "0-9", label: "0-9" };
  return { key: "#", label: "#" };
}

function typeLabel(item: Groupable): { key: string; label: string } {
  const ext = (item.ext ?? item.name.split(".").pop() ?? "").toLowerCase();
  if (!ext || ext === item.name.toLowerCase())
    return { key: "other", label: t("files.group.noExtension") };
  return { key: ext, label: ext.toUpperCase() };
}

const SIZE_BUCKETS: { max: number; label: string }[] = [
  { max: 100 * 1024, label: t("files.group.sizeUnder100k") },
  { max: 500 * 1024, label: "100 Ko – 500 Ko" },
  { max: 1024 * 1024, label: "500 Ko – 1 Mo" },
  { max: 5 * 1024 * 1024, label: "1 Mo – 5 Mo" },
  { max: 20 * 1024 * 1024, label: "5 Mo – 20 Mo" },
  { max: Number.POSITIVE_INFINITY, label: t("files.plusDe20Mo") },
];

function sizeLabel(size?: number): { key: string; label: string } {
  if (size == null) return { key: "no-size", label: t("files.tailleInconnue") };
  const i = SIZE_BUCKETS.findIndex((b) => size < b.max);
  const bucket = SIZE_BUCKETS[i === -1 ? SIZE_BUCKETS.length - 1 : i];
  return { key: `s-${bucket.label}`, label: bucket.label };
}

/** Groupe une liste **déjà triée** ; l'ordre des groupes suit celui des items. */
export function groupBySort<T extends Groupable>(items: T[], key: SortKey): FileGroup<T>[] {
  const out: FileGroup<T>[] = [];
  const index = new Map<string, FileGroup<T>>();
  for (const item of items) {
    const g =
      key === "date"
        ? dateLabel(item.mtime)
        : key === "size"
          ? sizeLabel(item.size)
          : key === "type"
            ? typeLabel(item)
            : nameLabel(item.name);
    let group = index.get(g.key);
    if (!group) {
      group = { key: g.key, label: g.label, items: [] };
      index.set(g.key, group);
      out.push(group);
    }
    group.items.push(item);
  }
  return out;
}
