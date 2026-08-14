import { runSearch } from "@/lib/search/engine";
import type { SearchResult, SearchFilters } from "@/lib/search/types";
import { EngineExecutionError } from "../errors";
import { ensurePermission } from "../permissions";
import type { CommandHandler, SearchParams } from "../types";
import { t } from "@/lib/i18n";

export const searchHandler: CommandHandler<SearchParams, { results: SearchResult[] }> = {
  type: "search",
  sideEffect: false,
  validate(p) {
    if (!Array.isArray(p?.roots) || p.roots.length === 0)
      return { ok: false, code: "INVALID_PARAMS", message: t("system.engine.noLocationToBrowse") };
    return { ok: true };
  },
  async run(p, ctx) {
    await ensurePermission("storage.read");
    const filters: SearchFilters = {
      kind: p.filters?.kind ?? "any",
      size: p.filters?.size ?? "any",
      date: p.filters?.date ?? "any",
      sizeMinBytes: p.filters?.sizeMinBytes,
      sizeMaxBytes: p.filters?.sizeMaxBytes,
      mtimeMin: p.filters?.mtimeMin,
      mtimeMax: p.filters?.mtimeMax,
      exts: p.filters?.exts?.length ? p.filters.exts : undefined,
    } as SearchFilters;

    const collected: SearchResult[] = [];
    let scanned = 0;

    return await new Promise((resolve, reject) => {
      const controller = runSearch({
        query: p.query ?? "",
        filters,
        roots: p.roots.map((path) => ({ rootId: path.rootId, path })),
        onBatch: (batch) => {
          for (const r of batch) {
            if (p.limit && collected.length >= p.limit) break;
            collected.push(r);
          }
          ctx.onProgress?.({ processed: collected.length, total: p.limit ?? collected.length });
          if (p.limit && collected.length >= p.limit) controller.abort();
        },
        onProgress: (n, current) => {
          scanned = n;
          ctx.onProgress?.({
            processed: collected.length,
            total: p.limit ?? collected.length,
            currentName: current,
          });
        },
        onDone: () => resolve({ results: collected }),
      });
      if (ctx.signal) {
        if (ctx.signal.aborted) controller.abort();
        else ctx.signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
      controller.done.catch((err: unknown) =>
        reject(
          new EngineExecutionError(
            "EXECUTION_FAILED",
            err instanceof Error ? err.message : String(err),
          ),
        ),
      );
      void scanned;
    });
  },
};
