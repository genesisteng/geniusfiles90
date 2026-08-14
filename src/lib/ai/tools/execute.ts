/**
 * Pont unique entre Genius AI et le moteur d'exécution.
 *
 * Rôle strictement limité :
 *   1. valider et normaliser la commande produite par le modèle ;
 *   2. résoudre les identifiants humains (`name`, `names`) en entrées
 *      réelles via le moteur de lecture ;
 *   3. déléguer au moteur (`src/lib/engine`), seul autorisé à toucher au
 *      stockage ;
 *   4. renvoyer un résultat JSON compact — succès ou échec explicite.
 *
 * Genius AI ne lit jamais le stockage : il ne voit que la sortie ci-dessous.
 * Aucune simulation, aucune valeur estimée, aucun contournement.
 */
import { execute } from "@/lib/engine";
import { listDirectory, listRoots } from "@/lib/files/fs";
import type { FileEntry, PathRef } from "@/lib/files/types";
import type { EngineCommand, EngineExecuteOptions, EngineResult } from "@/lib/engine/types";
import { engineProgressLabel, engineStageLabel, setEngineStage } from "./stage";
import { KIND_FILTER_MATCH, type KindFilter } from "@/lib/search/types";
import { t } from "@/lib/i18n";

type StrictKind = Exclude<KindFilter, "any">;

export type ToolOutput =
  | { ok: true; data: unknown; durationMs: number; warnings?: string[] }
  | {
      ok: false;
      error: { code: string; message: string; details?: unknown };
      durationMs: number;
    };

/** Types de commande acceptés — un seul nom canonique par opération. */
const COMMAND_TYPES = new Set([
  "list_storage_roots",
  "list",
  "search",
  "analyze",
  "properties",
  "create",
  "rename",
  "delete",
  "copy",
  "move",
  "organize",
  "compress",
  "extract",
  "share",
  "sort",
  "filter",
]);

function toOutput(result: EngineResult): ToolOutput {
  if (result.ok) {
    return {
      ok: true,
      data: result.data ?? null,
      durationMs: result.durationMs,
      ...(result.warnings?.length ? { warnings: result.warnings } : {}),
    };
  }
  return {
    ok: false,
    error: result.error ?? { code: "EXECUTION_FAILED", message: t("system.ai.unknownError") },
    durationMs: result.durationMs,
  };
}

function fail(code: string, message: string, started = Date.now()): ToolOutput {
  return { ok: false, error: { code, message }, durationMs: Date.now() - started };
}

function normalizePath(p: unknown): PathRef {
  const o = (p ?? {}) as { rootId?: string; segments?: unknown };
  return {
    rootId: (o.rootId ?? "internal") as PathRef["rootId"],
    segments: Array.isArray(o.segments) ? o.segments.map(String) : [],
  };
}

function normalizePaths(v: unknown): PathRef[] {
  return Array.isArray(v) ? v.map(normalizePath) : [];
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

function namesOf(params: Record<string, unknown>): string[] {
  return asStringArray(params.names ?? (params.name ? [params.name] : []));
}

/** Résout des noms en entrées réelles du dossier parent (via le moteur). */
async function resolveEntries(parent: PathRef, names: string[]) {
  const listing = await listDirectory(parent);
  if (!listing.ok) {
    return {
      ok: false as const,
      message: listing.message ?? t("system.ai.parentUnreadable"),
    };
  }
  const byName = new Map(listing.entries.map((e) => [e.name, e]));
  const entries: FileEntry[] = [];
  const missing: string[] = [];
  for (const n of names) {
    const hit = byName.get(n);
    if (hit) entries.push(hit);
    else missing.push(n);
  }
  return { ok: true as const, entries, missing };
}

/**
 * Vérifie que les stockages demandés existent ET sont montés. Sans
 * demande explicite, on prend tous les stockages montés.
 */
function resolveRoots(requested: PathRef[]): {
  available: PathRef[];
  missing: { rootId: string; reason: string }[];
  labels: Record<string, string>;
} {
  const all = listRoots();
  const labels: Record<string, string> = {};
  for (const r of all) labels[r.id] = r.label;
  if (requested.length === 0) {
    return {
      available: all
        .filter((r) => r.available)
        .map((r) => ({ rootId: r.id, segments: [] as string[] })),
      missing: [],
      labels,
    };
  }
  const available: PathRef[] = [];
  const missing: { rootId: string; reason: string }[] = [];
  for (const p of requested) {
    const root = all.find((r) => r.id === p.rootId);
    if (!root) {
      missing.push({ rootId: String(p.rootId), reason: t("system.ai.unknownStorage") });
      continue;
    }
    if (!root.available) {
      missing.push({
        rootId: root.id,
        reason: t("system.extra.storageNotMounted", { label: root.label }),
      });
      continue;
    }
    available.push(p);
  }
  return { available, missing, labels };
}

/**
 * Emplacement lisible pour l'utilisateur : le libellé du stockage suivi du
 * dossier, sans chemin technique. Ex. « Stockage interne · Documents ».
 */
function readableLocation(rootLabel: string, segments: string[] = []): string {
  const parts = segments.filter((s) => s && s !== ".");
  return parts.length ? `${rootLabel} · ${parts.join(" / ")}` : rootLabel;
}

function summarizeEntry(entry: FileEntry) {
  return {
    name: entry.name,
    isDirectory: entry.isDirectory,
    kind: entry.kind,
    ext: entry.ext,
    size: entry.size ?? null,
    modifiedAt: entry.mtime ? new Date(entry.mtime).toISOString() : null,
  };
}

/* ---------- Routeur unique ---------- */

export async function runEngineTool(toolName: string, rawInput: unknown): Promise<ToolOutput> {
  const started = Date.now();
  if (toolName !== "run_engine_command") {
    return fail("UNKNOWN_COMMAND", t("system.ai.unknownTool", { name: toolName }), started);
  }

  const call = (rawInput ?? {}) as { type?: unknown; params?: unknown };
  const type = String(call.type ?? "").trim();
  const params = (call.params ?? {}) as Record<string, unknown>;
  if (!type) return fail("INVALID_PARAMS", t("system.ai.missingCommandType"), started);
  if (!COMMAND_TYPES.has(type)) {
    return fail("UNKNOWN_COMMAND", t("system.ai.unsupportedCommand", { type }), started);
  }

  // Ligne d'activité : une étape est publiée immédiatement, puis remplacée
  // par la progression réelle du moteur. Jamais de temps mort.
  setEngineStage(engineStageLabel(type));
  const engineOptions: EngineExecuteOptions = {
    onProgress: (p) => setEngineStage(engineProgressLabel(type, p.processed, p.total)),
  };
  const run = <D = unknown>(command: EngineCommand) => execute<D>(command, engineOptions);

  try {
    switch (type) {
      /* ---------- Stockages ---------- */
      case "list_storage_roots": {
        const roots = listRoots().map((r) => ({
          rootId: r.id,
          label: r.label,
          hint: r.hint ?? null,
          available: r.available,
        }));
        return { ok: true, data: { roots }, durationMs: Date.now() - started };
      }

      /* ---------- Lecture ---------- */
      case "list": {
        const path = normalizePath(params.path);
        const root = listRoots().find((r) => r.id === path.rootId);
        if (!root)
          return fail(
            "NOT_FOUND",
            t("system.ai.unknownStorageNamed", { id: String(path.rootId) }),
            started,
          );
        if (!root.available) {
          return fail(
            "UNAVAILABLE",
            t("system.extra.storageNotAvailable", { label: root.label }),
            started,
          );
        }
        const res = await run<{ entries: FileEntry[] }>({ type: "list", params: { path } });
        if (!res.ok) return toOutput(res);
        const entries = res.data!.entries;
        return {
          ok: true,
          data: {
            rootId: root.id,
            rootLabel: root.label,
            path: path.segments.join("/"),
            count: entries.length,
            folders: entries.filter((e) => e.isDirectory).length,
            files: entries.filter((e) => !e.isDirectory).length,
            entries: entries.slice(0, 50).map(summarizeEntry),
            truncated: entries.length > 50,
          },
          durationMs: res.durationMs,
        };
      }

      case "search": {
        const requested = normalizePaths(params.roots);
        const rawLimit = params.limit;
        const limit =
          typeof rawLimit === "number" && rawLimit > 0 ? Math.min(rawLimit, 5000) : 2000;
        const rawExts = params.exts ?? params.extensions ?? params.ext;
        const exts = (Array.isArray(rawExts) ? rawExts : rawExts ? [rawExts] : [])
          .map((e) =>
            String(e)
              .trim()
              .toLowerCase()
              .replace(/^[.*]+/, ""),
          )
          .filter((e) => e.length > 0 && e.length <= 8);
        const kind = params.kind ? String(params.kind).toLowerCase() : undefined;
        const resolved = resolveRoots(requested);
        if (requested.length > 0 && resolved.available.length === 0) {
          return fail(
            "UNAVAILABLE",
            `Aucun des stockages demandés n'est disponible : ${resolved.missing
              .map((m) => `${m.rootId} (${m.reason})`)
              .join(", ")}`,
            started,
          );
        }
        const roots = resolved.available;
        const res = await run<{ results: unknown[] }>({
          type: "search",
          params: {
            query: String(params.query ?? ""),
            roots,
            limit,
            filters: {
              kind,
              size: (params.size as string | undefined) ?? undefined,
              date: (params.date as string | undefined) ?? undefined,
              exts: exts.length ? exts : undefined,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          },
        });
        if (!res.ok) return toOutput(res);

        type Hit = FileEntry & { rootId: string; segments: string[]; parentSegments: string[] };
        // Garde-fou : aucun résultat provenant d'un stockage non demandé,
        // ni d'un type étranger à la demande, ne peut atteindre le modèle.
        const allowedRoots = new Set(roots.map((r) => String(r.rootId)));
        const extSet = exts.length ? new Set(exts) : null;
        const allowedKinds =
          kind && kind !== "any" && kind in KIND_FILTER_MATCH
            ? KIND_FILTER_MATCH[kind as StrictKind]
            : undefined;
        const hits = (res.data!.results as Hit[]).filter((h) => {
          if (!allowedRoots.has(h.rootId)) return false;
          if (extSet) {
            if (h.isDirectory) return false;
            const e = (h.ext ?? h.name.split(".").pop() ?? "").toLowerCase();
            if (!extSet.has(e)) return false;
          }
          if (allowedKinds && !allowedKinds.includes(h.kind)) return false;
          return true;
        });

        let totalBytes = 0;
        const perRoot = new Map<string, { count: number; bytes: number }>();
        const folders = new Map<string, { count: number; bytes: number }>();
        for (const h of hits) {
          totalBytes += h.size ?? 0;
          const r = perRoot.get(h.rootId) ?? { count: 0, bytes: 0 };
          r.count += 1;
          r.bytes += h.size ?? 0;
          perRoot.set(h.rootId, r);
          const key = `${resolved.labels[h.rootId] ?? h.rootId}/${h.parentSegments.join("/")}`;
          const f = folders.get(key) ?? { count: 0, bytes: 0 };
          f.count += 1;
          f.bytes += h.size ?? 0;
          folders.set(key, f);
        }
        return {
          ok: true,
          data: {
            criteria: { kind: kind ?? null, exts: exts.length ? exts : null },
            totalFound: hits.length,
            truncated: hits.length >= limit,
            totalBytes,
            perRoot: [...perRoot.entries()].map(([rootId, s]) => ({
              rootId,
              rootLabel: resolved.labels[rootId] ?? rootId,
              count: s.count,
              bytes: s.bytes,
            })),
            rootsUnavailable: resolved.missing,
            topFolders: [...folders.entries()]
              .sort((a, b) => b[1].count - a[1].count)
              .slice(0, 6)
              .map(([folder, s]) => ({ folder, count: s.count, bytes: s.bytes })),
            // Exemples réels, triés du plus récemment modifié au plus
            // ancien. Chaque champ vient du moteur : rien n'est estimé.
            examples: [...hits]
              .sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0))
              .slice(0, 12)
              .map((h) => ({
                name: h.name,
                size: h.size ?? null,
                modifiedAt: h.mtime ? new Date(h.mtime).toISOString() : null,
                rootLabel: resolved.labels[h.rootId] ?? h.rootId,
                /** Emplacement lisible, sans chemin technique. */
                location: readableLocation(resolved.labels[h.rootId] ?? h.rootId, h.parentSegments),
              })),
          },
          durationMs: res.durationMs,
        };
      }

      case "analyze": {
        const requested = normalizePaths(params.roots);
        const resolved = resolveRoots(requested);
        if (requested.length > 0 && resolved.available.length === 0) {
          return fail(
            "UNAVAILABLE",
            `Aucun des stockages demandés n'est disponible : ${resolved.missing
              .map((m) => `${m.rootId} (${m.reason})`)
              .join(", ")}`,
            started,
          );
        }
        const res = await run({ type: "analyze", params: { roots: resolved.available } });
        if (!res.ok) return toOutput(res);
        return {
          ok: true,
          data: {
            rootsScanned: resolved.available.map((r) => ({
              rootId: r.rootId,
              rootLabel: resolved.labels[r.rootId] ?? r.rootId,
            })),
            rootsUnavailable: resolved.missing,
            ...(res.data as object),
          },
          durationMs: res.durationMs,
        };
      }

      case "properties": {
        const parent = normalizePath(params.parent);
        const name = String(params.name ?? "");
        if (!name) return fail("INVALID_PARAMS", t("system.ai.missingName"), started);
        const resolved = await resolveEntries(parent, [name]);
        if (!resolved.ok) return fail("NOT_FOUND", resolved.message, started);
        if (resolved.missing.length)
          return fail(
            "NOT_FOUND",
            t("system.extra.itemNotFound", { name: resolved.missing[0] }),
            started,
          );
        return toOutput(
          await run({ type: "properties", params: { parent, entry: resolved.entries[0] } }),
        );
      }

      /* ---------- Écriture ---------- */
      case "create": {
        const parent = normalizePath(params.parent);
        const name = String(params.name ?? "");
        if (!name) return fail("INVALID_PARAMS", t("system.ai.missingFolderName"), started);
        return toOutput(await run({ type: "create", params: { parent, name } }));
      }

      case "rename": {
        const parent = normalizePath(params.parent);
        const oldName = String(params.oldName ?? params.name ?? "");
        const newName = String(params.newName ?? "");
        if (!oldName || !newName)
          return fail("INVALID_PARAMS", t("system.ai.renameNamesRequired"), started);
        const resolved = await resolveEntries(parent, [oldName]);
        if (!resolved.ok) return fail("NOT_FOUND", resolved.message, started);
        if (resolved.missing.length)
          return fail(
            "NOT_FOUND",
            t("system.extra.itemNotFound", { name: resolved.missing[0] }),
            started,
          );
        return toOutput(
          await run({
            type: "rename",
            params: { parent, entry: resolved.entries[0], newName },
          }),
        );
      }

      case "delete": {
        const parent = normalizePath(params.parent);
        const names = namesOf(params);
        if (names.length === 0)
          return fail("INVALID_PARAMS", t("system.engine.noItemsToDelete"), started);
        const resolved = await resolveEntries(parent, names);
        if (!resolved.ok) return fail("NOT_FOUND", resolved.message, started);
        if (resolved.entries.length === 0)
          return fail(
            "NOT_FOUND",
            t("system.extra.noItemsFound", { names: names.join(", ") }),
            started,
          );
        const out = toOutput(
          await run({ type: "delete", params: { parent, entries: resolved.entries } }),
        );
        if (out.ok && resolved.missing.length) {
          return {
            ...out,
            warnings: [...(out.warnings ?? []), `Introuvables : ${resolved.missing.join(", ")}`],
          };
        }
        return out;
      }

      case "copy":
      case "move": {
        const source = normalizePath(params.source ?? params.parent);
        const destination = normalizePath(params.destination);
        const names = namesOf(params);
        let entries: FileEntry[] = [];
        if (names.length === 0 && params.all === true) {
          const listing = await listDirectory(source);
          if (!listing.ok)
            return fail("NOT_FOUND", listing.message ?? t("system.ai.sourceUnreadable"), started);
          entries = listing.entries.filter((e) =>
            params.filesOnly === false ? true : !e.isDirectory,
          );
        } else {
          if (names.length === 0)
            return fail("INVALID_PARAMS", t("system.engine.noItemsToProcess"), started);
          const resolved = await resolveEntries(source, names);
          if (!resolved.ok) return fail("NOT_FOUND", resolved.message, started);
          entries = resolved.entries;
        }
        if (entries.length === 0)
          return fail(
            "NOT_FOUND",
            t("system.extra.noItemsFound", {
              names: names.join(", ") || t("system.extra.emptyFolder"),
            }),
            started,
          );
        return toOutput(await run({ type, params: { source, entries, destination } }));
      }

      case "organize": {
        const folder = normalizePath(params.folder ?? params.path ?? params.parent);
        const rule = params.rule === "date" ? "date" : "type";
        return toOutput(await run({ type: "organize", params: { folder, rule } }));
      }

      case "compress": {
        const parent = normalizePath(params.parent);
        const destination = normalizePath(params.destination ?? params.parent);
        const names = namesOf(params);
        const archiveName = String(params.archiveName ?? "");
        if (!archiveName)
          return fail("INVALID_PARAMS", t("system.ai.archiveNameRequired"), started);
        if (names.length === 0)
          return fail("INVALID_PARAMS", t("system.engine.noItemsToCompress"), started);
        const resolved = await resolveEntries(parent, names);
        if (!resolved.ok) return fail("NOT_FOUND", resolved.message, started);
        if (resolved.entries.length === 0)
          return fail(
            "NOT_FOUND",
            t("system.extra.noItemsFound", { names: names.join(", ") }),
            started,
          );
        return toOutput(
          await run({
            type: "compress",
            params: {
              parent,
              entries: resolved.entries,
              destination,
              archiveName,
              format: (params.format as "zip" | "tar" | "tar.gz" | undefined) ?? "zip",
            },
          }),
        );
      }

      case "extract": {
        const parent = normalizePath(params.parent);
        const destination = normalizePath(params.destination ?? params.parent);
        const name = String(params.name ?? "");
        if (!name) return fail("INVALID_PARAMS", t("system.ai.archiveNameMissing"), started);
        const resolved = await resolveEntries(parent, [name]);
        if (!resolved.ok) return fail("NOT_FOUND", resolved.message, started);
        if (resolved.missing.length)
          return fail("NOT_FOUND", t("system.ai.archiveNotFound", { name }), started);
        return toOutput(
          await run({
            type: "extract",
            params: { parent, entry: resolved.entries[0], destination },
          }),
        );
      }

      case "share": {
        const parent = normalizePath(params.parent);
        const names = namesOf(params);
        if (names.length === 0)
          return fail("INVALID_PARAMS", t("system.engine.noFileToShare"), started);
        const resolved = await resolveEntries(parent, names);
        if (!resolved.ok) return fail("NOT_FOUND", resolved.message, started);
        if (resolved.entries.length === 0)
          return fail(
            "NOT_FOUND",
            t("system.extra.noItemsFound", { names: names.join(", ") }),
            started,
          );
        return toOutput(
          await run({ type: "share", params: { parent, entries: resolved.entries } }),
        );
      }

      /* ---------- Tri / filtre (délégation directe) ---------- */
      default:
        return toOutput(await run({ type, params: params as unknown }));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail("EXECUTION_FAILED", message, started);
  } finally {
    setEngineStage(null);
  }
}
