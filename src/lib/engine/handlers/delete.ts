import { createSignal, deleteEntries } from "@/lib/files/operations";
import { EngineExecutionError } from "../errors";
import { ensurePermission } from "../permissions";
import type { CommandHandler, DeleteParams } from "../types";
import { t } from "@/lib/i18n";

export const deleteHandler: CommandHandler<
  DeleteParams,
  { succeeded: number; failed: { name: string; reason: string }[] }
> = {
  type: "delete",
  sideEffect: true,
  validate(p) {
    if (!p?.parent || !Array.isArray(p.entries) || p.entries.length === 0)
      return { ok: false, code: "INVALID_PARAMS", message: t("system.engine.noItemsToDelete") };
    return { ok: true };
  },
  async run(p, ctx) {
    await ensurePermission("storage.write");
    // Progression réelle + annulation : une suppression de masse reste
    // interruptible et n'immobilise jamais l'interface.
    const signal = createSignal();
    if (ctx.signal) {
      if (ctx.signal.aborted) signal.cancel();
      else ctx.signal.addEventListener("abort", () => signal.cancel(), { once: true });
    }
    const res = await deleteEntries(p.parent, p.entries, {
      signal,
      onProgress: (evt) =>
        ctx.onProgress?.({
          processed: evt.completed,
          total: evt.total,
          bytes: evt.bytes,
          totalBytes: evt.totalBytes,
          currentName: evt.currentName,
          etaMs: evt.etaMs,
        }),
    });
    if (res.cancelled)
      throw new EngineExecutionError("CANCELLED", t("system.engine.deleteCancelled"));
    if (!res.ok && res.succeeded === 0) {
      throw new EngineExecutionError(
        "EXECUTION_FAILED",
        res.failed[0]?.reason ?? t("system.engine.deleteFailed"),
        { failed: res.failed },
      );
    }
    return { succeeded: res.succeeded, failed: res.failed };
  },
};
