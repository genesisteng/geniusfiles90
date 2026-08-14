import { sortEntries } from "@/lib/files/sort";
import type { FileEntry } from "@/lib/files/types";
import { KIND_FILTER_MATCH, SIZE_BAND_BYTES, dateBandCutoff } from "@/lib/search/types";
import type { CommandHandler, SortParams, FilterParams } from "../types";
import { t } from "@/lib/i18n";

export const sortHandler: CommandHandler<SortParams, { entries: FileEntry[] }> = {
  type: "sort",
  sideEffect: false,
  validate(p) {
    if (!Array.isArray(p?.entries))
      return { ok: false, code: "INVALID_PARAMS", message: t("system.engine.missingEntriesList") };
    return { ok: true };
  },
  async run(p) {
    return {
      entries: sortEntries(p.entries, p.key, p.order ?? "asc", p.foldersFirst ?? true),
    };
  },
};

export const filterHandler: CommandHandler<FilterParams, { entries: FileEntry[] }> = {
  type: "filter",
  sideEffect: false,
  validate(p) {
    if (!Array.isArray(p?.entries))
      return { ok: false, code: "INVALID_PARAMS", message: t("system.engine.missingEntriesList") };
    return { ok: true };
  },
  async run(p) {
    let list = p.entries.slice();
    if (p.kind && p.kind !== "any") {
      const allowed = new Set(KIND_FILTER_MATCH[p.kind]);
      list = list.filter((e) => allowed.has(e.kind));
    }
    if (p.size && p.size !== "any") {
      const [lo, hi] = SIZE_BAND_BYTES[p.size];
      list = list.filter((e) => {
        const s = e.size ?? 0;
        return s >= lo && s < hi;
      });
    }
    if (p.date && p.date !== "any") {
      const cutoff = dateBandCutoff(p.date);
      if (cutoff != null) list = list.filter((e) => (e.mtime ?? 0) >= cutoff);
    }
    if (p.minBytes != null) list = list.filter((e) => (e.size ?? 0) >= p.minBytes!);
    if (p.maxBytes != null) list = list.filter((e) => (e.size ?? 0) <= p.maxBytes!);
    if (p.mtimeMin != null) list = list.filter((e) => (e.mtime ?? 0) >= p.mtimeMin!);
    if (p.mtimeMax != null) list = list.filter((e) => (e.mtime ?? 0) <= p.mtimeMax!);
    if (p.nameContains) {
      const needle = p.nameContains.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(needle));
    }
    return { entries: list };
  },
};
