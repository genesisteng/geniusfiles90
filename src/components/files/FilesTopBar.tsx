import {
  ArrowLeft,
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  CheckSquare,
  FolderPlus,
  LayoutGrid,
  List,
  MoreVertical,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { SortKey, SortOrder, ViewMode } from "@/lib/files/types";
import { SelectionActionRow } from "./SelectionBar";
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

type Props = {
  title: string;
  count?: number;
  onBack: () => void;
  onSearch: () => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  sortKey: SortKey;
  sortOrder: SortOrder;
  onSortChange: (key: SortKey, order: SortOrder) => void;
  foldersFirst?: boolean;
  onFoldersFirstChange?: (on: boolean) => void;
  onRefresh: () => void;
  refreshing: boolean;
  /** Absent → l'entrée « Nouveau dossier » n'est pas proposée (catégories). */
  onNewFolder?: () => void;
  onSelect: () => void;

  /**
   * Quand défini, **seule** la première ligne est remplacée par la barre de
   * sélection (même hauteur) : le fil d'Ariane rendu via `children` reste
   * strictement à la même position.
   */
  selection?: {
    count: number;
    /** Taille totale de la sélection (« 482 Mo ») ou « Calcul… ». */
    sizeLabel?: string | null;
    onClear: () => void;
    onSelectAll: () => void;
    onSelectRange?: () => void;
  } | null;
  /** Ligne secondaire (fil d'Ariane) rendue dans le même en-tête collant. */
  children?: React.ReactNode;
};

/**
 * En-tête du gestionnaire de fichiers — structure Android native :
 * retour · titre · recherche · vue · menu. Les zones tactiles font 44 px,
 * les marges hautes respectent la safe area système.
 */
export function FilesTopBar({
  title,
  count,
  onBack,
  onSearch,
  view,
  onViewChange,
  sortKey,
  sortOrder,
  onSortChange,
  foldersFirst,
  onFoldersFirstChange,
  onRefresh,
  refreshing,
  onNewFolder,
  onSelect,
  selection,
  children,
}: Props) {
  const t = useT();
  const SORT_LABEL = useSortLabel();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [menu]);

  // Le menu d'options n'a pas de sens pendant une sélection.
  useEffect(() => {
    if (selection) setMenu(false);
  }, [selection]);

  return (
    <header className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/95 pt-safe backdrop-blur">
      {selection ? (
        <div className="pl-safe pr-safe">
          <SelectionActionRow
            count={selection.count}
            sizeLabel={selection.sizeLabel}
            onClear={selection.onClear}
            onSelectAll={selection.onSelectAll}
            onSelectRange={selection.onSelectRange}
          />
        </div>
      ) : (
        <div className="flex h-12 items-center gap-1 px-1.5 pl-safe pr-safe">
          <IconButton label={t("action.back")} onClick={onBack}>
            <ArrowLeft className="h-[21px] w-[21px]" strokeWidth={2.1} />
          </IconButton>
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em]">
              {title}
            </p>
            {count != null ? (
              <p className="truncate text-[11.5px] leading-tight text-muted-foreground">
                {t("count.items", { count })}
              </p>
            ) : null}
          </div>
          <IconButton label={t("action.search")} onClick={onSearch}>
            <Search className="h-[20px] w-[20px]" strokeWidth={2.1} />
          </IconButton>
          <IconButton
            label={view === "list" ? t("files.view.grid") : t("files.view.list")}
            onClick={() => onViewChange(view === "list" ? "grid" : "list")}
          >
            {view === "list" ? (
              <LayoutGrid className="h-[20px] w-[20px]" strokeWidth={2.1} />
            ) : (
              <List className="h-[20px] w-[20px]" strokeWidth={2.1} />
            )}
          </IconButton>
          <div className="relative" ref={menuRef}>
            <IconButton label={t("action.more")} onClick={() => setMenu((v) => !v)} expanded={menu}>
              <MoreVertical className="h-[20px] w-[20px]" strokeWidth={2.1} />
            </IconButton>
            {menu ? (
              <div
                role="menu"
                className="glass-panel animate-scale-in absolute right-1 top-[calc(100%+4px)] z-40 w-56 origin-top-right overflow-hidden rounded-2xl p-1.5 shadow-elevated"
              >
                <MenuLabel>{t("files.sort.by")}</MenuLabel>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <MenuItem
                    key={k}
                    onClick={() => onSortChange(k, sortOrder)}
                    trailing={k === sortKey ? <Check className="h-4 w-4 text-primary" /> : null}
                  >
                    {SORT_LABEL[k]}
                  </MenuItem>
                ))}
                <MenuItem
                  onClick={() => onSortChange(sortKey, sortOrder === "asc" ? "desc" : "asc")}
                  trailing={
                    sortOrder === "asc" ? (
                      <ArrowUpAZ className="h-4 w-4" />
                    ) : (
                      <ArrowDownAZ className="h-4 w-4" />
                    )
                  }
                >
                  {sortOrder === "asc" ? t("files.sort.ascending") : t("files.sort.descending")}
                </MenuItem>
                {onFoldersFirstChange ? (
                  <>
                    <Divider />
                    <MenuItem
                      onClick={() => onFoldersFirstChange(!foldersFirst)}
                      trailing={
                        <span
                          className={`flex h-[18px] w-8 items-center rounded-full p-0.5 transition-colors ${
                            foldersFirst ? "bg-primary" : "bg-secondary"
                          }`}
                        >
                          <span
                            className={`h-[14px] w-[14px] rounded-full bg-surface transition-transform duration-200 ${
                              foldersFirst ? "translate-x-[14px]" : ""
                            }`}
                          />
                        </span>
                      }
                      keepOpen
                    >
                      {t("files.sort.foldersFirst")}
                    </MenuItem>
                  </>
                ) : null}
                <Divider />
                {onNewFolder ? (
                  <MenuItem
                    onClick={onNewFolder}
                    leading={<FolderPlus className="h-[18px] w-[18px]" />}
                  >
                    {t("action.newFolder")}
                  </MenuItem>
                ) : null}

                <MenuItem
                  onClick={onSelect}
                  leading={<CheckSquare className="h-[18px] w-[18px]" />}
                >
                  {t("action.select")}
                </MenuItem>
                <MenuItem
                  onClick={onRefresh}
                  leading={
                    <RefreshCw
                      className={`h-[18px] w-[18px] ${refreshing ? "animate-spin" : ""}`}
                    />
                  }
                >
                  {t("action.refresh")}
                </MenuItem>
              </div>
            ) : null}
          </div>
        </div>
      )}
      {children ? <div className="pl-safe pr-safe">{children}</div> : null}
    </header>
  );

  function MenuItem({
    children,
    onClick,
    leading,
    trailing,
    keepOpen,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
    keepOpen?: boolean;
  }) {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClick();
          if (!keepOpen) setMenu(false);
        }}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] text-foreground transition-colors hover:bg-secondary active:bg-secondary"
      >
        {leading ? <span className="text-muted-foreground">{leading}</span> : null}
        <span className="flex-1 truncate">{children}</span>
        {trailing ? <span className="text-muted-foreground">{trailing}</span> : null}
      </button>
    );
  }
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-border" />;
}

function IconButton({
  children,
  label,
  onClick,
  expanded,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[background-color,transform,color] duration-150 hover:bg-secondary hover:text-foreground active:scale-95 active:bg-secondary"
    >
      {children}
    </button>
  );
}
