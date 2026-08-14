import { ArrowLeft, FolderPlus, LayoutGrid, List, MoreVertical, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { SortKey, SortOrder, ViewMode } from "@/lib/files/types";
import { SelectionActionRow } from "./SelectionBar";
import { SortMenu } from "./SortMenu";
import { useT } from "@/lib/i18n";

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
  /** Absent → l'entrée « Nouveau dossier » n'est pas proposée (catégories). */
  onNewFolder?: () => void;

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
  onNewFolder,
  selection,
  children,
}: Props) {
  const t = useT();

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
              <div className="animate-scale-in absolute right-1 top-[calc(100%+4px)] z-40 origin-top-right">
                {onNewFolder ? (
                  <div className="mb-1.5 w-60 overflow-hidden rounded-2xl border border-border-strong bg-popover p-1.5 shadow-elevated">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenu(false);
                        onNewFolder();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] text-foreground transition-colors hover:bg-secondary active:bg-secondary"
                    >
                      <FolderPlus className="h-[18px] w-[18px] text-muted-foreground" />
                      <span className="flex-1 truncate">{t("action.newFolder")}</span>
                    </button>
                  </div>
                ) : null}
                <SortMenu
                  sortKey={sortKey}
                  sortOrder={sortOrder}
                  foldersFirst={foldersFirst}
                  onFoldersFirstChange={onFoldersFirstChange}
                  onApply={(k, o) => {
                    onSortChange(k, o);
                    setMenu(false);
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
      {children ? <div className="pl-safe pr-safe">{children}</div> : null}
    </header>
  );
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
