/**
 * Vue virtuelle par catégorie — Images, Vidéos, Musique, Documents,
 * Téléchargements. Agrège tous les fichiers correspondants sur
 * l'ensemble des espaces de stockage autorisés, quel que soit leur
 * dossier d'origine. Les résultats streament pendant l'analyse et
 * sont mis en cache : réouvrir la catégorie est quasi instantané.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useAppNavigate } from "@/lib/navigation/pick-nav";
import { useListScrollMemory } from "@/lib/files/use-list-scroll";
import {
  confirmPick,
  requestDestination,
  setPickLocation,
  usePickRequest,
} from "@/lib/files/pick-session";
import {
  selectionKey as globalSelectionKey,
  toggleSelection as toggleGlobalSelection,
  useSelection as useGlobalSelection,
} from "@/lib/files/selection-store";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Search, X, FolderSearch } from "lucide-react";
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
import { EmptyState } from "@/components/ui/EmptyState";
import { batchSummary, errorMessage } from "@/lib/errors/humanize";
import { confirmCopy, progressLabel } from "@/lib/copy";
import { canOpenInViewer, canPreview } from "@/lib/viewer/kinds";
import { isPackageEntry } from "@/lib/files/package";
import { openPackageSheet } from "@/lib/files/package-sheet-store";
import { openWithSystem } from "@/lib/viewer/openWith";
import { audioEditorSearch } from "@/lib/audio/routes";
import { sortEntries } from "@/lib/files/sort";
import { formatSize } from "@/lib/files/format";
import { useSelectionSize } from "@/lib/files/selection-size";
import { selectionKey, type SelectionItem } from "@/lib/files/selection-store";
import { loadFoldersFirst, loadSort, loadView, saveSort, saveView } from "@/lib/files/preferences";
import type { FileEntry, PathRef, SortKey, SortOrder, ViewMode } from "@/lib/files/types";
import {
  categoryLabel,
  refreshCategory,
  subscribeCategory,
  type CategoryFile,
  type CategoryKind,
} from "@/lib/files/categories";
import {
  createSignal,
  deleteEntries,
  readDetails,
  renameEntry,
  shareEntries,
  transferEntries,
  type DetailsInfo,
  type OperationSignal,
  type ProgressEvent,
} from "@/lib/files/operations";

import { CategoryTabs, type CategoryTabId } from "@/components/files/CategoryTabs";
import { docTabs as documentTabs, isDocTab, matchesDocTab } from "@/lib/files/doc-tabs";
import { CategoryFolderList, type CategoryFolder } from "@/components/files/CategoryFolderList";
import { t, useT } from "@/lib/i18n";
import { groupBySort, type FileGroup } from "@/lib/files/image-groups";
import { IllustratedEmptyState } from "@/components/ui/IllustratedEmptyState";
import type { EmptyIllustrationId } from "@/lib/copy/empty-illustrations";

/** Illustration officielle correspondant à chaque catégorie. */
const EMPTY_ILLUSTRATION_BY_KIND: Record<CategoryKind, EmptyIllustrationId> = {
  images: "images",
  videos: "videos",
  audio: "audio",
  documents: "documents",
  downloads: "downloads",
};

const KINDS: CategoryKind[] = ["images", "videos", "audio", "documents", "downloads"];

function isKind(x: string): x is CategoryKind {
  return (KINDS as string[]).includes(x);
}

export const Route = createFileRoute("/categorie/$kind")({
  head: ({ params }) => {
    const label = isKind(params.kind)
      ? categoryLabel(params.kind)
      : t("files.category.fallbackTitle");
    return {
      meta: [
        { title: `${label} — GeniusFiles` },
        {
          name: "description",
          content: `Tous vos fichiers « ${label} » rassemblés en une vue unique, quel que soit leur emplacement de stockage.`,
        },
        { property: "og:title", content: `${label} — GeniusFiles` },
        {
          property: "og:description",
          content: `Vue virtuelle GeniusFiles regroupant automatiquement vos ${label.toLowerCase()}.`,
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: CategoryRoute,
});

function CategoryRoute() {
  const params = Route.useParams();
  return <CategoryPage kind={isKind(params.kind) ? params.kind : "images"} />;
}

type Dialog =
  | { kind: "none" }
  | { kind: "actions"; entry: FileEntry }
  | { kind: "details"; info: DetailsInfo | null; loading: boolean; parent: PathRef }
  | { kind: "rename"; entry: FileEntry; parent: PathRef }
  | { kind: "confirmDelete"; items: CategoryFile[] }
  | { kind: "viewer"; entryName: string };

function parentOf(f: CategoryFile): PathRef {
  return { rootId: f.rootId, segments: f.folderSegments };
}

/**
 * Écran officiel d'une catégorie. Réutilisé à l'identique par la route et
 * par une session de sélection (`PickLayer`).
 */
export function CategoryPage({ kind }: { kind: CategoryKind }) {
  const t = useT();
  const navigate = useAppNavigate();
  const label = categoryLabel(kind);
  /* Session de sélection : la sélection passe par le store global afin que
     la barre « Valider » voie exactement les mêmes éléments. */
  const pick = usePickRequest();
  const globalSelection = useGlobalSelection();

  const [files, setFiles] = useState<CategoryFile[]>([]);

  /* Onglets : « Chansons / Dossiers » (Musique) ou « Toutes / WORD / PDF /
     TXT / Autres » (Documents). L'onglet actif et le dossier ouvert sont
     conservés tant que l'utilisateur reste dans la catégorie
     (sessionStorage), comme sur Android. */
  /* Musique, Vidéos et Images partagent la même structure : onglet média +
     onglet dossiers/albums avec navigation à l'intérieur d'un dossier. */
  const folderTabs = kind === "audio" || kind === "videos" || kind === "images";
  const mediaTabLabel =
    kind === "videos"
      ? categoryLabel("videos")
      : kind === "images"
        ? categoryLabel("images")
        : t("files.category.songsTab");
  const mediaUnitLabel =
    kind === "videos"
      ? t("files.category.unitVideo")
      : kind === "images"
        ? t("files.category.unitPhoto")
        : t("files.category.unitSong");
  const folderTabLabel =
    kind === "images" ? t("files.category.albumsTab") : t("files.category.foldersTab");
  /* Images : regroupement automatique selon le tri actif (galerie Android). */
  const grouped = kind === "images";
  const docTabs = kind === "documents";
  const hasTabs = folderTabs || docTabs;
  const defaultTab: CategoryTabId = docTabs ? "all" : "songs";
  const [tab, setTab] = useState<CategoryTabId>(defaultTab);

  const [openFolder, setOpenFolder] = useState<{
    rootId: CategoryFile["rootId"];
    segments: string[];
    name: string;
  } | null>(null);

  const [view, setView] = useState<ViewMode>("list");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [query, setQuery] = useState("");
  /* Recherche contextuelle : dépliée depuis la barre supérieure, comme le
     gestionnaire de fichiers. Le libellé s'adapte à l'onglet actif. */
  const [searchOpen, setSearchOpen] = useState(false);
  const goBack = useAppBack();
  const searchPlaceholder = (() => {
    if (folderTabs && openFolder)
      return t("files.category.searchInFolder", { name: openFolder.name });
    if (docTabs) {
      if (tab === "pdf") return t("files.category.searchPdf");
      if (tab === "txt") return t("files.category.searchTxt");
      if (tab === "word") return t("files.category.searchWord");
      if (tab === "other") return t("files.category.searchOther");
      return t("files.category.searchIn", { label });
    }
    if (folderTabs && tab === "folders") {
      return kind === "images"
        ? t("files.category.searchAlbums")
        : t("files.category.searchFolders", { label });
    }
    return t("files.category.searchIn", { label });
  })();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  const [moreOpen, setMoreOpen] = useState(false);

  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [progressTitle, setProgressTitle] = useState("");
  const [progressSubtitle, setProgressSubtitle] = useState("");
  const [progressOpen, setProgressOpen] = useState(false);
  const [transferTaskId, setTransferTaskId] = useState<string | null>(null);
  /* La tâche appartient au gestionnaire global : fermer la fenêtre
     (« Masquer ») n'interrompt ni ne ralentit le transfert. */
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

  /* Retour Android : feuille → recherche → sélection → écran précédent.
     Les BottomSheet/visionneuse s'enregistrent eux-mêmes. */
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
  /* Retour : dossier → liste des dossiers → onglet par défaut → écran précédent. */
  useBackHandler(
    folderTabs && openFolder !== null,
    () => {
      setOpenFolder(null);
      return true;
    },
    BACK_PRIORITY.page,
  );
  useBackHandler(
    folderTabs && openFolder === null && tab === "folders",
    () => {
      setTab("songs");
      return true;
    },
    BACK_PRIORITY.page,
  );
  useBackHandler(
    docTabs && tab !== "all",
    () => {
      setTab("all");
      return true;
    },
    BACK_PRIORITY.page,
  );

  const signalRef = useRef<(OperationSignal & { cancel: () => void }) | null>(null);

  useEffect(() => {
    setView(loadView());
    const s = loadSort();
    setSortKey(s.key);
    setSortOrder(s.order);
  }, []);

  /* Ouverture instantanée : l'index persistant est lu immédiatement,
     aucune analyse n'est déclenchée à l'affichage. Les créations,
     suppressions et renommages arrivent en direct via les patchs. */
  useEffect(() => {
    setSelected(new Set());
    const handle = subscribeCategory(kind, (next) => setFiles(next));
    return () => handle.cancel();
  }, [kind]);

  /* Position de la liste : conservée uniquement le temps d'un aller-retour
     (ouvrir un dossier/fichier puis revenir), restituée avant peinture. */
  useListScrollMemory(
    `cat:${kind}:${openFolder ? `${openFolder.rootId}/${openFolder.segments.join("/")}` : tab}`,
    true,
  );

  /* Choix d'une destination : un dossier/album ouvert dans la catégorie
     devient la destination candidate. */
  useEffect(() => {
    if (pick?.purpose !== "destination") return;
    setPickLocation(
      openFolder ? { rootId: openFolder.rootId, segments: openFolder.segments } : null,
    );
  }, [pick?.purpose, openFolder]);

  /* Onglet actif + dossier ouvert : restaurés à l'ouverture de la catégorie. */
  useEffect(() => {
    if (!hasTabs || typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(`gf:cat-tab:${kind}`);
      if (!raw) return;
      const st = JSON.parse(raw) as {
        tab?: CategoryTabId;
        folder?: { rootId: CategoryFile["rootId"]; segments: string[]; name: string } | null;
      };
      if (st.tab) setTab(st.tab);
      if (st.folder) setOpenFolder(st.folder);
    } catch {
      /* état de navigation illisible : on repart de l'onglet par défaut */
    }
  }, [hasTabs, kind]);

  useEffect(() => {
    if (!hasTabs || typeof window === "undefined") return;
    sessionStorage.setItem(`gf:cat-tab:${kind}`, JSON.stringify({ tab, folder: openFolder }));
  }, [hasTabs, kind, tab, openFolder]);

  /** Fichiers visibles : filtre du sous-onglet, ou dossier ouvert. */
  const scoped = useMemo(() => {
    if (docTabs) {
      if (tab === "all") return files;
      const t = isDocTab(tab) ? tab : "all";
      return files.filter((f) => matchesDocTab(t, f.name));
    }
    if (!folderTabs || !openFolder) return files;
    const key = `${openFolder.rootId}/${openFolder.segments.join("/")}`;
    return files.filter((f) => `${f.rootId}/${f.folderSegments.join("/")}` === key);
  }, [files, folderTabs, docTabs, tab, openFolder]);

  /** Dossiers contenant au moins un fichier de la catégorie. */
  const folders = useMemo<CategoryFolder[]>(() => {
    if (!folderTabs) return [];
    const m = new Map<string, CategoryFolder>();
    for (const f of files) {
      const key = `${f.rootId}/${f.folderSegments.join("/")}`;
      const found = m.get(key);
      if (found) {
        found.count += 1;
        continue;
      }
      m.set(key, {
        rootId: f.rootId,
        segments: f.folderSegments,
        name: f.folderSegments[f.folderSegments.length - 1] ?? t("home.transfer.rootLabel"),
        count: 1,
        // Album : miniature réelle de la première image du dossier.
        coverPath: grouped ? f.path : undefined,
      });
    }
    const list = [...m.values()];
    list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
    return list;
  }, [files, folderTabs, grouped, t]);

  /* La saisie reste prioritaire : le filtrage d'une très grande liste est
     recalculé en tâche de moindre priorité (aucune frappe perdue). */
  const deferredQuery = useDeferredValue(query);

  const visibleFolders = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, deferredQuery]);

  const filtered = useMemo(() => {
    if (!deferredQuery.trim()) return scoped;
    const q = deferredQuery.trim().toLowerCase();
    return scoped.filter((f) => f.name.toLowerCase().includes(q));
  }, [scoped, deferredQuery]);

  const sorted = useMemo(
    () => sortEntries(filtered, sortKey, sortOrder, false) as CategoryFile[],
    [filtered, sortKey, sortOrder],
  );

  /* Regroupement dynamique (Images) : reconstruit dès que le tri change,
     sans rechargement des données. */
  const groups = useMemo<FileGroup<CategoryFile>[]>(
    () => (grouped ? groupBySort(sorted, sortKey) : []),
    [grouped, sorted, sortKey],
  );

  /* Chargement progressif des groupes (galerie) : seuls les premiers
     groupes sont montés, les suivants arrivent au défilement. */
  const GROUP_PAGE = 8;
  const [groupLimit, setGroupLimit] = useState(GROUP_PAGE);
  useEffect(() => {
    setGroupLimit(GROUP_PAGE);
  }, [kind, tab, openFolder, sortKey, sortOrder, deferredQuery]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!grouped) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setGroupLimit((n) => (n >= groups.length ? n : n + GROUP_PAGE));
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [grouped, groups.length]);

  const idOf = (f: CategoryFile) => `${f.rootId}/${f.folderSegments.join("/")}/${f.name}`;
  /* Index identifiant → fichier, construit une seule fois par liste : chaque
     cocher/décocher devient O(taille de la sélection) au lieu d'un parcours
     complet de la catégorie (100 000+ éléments). */
  const byId = useMemo(() => {
    const m = new Map<string, CategoryFile>();
    for (const f of sorted) m.set(idOf(f), f);
    return m;
  }, [sorted]);
  const selectedFiles = useMemo(() => {
    const out: CategoryFile[] = [];
    for (const id of selected) {
      const f = byId.get(id);
      if (f) out.push(f);
    }
    return out;
  }, [byId, selected]);

  /* Taille réelle de la sélection — exactement le même mécanisme que le
     gestionnaire de fichiers (tailles connues pour les fichiers, mesure
     récursive mémorisée pour les dossiers, sans double comptage). */
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
      ? `${formatSize(selectionSize.bytes)} • ${t("state.computing")}`
      : t("state.computingCap")
    : formatSize(selectionSize.bytes);

  const toggleSelect = useCallback(
    (entry: FileEntry) => {
      const f = entry as CategoryFile;
      if (pick) {
        if (pick.accept === "folders") return;
        if (!pick.multi) {
          confirmPick({ parent: parentOf(f), entry: f });
          return;
        }
        toggleGlobalSelection(parentOf(f), f);
        return;
      }
      pickLessToggle(f);
    },
    // pickLessToggle est stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pick],
  );

  const pickLessToggle = useCallback((f: CategoryFile) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const id = idOf(f);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const beginSelection = useCallback((entry: FileEntry) => {
    setSelected(new Set([idOf(entry as CategoryFile)]));
  }, []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);
  const selectAll = useCallback(() => {
    setSelected(new Set(sorted.map(idOf)));
  }, [sorted]);
  const selectRange = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const indices: number[] = [];
      sorted.forEach((e, i) => {
        if (prev.has(idOf(e))) indices.push(i);
      });
      if (indices.length === 0) return prev;
      const lo = indices[0];
      const hi = indices[indices.length - 1];
      const next = new Set(prev);
      for (let i = lo; i <= hi; i++) next.add(idOf(sorted[i]));
      return next;
    });
  }, [sorted]);
  const isSelected = useCallback(
    (e: FileEntry) =>
      pick
        ? globalSelection.has(globalSelectionKey(parentOf(e as CategoryFile), e.name))
        : selected.has(idOf(e as CategoryFile)),
    [selected, pick, globalSelection],
  );

  const openEntry = useCallback((entry: FileEntry) => {
    const f = entry as CategoryFile;
    if (isPackageEntry(f)) openPackageSheet({ parent: parentOf(f), entry: f });
    else if (canPreview(f)) setDialog({ kind: "viewer", entryName: f.name });
    else setDialog({ kind: "actions", entry: f });
  }, []);

  /* ---------- grouped batch operations (per parent folder) ---------- */

  const groupByParent = (items: CategoryFile[]) => {
    const m = new Map<string, { parent: PathRef; entries: CategoryFile[] }>();
    for (const f of items) {
      const key = `${f.rootId}/${f.folderSegments.join("/")}`;
      const bucket = m.get(key);
      if (bucket) bucket.entries.push(f);
      else m.set(key, { parent: parentOf(f), entries: [f] });
    }
    return [...m.values()];
  };

  /* Tirer pour actualiser : reconstruction de l'index en tâche de fond,
     la liste affichée n'est jamais vidée. */
  usePullToRefresh(
    useCallback(async () => {
      // Relecture réelle du stockage : la promesse n'est résolue qu'une
      // fois la traversée terminée (nouveaux fichiers ajoutés, fichiers
      // disparus évincés), sans jamais vider l'affichage.
      await refreshCategory(kind);
    }, [kind]),
  );

  const refreshAfterMutation = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("gf:storage-changed"));
    }
  };

  const doDelete = useCallback(
    async (items: CategoryFile[]) => {
      const groups = groupByParent(items);
      let ok = 0;
      let failed = 0;
      for (const g of groups) {
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

  const doShare = useCallback(
    async (items: CategoryFile[]) => {
      const groups = groupByParent(items);
      for (const g of groups) {
        const r = await shareEntries(g.parent, g.entries);
        if (!r.ok) toast.error(errorMessage(r.error, t("home.share.failed")));
      }
    },
    [t],
  );

  const doTransfer = useCallback(
    (mode: "copy" | "move", items: CategoryFile[], dest: PathRef) => {
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

  /* Copier / Déplacer depuis une catégorie : la destination se choisit
     dans la navigation habituelle (stockages, dossiers, albums). */
  const startTransferFlow = useCallback(
    async (mode: "copy" | "move", items: CategoryFile[]) => {
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
      toast.error(errorMessage(r.error, t("home.rename.failed")));
      return false;
    },
    [clearSelection, t],
  );

  /* ---------- action-sheet dispatch ---------- */

  const onEntryAction = useCallback(
    async (action: EntryAction) => {
      if (dialog.kind !== "actions") return;
      const f = dialog.entry as CategoryFile;
      const parent = parentOf(f);
      setDialog({ kind: "none" });
      switch (action) {
        case "open":
          if (isPackageEntry(f)) openPackageSheet({ parent, entry: f });
          else if (canPreview(f)) setDialog({ kind: "viewer", entryName: f.name });
          else await openWithSystem(parent, f);
          break;
        case "openWith":
          await openWithSystem(parent, f);
          break;
        case "editAudio":
          await navigate({
            to: "/editeur-audio",
            search: audioEditorSearch(parent, f),
          });
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
      const f = entry as CategoryFile;
      const parent = parentOf(f);
      switch (action) {
        case "share":
          await doShare([f]);
          break;
        case "openWith":
          await openWithSystem(parent, f);
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
    [doShare],
  );

  const viewerEntries = useMemo(() => sorted.filter((f) => canOpenInViewer(f)), [sorted]);

  /**
   * Ouverture rapide depuis la vignette pendant le mode sélection : le
   * lecteur interne s'ouvre pour tout fichier, la sélection est préservée.
   */
  const quickOpenEntry = useCallback((entry: FileEntry) => {
    const f = entry as CategoryFile;
    if (isPackageEntry(f)) openPackageSheet({ parent: parentOf(f), entry: f });
    else if (canOpenInViewer(f)) setDialog({ kind: "viewer", entryName: f.name });
    else setDialog({ kind: "actions", entry: f });
  }, []);
  const viewerIndex = useMemo(() => {
    if (dialog.kind !== "viewer") return -1;
    return viewerEntries.findIndex((f) => f.name === dialog.entryName);
  }, [dialog, viewerEntries]);

  const selectionMode = selected.size > 0;
  const showFolders = folderTabs && tab === "folders" && !openFolder;

  return (
    <AppShell>
      <FilesTopBar
        title={folderTabs && openFolder ? openFolder.name : label}
        count={
          showFolders
            ? visibleFolders.length
            : folderTabs && openFolder
              ? scoped.length
              : docTabs
                ? scoped.length
                : files.length
        }
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
      >
        {hasTabs && !openFolder ? (
          <CategoryTabs
            tabs={
              docTabs
                ? documentTabs()
                : [
                    { id: "songs", label: mediaTabLabel },
                    { id: "folders", label: folderTabLabel },
                  ]
            }
            active={tab}
            onChange={(t) => {
              setTab(t);
              setQuery("");
            }}
          />
        ) : folderTabs && openFolder ? (
          <div className="flex h-8 items-center px-3">
            <p className="truncate text-[12px] text-muted-foreground">
              {openFolder.segments.join(" / ") || t("home.transfer.rootLabel")}
            </p>
          </div>
        ) : null}
      </FilesTopBar>

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
            placeholder={searchPlaceholder}
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

      {showFolders ? (
        visibleFolders.length === 0 ? (
          <EmptyState
            icon={FolderSearch}
            title={
              grouped ? t("files.category.emptyAlbumsTitle") : t("files.category.emptyFoldersTitle")
            }
            description={t("files.category.emptyFoldersDesc", {
              kind: grouped ? t("files.category.unitAlbum") : t("files.category.unitFolder"),
              label: label.toLowerCase(),
            })}
          />
        ) : (
          <div className="-mx-4 pt-1">
            <CategoryFolderList
              folders={visibleFolders}
              describeCount={(n) =>
                folderTabs
                  ? kind === "videos"
                    ? t("count.videos", { count: n })
                    : kind === "images"
                      ? t("count.photos", { count: n })
                      : t("count.songs", { count: n })
                  : t("count.files", { count: n })
              }
              onOpen={(f) => {
                setSelected(new Set());
                setQuery("");
                setOpenFolder({ rootId: f.rootId, segments: f.segments, name: f.name });
              }}
            />
          </div>
        )
      ) : sorted.length === 0 && query.trim() ? (
        <IllustratedEmptyState
          id="search"
          description={t("files.search.noMatchDesc", { query: query.trim() })}
          action={
            <button onClick={() => setQuery("")} className="btn-primary gf-press">
              {t("cleaner.trash.clearSearch.aria")}
            </button>
          }
        />
      ) : sorted.length === 0 ? (
        <IllustratedEmptyState id={EMPTY_ILLUSTRATION_BY_KIND[kind]} />
      ) : (
        /* Marges identiques au gestionnaire de fichiers : la liste
           annule le padding horizontal de l'AppShell (-mx-4) puisque
           FileListView/FileGridView portent déjà leur propre px-4.
           Sans cela les marges étaient doublées (32 px au lieu de 16). */
        <div className="-mx-4 pt-1">
          {(grouped ? groups.slice(0, groupLimit) : [{ key: "all", label: "", items: sorted }]).map(
            (g) => (
              <section key={g.key}>
                {grouped && g.label ? (
                  <GroupHeading label={g.label} />
                ) : null}
                {view === "list" ? (
                  <FileListView
                    entries={g.items}
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
                    entries={g.items}
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
            ),
          )}
          {grouped && groupLimit < groups.length ? (
            <div ref={sentinelRef} className="h-10" aria-hidden />
          ) : null}
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
        label={t("home.rename.nameLabel")}
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
          if (next) setDialog({ kind: "viewer", entryName: next.name });
        }}
        onClose={() => setDialog({ kind: "none" })}
        onAction={onViewerAction}
        parentOf={(e) => parentOf(e as never)}
      />

      <ProgressDialog
        open={progressOpen}
        title={progressTitle}
        subtitle={progressSubtitle}
        progress={transferProgress ?? progress}
        speedBps={activeTransfer?.speedBps}
        onHide={activeTransfer ? hideTransferDialog : undefined}
        onCancel={() => {
          if (activeTransfer) cancelTransfer(activeTransfer.id);
          else signalRef.current?.cancel();
        }}
      />
    </AppShell>
  );
}
