/**
 * Exécutions réelles des actions « organiser », « compresser »,
 * « extraire » et « analyse du nettoyeur ».
 *
 * Elles réutilisent exactement les mêmes moteurs que l'interface
 * (opérations fichiers, archives, scanner du Nettoyeur) afin qu'une
 * automatisation produise le même résultat qu'une action manuelle.
 */
import { createArchive, extractArchive } from "@/lib/files/archive";
import { createDirectory, transferEntries } from "@/lib/files/operations";
import { listDirectory } from "@/lib/files/fs";
import { listRoots } from "@/lib/files/fs";
import { scanCleanup } from "@/lib/cleaner/scanner";
import type { FileEntry, PathRef } from "@/lib/files/types";
import type { CleanScanResult } from "@/lib/cleaner/types";

/** Sous-dossier cible d'un fichier selon la règle de rangement. */
export function organizeBucket(entry: FileEntry, rule: "type" | "date" | "name"): string {
  if (rule === "name") {
    const first = entry.name.trim()[0]?.toUpperCase() ?? "#";
    return /[A-Z]/.test(first) ? first : "#";
  }
  if (rule === "date") {
    const d = new Date(entry.modifiedAt ?? Date.now());
    const month = `${d.getMonth() + 1}`.padStart(2, "0");
    return `${d.getFullYear()}-${month}`;
  }
  const dot = entry.name.lastIndexOf(".");
  const ext = dot > 0 ? entry.name.slice(dot + 1).toLowerCase() : "";
  return ext || "sans-extension";
}

export type OrganizeOutcome = { moved: number; errors: string[] };

/** Range les fichiers d'un dossier dans des sous-dossiers (type / date / initiale). */
export async function organizeFolder(
  folder: PathRef,
  rule: "type" | "date" | "name",
): Promise<OrganizeOutcome> {
  const listing = await listDirectory(folder, { force: true });
  if (!listing.ok) return { moved: 0, errors: [listing.message ?? listing.reason] };

  const files = listing.entries.filter((e) => !e.isDirectory);
  const buckets = new Map<string, FileEntry[]>();
  for (const f of files) {
    const bucket = organizeBucket(f, rule);
    const list = buckets.get(bucket);
    if (list) list.push(f);
    else buckets.set(bucket, [f]);
  }

  let moved = 0;
  const errors: string[] = [];
  for (const [bucket, entries] of buckets) {
    const mk = await createDirectory(folder, bucket);
    if (!mk.ok && mk.error && !/exist/i.test(mk.error)) {
      errors.push(`${bucket}: ${mk.error}`);
      continue;
    }
    const destination: PathRef = { ...folder, segments: [...folder.segments, bucket] };
    const res = await transferEntries(folder, entries, destination, { mode: "move" });
    moved += res.succeeded;
    for (const f of res.failed) errors.push(`${f.name}: ${f.reason}`);
  }
  return { moved, errors };
}

/** Compresse une sélection en une archive ZIP. */
export async function compressSelection(opts: {
  parent: PathRef;
  entries: FileEntry[];
  destination: PathRef;
  archiveName: string;
}) {
  return createArchive({
    parent: opts.parent,
    entries: opts.entries,
    destination: opts.destination,
    archiveName: opts.archiveName || "archive.zip",
    format: "zip",
    level: 6,
  });
}

/** Extrait une archive dans un dossier de destination. */
export async function extractSelection(opts: {
  parent: PathRef;
  entry: FileEntry;
  destination: PathRef;
}) {
  return extractArchive({
    parent: opts.parent,
    entry: opts.entry,
    destination: opts.destination,
    conflict: "rename",
  });
}

/** Lance une vraie analyse du Nettoyeur sur tous les stockages connus. */
export function runCleanerScan(): Promise<CleanScanResult> {
  const targets: PathRef[] = listRoots().map((r) => ({ rootId: r.id, segments: [] }));
  return new Promise((resolve) => {
    const handle = scanCleanup(
      targets,
      () => {},
      (result) => resolve(result),
    );
    // Garde-fou : une analyse ne doit jamais bloquer une automatisation.
    setTimeout(
      () => {
        handle.cancel();
      },
      5 * 60_000,
    );
  });
}
