import { scanCategories, type ScanResult } from "@/lib/files/analyzer";
import { ensurePermission } from "../permissions";
import { EngineExecutionError } from "../errors";
import type { CommandHandler, AnalyzeParams } from "../types";
import { t } from "@/lib/i18n";

export const analyzeHandler: CommandHandler<AnalyzeParams, ScanResult> = {
  type: "analyze",
  sideEffect: false,
  validate(p) {
    if (!p?.roots?.length)
      return { ok: false, code: "INVALID_PARAMS", message: t("system.engine.noLocationToAnalyze") };
    return { ok: true };
  },
  run(p, ctx) {
    return new Promise<ScanResult>((resolve, reject) => {
      ensurePermission("storage.read").then(
        () => {
          const handle = scanCategories(
            p.roots,
            (partial) =>
              ctx.onProgress?.({
                processed: partial.scannedFolders,
                total: partial.scannedFolders,
                currentName: t("count.files", { count: partial.totalFiles }),
              }),
            (final) => resolve(final),
          );
          if (ctx.signal) {
            if (ctx.signal.aborted) handle.cancel();
            else ctx.signal.addEventListener("abort", () => handle.cancel(), { once: true });
          }
        },
        (err) =>
          reject(
            err instanceof Error ? err : new EngineExecutionError("EXECUTION_FAILED", String(err)),
          ),
      );
    });
  },
};
