import type { FileEntry, SortKey, SortOrder } from "./types";

const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

export function sortEntries(
  entries: FileEntry[],
  key: SortKey,
  order: SortOrder,
  foldersFirst: boolean,
): FileEntry[] {
  const dir = order === "asc" ? 1 : -1;
  const sorted = [...entries].sort((a, b) => {
    if (foldersFirst && a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    switch (key) {
      case "size":
        return ((a.size ?? -1) - (b.size ?? -1)) * dir;
      case "date":
        return ((a.mtime ?? 0) - (b.mtime ?? 0)) * dir;
      case "type": {
        const t = collator.compare(a.kind + (a.ext ?? ""), b.kind + (b.ext ?? ""));
        return t !== 0 ? t * dir : collator.compare(a.name, b.name);
      }
      case "name":
      default:
        return collator.compare(a.name, b.name) * dir;
    }
  });
  return sorted;
}
