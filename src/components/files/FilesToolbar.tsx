import {
  ArrowDownAZ,
  ArrowUpAZ,
  LayoutGrid,
  List,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SortKey, SortOrder, ViewMode } from "@/lib/files/types";
import { SortMenu, useSortLabels } from "./SortMenu";
import { useT } from "@/lib/i18n";

export function FilesToolbar({
  view,
  onViewChange,
  sortKey,
  sortOrder,
  onSortChange,
  foldersFirst,
  onFoldersFirstChange,
  onRefresh,
  refreshing,
  count,
}: {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  sortKey: SortKey;
  sortOrder: SortOrder;
  onSortChange: (key: SortKey, order: SortOrder) => void;
  foldersFirst: boolean;
  onFoldersFirstChange: (on: boolean) => void;
  onRefresh: () => void;
  refreshing: boolean;
  count?: number;
}) {
  const t = useT();
  const SORT_LABEL = useSortLabels();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="mr-auto text-[11px] text-muted-foreground">
        {count != null ? t("count.items", { count }) : ""}
      </span>

      <button
        type="button"
        onClick={onRefresh}
        aria-label={t("action.refresh")}
        className="rounded-lg border border-border bg-surface p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={t("files.sort.optionsAria")}
          aria-expanded={open}
          className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">{SORT_LABEL[sortKey]}</span>
          {sortOrder === "asc" ? (
            <ArrowUpAZ className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownAZ className="h-3.5 w-3.5" />
          )}
        </button>
        {open ? (
          <SortMenu
            className="absolute right-0 top-[calc(100%+6px)] z-40"
            sortKey={sortKey}
            sortOrder={sortOrder}
            foldersFirst={foldersFirst}
            onFoldersFirstChange={onFoldersFirstChange}
            onApply={(k, o) => {
              onSortChange(k, o);
              setOpen(false);
            }}
          />
        ) : null}
      </div>

      <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
        <button
          type="button"
          onClick={() => onViewChange("list")}
          aria-pressed={view === "list"}
          aria-label={t("files.view.list")}
          className={`rounded-md p-1 transition-colors ${
            view === "list" ? "bg-secondary text-foreground" : "text-muted-foreground"
          }`}
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange("grid")}
          aria-pressed={view === "grid"}
          aria-label={t("files.view.grid")}
          className={`rounded-md p-1 transition-colors ${
            view === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
