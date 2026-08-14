import { readDetails, type DetailsInfo } from "@/lib/files/operations";
import { ensurePermission } from "../permissions";
import type { CommandHandler, PropertiesParams } from "../types";
import { t } from "@/lib/i18n";

export const propertiesHandler: CommandHandler<PropertiesParams, DetailsInfo> = {
  type: "properties",
  sideEffect: false,
  validate(p) {
    if (!p?.parent || !p?.entry)
      return { ok: false, code: "INVALID_PARAMS", message: t("system.engine.itemMissing") };
    return { ok: true };
  },
  async run(p) {
    await ensurePermission("storage.read");
    return readDetails(p.parent, p.entry);
  },
};
