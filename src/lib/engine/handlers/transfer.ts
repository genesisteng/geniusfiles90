import { createSignal, transferEntries } from "@/lib/files/operations";
import type { FileEntry } from "@/lib/files/types";
import { EngineExecutionError } from "../errors";
import { ensurePermission } from "../permissions";
import type { CommandHandler, CopyParams, MoveParams, EngineExecuteOptions } from "../types";
import { t } from "@/lib/i18n";

function assertParams(p: CopyParams) {
  if (!p?.source || !p?.destination) return t("system.engine.sourceDestRequired");
  if (!Array.isArray(p.entries) || p.entries.length === 0)
    return t("system.engine.noItemsToProcess");
  return null;
}

async function runTransfer(mode: "copy" | "move", p: CopyParams, ctx: EngineExecuteOptions) {
  await ensurePermission("storage.write");
  const signal = createSignal();
  if (ctx.signal) {
    if (ctx.signal.aborted) signal.cancel();
    else ctx.signal.addEventListener("abort", () => signal.cancel(), { once: true });
  }
  const res = await transferEntries(p.source, p.entries, p.destination, {
    mode,
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
    throw new EngineExecutionError("CANCELLED", t("system.engine.transferCancelled"));
  if (!res.ok && res.succeeded === 0) {
    throw new EngineExecutionError(
      "EXECUTION_FAILED",
      res.failed[0]?.reason ?? t("system.engine.transferFailed"),
      { failed: res.failed },
    );
  }
  return {
    succeeded: res.succeeded,
    failed: res.failed,
    partial: res.failed.length > 0 && res.succeeded > 0,
  };
}

export const copyHandler: CommandHandler<
  CopyParams,
  { succeeded: number; failed: { name: string; reason: string }[]; partial: boolean }
> = {
  type: "copy",
  sideEffect: true,
  validate: (p) => {
    const err = assertParams(p);
    return err ? { ok: false, code: "INVALID_PARAMS", message: err } : { ok: true };
  },
  run: (p, ctx) => runTransfer("copy", p, ctx),
};

export const moveHandler: CommandHandler<
  MoveParams,
  { succeeded: number; failed: { name: string; reason: string }[]; partial: boolean }
> = {
  type: "move",
  sideEffect: true,
  validate: (p) => {
    const err = assertParams(p);
    return err ? { ok: false, code: "INVALID_PARAMS", message: err } : { ok: true };
  },
  run: (p, ctx) => runTransfer("move", p, ctx),
};

export type { FileEntry };
