import { createDirectory } from "@/lib/files/operations";
import { EngineExecutionError } from "../errors";
import { ensurePermission } from "../permissions";
import type { CommandHandler, CreateParams } from "../types";
import { t } from "@/lib/i18n";

export const createHandler: CommandHandler<CreateParams, { name: string }> = {
  type: "create",
  sideEffect: true,
  validate(p) {
    if (!p?.parent)
      return { ok: false, code: "INVALID_PARAMS", message: t("system.engine.parentMissing") };
    const clean = p.name?.trim();
    if (!clean) return { ok: false, code: "INVALID_PARAMS", message: t("system.engine.emptyName") };
    if (/[\\/]/.test(clean))
      return {
        ok: false,
        code: "INVALID_PARAMS",
        message: t("system.engine.invalidCharsInName"),
      };
    if (p.kind && p.kind !== "folder")
      return {
        ok: false,
        code: "INVALID_PARAMS",
        message: t("system.engine.onlyFoldersSupported"),
      };
    return { ok: true };
  },
  async run(p) {
    await ensurePermission("storage.write");
    const res = await createDirectory(p.parent, p.name);
    if (!res.ok) {
      const msg = res.error ?? t("system.engine.createFailed");
      const code = /existe/i.test(msg) ? "CONFLICT" : "EXECUTION_FAILED";
      throw new EngineExecutionError(code, msg);
    }
    return { name: p.name.trim() };
  },
};
