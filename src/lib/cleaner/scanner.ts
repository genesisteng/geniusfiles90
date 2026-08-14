/**
 * Smart Cleaner scanner.
 *
 * Streams a BFS traversal over the selected storage roots using the same
 * `listDirectory` bridge as the rest of the app (native java.io.File on
 * Android, curated mock tree on the web preview) and classifies files
 * into clean-up categories. Yields to the event loop regularly so the UI
 * stays fluid even on filesystems with hundreds of thousands of entries.
 *
 * Nothing is deleted here — the scanner strictly PROPOSES items. The
 * user must review and confirm before any removal via `runCleanup`.
 *
 * Safety rules baked into the engine:
 *  - protected locations (Android/data, Android/obb, .trashed, dossiers
 *    système) are never traversed nor proposed ;
 *  - aucune extension seule ne suffit : l'emplacement, l'âge et le
 *    contexte sont toujours pris en compte ;
 *  - chaque fichier appartient à UNE seule catégorie (pas de double
 *    comptage entre « volumineux » et « doublons », par exemple) ;
 *  - les doublons sont regroupés par taille exacte, et le contenu est
 *    réellement comparé quand la lecture est possible et bornée ;
 *  - la copie conservée d'un groupe est marquée `keeper` et n'est jamais
 *    proposée à la suppression.
 */
import { listDirectory } from "@/lib/files/fs";
import { extOf, kindOf } from "@/lib/files/format";
import { isAndroidNative, nativePlugin } from "@/lib/native/geniusfiles-native";
import type { FileEntry, PathRef } from "@/lib/files/types";
import type {
  CleanCategory,
  CleanCategoryKey,
  CleanItem,
  CleanScanHandle,
  CleanScanResult,
} from "./types";
import { t } from "@/lib/i18n";

/* -------- Heuristics -------- */

export const LARGE_FILE_BYTES = 100 * 1024 * 1024; // 100 Mo
export const OLD_DOWNLOAD_DAYS = 60;
export const OLD_APK_DAYS = 14;
const DUP_MIN_BYTES = 64 * 1024; // ignore trivial duplicates
const MESSAGING_MEDIA_MIN_BYTES = 512 * 1024;
/** Un fichier temporaire doit aussi être « au repos » depuis un moment. */
const TEMP_MIN_AGE_DAYS = 3;
const PARTIAL_MIN_AGE_DAYS = 1;

/** Extensions de travail : suffisantes seulement si le fichier est ancien. */
const PARTIAL_EXTS = new Set(["part", "crdownload", "tmp", "temp", "dmp", "chk"]);
/** Extensions ambiguës : uniquement dans un dossier de cache avéré. */
const CACHE_ONLY_EXTS = new Set(["log", "bak", "old", "cache"]);

const CACHE_DIR_NAMES = new Set([
  "cache",
  ".cache",
  "caches",
  ".thumbnails",
  "thumbnails",
  "tmp",
  "temp",
  "logs",
  "log",
  "crashlytics",
  "crash",
  ".temp",
  ".tmp",
]);

const MESSAGING_KEYS = [
  "whatsapp",
  "telegram",
  "signal",
  "messenger",
  "viber",
  "discord",
  "wechat",
  "line",
];

/**
 * Emplacements jamais parcourus ni proposés : données privées d'autres
 * applications, corbeilles système, index média.
 */
const PROTECTED_DIRS = new Set([
  "data",
  "obb",
  ".trashed",
  ".trash",
  ".trash-1000",
  "lost.dir",
  "system",
  "system_dm",
  ".android_secure",
  ".secure",
  ".thumbnails_secure",
]);

/** Dossiers standards Android : ne jamais proposer de les supprimer. */
const STANDARD_DIRS = new Set([
  "dcim",
  "download",
  "downloads",
  "pictures",
  "movies",
  "music",
  "documents",
  "podcasts",
  "ringtones",
  "alarms",
  "notifications",
  "audiobooks",
  "recordings",
  "screenshots",
  "android",
  "camera",
]);

const ARCHIVE_EXTS = new Set(["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"]);

/** Budget de vérification par contenu (lecture réelle du disque). */
const CONTENT_VERIFY_MAX_BYTES = 4 * 1024 * 1024;
const CONTENT_VERIFY_MAX_FILES = 80;

/* -------- Helpers -------- */

function categoryMeta(): Record<
  CleanCategoryKey,
  { label: string; description: string; safety: CleanCategory["safety"] }
> {
  return {
    duplicates: {
      label: t("cleaner.category.duplicates.label"),
      description: t("cleaner.category.duplicates.description"),
      safety: "review",
    },
    large: {
      label: t("cleaner.category.large.label"),
      description: t("cleaner.category.large.description", {
        sizeMb: Math.round(LARGE_FILE_BYTES / (1024 * 1024)),
      }),
      safety: "review",
    },
    old_downloads: {
      label: t("cleaner.category.old_downloads.label"),
      description: t("cleaner.category.old_downloads.description", { days: OLD_DOWNLOAD_DAYS }),
      safety: "review",
    },
    empty_folders: {
      label: t("cleaner.category.empty_folders.label"),
      description: t("cleaner.category.empty_folders.description"),
      safety: "safe",
    },
    temp: {
      label: t("cleaner.category.temp.label"),
      description: t("cleaner.category.temp.description"),
      safety: "safe",
    },
    extracted_archives: {
      label: t("cleaner.category.extracted_archives.label"),
      description: t("cleaner.category.extracted_archives.description"),
      safety: "review",
    },
    apk: {
      label: t("cleaner.category.apk.label"),
      description: t("cleaner.category.apk.description", { days: OLD_APK_DAYS }),
      safety: "review",
    },
    messaging_media: {
      label: t("cleaner.category.messaging_media.label"),
      description: t("cleaner.category.messaging_media.description"),
      safety: "review",
    },
  };
}

/**
 * Priorité d'affectation : un fichier ne peut apparaître que dans UNE
 * catégorie. Les doublons sont résolus en fin d'analyse et l'emportent
 * sur toute autre affectation.
 */
const ASSIGN_PRIORITY: CleanCategoryKey[] = [
  "temp",
  "extracted_archives",
  "apk",
  "messaging_media",
  "old_downloads",
  "large",
];

function emptyCategory(key: CleanCategoryKey): CleanCategory {
  const meta = categoryMeta()[key];
  return {
    key,
    label: meta.label,
    description: meta.description,
    items: [],
    bytes: 0,
    status: "pending",
    safety: meta.safety,
  };
}

function emptyResult(): CleanScanResult {
  return {
    categories: {
      duplicates: emptyCategory("duplicates"),
      large: emptyCategory("large"),
      old_downloads: emptyCategory("old_downloads"),
      empty_folders: emptyCategory("empty_folders"),
      temp: emptyCategory("temp"),
      extracted_archives: emptyCategory("extracted_archives"),
      apk: emptyCategory("apk"),
      messaging_media: emptyCategory("messaging_media"),
    },
    totalItems: 0,
    totalBytes: 0,
    scannedFolders: 0,
    scannedFiles: 0,
    currentPath: null,
    phase: "starting",
    issues: [],
    done: false,
    cancelled: false,
  };
}

function normName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(\d+\)(?=\.[a-z0-9]+$|$)/i, "")
    .replace(/[-_ ]cop(?:y|ie)(?:\s*\d*)?(?=\.[a-z0-9]+$|$)/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pathHasMessagingKey(segments: string[]): boolean {
  for (const s of segments) {
    const lower = s.toLowerCase();
    for (const k of MESSAGING_KEYS) if (lower.includes(k)) return true;
  }
  return false;
}

function daysAgo(mtime?: number): number {
  if (!mtime) return 0;
  return Math.max(0, (Date.now() - mtime) / (1000 * 60 * 60 * 24));
}

function idFor(parent: PathRef, name: string): string {
  return `${parent.rootId}:/${[...parent.segments, name].join("/")}`;
}

function inCacheDir(segments: string[]): boolean {
  return segments.some((s) => CACHE_DIR_NAMES.has(s.toLowerCase()));
}

function isProtectedDir(name: string, segments: string[]): boolean {
  const lower = name.toLowerCase();
  if (PROTECTED_DIRS.has(lower)) return true;
  // Android/ : on n'entre que dans Android/media (médias publics des apps).
  const first = segments[0]?.toLowerCase();
  if (first === "android" && segments.length === 1) return lower !== "media";
  return false;
}

/** Un dossier vide est-il réellement supprimable sans risque ? */
function isDeletableEmptyDir(segments: string[]): boolean {
  if (segments.length === 0) return false;
  const name = segments[segments.length - 1].toLowerCase();
  if (STANDARD_DIRS.has(name)) return false;
  if (PROTECTED_DIRS.has(name)) return false;
  if (name.startsWith(".")) return false;
  if (segments.some((s) => s.toLowerCase() === "android")) return false;
  return true;
}

/**
 * Classement d'un fichier — l'extension n'est JAMAIS suffisante seule.
 * Retourne la catégorie retenue et l'explication affichée.
 */
function classifyFile(
  entry: FileEntry,
  parent: PathRef,
  ctx: { dirNamesWithContent: Set<string> },
): { key: CleanCategoryKey; reason: string; evidence: CleanItem["evidence"] } | null {
  const size = entry.size ?? 0;
  const ext = extOf(entry.name) ?? "";
  const segs = parent.segments.map((s) => s.toLowerCase());
  const age = daysAgo(entry.mtime);
  const cache = inCacheDir(segs);
  const kind = kindOf(entry.name, false);

  const candidates = new Map<
    CleanCategoryKey,
    { reason: string; evidence: CleanItem["evidence"] }
  >();

  /* Temporaires — emplacement + âge, jamais l'extension seule. */
  if (kind !== "apk") {
    if (cache && (CACHE_ONLY_EXTS.has(ext) || PARTIAL_EXTS.has(ext) || kind === "other")) {
      if (age >= TEMP_MIN_AGE_DAYS) {
        candidates.set("temp", {
          reason: t("cleaner.reason.cacheUnused", { days: Math.round(age) }),
          evidence: "location",
        });
      }
    } else if (PARTIAL_EXTS.has(ext) && age >= PARTIAL_MIN_AGE_DAYS) {
      candidates.set("temp", {
        reason: t("cleaner.reason.interruptedDownload", { ext, days: Math.round(age) }),
        evidence: "location",
      });
    } else if (entry.name.endsWith("~") && age >= TEMP_MIN_AGE_DAYS) {
      candidates.set("temp", {
        reason: t("cleaner.reason.editorBackup"),
        evidence: "location",
      });
    }
  }

  /* Archives déjà extraites — le dossier voisin doit contenir des fichiers. */
  if (ARCHIVE_EXTS.has(ext)) {
    const base = entry.name.slice(0, -(ext.length + 1)).toLowerCase();
    if (base && ctx.dirNamesWithContent.has(base)) {
      candidates.set("extracted_archives", {
        reason: t("cleaner.reason.extractedArchive", { name: base }),
        evidence: "location",
      });
    }
  }

  /* APK anciens — uniquement hors dossiers d'application. */
  if (ext === "apk" && age >= OLD_APK_DAYS) {
    candidates.set("apk", {
      reason: t("cleaner.reason.apkKept", { days: Math.round(age) }),
      evidence: "location",
    });
  }

  /* Médias de messagerie. */
  if (
    size >= MESSAGING_MEDIA_MIN_BYTES &&
    pathHasMessagingKey(parent.segments) &&
    (kind === "image" || kind === "video" || kind === "audio")
  ) {
    candidates.set("messaging_media", {
      reason: t("cleaner.reason.messagingMedia"),
      evidence: "location",
    });
  }

  /* Téléchargements anciens. */
  if (parent.rootId === "downloads" || segs.some((s) => s === "download" || s === "downloads")) {
    if (age >= OLD_DOWNLOAD_DAYS) {
      candidates.set("old_downloads", {
        reason: t("cleaner.reason.oldDownload", { days: Math.round(age) }),
        evidence: "location",
      });
    }
  }

  /* Fichiers volumineux — mesure directe. */
  if (size >= LARGE_FILE_BYTES) {
    candidates.set("large", {
      reason: t("cleaner.reason.largeFile", { sizeMb: Math.round(size / (1024 * 1024)) }),
      evidence: "measured",
    });
  }

  for (const key of ASSIGN_PRIORITY) {
    const hit = candidates.get(key);
    if (hit) return { key, reason: hit.reason, evidence: hit.evidence };
  }
  return null;
}

/* -------- Vérification de contenu (doublons) -------- */

function fnv1a(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/**
 * Empreinte réelle du contenu, quand la lecture est possible et bornée.
 * Retourne `null` si le contenu n'a pas pu être lu : le groupe reste
 * alors basé sur « taille exacte + nom », et l'UI le dit explicitement.
 */
async function contentSignature(parent: PathRef, entry: FileEntry): Promise<string | null> {
  if (!isAndroidNative()) return null;
  const size = entry.size ?? 0;
  if (size <= 0 || size > CONTENT_VERIFY_MAX_BYTES) return null;
  const plugin = nativePlugin();
  if (!plugin?.readFileBase64) return null;
  try {
    const abs = `/${[...parent.segments, entry.name].join("/")}`;
    const res = await plugin.readFileBase64({ path: entry.path || abs });
    if (!res?.data) return null;
    return `${size}:${fnv1a(res.data)}`;
  } catch {
    return null;
  }
}

/* -------- Scanner -------- */

export function scanCleanup(
  roots: PathRef[],
  onProgress: (partial: CleanScanResult) => void,
  onDone: (result: CleanScanResult) => void,
): CleanScanHandle {
  let cancelled = false;
  const handle: CleanScanHandle = {
    cancel: () => {
      cancelled = true;
    },
  };
  const result = emptyResult();

  /** Affectation unique par fichier — clé = identifiant de l'item. */
  const assigned = new Map<string, { key: CleanCategoryKey; item: CleanItem }>();
  /** Candidats doublons regroupés par taille exacte + extension. */
  const dupBuckets = new Map<string, CleanItem[]>();

  const snapshot = (): CleanScanResult => ({
    ...result,
    categories: { ...result.categories },
    issues: [...result.issues],
  });

  const rebuildTotals = () => {
    let items = 0;
    let bytes = 0;
    for (const c of Object.values(result.categories)) {
      items += c.items.filter((i) => !i.keeper).length;
      bytes += c.bytes;
    }
    result.totalItems = items;
    result.totalBytes = bytes;
  };

  /** Reconstruit les catégories à partir des affectations courantes. */
  const materialize = () => {
    for (const key of Object.keys(result.categories) as CleanCategoryKey[]) {
      const cat = result.categories[key];
      cat.items = [];
      cat.bytes = 0;
    }
    for (const { key, item } of assigned.values()) {
      const cat = result.categories[key];
      cat.items.push(item);
      if (!item.keeper) cat.bytes += item.entry.size ?? 0;
    }
    rebuildTotals();
  };

  (async () => {
    const queue: PathRef[] = [...roots];
    const visited = new Set<string>();
    let step = 0;
    result.phase = "walking";
    for (const key of Object.keys(result.categories) as CleanCategoryKey[]) {
      result.categories[key].status = "scanning";
    }

    while (queue.length && !cancelled) {
      const p = queue.shift()!;
      const key = `${p.rootId}/${p.segments.join("/")}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const res = await listDirectory(p);
      result.scannedFolders += 1;
      result.currentPath = p.segments.length ? `/${p.segments.join("/")}` : "/";

      if (!res.ok) {
        if (result.issues.length < 40) {
          result.issues.push({
            path: result.currentPath,
            reason: t("cleaner.issue.unreadable"),
          });
        }
        step += 1;
        continue;
      }

      const allEntries = res.entries;
      const visibleEntries = allEntries.filter((e) => !e.name.startsWith("."));

      /* Dossier vide : contrôle sur TOUTES les entrées, y compris cachées. */
      if (allEntries.length === 0 && isDeletableEmptyDir(p.segments)) {
        const parentSegs = p.segments.slice(0, -1);
        const parent: PathRef = { rootId: p.rootId, segments: parentSegs };
        const name = p.segments[p.segments.length - 1];
        const entry: FileEntry = {
          name,
          path: "/" + p.segments.join("/"),
          isDirectory: true,
          mtime: undefined,
          kind: "folder",
          size: 0,
        };
        const id = idFor(parent, name);
        assigned.set(id, {
          key: "empty_folders",
          item: {
            id,
            parent,
            entry,
            reason: t("cleaner.reason.emptyFolder"),
            evidence: "measured",
          },
        });
      }

      /* Dossiers voisins NON vides — base de l'heuristique « archive extraite ». */
      const dirNamesWithContent = new Set(
        visibleEntries.filter((e) => e.isDirectory).map((e) => e.name.toLowerCase()),
      );

      for (const e of visibleEntries) {
        if (e.isDirectory) {
          if (isProtectedDir(e.name, [...p.segments, e.name])) continue;
          queue.push({ rootId: p.rootId, segments: [...p.segments, e.name] });
          continue;
        }
        result.scannedFiles += 1;

        const id = idFor(p, e.name);
        const base: CleanItem = { id, parent: p, entry: e, reason: "" };

        const hit = classifyFile(e, p, { dirNamesWithContent });
        if (hit) {
          assigned.set(id, {
            key: hit.key,
            item: { ...base, reason: hit.reason, evidence: hit.evidence },
          });
        }

        /* Candidats doublons : taille EXACTE + extension. */
        const size = e.size ?? 0;
        if (size >= DUP_MIN_BYTES) {
          const bucketKey = `${size}::${extOf(e.name) ?? ""}`;
          const arr = dupBuckets.get(bucketKey) ?? [];
          arr.push(base);
          dupBuckets.set(bucketKey, arr);
        }
      }

      step += 1;
      if (step % 6 === 0) {
        materialize();
        onProgress(snapshot());
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    /* ---- Doublons : regroupement puis vérification réelle ---- */
    if (!cancelled) {
      result.phase = "matching";
      result.currentPath = null;
      materialize();
      onProgress(snapshot());
      await new Promise((r) => setTimeout(r, 0));

      let verifyBudget = CONTENT_VERIFY_MAX_FILES;

      for (const [bucketKey, arr] of dupBuckets) {
        if (cancelled) break;
        if (arr.length < 2) continue;

        /* Sous-groupes : nom normalisé identique, puis contenu si lisible. */
        const byName = new Map<string, CleanItem[]>();
        for (const it of arr) {
          const n = normName(it.entry.name);
          const list = byName.get(n) ?? [];
          list.push(it);
          byName.set(n, list);
        }

        for (const [nameKey, group] of byName) {
          if (group.length < 2) continue;

          let clusters: { items: CleanItem[]; evidence: CleanItem["evidence"] }[];
          if (verifyBudget >= group.length) {
            const sigs = new Map<string, CleanItem[]>();
            let allRead = true;
            for (const it of group) {
              const sig = await contentSignature(it.parent, it.entry);
              verifyBudget -= 1;
              if (!sig) {
                allRead = false;
                break;
              }
              const list = sigs.get(sig) ?? [];
              list.push(it);
              sigs.set(sig, list);
            }
            clusters = allRead
              ? [...sigs.values()]
                  .filter((l) => l.length >= 2)
                  .map((items) => ({
                    items,
                    evidence: "content" as const,
                  }))
              : [{ items: group, evidence: "size-name" as const }];
          } else {
            clusters = [{ items: group, evidence: "size-name" as const }];
          }

          for (const cluster of clusters) {
            if (cluster.items.length < 2) continue;
            /* La copie conservée est la PLUS ANCIENNE (l'originale). */
            const sorted = [...cluster.items].sort(
              (a, b) => (a.entry.mtime ?? 0) - (b.entry.mtime ?? 0),
            );
            const keeper = sorted[0];
            const gid = `${bucketKey}::${nameKey}::${keeper.id}`;
            assigned.set(keeper.id, {
              key: "duplicates",
              item: {
                ...keeper,
                group: gid,
                keeper: true,
                evidence: cluster.evidence,
                reason: t("cleaner.reason.duplicateKeeper"),
              },
            });
            for (let i = 1; i < sorted.length; i++) {
              const it = sorted[i];
              assigned.set(it.id, {
                key: "duplicates",
                item: {
                  ...it,
                  group: gid,
                  evidence: cluster.evidence,
                  reason:
                    cluster.evidence === "content"
                      ? t("cleaner.reason.duplicateContent")
                      : t("cleaner.reason.duplicateSizeName"),
                },
              });
            }
          }
        }

        if (verifyBudget <= 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    }

    materialize();
    for (const key of Object.keys(result.categories) as CleanCategoryKey[]) {
      result.categories[key].status = "ready";
    }
    result.phase = "done";
    result.currentPath = null;
    result.done = !cancelled;
    result.cancelled = cancelled;
    onDone(snapshot());
  })().catch((err) => {
    result.issues.push({
      path: result.currentPath ?? "/",
      reason: err instanceof Error ? err.message : "Analyse interrompue",
    });
    materialize();
    for (const key of Object.keys(result.categories) as CleanCategoryKey[]) {
      result.categories[key].status = "ready";
    }
    result.phase = "done";
    result.done = true;
    onDone(snapshot());
  });

  return handle;
}
