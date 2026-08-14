import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  LayoutGrid,
  List,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SortKey, SortOrder, ViewMode } from "@/lib/files/types";
import { useT } from "@/lib/i18n";

function useSortLabel(): Record<SortKey, string> {
  const t = useT();
  return {
    name: t("files.sort.name"),
    date: t("files.sort.date"),
    size: t("files.sort.size"),
    type: t("files.sort.type"),
  };
}

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
  const SORT_LABEL = useSortLabel();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
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
          <div
            role="menu"
            className="glass-panel absolute right-0 top-[calc(100%+6px)] z-30 w-52 overflow-hidden rounded-xl p-1 shadow-soft"
          >
            <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("files.sort.by")}
            </p>
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => {
              const active = k === sortKey;
              return (
                <button
                  key={k}
                  role="menuitem"
                  onClick={() => onSortChange(k, sortOrder)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-secondary ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span>{SORT_LABEL[k]}</span>
                  {active ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                </button>
              );
            })}
            <div className="my-1 h-px bg-border" />
            <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("files.sort.order")}
            </p>
            <div className="flex gap-1 px-1 pb-1">
              <button
                onClick={() => onSortChange(sortKey, "asc")}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] transition-colors ${
                  sortOrder === "asc"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowUpAZ className="h-3.5 w-3.5" /> {t("files.sort.ascending")}
              </button>
              <button
                onClick={() => onSortChange(sortKey, "desc")}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] transition-colors ${
                  sortOrder === "desc"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowDownAZ className="h-3.5 w-3.5" /> {t("files.sort.descending")}
              </button>
            </div>
            <div className="my-1 h-px bg-border" />
            <button
              onClick={() => onFoldersFirstChange(!foldersFirst)}
              role="menuitemcheckbox"
              aria-checked={foldersFirst}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <span>{t("files.sort.foldersFirst")}</span>
              <span
                className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${
                  foldersFirst ? "bg-primary" : "bg-secondary"
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-white transition-transform ${
                    foldersFirst ? "translate-x-3" : ""
                  }`}
                />
              </span>
            </button>
          </div>
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
