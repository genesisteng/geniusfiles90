import { createArchive, extractArchive } from "@/lib/files/archive";
import { createSignal } from "@/lib/files/operations";
import { EngineExecutionError } from "../errors";
import { ensurePermission } from "../permissions";
import type { CommandHandler, CompressParams, ExtractParams, EngineExecuteOptions } from "../types";
import { t } from "@/lib/i18n";

function bindSignal(ctx: EngineExecuteOptions) {
  const s = createSignal();
  if (ctx.signal) {
    if (ctx.signal.aborted) s.cancel();
    else ctx.signal.addEventListener("abort", () => s.cancel(), { once: true });
  }
  return s;
}

export const compressHandler: CommandHandler<CompressParams, { path?: string; size?: number }> = {
  type: "compress",
  sideEffect: true,
  validate(p) {
    if (!p?.parent || !p?.destination)
      return { ok: false, code: "INVALID_PARAMS", message: t("system.engine.sourceDestRequired") };
    if (!p.archiveName?.trim())
      return { ok: false, code: "INVALID_PARAMS", message: t("system.engine.archiveNameMissing") };
    if (!Array.isArray(p.entries) || p.entries.length === 0)
      return { ok: false, code: "INVALID_PARAMS", message: t("system.engine.noItemsToCompress") };
    return { ok: true };
  },
  async run(p, ctx) {
    await ensurePermission("storage.write");
    const signal = bindSignal(ctx);
    const res = await createArchive({
      parent: p.parent,
      entries: p.entries,
      destination: p.destination,
      archiveName: p.archiveName,
      format: p.format ?? "zip",
      level: p.level ?? 6,
      password: p.password,
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
      throw new EngineExecutionError("CANCELLED", t("system.engine.compressCancelled"));
    if (!res.ok) {
      const code = /existe/i.test(res.error ?? "") ? "CONFLICT" : "EXECUTION_FAILED";
      throw new EngineExecutionError(code, res.error ?? t("system.engine.compressFailed"));
    }
    return { path: res.path, size: res.size };
  },
};

export const extractHandler: CommandHandler<
  ExtractParams,
  { completed?: number; skipped?: number; overwritten?: number; path?: string }
> = {
  type: "extract",
  sideEffect: true,
  validate(p) {
    if (!p?.parent || !p?.entry || !p?.destination)
      return {
        ok: false,
        code: "INVALID_PARAMS",
        message: t("system.engine.incompleteExtractParams"),
      };
    return { ok: true };
  },
  async run(p, ctx) {
    await ensurePermission("storage.write");
    const signal = bindSignal(ctx);
    const res = await extractArchive({
      parent: p.parent,
      entry: p.entry,
      destination: p.destination,
      entries: p.entries,
      conflict: p.conflict ?? "rename",
      password: p.password,
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
      throw new EngineExecutionError("CANCELLED", t("system.engine.extractCancelled"));
    if (!res.ok)
      throw new EngineExecutionError(
        "EXECUTION_FAILED",
        res.error ?? t("system.engine.extractFailed"),
      );
    return {
      completed: res.completed,
      skipped: res.skipped,
      overwritten: res.overwritten,
      path: res.path,
    };
  },
};
