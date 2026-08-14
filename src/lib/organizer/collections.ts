/**
 * Collections intelligentes — filtres déclaratifs, réévalués à la demande.
 *
 * Aucune donnée dupliquée : les collections agrègent des références aux
 * fichiers réels et se recalculent quand `gf:storage-changed` est émis.
 */
import { listDirectory } from "@/lib/files/fs";
import type { FileEntry, PathRef, StorageRootId } from "@/lib/files/types";
import { getAnalysis } from "@/lib/analysis";
import type {
  CollectionMatch,
  CollectionRule,
  CollectionRuleClause,
  SmartCollection,
} from "./types";
import { t } from "@/lib/i18n";

export const DEFAULT_COLLECTIONS: SmartCollection[] = [
  {
    id: "admin",
    label: "Documents administratifs",
    rule: {
      any: [
        { kind: "doctype", types: ["cv", "rapport", "note"] },
        {
          kind: "name_regex",
          pattern: "cv|attestation|releve|declaration|impots|taxe|contrat",
        },
      ],
    },
  },
  {
    id: "factures",
    label: "Factures",
    rule: {
      any: [
        { kind: "doctype", types: ["facture", "recu"] },
        { kind: "flag", flag: "isInvoice" },
        { kind: "flag", flag: "isReceipt" },
        { kind: "name_regex", pattern: "facture|invoice|receipt|recu|ticket" },
      ],
    },
  },
  {
    id: "contrats",
    label: "Contrats",
    rule: {
      any: [
        { kind: "doctype", types: ["contrat"] },
        { kind: "name_regex", pattern: "contrat|contract|bail|accord|nda" },
      ],
    },
  },
  {
    id: "photos",
    label: "Photos",
    rule: { all: [{ kind: "kind", kinds: ["image"] }] },
  },
  {
    id: "videos",
    label: t("home.category.videos"),
    rule: { all: [{ kind: "kind", kinds: ["video"] }] },
  },
  {
    id: "musique",
    label: "Musique",
    rule: { all: [{ kind: "kind", kinds: ["audio"] }] },
  },
  {
    id: "telechargements",
    label: t("home.category.downloads"),
    rule: { any: [{ kind: "path_contains", needles: ["download", "telecharg"] }] },
  },
  {
    id: "archives",
    label: "Archives",
    rule: { all: [{ kind: "kind", kinds: ["archive"] }] },
  },
  {
    id: "captures",
    label: t("organize.capturesDEcran"),
    rule: {
      any: [
        { kind: "flag", flag: "isScreenshot" },
        { kind: "name_regex", pattern: "screenshot|capture[- ]?ecran" },
        { kind: "path_contains", needles: ["screenshots"] },
      ],
    },
  },
  {
    id: "scans",
    label: t("organize.documentsNumerises"),
    rule: {
      any: [
        { kind: "flag", flag: "isDocument" },
        { kind: "name_regex", pattern: "scan[- ]?doc|doc[- ]?scan|numeris" },
      ],
    },
  },
];

/* ---------- évaluation ---------- */

function matchClause(clause: CollectionRuleClause, e: FileEntry, parent: PathRef): boolean {
  switch (clause.kind) {
    case "kind":
      return clause.kinds.includes(e.kind);
    case "ext":
      return !!e.ext && clause.exts.includes(e.ext);
    case "name_regex":
      return new RegExp(clause.pattern, "i").test(e.name);
    case "path_contains": {
      const p = parent.segments.join("/").toLowerCase();
      return clause.needles.some((n) => p.includes(n.toLowerCase()));
    }
    case "mtime_within_days": {
      if (!e.mtime) return false;
      return e.mtime >= Date.now() - clause.days * 86400_000;
    }
    case "doctype": {
      const rec = getAnalysis(parent, e);
      const t = rec?.content?.docType;
      return !!t && clause.types.includes(t);
    }
    case "flag": {
      const rec = getAnalysis(parent, e);
      const img = rec?.image;
      return !!img && !!img[clause.flag];
    }
  }
}

function matchRule(rule: CollectionRule, e: FileEntry, parent: PathRef): boolean {
  if (rule.any && rule.any.length > 0) {
    return rule.any.some((c) => matchClause(c, e, parent));
  }
  if (rule.all && rule.all.length > 0) {
    return rule.all.every((c) => matchClause(c, e, parent));
  }
  return false;
}

/* ---------- API ---------- */

export function listCollections(): SmartCollection[] {
  return DEFAULT_COLLECTIONS.slice();
}

export function getCollection(id: string): SmartCollection | undefined {
  return DEFAULT_COLLECTIONS.find((c) => c.id === id);
}

export async function evalCollection(
  id: string,
  roots: { rootId: StorageRootId; segments: string[] }[],
  signal?: AbortSignal,
): Promise<CollectionMatch> {
  const col = getCollection(id);
  const match: CollectionMatch = { collectionId: id, entries: [], totalBytes: 0 };
  if (!col) return match;

  const queue: { rootId: StorageRootId; segments: string[] }[] = roots.map((r) => ({ ...r }));
  let scanned = 0;
  while (queue.length) {
    if (signal?.aborted) break;
    const cur = queue.shift()!;
    const parent: PathRef = { rootId: cur.rootId, segments: cur.segments };
    const res = await listDirectory(parent);
    if (!res.ok) continue;
    for (const e of res.entries) {
      if (e.isDirectory) {
        queue.push({ rootId: cur.rootId, segments: [...cur.segments, e.name] });
        continue;
      }
      if (matchRule(col.rule, e, parent)) {
        match.entries.push({ entry: e, parent });
        match.totalBytes += e.size ?? 0;
      }
    }
    if (++scanned % 20 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return match;
}
