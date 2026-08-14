/**
 * Scanner d'organisation.
 *
 * Parcours BFS non-bloquant des racines fournies. Détecte les dossiers
 * désorganisés, surchargés, mal classés, isolés, difficiles à parcourir
 * et les noms peu explicites. Réutilise les analyses persistées
 * (`@/lib/analysis`) sans jamais retraiter les fichiers.
 */
import { listDirectory } from "@/lib/files/fs";
import type { FileEntry, FileKind, PathRef, StorageRootId } from "@/lib/files/types";
import { classify } from "./classifier";
import { loadPreferences } from "./preferences";
import type { OrgCategoryId, OrgIssue, OrgReport } from "./types";
import { t } from "@/lib/i18n";

export type ScanOptions = {
  roots: { rootId: StorageRootId; segments: string[] }[];
  signal?: AbortSignal;
  onProgress?: (folders: number, files: number) => void;
  /** Profondeur maximale (par sécurité). */
  maxDepth?: number;
};

const yieldToLoop = () => new Promise<void>((r) => setTimeout(r, 0));

function isUnclearName(name: string): boolean {
  const base = name.replace(/\.[^.]+$/, "");
  if (/^(img|dsc|dcim|photo|vid|video|mov)[_-]?\d/i.test(base)) return true;
  if (/^screenshot[_-]?\d/i.test(base)) return true;
  if (/^(nouveau|new)[ _-]?(document|dossier|folder|fichier)/i.test(base)) return true;
  if (/^(untitled|sans[- ]?titre)/i.test(base)) return true;
  if (/^copy of|copie de|\(\d+\)\s*$/i.test(base)) return true;
  if (/^[a-f0-9]{16,}$/i.test(base)) return true; // hash-like
  if (/^\d{5,}$/.test(base)) return true;
  return false;
}

function idOf(kind: string, path: PathRef, extra = ""): string {
  return `${kind}:${path.rootId}:${path.segments.join("/")}${extra ? `:${extra}` : ""}`;
}

function kindLabel(kind: FileKind): string {
  switch (kind) {
    case "audio":
      return t("organize.kind.audio");
    case "video":
      return t("organize.kind.video");
    case "image":
      return t("organize.kind.image");
    default:
      return kind;
  }
}

export async function scanOrganization(opts: ScanOptions): Promise<OrgReport> {
  const prefs = loadPreferences();
  const issues: OrgIssue[] = [];
  const distribution: OrgReport["distribution"] = {};
  const recentlyAdded: OrgReport["recentlyAdded"] = [];
  const recentCutoff = Date.now() - prefs.recentDays * 86400_000;

  let scannedFolders = 0;
  let scannedFiles = 0;
  let totalBytes = 0;
  let reorganizableBytes = 0;

  const queue: { rootId: StorageRootId; segments: string[]; depth: number }[] = [];
  for (const r of opts.roots) queue.push({ rootId: r.rootId, segments: r.segments, depth: 0 });

  const maxDepth = opts.maxDepth ?? 8;

  while (queue.length) {
    if (opts.signal?.aborted) break;
    const cur = queue.shift()!;
    if (cur.depth > maxDepth) continue;
    const parent: PathRef = { rootId: cur.rootId, segments: cur.segments };
    const res = await listDirectory(parent);
    if (!res.ok || res.entries.length === 0) continue;

    scannedFolders++;
    if (scannedFolders % 8 === 0) {
      opts.onProgress?.(scannedFolders, scannedFiles);
      await yieldToLoop();
    }

    const files = res.entries.filter((e) => !e.isDirectory);
    const dirs = res.entries.filter((e) => e.isDirectory);
    for (const d of dirs) {
      queue.push({ rootId: cur.rootId, segments: [...cur.segments, d.name], depth: cur.depth + 1 });
    }

    // Distribution par catégorie + fichiers récents.
    for (const f of files) {
      scannedFiles++;
      totalBytes += f.size ?? 0;
      const cat = classify(f, parent);
      const slot = (distribution[cat] ??= { count: 0, bytes: 0 });
      slot.count++;
      slot.bytes += f.size ?? 0;
      if (f.mtime && f.mtime >= recentCutoff) {
        recentlyAdded.push({ entry: f, parent });
      }
    }

    // Ne scanne pas la « désorganisation » sur les racines pures
    if (files.length === 0) continue;

    // 1) Dossier surchargé
    if (files.length >= prefs.overloadedThreshold) {
      issues.push({
        id: idOf("overloaded", parent),
        kind: "overloaded_folder",
        severity: "warn",
        path: parent,
        label: cur.segments.at(-1) || t("organize.scanner.root"),
        detail: t("organize.scanner.overloadedDetail", { count: files.length }),
        metrics: { count: files.length },
      });
    }

    // 2) Dossier désorganisé (mélange de kinds sans dominant)
    const kindCounts = new Map<FileKind, number>();
    for (const f of files) kindCounts.set(f.kind, (kindCounts.get(f.kind) ?? 0) + 1);
    const distinctKinds = kindCounts.size;
    const maxKind = Math.max(...kindCounts.values());
    const dominantRatio = maxKind / files.length;
    if (files.length >= 6 && distinctKinds >= 3 && dominantRatio < prefs.dominantKindRatio) {
      issues.push({
        id: idOf("messy", parent),
        kind: "messy_folder",
        severity: "info",
        path: parent,
        label: cur.segments.at(-1) || t("organize.scanner.root"),
        detail: t("organize.scanner.messyDetail", { count: distinctKinds }),
        entries: files,
        metrics: { kinds: distinctKinds, files: files.length },
      });
      reorganizableBytes += files.reduce((s, f) => s + (f.size ?? 0), 0);
    }

    // 3) Fichiers mal classés (photo dans Music/, etc.)
    const pathLower = cur.segments.join("/").toLowerCase();
    const expected: FileKind | null = /music/.test(pathLower)
      ? "audio"
      : /movies|videos?/.test(pathLower)
        ? "video"
        : /pictures|dcim|camera/.test(pathLower)
          ? "image"
          : null;
    if (expected) {
      const strays = files.filter((f) => f.kind !== expected && f.kind !== "folder");
      if (strays.length > 0 && strays.length <= files.length * 0.4) {
        issues.push({
          id: idOf("misplaced", parent),
          kind: "misplaced_file",
          severity: "info",
          path: parent,
          label: cur.segments.at(-1) || t("organize.scanner.root"),
          detail: t("organize.scanner.misplacedDetail", {
            count: strays.length,
            kind: kindLabel(expected),
          }),
          entries: strays,
        });
        reorganizableBytes += strays.reduce((s, f) => s + (f.size ?? 0), 0);
      }
    }

    // 4) Noms peu explicites
    const unclear = files.filter((f) => isUnclearName(f.name));
    if (unclear.length >= 3) {
      issues.push({
        id: idOf("unclear", parent),
        kind: "unclear_name",
        severity: "info",
        path: parent,
        label: cur.segments.at(-1) || t("organize.scanner.root"),
        detail: t("organize.scanner.unclearDetail", { count: unclear.length }),
        entries: unclear,
        metrics: { count: unclear.length },
      });
    }

    // 5) Fichiers isolés regroupables (≥ 3 fichiers d'une même catégorie
    //    minoritaire dans un dossier mixte).
    if (distinctKinds >= 2) {
      const byCat = new Map<OrgCategoryId, FileEntry[]>();
      for (const f of files) {
        const c = classify(f, parent);
        const list = byCat.get(c) ?? [];
        list.push(f);
        byCat.set(c, list);
      }
      for (const [cat, list] of byCat) {
        if (list.length >= 3 && list.length < files.length) {
          issues.push({
            id: idOf("isolated", parent, cat),
            kind: "isolated_files",
            severity: "info",
            path: parent,
            label: cur.segments.at(-1) || t("organize.scanner.root"),
            detail: t("organize.scanner.isolatedDetail", { count: list.length, category: cat }),
            entries: list,
            metrics: { count: list.length },
          });
        }
      }
    }
  }

  opts.onProgress?.(scannedFolders, scannedFiles);

  // 6) Difficile à parcourir : un dossier racine avec > 30 sous-dossiers
  //    ET > 200 fichiers directs. Approche globale.
  if (scannedFolders > 200 && issues.filter((i) => i.kind === "overloaded_folder").length >= 3) {
    issues.push({
      id: idOf("hard", { rootId: opts.roots[0]?.rootId ?? "internal", segments: [] }),
      kind: "hard_to_browse",
      severity: "warn",
      path: { rootId: opts.roots[0]?.rootId ?? "internal", segments: [] },
      label: t("organize.scanner.storageLabel"),
      detail: t("organize.scanner.hardDetail"),
    });
  }

  return {
    generatedAt: Date.now(),
    scannedFolders,
    scannedFiles,
    totalBytes,
    issues,
    recentlyAdded: recentlyAdded.slice(0, 20),
    distribution,
    reorganizableBytes,
  };
}
