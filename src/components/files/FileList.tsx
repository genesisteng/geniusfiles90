import { CheckCircle2, ChevronRight, Circle, Eye, MoreVertical } from "lucide-react";
import { memo, useRef } from "react";
import { countLabel } from "@/lib/copy";
import { useT } from "@/lib/i18n";
import { fileMetaLine, formatDate, formatSize, kindLabel } from "@/lib/files/format";
import { useFolderCount } from "@/lib/files/folder-count";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { FileIcon } from "./FileIcon";
import { useWindowVirtualList } from "@/hooks/use-virtual-list";

// Hauteurs FIXES : aucune re-mesure pendant le défilement, donc aucune
// « danse » des éléments, même en défilement rapide sur 100 000 fichiers.
const ROW_HEIGHT = 66;
const GRID_CELL_HEIGHT = 138;
const GRID_ROW_HEIGHT = GRID_CELL_HEIGHT + 10; // + gap vertical

type Props = {
  entries: FileEntry[];
  /** Dossier parent — sert au comptage paresseux des éléments d'un dossier. */
  parent?: PathRef | null;
  onOpen: (entry: FileEntry) => void;
  /**
   * Ouverture rapide depuis la vignette pendant le mode sélection : ouvre
   * le fichier dans le lecteur interne sans toucher à la sélection.
   * Par défaut, retombe sur `onOpen`.
   */
  onQuickOpen?: (entry: FileEntry) => void;
  /**
   * Vignette personnalisée (icône réelle d'une application, par exemple).
   * Retourne `null` pour conserver l'icône de type standard.
   */
  renderIcon?: (entry: FileEntry) => React.ReactNode;
  onLongPress: (entry: FileEntry) => void;
  onMore: (entry: FileEntry) => void;
  selectionMode: boolean;
  isSelected: (entry: FileEntry) => boolean;
  onToggleSelect: (entry: FileEntry) => void;
};

const LONG_PRESS_MS = 380;

function usePressBinder(entry: FileEntry, onLongPress: (e: FileEntry) => void) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    origin.current = null;
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return {
    fired,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        fired.current = false;
        clear();
        origin.current = { x: e.clientX, y: e.clientY };
        timer.current = window.setTimeout(() => {
          fired.current = true;
          onLongPress(entry);
        }, LONG_PRESS_MS);
      },
      /* Dès que le doigt glisse (défilement ou tirer pour actualiser),
         l'appui long est abandonné : plus aucune sélection accidentelle. */
      onPointerMove: (e: React.PointerEvent) => {
        const start = origin.current;
        if (!start || timer.current == null) return;
        if (Math.abs(e.clientX - start.x) > 8 || Math.abs(e.clientY - start.y) > 8) clear();
      },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
    },
  };
}

export function FileListView({
  entries,
  parent,
  onOpen,
  onQuickOpen,
  renderIcon,
  onLongPress,
  onMore,
  selectionMode,
  isSelected,
  onToggleSelect,
}: Props) {
  const { enabled, parentRef, virtualizer, scrollMargin } = useWindowVirtualList({
    count: entries.length,
    estimateSize: ROW_HEIGHT,
    overscan: 10,
  });

  if (!enabled) {
    return (
      <div className="divide-y divide-border/45">
        {entries.map((entry) => (
          <FileRow
            key={entry.path}
            entry={entry}
            parent={parent ?? null}
            onOpen={onOpen}
            onQuickOpen={onQuickOpen}
            renderIcon={renderIcon}
            onLongPress={onLongPress}
            onMore={onMore}
            selectionMode={selectionMode}
            isSelected={isSelected(entry)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  return (
    <div
      ref={parentRef}
      className="divide-y divide-border/45"
      style={{ position: "relative", height: `${totalSize}px` }}
    >
      {items.map((v) => {
        const entry = entries[v.index];
        return (
          <div
            key={entry.path}
            data-index={v.index}
            className="border-b border-border/45"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${ROW_HEIGHT}px`,
              transform: `translateY(${v.start - scrollMargin}px)`,
              contain: "layout paint style",
            }}
          >
            <FileRow
              entry={entry}
              parent={parent ?? null}
              onOpen={onOpen}
              onQuickOpen={onQuickOpen}
              renderIcon={renderIcon}
              onLongPress={onLongPress}
              onMore={onMore}
              selectionMode={selectionMode}
              isSelected={isSelected(entry)}
              onToggleSelect={onToggleSelect}
            />
          </div>
        );
      })}
    </div>
  );
}

export const FileRow = memo(function FileRow({
  entry,
  parent,
  onOpen,
  onQuickOpen,
  renderIcon,
  onLongPress,
  onMore,
  selectionMode,
  isSelected,
  onToggleSelect,
}: {
  entry: FileEntry;
  parent?: PathRef | null;
  onOpen: (e: FileEntry) => void;
  onQuickOpen?: (e: FileEntry) => void;
  renderIcon?: (entry: FileEntry) => React.ReactNode;
  onLongPress: (e: FileEntry) => void;
  onMore: (e: FileEntry) => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (e: FileEntry) => void;
}) {
  const t = useT();
  const press = usePressBinder(entry, onLongPress);
  const count = useFolderCount(parent, entry.name, entry.isDirectory);
  // Colonne de droite : nombre d'éléments (dossier) ou taille (fichier).
  const trailing = entry.isDirectory
    ? count == null
      ? ""
      : countLabel(count, "item")
    : formatSize(entry.size);
  const secondary = entry.isDirectory ? kindLabel(entry.kind) : kindLabel(entry.kind, entry.ext);

  return (
    <button
      type="button"
      data-entry-name={entry.name}
      {...press.handlers}
      onClick={() => {
        if (press.fired.current) return;
        if (selectionMode) onToggleSelect(entry);
        else onOpen(entry);
      }}
      aria-pressed={selectionMode ? isSelected : undefined}
      className={`group relative flex h-full min-h-[66px] w-full items-center gap-3 overflow-hidden px-4 py-2 text-left transition-colors duration-150 ${
        isSelected ? "bg-primary-softer" : "active:bg-secondary/60 hover:bg-secondary/35"
      }`}
    >
      {isSelected ? (
        <span aria-hidden className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-primary" />
      ) : null}
      {selectionMode ? (
        <span
          role="button"
          tabIndex={-1}
          aria-label={isSelected ? t("action.deselect") : t("action.select")}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(entry);
          }}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
            isSelected ? "text-primary" : "text-muted-foreground/60"
          }`}
        >
          {isSelected ? (
            <CheckCircle2 className="h-[22px] w-[22px] fill-primary/15" strokeWidth={2.2} />
          ) : (
            <Circle className="h-[22px] w-[22px]" strokeWidth={1.8} />
          )}
        </span>
      ) : null}
      <OpenZone
        entry={entry}
        active={selectionMode}
        onOpen={entry.isDirectory ? onOpen : (onQuickOpen ?? onOpen)}
        label={
          entry.isDirectory
            ? t("files.list.openFolder", { name: entry.name })
            : t("files.list.openFile", { name: entry.name })
        }
      >
        {renderIcon?.(entry) ?? <FileIcon kind={entry.kind} path={entry.path} />}
      </OpenZone>

      <div className="min-w-0 flex-1">
        <p className="gf-row-title line-clamp-2 break-all">{entry.name}</p>
        <div className="mt-0.5 flex items-baseline gap-3">
          <span className="gf-row-meta min-w-0 flex-1 truncate">
            {formatDate(entry.mtime)}
            {!entry.isDirectory && secondary ? (
              <span className="text-muted-foreground/60"> · {secondary}</span>
            ) : null}
          </span>
          {trailing ? (
            <span className="shrink-0 whitespace-nowrap text-[11.5px] tabular-nums text-muted-foreground/80">
              {trailing}
            </span>
          ) : null}
        </div>
      </div>
      {!selectionMode && !entry.isDirectory ? <MoreAction onClick={() => onMore(entry)} /> : null}
    </button>
  );
});

export function FileGridView({
  entries,
  parent,
  onOpen,
  onQuickOpen,
  renderIcon,
  onLongPress,
  onMore: _onMore,
  selectionMode,
  isSelected,
  onToggleSelect,
}: Props) {
  const COLS = 3;
  const rowCount = Math.ceil(entries.length / COLS);
  const { enabled, parentRef, virtualizer, scrollMargin } = useWindowVirtualList({
    count: rowCount,
    estimateSize: GRID_ROW_HEIGHT,
    overscan: 6,
    threshold: 40,
  });
  void parent;

  if (!enabled) {
    return (
      <div className="grid grid-cols-3 gap-2.5 px-4">
        {entries.map((entry) => (
          <GridCell
            key={entry.path}
            entry={entry}
            onOpen={onOpen}
            onQuickOpen={onQuickOpen}
            renderIcon={renderIcon}
            onLongPress={onLongPress}
            selectionMode={selectionMode}
            isSelected={isSelected(entry)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  return (
    <div ref={parentRef} style={{ position: "relative", height: `${totalSize}px` }}>
      {items.map((v) => {
        const start = v.index * COLS;
        const rowEntries = entries.slice(start, start + COLS);
        return (
          <div
            key={v.key}
            data-index={v.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${GRID_ROW_HEIGHT}px`,
              transform: `translateY(${v.start - scrollMargin}px)`,
              contain: "layout paint style",
            }}
          >
            <div className="grid grid-cols-3 gap-2.5 px-4 pb-2.5">
              {rowEntries.map((entry) => (
                <GridCell
                  key={entry.path}
                  entry={entry}
                  onOpen={onOpen}
                  onQuickOpen={onQuickOpen}
                  renderIcon={renderIcon}
                  onLongPress={onLongPress}
                  selectionMode={selectionMode}
                  isSelected={isSelected(entry)}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const GridCell = memo(function GridCell({
  entry,
  onOpen,
  onQuickOpen,
  renderIcon,
  onLongPress,
  selectionMode,
  isSelected,
  onToggleSelect,
}: {
  entry: FileEntry;
  onOpen: (e: FileEntry) => void;
  onQuickOpen?: (e: FileEntry) => void;
  renderIcon?: (entry: FileEntry) => React.ReactNode;
  onLongPress: (e: FileEntry) => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (e: FileEntry) => void;
}) {
  const t = useT();
  const press = usePressBinder(entry, onLongPress);
  return (
    <button
      type="button"
      data-entry-name={entry.name}
      {...press.handlers}
      onClick={() => {
        if (press.fired.current) return;
        if (selectionMode) onToggleSelect(entry);
        else onOpen(entry);
      }}
      style={{ height: GRID_CELL_HEIGHT }}
      className={`gf-card gf-press group relative flex flex-col items-start gap-2 overflow-hidden p-3 text-left ${
        isSelected ? "bg-primary-softer ring-2 ring-primary" : ""
      }`}
    >
      {selectionMode ? (
        <span
          role="button"
          tabIndex={-1}
          aria-label={isSelected ? t("action.deselect") : t("action.select")}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(entry);
          }}
          className={`absolute left-2 top-2 z-10 rounded-full bg-surface/85 ${
            isSelected ? "text-primary" : "text-muted-foreground/70"
          }`}
        >
          {isSelected ? (
            <CheckCircle2 className="h-5 w-5 fill-primary/15" strokeWidth={2.2} />
          ) : (
            <Circle className="h-5 w-5" strokeWidth={1.8} />
          )}
        </span>
      ) : null}
      <OpenZone
        entry={entry}
        active={selectionMode}
        onOpen={entry.isDirectory ? onOpen : (onQuickOpen ?? onOpen)}
        label={
          entry.isDirectory
            ? t("files.list.openFolder", { name: entry.name })
            : t("files.list.openFile", { name: entry.name })
        }
      >
        {renderIcon?.(entry) ?? <FileIcon kind={entry.kind} size="lg" path={entry.path} />}
      </OpenZone>

      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-semibold leading-tight">{entry.name}</p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {entry.isDirectory ? kindLabel(entry.kind) : fileMetaLine(entry)}
        </p>
      </div>
    </button>
  );
});

/**
 * Zone d'ouverture rapide (icône / vignette).
 *
 * En mode sélection, un appui sur la vignette ouvre le fichier dans le
 * lecteur GeniusFiles sans quitter la sélection ; l'appui ailleurs sur la
 * ligne continue de cocher/décocher. Hors sélection, la zone est
 * totalement transparente (l'appui remonte à la ligne).
 */
function OpenZone({
  entry,
  active,
  onOpen,
  label,
  children,
}: {
  entry: FileEntry;
  active: boolean;
  onOpen: (e: FileEntry) => void;
  label: string;
  children: React.ReactNode;
}) {
  if (!active) return <>{children}</>;
  return (
    <span
      role="button"
      tabIndex={-1}
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(entry);
      }}
      className="relative shrink-0 rounded-xl transition-transform active:scale-95"
    >
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
      >
        {entry.isDirectory ? (
          <ChevronRight className="h-2.5 w-2.5" strokeWidth={3} />
        ) : (
          <Eye className="h-2.5 w-2.5" strokeWidth={2.6} />
        )}
      </span>
    </span>
  );
}

function MoreAction({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={t("action.actions")}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }
      }}
      className="-mr-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground active:bg-secondary"
    >
      <MoreVertical className="h-[18px] w-[18px]" />
    </span>
  );
}
