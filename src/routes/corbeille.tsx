/**
 * GeniusFiles — Corbeille (Trash) route.
 *
 * Central safety net for every deletion performed inside the app. Every
 * item deleted via the file explorer, the cleaner or any future module
 * lands here first; from this screen the user can preview an item, restore
 * selected entries to their original folder, pick a new destination when
 * the origin no longer exists, or definitively free space.
 *
 * Points structurants :
 *  - en-tête collant partagé (PageHeader) : la barre d'état ne recouvre
 *    jamais le titre et le contenu défile sous l'en-tête ;
 *  - vignettes réelles : les éléments natifs exposent leur chemin réel dans
 *    l'espace privé de l'app, enregistré comme alias de chemin pour que le
 *    générateur de miniatures et le visualiseur y accèdent normalement ;
 *  - lecture directe : un appui simple ouvre le fichier dans le visualiseur
 *    universel sans restauration préalable ;
 *  - barre de sélection en grille : aucun débordement, même sur écran étroit.
 */
import { useListScrollMemory } from "@/lib/files/use-list-scroll";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownAZ, Check, CheckSquare, MoreVertical, Square, X } from "lucide-react";
import {
  GfSort as ArrowUpDown,
  GfRecent as Clock,
  GfEyeOpen as Eye,
  GfFolderOpen as FolderOpen,
  GfRefreshCycle as RefreshCw,
  GfSearch as Search,
  GfTrash as Trash2,
  GfRestore as Undo2,
} from "@/components/icons";

import { toast } from "sonner";
import { IllustratedEmptyState } from "@/components/ui/IllustratedEmptyState";
import { AppShell } from "@/components/AppShell";
import { usePullToRefresh } from "@/lib/gestures/pull-refresh";
import { BackButton } from "@/components/navigation/BackButton";
import { BACK_PRIORITY, useBackHandler } from "@/lib/navigation/back-stack";
import { ListSkeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/common/PageHeader";
import { BottomSheet, PrimaryButton, ConfirmDialog } from "@/components/files/BottomSheet";
import { DestinationPicker } from "@/components/files/DestinationPicker";
import { FileIcon } from "@/components/files/FileIcon";
import { UniversalViewer } from "@/components/viewer/UniversalViewer";
import { registerPathAlias, toAbsolutePath } from "@/lib/files/fs";
import { extOf, formatSize, formatDate, kindOf } from "@/lib/files/format";
import {
  emptyTrash,
  listTrashItems,
  permanentDelete,
  restoreItems,
  type TrashItem,
  type RestoreOutcome,
} from "@/lib/files/trash";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { confirmCopy, freedLabel } from "@/lib/copy";
import { useT, t as translate } from "@/lib/i18n";
import type { TransValues } from "@/lib/i18n";

type TFn = (key: string, values?: TransValues) => string;

export const Route = createFileRoute("/corbeille")({
  head: () => ({
    meta: [
      { title: "Corbeille — GeniusFiles" },
      {
        name: "description",
        content: translate("meta.trash.description"),
      },
      { property: "og:title", content: "Corbeille — GeniusFiles" },
      {
        property: "og:description",
        content: translate("meta.trash.ogDescription"),
      },
    ],
  }),
  component: TrashPage,
});

type SortKey = "recent" | "name" | "size";

const sortLabel = (t: TFn): Record<SortKey, string> => ({
  recent: t("cleaner.trash.sort.recent"),
  name: t("cleaner.trash.sort.name"),
  size: t("cleaner.trash.sort.size"),
});

function formatCountdown(t: TFn, ms?: number): string {
  if (ms == null) return t("cleaner.trash.countdown.permanent");
  if (ms <= 0) return t("cleaner.trash.countdown.imminent");
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return t("cleaner.trash.countdown.days", { count: days });
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return t("cleaner.trash.countdown.hours", { count: hours });
}

/**
 * PathRef propre à un élément de corbeille. Chaque élément a sa propre
 * racine `abs:` (suffixée par son identifiant) : deux fichiers supprimés
 * portant le même nom restent ainsi résolus vers deux chemins distincts.
 */
function trashPathRefOf(item: TrashItem): PathRef | null {
  if (!item.trashPath) return null;
  const dir = item.trashPath.split("/").slice(0, -1).join("/");
  return { rootId: `abs:${dir}#${item.id}`, segments: [] };
}

function toFileEntry(item: TrashItem): FileEntry {
  return {
    name: item.name,
    path: item.originalPath,
    isDirectory: item.isDirectory,
    size: item.size,
    mtime: item.deletedAt,
    kind: kindOf(item.name, item.isDirectory),
    ext: extOf(item.name),
  };
}

function TrashPage() {
  /* Position de la liste restituée au retour depuis un aperçu. */
  useListScrollMemory("trash", true);

  const t = useT();
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [totalBytes, setTotalBytes] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pickDestFor, setPickDestFor] = useState<TrashItem[] | null>(null);
  const [outcome, setOutcome] = useState<RestoreOutcome | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  /* Retour Android : visualiseur → menu → recherche → sélection → écran précédent. */
  useBackHandler(
    menuOpen,
    () => {
      setMenuOpen(false);
      return true;
    },
    BACK_PRIORITY.overlay,
  );
  useBackHandler(
    pickDestFor != null,
    () => {
      setPickDestFor(null);
      return true;
    },
    BACK_PRIORITY.overlay,
  );
  useBackHandler(
    searchOpen,
    () => {
      setSearchOpen(false);
      setQuery("");
      return true;
    },
    BACK_PRIORITY.mode,
  );
  useBackHandler(
    selected.size > 0,
    () => {
      setSelected(new Set());
      return true;
    },
    BACK_PRIORITY.mode,
  );

  const reload = useCallback(async () => {
    const res = await listTrashItems();
    setItems(res.items);
    setTotalBytes(res.totalBytes);
    setSelected((prev) => {
      const stillThere = new Set(res.items.map((i) => i.id));
      return new Set(Array.from(prev).filter((id) => stillThere.has(id)));
    });
  }, []);

  usePullToRefresh(reload);

  useEffect(() => {
    reload();
    if (typeof window === "undefined") return;
    const handler = () => reload();
    window.addEventListener("gf:trash-changed", handler);
    return () => window.removeEventListener("gf:trash-changed", handler);
  }, [reload]);

  /* Les éléments natifs vivent dans l'espace privé de l'app : on déclare
     leur chemin réel pour que miniatures et lecteurs les résolvent. */
  useEffect(() => {
    if (!items) return;
    for (const it of items) {
      const ref = trashPathRefOf(it);
      if (ref && it.trashPath) registerPathAlias({ ...ref, segments: [it.name] }, it.trashPath);
    }
  }, [items]);

  const sortedItems = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter(
          (i) => i.name.toLowerCase().includes(q) || i.originalPath.toLowerCase().includes(q),
        )
      : items;
    const copy = [...filtered];
    if (sortKey === "name") copy.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    else if (sortKey === "size") copy.sort((a, b) => b.size - a.size);
    else copy.sort((a, b) => b.deletedAt - a.deletedAt);
    return copy;
  }, [items, query, sortKey]);

  const allSelected = sortedItems.length > 0 && selected.size === sortedItems.length;
  const anySelected = selected.size > 0;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sortedItems.map((i) => i.id)));
  };

  const selectedItems = useMemo(
    () => sortedItems.filter((i) => selected.has(i.id)),
    [sortedItems, selected],
  );

  const anyOrphan = selectedItems.some((i) => i.originalParentExists === false);

  /* Éléments réellement lisibles (fichiers dont le chemin réel est connu). */
  const previewable = useMemo(
    () => sortedItems.filter((i) => !i.isDirectory && !!i.trashPath),
    [sortedItems],
  );
  const viewerEntries = useMemo(() => previewable.map(toFileEntry), [previewable]);

  const openPreview = (item: TrashItem) => {
    const idx = previewable.findIndex((i) => i.id === item.id);
    if (idx < 0) {
      toast.info(t("cleaner.trash.preview.unavailable.title"), {
        description: item.isDirectory
          ? t("cleaner.trash.preview.unavailable.folder")
          : t("cleaner.trash.preview.unavailable.file"),
      });
      return;
    }
    setViewerIndex(idx);
  };

  const runRestore = async (target?: PathRef) => {
    if (selectedItems.length === 0) return;
    setBusy(true);
    try {
      const res = await restoreItems(selectedItems, {
        targetPath: target ? toAbsolutePath(target) : undefined,
      });
      setOutcome(res);
      if (res.failed.length === 0) {
        toast.success(t("cleaner.trash.restore.success", { count: res.restored }));
      } else if (res.restored > 0) {
        toast.info(
          t("cleaner.trash.restore.partial", {
            restored: res.restored,
            failed: res.failed.length,
          }),
        );
      }
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const onRestoreClick = () => {
    if (anyOrphan) {
      setPickDestFor(selectedItems);
      return;
    }
    setConfirmRestore(true);
  };

  const onPermanentDeleteClick = () => setConfirmPurge(true);

  const doPurgeSelected = async () => {
    setConfirmPurge(false);
    if (selectedItems.length === 0) return;
    setBusy(true);
    const freedBytes = selectedItems.reduce((acc, i) => acc + i.size, 0);
    try {
      const res = await permanentDelete(selectedItems);
      if (res.failed.length === 0) {
        toast.success(t("cleaner.trash.purge.success", { count: res.deleted }), {
          description: t("cleaner.trash.purge.desc", { freed: freedLabel(freedBytes) }),
        });
      } else {
        toast.info(
          t("cleaner.trash.purge.partial", {
            deleted: res.deleted,
            failed: res.failed.length,
          }),
        );
      }
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const doEmpty = async () => {
    setConfirmEmpty(false);
    const freedBytes = totalBytes;
    setBusy(true);
    try {
      const res = await emptyTrash();
      toast.success(t("cleaner.trash.emptied.title"), {
        description: t("cleaner.trash.emptied.desc", {
          count: res.deleted,
          freed: freedLabel(freedBytes),
        }),
      });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const subtitle =
    items == null
      ? t("state.loading")
      : items.length === 0
        ? t("cleaner.trash.noItems")
        : t("cleaner.trash.summary", { count: items.length, size: formatSize(totalBytes) });

  return (
    <AppShell>
      <PageHeader
        title={
          anySelected ? t("unit.selected", { count: selected.size }) : t("cleaner.trash.title")
        }
        subtitle={anySelected ? t("cleaner.trash.selectHint") : subtitle}
        leading={
          <BackButton className="gf-press flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground hover:text-foreground" />
        }
        action={
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="gf-press flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label={t("cleaner.trash.search.aria")}
              aria-pressed={searchOpen}
            >
              <Search className="h-4 w-4" />
            </button>
            {sortedItems.length > 0 ? (
              <button
                type="button"
                onClick={toggleAll}
                className="gf-press flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label={allSelected ? t("action.deselectAll") : t("action.selectAll")}
              >
                {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              </button>
            ) : null}
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="gf-press flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label={t("cleaner.trash.moreActions.aria")}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="glass-panel absolute right-0 top-11 z-40 w-60 overflow-hidden rounded-2xl shadow-soft"
                >
                  <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("cleaner.trash.sortBy")}
                  </p>
                  {(Object.keys(sortLabel(t)) as SortKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={sortKey === key}
                      onClick={() => {
                        setSortKey(key);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] hover:bg-secondary/60"
                    >
                      {sortKey === key ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <ArrowDownAZ className="h-4 w-4 text-muted-foreground/60" />
                      )}
                      <span className="truncate">{sortLabel(t)[key]}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      reload();
                    }}
                    className="flex w-full items-center gap-2 border-t border-border/60 px-3 py-2.5 text-left text-[13px] hover:bg-secondary/60"
                  >
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    {t("files.rafraichir")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={sortedItems.length === 0 || busy}
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmEmpty(true);
                    }}
                    className="flex w-full items-center gap-2 border-t border-border/60 px-3 py-2.5 text-left text-[13px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("cleaner.trash.emptyAction")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        }
      />

      {searchOpen ? (
        <div className="sticky top-[calc(env(safe-area-inset-top)+4.6rem)] z-20 -mx-4 border-b border-border/60 bg-background px-4 pb-2.5">
          <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("cleaner.trash.searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] outline-none placeholder:text-muted-foreground/70"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("cleaner.trash.clearSearch.aria")}
                className="gf-press shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="pt-3">
        {items == null ? (
          <ListSkeleton rows={5} />
        ) : sortedItems.length === 0 ? (
          <IllustratedEmptyState
            id="trash"
            description={
              query.trim()
                ? t("cleaner.trash.emptyState.searchDesc")
                : t("cleaner.trash.emptyState.desc")
            }
          />
        ) : (
          <>
            <div className="mb-2 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
              <ArrowUpDown className="h-3 w-3 shrink-0" />
              <span className="truncate">{sortLabel(t)[sortKey]}</span>
              <span className="ml-auto shrink-0">
                {t("cleaner.trash.sortedCount", { count: sortedItems.length })}
              </span>
            </div>
            <div className="gf-card divide-y divide-border/60">
              {sortedItems.map((it) => {
                const isSel = selected.has(it.id);
                const kind = kindOf(it.name, it.isDirectory);
                const parent = it.originalPath.split("/").slice(0, -1).join("/") || "—";
                const orphan = it.originalParentExists === false;
                const canPreview = !it.isDirectory && !!it.trashPath;
                return (
                  <div key={it.id} className="relative flex items-center gap-2 pr-2">
                    {isSel ? (
                      <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => (anySelected ? toggle(it.id) : openPreview(it))}
                      className={`gf-row min-w-0 flex-1 ${isSel ? "bg-primary-softer" : ""}`}
                    >
                      {isSel ? (
                        <span className="gf-icon-tile bg-primary text-primary-foreground">
                          <Check className="h-5 w-5" />
                        </span>
                      ) : (
                        <FileIcon kind={kind} path={it.trashPath} />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="gf-row-title truncate">{it.name}</p>
                          {orphan ? (
                            <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-400">
                              {t("cleaner.trash.orphanBadge")}
                            </span>
                          ) : null}
                        </div>
                        <p className="gf-row-meta truncate">
                          <FolderOpen className="mr-1 inline h-3 w-3" />
                          {parent}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                          <span>{formatSize(it.size)}</span>
                          <span aria-hidden>·</span>
                          <span>{formatDate(it.deletedAt)}</span>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatCountdown(t, it.msUntilPurge)}
                          </span>
                        </p>
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggle(it.id)}
                        aria-label={
                          isSel ? t("cleaner.trash.item.deselectAria") : t("action.select")
                        }
                        aria-pressed={isSel}
                        className="gf-press flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        {isSel ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                      {canPreview ? (
                        <button
                          type="button"
                          onClick={() => openPreview(it)}
                          aria-label={t("cleaner.trash.item.previewAria", { name: it.name })}
                          className="gf-press flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Barre de sélection — grille : jamais de débordement horizontal. */}
      {anySelected ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-40 flex justify-center px-3">
          <div className="glass-panel animate-in-up pointer-events-auto w-full max-w-md rounded-3xl p-2 shadow-soft">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="gf-press flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
                {t("action.cancel")}
              </button>
              <button
                type="button"
                onClick={onRestoreClick}
                disabled={busy}
                className="gf-press flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-2xl bg-primary text-[11px] font-semibold text-primary-foreground shadow-soft disabled:opacity-50"
              >
                <Undo2 className="h-4 w-4" />
                Restaurer
              </button>
              <button
                type="button"
                onClick={onPermanentDeleteClick}
                disabled={busy}
                className="gf-press flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-2xl bg-destructive text-[11px] font-semibold text-destructive-foreground shadow-soft disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {t("automations.card.delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <UniversalViewer
        open={viewerIndex !== null}
        parent={viewerIndex !== null ? trashPathRefOf(previewable[viewerIndex]) : null}
        entries={viewerEntries}
        index={viewerIndex ?? 0}
        onIndexChange={(i) => setViewerIndex(i)}
        onClose={() => setViewerIndex(null)}
        parentOf={(entry) => {
          const item = previewable.find((i) => i.name === entry.name);
          return item ? trashPathRefOf(item) : null;
        }}
        onAction={(entry, action) => {
          const item = previewable.find((i) => i.name === entry.name);
          if (!item) return;
          if (action === "delete") {
            setSelected(new Set([item.id]));
            setViewerIndex(null);
            setConfirmPurge(true);
            return;
          }
          if (action === "move" || action === "copy" || action === "openFolder") {
            setSelected(new Set([item.id]));
            setViewerIndex(null);
            onRestoreClick();
            return;
          }
          if (action === "rename" || action === "compress") {
            toast.info(t("cleaner.trash.actionUnavailable.title"), {
              description: t("cleaner.trash.actionUnavailable.desc"),
            });
          }
        }}
      />

      <ConfirmDialog
        open={confirmEmpty}
        title={confirmCopy.emptyTrash(sortedItems.length).title}
        description={confirmCopy.emptyTrash(sortedItems.length).description}
        confirmLabel={confirmCopy.emptyTrash(sortedItems.length).confirmLabel}
        danger
        onCancel={() => setConfirmEmpty(false)}
        onConfirm={doEmpty}
      />

      <ConfirmDialog
        open={confirmPurge}
        title={confirmCopy.deleteForever(selectedItems.length).title}
        description={confirmCopy.deleteForever(selectedItems.length).description}
        confirmLabel={confirmCopy.deleteForever(selectedItems.length).confirmLabel}
        danger
        onCancel={() => setConfirmPurge(false)}
        onConfirm={doPurgeSelected}
      />

      <ConfirmDialog
        open={confirmRestore}
        title={confirmCopy.restore(selectedItems.length).title}
        description={confirmCopy.restore(selectedItems.length).description}
        confirmLabel={confirmCopy.restore(selectedItems.length).confirmLabel}
        onCancel={() => setConfirmRestore(false)}
        onConfirm={async () => {
          setConfirmRestore(false);
          await runRestore();
        }}
      />

      <DestinationPicker
        open={pickDestFor !== null}
        title={t("cleaner.trash.destPicker.title")}
        initial={{ rootId: "internal", segments: [] }}
        onCancel={() => setPickDestFor(null)}
        onConfirm={(dest) => {
          setPickDestFor(null);
          void runRestore(dest);
        }}
      />

      <BottomSheet
        open={outcome !== null && (outcome?.failed.length ?? 0) > 0}
        onClose={() => setOutcome(null)}
      >
        {outcome ? (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
                <Undo2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{t("cleaner.trash.restoreOutcome.title")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("cleaner.trash.restoreOutcome.summary", {
                    restored: outcome.restored,
                    failed: outcome.failed.length,
                  })}
                </p>
              </div>
            </div>
            <ul className="max-h-56 overflow-auto rounded-xl border border-border bg-surface/60">
              {outcome.failed.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-[12px] last:border-b-0"
                >
                  <span className="truncate">{f.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {f.reason === "PARENT_MISSING"
                      ? t("cleaner.trash.restoreOutcome.reason.parentMissing")
                      : f.reason === "MISSING"
                        ? t("cleaner.trash.restoreOutcome.reason.missing")
                        : f.reason === "NO_TARGET"
                          ? t("cleaner.trash.restoreOutcome.reason.noTarget")
                          : t("cleaner.trash.restoreOutcome.reason.failed")}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-end">
              <PrimaryButton onClick={() => setOutcome(null)}>{t("action.close")}</PrimaryButton>
            </div>
          </div>
        ) : null}
      </BottomSheet>
    </AppShell>
  );
}
