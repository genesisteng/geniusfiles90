/**
 * Page plein écran « Fichiers récents ».
 *
 * Véritable vue du gestionnaire de fichiers : mêmes composants
 * (FilesTopBar, FileListView / FileGridView, SelectionBar,
 * MoreActionsSheet…), mêmes gestes, mêmes actions et mêmes règles
 * métier. Les fichiers proviennent réellement du stockage (dates
 * d'ajout réelles) sur une fenêtre de 7 jours ; la liste connue
 * s'affiche instantanément puis se rafraîchit en arrière-plan.
 */
import { useListScrollMemory } from "@/lib/files/use-list-scroll";
import { createFileRoute } from "@tanstack/react-router";
import { useAppNavigate } from "@/lib/navigation/pick-nav";
import { confirmPick, requestDestination, usePickRequest } from "@/lib/files/pick-session";
import {
  toggleSelection as toggleGlobalSelection,
  useSelection as useGlobalSelection,
} from "@/lib/files/selection-store";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { GroupHeading } from "@/components/ui/SectionHeader";
import { usePullToRefresh } from "@/lib/gestures/pull-refresh";
import { useAppBack } from "@/lib/navigation/use-app-back";
import { BACK_PRIORITY, useBackHandler } from "@/lib/navigation/back-stack";
import { FilesTopBar } from "@/components/files/FilesTopBar";
import { FileGridView, FileListView } from "@/components/files/FileList";
import { SelectionBar } from "@/components/files/SelectionBar";
import { MoreActionsSheet } from "@/components/files/MoreActionsSheet";
import { buildMoreActions } from "@/lib/files/selection-actions";
import { EntryActionSheet, type EntryAction } from "@/components/files/EntryActionSheet";
import { ConfirmDialog, NamePrompt } from "@/components/files/BottomSheet";
import { DetailsSheet } from "@/components/files/DetailsSheet";
import { ProgressDialog } from "@/components/files/ProgressDialog";
import { startTransfer, cancelTransfer } from "@/lib/transfers/manager";
import { useTransferTask } from "@/lib/transfers/useTransfers";
import { UniversalViewer, type ViewerAction } from "@/components/viewer/UniversalViewer";
import { IllustratedEmptyState } from "@/components/ui/IllustratedEmptyState";
import { canOpenInViewer, canPreview } from "@/lib/viewer/kinds";
import { isPackageEntry } from "@/lib/files/package";
import { openPackageSheet } from "@/lib/files/package-sheet-store";
import { openWithSystem } from "@/lib/viewer/openWith";
import { audioEditorSearch } from "@/lib/audio/routes";
import { batchSummary, errorMessage } from "@/lib/errors/humanize";
import { confirmCopy, progressLabel } from "@/lib/copy";
import { sortEntries } from "@/lib/files/sort";
import { formatSize } from "@/lib/files/format";
import { useSelectionSize } from "@/lib/files/selection-size";
import { selectionKey, type SelectionItem } from "@/lib/files/selection-store";
import { loadSort, loadView, saveSort, saveView } from "@/lib/files/preferences";
import type { FileEntry, PathRef, SortKey, SortOrder, ViewMode } from "@/lib/files/types";
import {
  deleteEntries,
  readDetails,
  renameEntry,
  shareEntries,
  type DetailsInfo,
  type OperationSignal,
  type ProgressEvent,
} from "@/lib/files/operations";
import { groupRecents } from "@/lib/recents/store";
import {
  addedId,
  addedLocationLabel,
  loadAddedWindow,
  refreshAddedFiles,
  subscribeAdded,
  watchAddedFiles,
  type AddedFile,
} from "@/lib/recents/added";
import { useT, t as translate } from "@/lib/i18n";

export const Route = createFileRoute("/fichiers-recents")({
  head: () => ({
    meta: [
      { title: translate("files.recent.metaTitle") },
      {
        name: "description",
        content: translate("files.recent.metaDescription"),
      },
      { property: "og:title", content: translate("files.recent.metaTitle") },
      {
        property: "og:description",
        content: translate("files.recent.ogDescription"),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AddedFilesPage,
});

type Dialog =
  | { kind: "none" }
  | { kind: "actions"; entry: FileEntry }
  | { kind: "details"; info: DetailsInfo | null; loading: boolean; parent: PathRef }
  | { kind: "rename"; entry: FileEntry; parent: PathRef }
  | { kind: "confirmDelete"; items: AddedFile[] }
  | { kind: "viewer"; entryId: string };

function parentOf(f: AddedFile): PathRef {
  return { rootId: f.rootId, segments: f.folderSegments };
}

export function AddedFilesPage() {
  /* Position de la liste restituée au retour depuis un aperçu. */
  useListScrollMemory("added", true);

  const t = useT();
  const navigate = useAppNavigate();
  const pick = usePickRequest();
  const globalSelection = useGlobalSelection();
  const goBack = useAppBack();

  const [files, setFiles] = useState<AddedFile[]>([]);
  const [view, setView] = useState<ViewMode>("list");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  const [moreOpen, setMoreOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [progressTitle, setProgressTitle] = useState("");
  const [progressSubtitle, setProgressSubtitle] = useState("");
  const [progressOpen, setProgressOpen] = useState(false);
  const [transferTaskId, setTransferTaskId] = useState<string | null>(null);
  const activeTransfer = useTransferTask(transferTaskId);
  const transferProgress: ProgressEvent | null = activeTransfer
    ? {
        completed: activeTransfer.completed,
        total: activeTransfer.total,
        bytes: activeTransfer.bytes,
        totalBytes: activeTransfer.totalBytes,
        currentName: activeTransfer.currentName ?? "",
        elapsedMs: Date.now() - activeTransfer.startedAt,
        etaMs: activeTransfer.etaMs,
      }
    : null;
  const hideTransferDialog = useCallback(() => {
    setProgressOpen(false);
    setTransferTaskId(null);
  }, []);
  useEffect(() => {
    if (activeTransfer && activeTransfer.status !== "running") {
      setProgressOpen(false);
      setTransferTaskId(null);
    }
  }, [activeTransfer]);

  const signalRef = useRef<(OperationSignal & { cancel: () => void }) | null>(null);

  /* Retour Android : feuille → recherche → sélection → écran précédent. */
  useBackHandler(
    moreOpen,
    () => {
      setMoreOpen(false);
      return true;
    },
    BACK_PRIORITY.overlay,
  );
  useBackHandler(
    searchOpen,
    () => {
      setQuery("");
      setSearchOpen(false);
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

  useEffect(() => {
    setView(loadView());
    const s = loadSort();
    setSortKey(s.key);
    setSortOrder(s.order);
  }, []);

  /* Affichage immédiat de la dernière liste connue, puis surveillance
     réelle du stockage (premier plan, mutations, sondage). */
  useEffect(() => {
    const refresh = () => setFiles(loadAddedWindow());
    refresh();
    const unsubscribe = subscribeAdded(refresh);
    const stop = watchAddedFiles();
    return () => {
      unsubscribe();
      stop();
    };
  }, []);

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAddedFiles(true);
      setFiles(loadAddedWindow());
    } finally {
      setRefreshing(false);
    }
  }, []);

  /* Tirer pour actualiser : relecture réelle du stockage. */
  usePullToRefresh(doRefresh);

  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (f) => f.name.toLowerCase().includes(q) || addedLocationLabel(f).toLowerCase().includes(q),
    );
  }, [files, deferredQuery]);

  const sorted = useMemo(
    () => sortEntries(filtered, sortKey, sortOrder, false) as AddedFile[],
    [filtered, sortKey, sortOrder],
  );

  /* Regroupement par jour uniquement lorsque le tri est chronologique —
     comme la galerie du gestionnaire. */
  const groups = useMemo(
    () =>
      sortKey === "date"
        ? groupRecents(sorted)
        : [{ key: "all", label: "", files: sorted as AddedFile[] }],
    [sorted, sortKey],
  );

  const selectedFiles = useMemo(
    () => sorted.filter((f) => selected.has(addedId(f))),
    [sorted, selected],
  );

  /* Taille réelle de la sélection — même mécanisme que le gestionnaire. */
  const selectionItems = useMemo(() => {
    const m = new Map<string, SelectionItem>();
    for (const f of selectedFiles) {
      const parent = parentOf(f);
      const key = selectionKey(parent, f.name);
      m.set(key, { key, parent, entry: f });
    }
    return m;
  }, [selectedFiles]);
  const selectionSize = useSelectionSize(selectionItems);
  const selectionSizeLabel = selectionSize.pending
    ? selectionSize.bytes > 0
      ? t("files.recent.calculatingSuffix", { size: formatSize(selectionSize.bytes) })
      : t("files.recent.calculatingOnly")
    : formatSize(selectionSize.bytes);

  const toggleSelect = useCallback(
    (entry: FileEntry) => {
      const f = entry as AddedFile;
      if (pick) {
        if (pick.accept === "folders") return;
        if (!pick.multi) {
          confirmPick({ parent: parentOf(f), entry: f });
          return;
        }
        toggleGlobalSelection(parentOf(f), f);
        return;
      }
      const id = addedId(f);
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [pick],
  );
  const beginSelection = useCallback((entry: FileEntry) => {
    setSelected(new Set([addedId(entry as AddedFile)]));
  }, []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);
  const selectAll = useCallback(() => {
    setSelected(new Set(sorted.map(addedId)));
  }, [sorted]);
  const selectRange = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const indices: number[] = [];
      sorted.forEach((e, i) => {
        if (prev.has(addedId(e))) indices.push(i);
      });
      if (indices.length === 0) return prev;
      const lo = indices[0];
      const hi = indices[indices.length - 1];
      const next = new Set(prev);
      for (let i = lo; i <= hi; i++) next.add(addedId(sorted[i]));
      return next;
    });
  }, [sorted]);
  const isSelected = useCallback(
    (e: FileEntry) =>
      pick
        ? globalSelection.has(selectionKey(parentOf(e as AddedFile), e.name))
        : selected.has(addedId(e as AddedFile)),
    [selected, pick, globalSelection],
  );

  const refreshAfterMutation = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("gf:storage-changed"));
    }
    void refreshAddedFiles(true).then(() => setFiles(loadAddedWindow()));
  };

  const groupByParent = (items: AddedFile[]) => {
    const m = new Map<string, { parent: PathRef; entries: AddedFile[] }>();
    for (const f of items) {
      const key = `${f.rootId}/${f.folderSegments.join("/")}`;
      const bucket = m.get(key);
      if (bucket) bucket.entries.push(f);
      else m.set(key, { parent: parentOf(f), entries: [f] });
    }
    return [...m.values()];
  };

  const openEntry = useCallback((entry: FileEntry) => {
    const f = entry as AddedFile;
    if (isPackageEntry(f)) openPackageSheet({ parent: parentOf(f), entry: f });
    else if (canPreview(f)) setDialog({ kind: "viewer", entryId: addedId(f) });
    else setDialog({ kind: "actions", entry: f });
  }, []);

  const quickOpenEntry = useCallback((entry: FileEntry) => {
    const f = entry as AddedFile;
    if (isPackageEntry(f)) openPackageSheet({ parent: parentOf(f), entry: f });
    else if (canOpenInViewer(f)) setDialog({ kind: "viewer", entryId: addedId(f) });
    else setDialog({ kind: "actions", entry: f });
  }, []);

  const doShare = useCallback(
    async (items: AddedFile[]) => {
      for (const g of groupByParent(items)) {
        const r = await shareEntries(g.parent, g.entries);
        if (!r.ok) toast.error(errorMessage(r.error, t("files.recent.sharePartial")));
      }
    },
    [t],
  );

  const doDelete = useCallback(
    async (items: AddedFile[]) => {
      let ok = 0;
      let failed = 0;
      for (const g of groupByParent(items)) {
        const r = await deleteEntries(g.parent, g.entries);
        ok += r.succeeded;
        failed += r.failed.length;
      }
      clearSelection();
      refreshAfterMutation();
      const s = batchSummary(t("files.recent.movedToTrashVerb"), ok, failed);
      if (s.ok) toast.success(s.message);
      else toast.error(s.message);
    },
    [clearSelection, t],
  );

  const doTransfer = useCallback(
    (mode: "copy" | "move", items: AddedFile[], dest: PathRef) => {
      const destLabel = dest.segments.length
        ? dest.segments.join(" / ")
        : t("home.transfer.rootLabel");
      const id = startTransfer({
        mode,
        groups: groupByParent(items),
        destination: dest,
        onDone: (task) => {
          refreshAfterMutation();
          if (task.status === "cancelled") {
            toast.warning(t("home.transfer.cancelled"));
            return;
          }
          const s = batchSummary(
            mode === "copy" ? t("files.recent.copiedVerb") : t("files.recent.movedVerb"),
            task.succeeded,
            task.failures.length,
          );
          if (s.ok) toast.success(s.message);
          else toast.error(s.message);
        },
      });
      setTransferTaskId(id);
      setProgressTitle(
        progressLabel(
          mode === "copy" ? t("files.recent.copyAction") : t("files.recent.moveAction"),
          undefined,
          items.length,
        ),
      );
      setProgressSubtitle(t("files.recent.destinationSubtitle", { destination: destLabel }));
      setProgressOpen(true);
      clearSelection();
    },
    [clearSelection, t],
  );

  /* Copier / Déplacer : destination choisie dans la navigation habituelle. */
  const startTransferFlow = useCallback(
    async (mode: "copy" | "move", items: AddedFile[]) => {
      if (items.length === 0) return;
      const picked = [...items];
      setDialog({ kind: "none" });
      const dest = await requestDestination({ mode });
      if (!dest) return;
      doTransfer(mode, picked, dest);
    },
    [doTransfer],
  );

  const doRename = useCallback(
    async (entry: FileEntry, parent: PathRef, newName: string) => {
      const r = await renameEntry(parent, entry, newName);
      if (r.ok) {
        toast.success(t("home.rename.done"));
        clearSelection();
        refreshAfterMutation();
        return true;
      }
      toast.error(errorMessage(r.error, t("files.recent.renamePartial")));
      return false;
    },
    [clearSelection, t],
  );

  const onEntryAction = useCallback(
    async (action: EntryAction) => {
      if (dialog.kind !== "actions") return;
      const f = dialog.entry as AddedFile;
      const parent = parentOf(f);
      setDialog({ kind: "none" });
      switch (action) {
        case "open":
          if (isPackageEntry(f)) openPackageSheet({ parent, entry: f });
          else if (canPreview(f)) setDialog({ kind: "viewer", entryId: addedId(f) });
          else await openWithSystem(parent, f);
          break;
        case "openWith":
          await openWithSystem(parent, f);
          break;
        case "editAudio":
          await navigate({ to: "/editeur-audio", search: audioEditorSearch(parent, f) });
          break;
        case "share":
          await doShare([f]);
          break;
        case "rename":
          setDialog({ kind: "rename", entry: f, parent });
          break;
        case "copy":
          void startTransferFlow("copy", [f]);
          break;
        case "move":
          void startTransferFlow("move", [f]);
          break;
        case "delete":
          setDialog({ kind: "confirmDelete", items: [f] });
          break;
        case "info": {
          setDialog({ kind: "details", info: null, loading: true, parent });
          const info = await readDetails(parent, f);
          setDialog({ kind: "details", info, loading: false, parent });
          break;
        }
        default:
          break;
      }
    },
    [dialog, doShare, navigate, startTransferFlow],
  );

  const onViewerAction = useCallback(
    async (entry: FileEntry, action: ViewerAction) => {
      const f = entry as AddedFile;
      const parent = parentOf(f);
      switch (action) {
        case "share":
          await doShare([f]);
          break;
        case "openWith":
          await openWithSystem(parent, f);
          break;
        case "rename":
          setDialog({ kind: "rename", entry: f, parent });
          break;
        case "copy":
          void startTransferFlow("copy", [f]);
          break;
        case "move":
          void startTransferFlow("move", [f]);
          break;
        case "delete":
          setDialog({ kind: "confirmDelete", items: [f] });
          break;
        case "info": {
          setDialog({ kind: "details", info: null, loading: true, parent });
          const info = await readDetails(parent, f);
          setDialog({ kind: "details", info, loading: false, parent });
          break;
        }
        default:
          break;
      }
    },
    [doShare, startTransferFlow],
  );

  const viewerEntries = useMemo(() => sorted.filter((f) => canOpenInViewer(f)), [sorted]);
  const viewerIndex = useMemo(() => {
    if (dialog.kind !== "viewer") return -1;
    return viewerEntries.findIndex((f) => addedId(f) === dialog.entryId);
  }, [dialog, viewerEntries]);

  const selectionMode = selected.size > 0;

  return (
    <AppShell>
      <FilesTopBar
        title={t("home.recent.aria")}
        count={sorted.length}
        onBack={goBack}
        onSearch={() => setSearchOpen((v) => !v)}
        view={view}
        onViewChange={(v) => {
          setView(v);
          saveView(v);
        }}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSortChange={(k, o) => {
          setSortKey(k);
          setSortOrder(o);
          saveSort({ key: k, order: o });
        }}
        selection={
          selectionMode
            ? {
                count: selectedFiles.length,
                sizeLabel: selectionSizeLabel,
                onClear: clearSelection,
                onSelectAll: selectAll,
                onSelectRange: selectedFiles.length >= 1 ? selectRange : undefined,
              }
            : null
        }
      />

      {searchOpen && !selectionMode ? (
        <div className="mb-2 mt-2 flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("files.rechercherDansLesFichiersRecents")}
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSearchOpen(false);
            }}
            aria-label={t("viewer.document.closeSearch")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {sorted.length === 0 && query.trim() ? (
        <IllustratedEmptyState
          id="search"
          description={t("files.recent.searchEmpty", { query: query.trim() })}
          action={
            <button onClick={() => setQuery("")} className="btn-primary gf-press">
              {t("cleaner.trash.clearSearch.aria")}
            </button>
          }
        />
      ) : sorted.length === 0 ? (
        <IllustratedEmptyState
          id="documents"
          description={t("files.lesFichiersAjoutesAVotreStockage")}
        />
      ) : (
        <div className="-mx-4 pt-1">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label || undefined}>
              {g.label ? <GroupHeading label={g.label} /> : null}
              {view === "list" ? (
                <FileListView
                  entries={g.files}
                  onOpen={openEntry}
                  onQuickOpen={quickOpenEntry}
                  onLongPress={beginSelection}
                  onMore={(e) => {
                    if (!pick) setDialog({ kind: "actions", entry: e });
                  }}
                  selectionMode={selectionMode || pick !== null}
                  isSelected={isSelected}
                  onToggleSelect={toggleSelect}
                />
              ) : (
                <FileGridView
                  entries={g.files}
                  onOpen={openEntry}
                  onQuickOpen={quickOpenEntry}
                  onLongPress={beginSelection}
                  onMore={(e) => {
                    if (!pick) setDialog({ kind: "actions", entry: e });
                  }}
                  selectionMode={selectionMode || pick !== null}
                  isSelected={isSelected}
                  onToggleSelect={toggleSelect}
                />
              )}
            </section>
          ))}
        </div>
      )}

      {selectionMode && !pick ? (
        <SelectionBar
          count={selectedFiles.length}
          onCopy={() => void startTransferFlow("copy", selectedFiles)}
          onMove={() => void startTransferFlow("move", selectedFiles)}
          onDelete={() => setDialog({ kind: "confirmDelete", items: selectedFiles })}
          onRename={() => {
            if (selectedFiles.length !== 1) return;
            const f = selectedFiles[0];
            setDialog({ kind: "rename", entry: f, parent: parentOf(f) });
          }}
          onShare={() => doShare(selectedFiles.filter((f) => !f.isDirectory))}
          onMore={() => setMoreOpen(true)}
        />
      ) : null}

      <MoreActionsSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        actions={buildMoreActions(selectedFiles, {
          onShare: () => doShare(selectedFiles.filter((f) => !f.isDirectory)),
          onProperties: async () => {
            const f = selectedFiles[0];
            if (!f) return;
            const parent = parentOf(f);
            setDialog({ kind: "details", info: null, loading: true, parent });
            const info = await readDetails(parent, f);
            setDialog({ kind: "details", info, loading: false, parent });
          },
          onCut: () => void startTransferFlow("move", selectedFiles),
        })}
      />

      <EntryActionSheet
        open={dialog.kind === "actions"}
        entry={dialog.kind === "actions" ? dialog.entry : null}
        onClose={() => setDialog({ kind: "none" })}
        onAction={onEntryAction}
      />

      <NamePrompt
        open={dialog.kind === "rename"}
        title={t("action.rename")}
        label={t("files.recent.newNameLabel")}
        initial={dialog.kind === "rename" ? dialog.entry.name : ""}
        cta={t("action.rename")}
        onCancel={() => setDialog({ kind: "none" })}
        onSubmit={async (name: string) => {
          if (dialog.kind !== "rename") return;
          const ok = await doRename(dialog.entry, dialog.parent, name);
          if (ok) setDialog({ kind: "none" });
        }}
      />

      <ConfirmDialog
        open={dialog.kind === "confirmDelete"}
        title={
          dialog.kind === "confirmDelete" ? confirmCopy.moveToTrash(dialog.items.length).title : ""
        }
        description={
          dialog.kind === "confirmDelete"
            ? confirmCopy.moveToTrash(dialog.items.length).description
            : ""
        }
        confirmLabel={
          dialog.kind === "confirmDelete"
            ? confirmCopy.moveToTrash(dialog.items.length).confirmLabel
            : ""
        }
        danger
        onCancel={() => setDialog({ kind: "none" })}
        onConfirm={async () => {
          if (dialog.kind !== "confirmDelete") return;
          const items = dialog.items;
          setDialog({ kind: "none" });
          await doDelete(items);
        }}
      />

      <DetailsSheet
        open={dialog.kind === "details"}
        info={dialog.kind === "details" ? dialog.info : null}
        onClose={() => setDialog({ kind: "none" })}
      />

      <UniversalViewer
        open={dialog.kind === "viewer" && viewerIndex >= 0}
        entries={viewerEntries}
        parent={
          viewerEntries[viewerIndex >= 0 ? viewerIndex : 0]
            ? parentOf(viewerEntries[viewerIndex >= 0 ? viewerIndex : 0])
            : null
        }
        index={viewerIndex >= 0 ? viewerIndex : 0}
        onIndexChange={(i) => {
          const next = viewerEntries[i];
          if (next) setDialog({ kind: "viewer", entryId: addedId(next) });
        }}
        onClose={() => setDialog({ kind: "none" })}
        parentOf={(e) => parentOf(e as AddedFile)}
        onAction={onViewerAction}
      />

      <ProgressDialog
        open={progressOpen}
        title={progressTitle}
        subtitle={progressSubtitle}
        progress={transferProgress ?? progress}
        onCancel={() => {
          if (transferTaskId) cancelTransfer(transferTaskId);
          else signalRef.current?.cancel();
        }}
        onHide={transferTaskId ? hideTransferDialog : undefined}
      />
    </AppShell>
  );
}
