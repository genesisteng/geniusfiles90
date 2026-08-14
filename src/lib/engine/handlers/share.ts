import { shareEntries } from "@/lib/files/operations";
import { EngineExecutionError } from "../errors";
import { ensurePermission } from "../permissions";
import type { CommandHandler, ShareParams } from "../types";
import { t } from "@/lib/i18n";

export const shareHandler: CommandHandler<ShareParams, { shared: number }> = {
  type: "share",
  sideEffect: true,
  validate(p) {
    if (!p?.parent || !Array.isArray(p.entries) || p.entries.length === 0)
      return { ok: false, code: "INVALID_PARAMS", message: t("system.engine.noFileToShare") };
    return { ok: true };
  },
  async run(p) {
    await ensurePermission("storage.read");
    const files = p.entries.filter((e) => !e.isDirectory);
    const res = await shareEntries(p.parent, files);
    if (!res.ok)
      throw new EngineExecutionError(
        "EXECUTION_FAILED",
        res.error ?? t("system.engine.shareFailed"),
      );
    return { shared: files.length };
  },
};
