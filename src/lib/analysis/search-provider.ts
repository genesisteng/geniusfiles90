/**
 * Provider de recherche par contenu — branché sur le moteur existant
 * via `registerSearchProvider` (point d'extension prévu d'origine).
 *
 * Deux modes :
 *  - **Rapide** : interroge l'index inversé persistant. Instantané et hors
 *    ligne, retrouve un fichier même quand son nom ne contient pas la
 *    requête, dès lors qu'il a été analysé une fois.
 *  - **Opportuniste** : pendant que le moteur nom parcourt l'arborescence,
 *    on enfile en arrière-plan une analyse des documents/images
 *    rencontrés (priorité basse) pour enrichir l'index sans bloquer.
 */
import { registerSearchProvider } from "@/lib/search/engine";
import type { SearchContext, SearchProvider, SearchResult } from "@/lib/search/types";
import { extOf, kindOf } from "@/lib/files/format";
import { listNativeDirectory, isAndroidNative } from "@/lib/native/geniusfiles-native";
import { mockResolve, toAbsolutePath } from "@/lib/files/fs";
import type { FileEntry, StorageRootId } from "@/lib/files/types";
import { queryIndex, allRecords } from "./store";
import { parseNaturalQuery } from "./nlu";
import { enqueueAnalysis } from "./queue";
import { isTextExt } from "./extractors";
import { t } from "@/lib/i18n";

function toSegments(key: string): { rootId: StorageRootId; segments: string[] } {
  const [rootId, tail] = key.split("::");
  const segments = tail ? tail.split("/") : [];
  return { rootId: rootId as StorageRootId, segments };
}

const contentProvider: SearchProvider = {
  id: "content",
  label: t("system.contenuDesFichiers"),
  enabled: true,
  async run(ctx: SearchContext) {
    const natural = parseNaturalQuery(ctx.query);
    const tokens = natural.tokens.length ? natural.tokens : ctx.tokens;
    if (tokens.length === 0) return;

    // 1. Index inversé — immédiat
    const hits = queryIndex(tokens);
    for (const hit of hits) {
      if (ctx.signal.aborted) return;
      const { rootId, segments } = toSegments(hit.key);
      const name = segments[segments.length - 1] ?? "";
      if (!name) continue;
      const parentSegments = segments.slice(0, -1);
      const entry: FileEntry = {
        name,
        path: "/" + segments.join("/"),
        isDirectory: false,
        size: hit.fingerprint.size,
        mtime: hit.fingerprint.mtime,
        kind: kindOf(name, false),
        ext: hit.fingerprint.ext ?? extOf(name),
      };
      const result: SearchResult = {
        ...entry,
        rootId,
        segments,
        parentSegments,
        score: hit.score,
        providerId: "content",
      };
      ctx.emit(result);
    }

    // 2. Enrichissement opportuniste — enfile en tâche de fond les
    // documents pertinents rencontrés dans les racines sélectionnées.
    // On limite le nombre pour éviter d'inonder la file d'un seul coup.
    let scheduled = 0;
    const MAX_SCHEDULED = 60;
    const alreadyIndexed = new Set(allRecords().map((r) => r.key));

    for (const root of ctx.roots) {
      if (ctx.signal.aborted) return;
      if (scheduled >= MAX_SCHEDULED) break;
      await walkForAnalysis(
        root.rootId,
        root.path.segments,
        (parent, entry) => {
          if (scheduled >= MAX_SCHEDULED) return false;
          const key = `${parent.rootId}::${[...parent.segments, entry.name].join("/")}`;
          if (alreadyIndexed.has(key)) return true;
          const relevant =
            entry.kind === "pdf" ||
            entry.kind === "text" ||
            entry.kind === "code" ||
            isTextExt(entry.ext) ||
            (entry.kind === "image" && !!natural.visualTags?.length);
          if (!relevant) return true;
          enqueueAnalysis(parent, entry, { priority: "low" });
          scheduled++;
          return true;
        },
        ctx.signal,
      );
    }
  },
};

registerSearchProvider(contentProvider);

/**
 * Parcours limité (largeur, plafonné) utilisé uniquement pour repérer les
 * candidats à l'analyse. On ne renvoie rien à la recherche depuis ici — le
 * moteur `name` fait déjà ce travail.
 */
async function walkForAnalysis(
  rootId: StorageRootId,
  rootSegments: string[],
  visit: (parent: { rootId: StorageRootId; segments: string[] }, entry: FileEntry) => boolean,
  signal: AbortSignal,
) {
  const MAX_FOLDERS = 40;
  let visited = 0;
  if (isAndroidNative()) {
    const queue: { abs: string; segments: string[] }[] = [
      { abs: toAbsolutePath({ rootId, segments: rootSegments }), segments: rootSegments },
    ];
    while (queue.length && visited < MAX_FOLDERS) {
      if (signal.aborted) return;
      const cur = queue.shift()!;
      const res = await listNativeDirectory(cur.abs);
      visited++;
      if (!res.ok) continue;
      for (const raw of res.listing.entries) {
        if (raw.name.startsWith(".")) continue;
        const entry: FileEntry = {
          name: raw.name,
          path: raw.path,
          isDirectory: raw.isDirectory,
          size: raw.isDirectory ? undefined : raw.size,
          mtime: raw.mtime,
          kind: kindOf(raw.name, raw.isDirectory),
          ext: raw.isDirectory ? undefined : extOf(raw.name),
        };
        if (raw.isDirectory) {
          queue.push({ abs: raw.path, segments: [...cur.segments, raw.name] });
        } else {
          const cont = visit({ rootId, segments: cur.segments }, entry);
          if (!cont) return;
        }
      }
    }
  } else {
    const node = mockResolve({ rootId, segments: rootSegments });
    if (!node) return;
    const queue: { node: typeof node; segments: string[] }[] = [{ node, segments: rootSegments }];
    while (queue.length && visited < MAX_FOLDERS) {
      if (signal.aborted) return;
      const cur = queue.shift()!;
      visited++;
      const children = cur.node?.children ?? [];
      for (const child of children) {
        const entry: FileEntry = {
          name: child.name,
          path: "/" + [...cur.segments, child.name].join("/"),
          isDirectory: child.isDirectory,
          size: child.isDirectory ? undefined : child.size,
          mtime: child.mtime,
          kind: kindOf(child.name, child.isDirectory),
          ext: child.isDirectory ? undefined : extOf(child.name),
        };
        if (child.isDirectory) {
          queue.push({ node: child, segments: [...cur.segments, child.name] });
        } else {
          const cont = visit({ rootId, segments: cur.segments }, entry);
          if (!cont) return;
        }
      }
    }
  }
}
