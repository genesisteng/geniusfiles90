import { createFileRoute } from "@tanstack/react-router";
import { useAppNavigate } from "@/lib/navigation/pick-nav";
import {
  pickAccepts,
  pickAllowsApk,
  requestDestination,
  setPickLocation,
  usePickRequest,
  type PickedDetail,
  type PickRequest,
} from "@/lib/files/pick-session";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useBackHandler, BACK_PRIORITY } from "@/lib/navigation/back-stack";
import { loadScreenState, saveScreenState, clearScreenState } from "@/lib/navigation/screen-state";
import {
  ArrowLeft,
  Clock,
  HardDrive,
  Download,
  Search,
  Trash2,
  FileText,
  Wrench,
  AlertTriangle,
  Info,
  TrendingDown,
  Crop,
  AudioWaveform,
} from "lucide-react";

import { FileArchive, Package, Zap, Sparkles, Folder } from "lucide-react";
import {
  GfApps,
  GfAudioEditor,
  GfCleaner,
  GfDocument,
  GfDownload,
  GfImage,
  GfPhotoEditor,
  GfPdfTools,
  GfTrash,
  GfVault,
  GfVideo,
  GfAudio,
  type GfIconComponent,
} from "@/components/icons";
import { useStorageStats, type StorageStats } from "@/lib/native/use-storage-stats";
import { StorageCards } from "@/components/home/StorageCards";
import { RecentFilesSection } from "@/components/home/RecentFilesSection";
import { refreshAddedFiles } from "@/lib/recents/added";
import { formatSize } from "@/lib/files/format";
import { buildRecommendations, type Recommendation } from "@/lib/files/recommendations";
import type { ScanResult } from "@/lib/files/analyzer";
import { refreshStorageStats, subscribeStorageStats } from "@/lib/index/storage-stats";
import { recordSnapshot, loadSnapshots, type FreeSnapshot } from "@/lib/files/snapshots";
import { usageTrash, autoPurgeTrash } from "@/lib/files/trash";
import { ResumeBanner } from "@/components/jobs/ResumeBanner";
import { AppShell } from "@/components/AppShell";
import { usePullToRefresh } from "@/lib/gestures/pull-refresh";
import { PageHeader } from "@/components/common/PageHeader";

import { markStartupSignal } from "@/lib/startup/boot";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { PathBreadcrumb } from "@/components/files/PathBreadcrumb";
import { FilesTopBar } from "@/components/files/FilesTopBar";
import { FileGridView, FileListView } from "@/components/files/FileList";
import { FileIcon } from "@/components/files/FileIcon";
import {
  DeniedState,
  EmptyFolder,
  ErrorState,
  LoadingState,
  UnavailableState,
} from "@/components/files/StateViews";
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
import { canOpenInViewer, canPreview } from "@/lib/viewer/kinds";
import { isPackageEntry } from "@/lib/files/package";
import { openPackageSheet } from "@/lib/files/package-sheet-store";
import { openWithSystem } from "@/lib/viewer/openWith";
import { audioEditorSearch } from "@/lib/audio/routes";
import { FileSourcePicker } from "@/components/files/FileSourcePicker";
import { PhotoEditor } from "@/components/photo/PhotoEditor";
import { sourceUrlOf } from "@/lib/viewer/source";
import { AUDIO_EDITOR_EXTS, IMAGE_EDITOR_EXTS } from "@/lib/files/editor-picks";

import {
  getExternalVolumes,
  listDirectory,
  listRoots,
  peekDirectory,
  prefetchSubdirectories,
  refreshStorageVolumes,
  subscribeRoots,
} from "@/lib/files/fs";
import { subscribeFsPatch } from "@/lib/index/patches";
import { useLiveListing } from "@/lib/files/live-sync";
import { listInstalledApps } from "@/lib/apps/api";
import { consumeFileJump, FILE_JUMP_EVENT, type FileJumpTarget } from "@/lib/files/deeplink";

import { useRoots } from "@/lib/fs/useRoots";
import { sortEntries } from "@/lib/files/sort";
import { setSearchScope } from "@/lib/search/scope";
import { formatDate } from "@/lib/files/format";
import {
  loadFoldersFirst,
  loadRecents,
  loadSort,
  loadView,
  pushRecent,
  saveFoldersFirst,
  saveSort,
  saveView,
  type RecentItem,
} from "@/lib/files/preferences";

import type {
  FileEntry,
  ListingState,
  PathRef,
  SortKey,
  StorageRootId,
  SortOrder,
  ViewMode,
} from "@/lib/files/types";
import { openStoragePermissionSettings } from "@/lib/native/storage-permission";
import { confirmCopy, summarize, progressLabel } from "@/lib/copy";
import {
  useSelection,
  selectionEntries,
  selectionKey,
  pathKeyOf,
  toggleSelection,
  addSelection,
  replaceSelection,
  clearSelectionStore,
  reconcileSelection,
} from "@/lib/files/selection-store";
import { useSelectionSize, invalidateSizes } from "@/lib/files/selection-size";
import { unitFor } from "@/lib/files/describe";
import { useListScrollMemory } from "@/lib/files/use-list-scroll";
import {
  createDirectory,
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
import {
  ArchiveCreateSheet,
  ArchiveViewerSheet,
  ArchiveExtractSheet,
} from "@/components/files/ArchiveSheets";
import {
  createArchive,
  extractArchive,
  getArchiveCapabilities,
  listArchive,
  canReadArchive,
  type ArchiveCapabilities,
  type ArchiveListing,
  type ConflictPolicy,
  type ArchiveFormat,
} from "@/lib/files/archive";
import { useT, t as translate } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GeniusFiles" },
      {
        name: "description",
        content: translate("app.tagline"),
      },
      { property: "og:title", content: "GeniusFiles" },
      {
        property: "og:description",
        content: translate("app.tagline"),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FilesPage,
});

function pathKey(p: PathRef | null): string {
  return p ? `${p.rootId}::${p.segments.join("/")}` : "root";
}

type ActiveDialog =
  | { kind: "none" }
  | { kind: "newFolder" }
  | { kind: "rename"; entry: FileEntry }
  | { kind: "details"; info: DetailsInfo | null; loading: boolean }
  | { kind: "confirmDelete"; entries: FileEntry[] }
  | { kind: "actions"; entry: FileEntry }
  | { kind: "archiveCreate"; entries: FileEntry[] }
  | {
      kind: "archiveViewer";
      entry: FileEntry;
      listing: ArchiveListing | null;
      loading: boolean;
    }
  | {
      kind: "archiveExtract";
      entry: FileEntry;
      selection: string[];
    };

export function FilesPage() {
  const t = useT();
  const { roots } = useRoots();
  const routerNavigate = useAppNavigate();
  /* Session de sélection en cours (outils PDF, transfert, coffre-fort…) :
     l'écran officiel est réutilisé tel quel, seules les actions de gestion
     et l'ouverture d'un fichier changent de rôle. */
  const pick = usePickRequest();
  const [path, setPath] = useState<PathRef | null>(null);
  const [historyLen, setHistoryLen] = useState(0);

  const [view, setView] = useState<ViewMode>("list");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [foldersFirst, setFoldersFirst] = useState(true);

  const [recents, setRecents] = useState<RecentItem[]>([]);

  const [listing, setListing] = useState<ListingState>({ status: "idle" });
  const [refreshing, setRefreshing] = useState(false);

  /* Sélection globale (store externe) : elle survit à la navigation, au fil
     d'Ariane et aux changements de stockage, et peut couvrir plusieurs
     dossiers à la fois. */
  const selection = useSelection();
  const selectionMode = selection.size > 0;
  const selectionSize = useSelectionSize(selection);
  const selectionSizeLabel = selectionSize.pending
    ? selectionSize.bytes > 0
      ? `${formatSize(selectionSize.bytes)} • ${t("state.computing")}`
      : t("state.computingCap")
    : formatSize(selectionSize.bytes);
  /**
   * Le visionneur vit *à côté* des boîtes de dialogue : renommer, copier ou
   * partager depuis le lecteur ouvre une feuille par-dessus sans démonter
   * la vidéo (plus de fermeture intempestive ni de perte de position).
   */
  const [viewerName, setViewerName] = useState<string | null>(null);

  const [dialog, setDialog] = useState<ActiveDialog>({ kind: "none" });
  const [moreOpen, setMoreOpen] = useState(false);
  // Fichier ciblé par un lien profond, en attente du chargement du dossier.
  const [pendingFocus, setPendingFocus] = useState<{ name: string; open: boolean } | null>(null);

  // Progress dialog state — dedicated so a long op can keep running while
  // the picker/confirm sheets close.
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [progressTitle, setProgressTitle] = useState("");
  const [progressSubtitle, setProgressSubtitle] = useState("");
  const [progressOpen, setProgressOpen] = useState(false);
  const [transferTaskId, setTransferTaskId] = useState<string | null>(null);
  /* Tâche de transfert supervisée par la fenêtre de progression. Elle vit
     dans le gestionnaire global : « Masquer » ne fait que fermer la vue. */
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

  const [archiveCaps, setArchiveCaps] = useState<ArchiveCapabilities | null>(null);
  useEffect(() => {
    getArchiveCapabilities().then(setArchiveCaps);
  }, []);

  // Hydrate persisted prefs.
  useEffect(() => {
    setView(loadView());
    const s = loadSort();
    setSortKey(s.key);
    setSortOrder(s.order);
    setFoldersFirst(loadFoldersFirst());

    setRecents(loadRecents());
    // Lien profond éventuel (page Recherche ou Genius AI) : on ouvre le
    // dossier et on mémorise le fichier à sélectionner/ouvrir.
    const jump = consumeFileJump();
    if (jump) {
      setPath({ rootId: jump.rootId, segments: jump.segments });
      setHistoryLen(jump.segments.length);
      if (jump.file) setPendingFocus({ name: jump.file, open: jump.open === true });
      return;
    }
    // Retour depuis un autre écran : on restaure le dossier réellement
    // ouvert, jamais la racine.
    const last = loadScreenState<PathRef>("files.path");
    if (last?.rootId) {
      setPath(last);
      setHistoryLen(last.segments?.length ?? 0);
    }
  }, []);

  // Mémorise le dossier courant pour la restauration au retour.
  useEffect(() => {
    if (path) saveScreenState("files.path", path);
    else clearScreenState("files.path");
  }, [path]);

  // Fetch directory when path changes / refresh triggered.
  // Le contenu déjà connu (cache dossier) est peint immédiatement : aucun
  // écran de chargement au retour ni au changement de dossier. La lecture
  // réelle revalide ensuite en arrière-plan.
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    const cached = peekDirectory(path);
    if (cached) {
      setListing(cached.length === 0 ? { status: "empty" } : { status: "ready", entries: cached });
    } else {
      setListing({ status: "loading" });
    }
    listDirectory(path).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setListing({ status: res.reason, message: res.message ?? "" } as ListingState);
        setRefreshing(false);
        return;
      }
      setListing(
        res.entries.length === 0 ? { status: "empty" } : { status: "ready", entries: res.entries },
      );
      setRefreshing(false);
      // Préchauffe les sous-dossiers pour une ouverture instantanée.
      prefetchSubdirectories(path, res.entries);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  /* ─────────────────────────────────────────────────────────────
     Mise à jour immédiate et ciblée.

     Chaque mutation (renommage, suppression, création, copie,
     déplacement, extraction, enregistrement…) est appliquée
     directement à la liste affichée : pas de relecture du dossier,
     donc aucun clignotement, aucun saut de liste, aucune perte de
     position ni de sélection — même sur un dossier de plusieurs
     dizaines de milliers de fichiers.
     ───────────────────────────────────────────────────────────── */
  const onPathRebased = useCallback((next: PathRef) => {
    setPath(next);
  }, []);
  useLiveListing(path, setListing, onPathRebased);

  /* ─────────────────────────────────────────────────────────────
     Signal de démarrage : le splash ne se retire que lorsque le
     premier écran est RÉELLEMENT construit.

     • accueil : les stockages sont connus (cartes + raccourcis
       peints avec leurs vraies valeurs) ;
     • dossier restauré : la liste n'est plus en cours de lecture.

     Deux frames sont attendues après cet état pour garantir que la
     peinture a bien eu lieu avant le fondu. Un délai de grâce court
     évite tout blocage si aucun stockage n'est exposé (preview web) ;
     le coordinateur possède de toute façon son propre plafond dur.
     ───────────────────────────────────────────────────────────── */
  const firstScreenSignaled = useRef(false);
  useEffect(() => {
    if (firstScreenSignaled.current) return;
    const contentReady = path
      ? listing.status !== "idle" && listing.status !== "loading"
      : roots.length > 0;
    const commit = () => {
      if (firstScreenSignaled.current) return;
      firstScreenSignaled.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => markStartupSignal("first-screen")));
    };
    if (contentReady) {
      commit();
      return;
    }
    const grace = window.setTimeout(commit, 220);
    return () => window.clearTimeout(grace);
  }, [path, listing.status, roots.length]);

  /* ---------- mémoire de navigation ---------- */

  const scrollKey = path ? pathKeyOf(path) : "__root";

  /* Position du gestionnaire de fichiers : conservée uniquement le temps
     d'un aller-retour (ouvrir un dossier puis revenir), restituée avant
     peinture — aucun clignotement, aucun saut. */
  useListScrollMemory(
    scrollKey,
    path ? listing.status === "ready" || listing.status === "empty" : roots.length > 0,
  );

  /* Choix d'une destination : le dossier affiché EST la destination
     candidate — la barre du bas suit la navigation en direct. */
  useEffect(() => {
    if (pick?.purpose !== "destination") return;
    setPickLocation(path);
  }, [pick?.purpose, path]);

  // La sélection survit à la navigation : on retire seulement ce qui a
  // réellement disparu du dossier rafraîchi.
  useEffect(() => {
    if (!path || listing.status !== "ready") return;
    reconcileSelection(path, listing.entries);
  }, [path, listing]);

  // Lien profond reçu alors que la page est déjà montée (Genius AI).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onJump = (e: Event) => {
      const t = (e as CustomEvent<FileJumpTarget>).detail;
      if (!t) return;
      consumeFileJump();
      setPath({ rootId: t.rootId, segments: [...t.segments] });
      setHistoryLen(t.segments.length);
      if (t.file) setPendingFocus({ name: t.file, open: t.open === true });
    };
    window.addEventListener(FILE_JUMP_EVENT, onJump as EventListener);
    return () => window.removeEventListener(FILE_JUMP_EVENT, onJump as EventListener);
  }, []);

  // Cible d'un lien profond : dès que le dossier est chargé, le fichier
  // est sélectionné, amené à l'écran et — si demandé — ouvert.
  useEffect(() => {
    if (!pendingFocus || !path) return;
    if (listing.status !== "ready") {
      if (listing.status === "empty" || listing.status === "loading") return;
      setPendingFocus(null);
      return;
    }
    const entry = listing.entries.find((e) => e.name === pendingFocus.name);
    setPendingFocus(null);
    if (!entry) {
      toast.warning(t("home.editor.fileGone", { name: pendingFocus.name }));
      return;
    }
    replaceSelection(path, [entry]);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-entry-name="${CSS.escape(entry.name)}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    if (pendingFocus.open) {
      if (canPreview(entry)) setViewerName(entry.name);
      else void openWithSystem(path, entry);
    }
  }, [pendingFocus, listing, path, t]);

  const currentTitle = path
    ? (path.segments[path.segments.length - 1] ??
      roots.find((r) => r.id === path.rootId)?.label ??
      t("home.title.files"))
    : t("home.title.files");

  const navigateTo = useCallback((next: PathRef | null) => {
    setPath(next);
    setHistoryLen((h) => (next ? h + 1 : 0));
  }, []);

  const goBack = useCallback(() => {
    if (selectionMode) {
      clearSelectionStore();
      return;
    }
    if (!path) return;
    if (path.segments.length === 0) {
      setPath(null);
      setHistoryLen(0);
    } else {
      setPath({ rootId: path.rootId, segments: path.segments.slice(0, -1) });
      setHistoryLen((h) => Math.max(0, h - 1));
    }
  }, [path, selectionMode]);

  // Retour Android / geste système : le contrôleur central délègue ici tant
  // que la page fichiers a quelque chose à absorber (mode sélection puis
  // dossier parent). Sinon il remonte à l'écran précédent réel.
  useBackHandler(
    selectionMode,
    () => {
      clearSelectionStore();
      return true;
    },
    BACK_PRIORITY.mode,
  );
  useBackHandler(
    Boolean(path),
    () => {
      if (!path) return false;
      goBack();
      return true;
    },
    BACK_PRIORITY.page,
  );

  const openEntry = useCallback(
    (entry: FileEntry) => {
      if (!path) return;
      const segments = [...path.segments, entry.name];
      pushRecent({
        name: entry.name,
        rootId: path.rootId,
        segments,
        isDirectory: entry.isDirectory,
      });
      setRecents(loadRecents());
      if (entry.isDirectory) {
        navigateTo({ rootId: path.rootId, segments });
      } else if (isPackageEntry(entry)) {
        // APK / AAB / XAPK : paquet Android, jamais l'écran d'extraction.
        openPackageSheet({ parent: path, entry, onExplore: openArchive });
      } else if (canReadArchive(entry)) {
        openArchive(entry);
      } else if (canPreview(entry)) {
        // Previewable file → Universal Viewer.
        setViewerName(entry.name);
      } else {
        // File tap in browsing mode opens the actions sheet.
        setDialog({ kind: "actions", entry });
      }
    },
    // openArchive is stable within the same path
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, navigateTo],
  );

  /**
   * Ouverture rapide depuis la vignette (mode sélection) : ouvre TOUJOURS
   * le lecteur interne — l'étape de repli du visualiseur gère les formats
   * sans lecteur dédié (APK, binaires…). La sélection reste intacte.
   */
  const quickOpenEntry = useCallback(
    (entry: FileEntry) => {
      if (!path) return;
      if (entry.isDirectory) {
        // Pendant une sélection, la vignette d'un dossier permet d'y entrer.
        if (pick) navigateTo({ rootId: path.rootId, segments: [...path.segments, entry.name] });
        return;
      }
      if (isPackageEntry(entry)) {
        openPackageSheet({ parent: path, entry, onExplore: openArchive });
        return;
      }
      if (canReadArchive(entry)) {
        openArchive(entry);
        return;
      }
      if (canOpenInViewer(entry)) {
        setViewerName(entry.name);
        return;
      }
      setDialog({ kind: "actions", entry });
    },
    // openArchive est stable pour un même chemin
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, pick, navigateTo],
  );

  const openRoot = useCallback(
    (rootId: PathRef["rootId"]) => {
      navigateTo({ rootId, segments: [] });
    },
    [navigateTo],
  );

  const onSortChange = (key: SortKey, order: SortOrder) => {
    setSortKey(key);
    setSortOrder(order);
    saveSort({ key, order });
  };
  const onViewChange = (v: ViewMode) => {
    setView(v);
    saveView(v);
  };
  const onFoldersFirstChange = (v: boolean) => {
    setFoldersFirst(v);
    saveFoldersFirst(v);
  };

  /**
   * Actualisation réelle (tirer pour actualiser / bouton).
   *
   * Le dossier affiché est **relu depuis le stockage** en ignorant le
   * cache (`force`), les volumes et les statistiques sont recalculés et
   * la liste des fichiers récemment ajoutés est rescannée. La promesse
   * n'est résolue qu'une fois les données réellement à jour : l'anneau
   * de rafraîchissement reflète l'état réel de l'opération.
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshStorageStats();
    const jobs: Promise<unknown>[] = [refreshStorageVolumes(), refreshAddedFiles(true)];
    if (path) {
      jobs.push(
        listDirectory(path, { force: true }).then((res) => {
          if (!res.ok) {
            setListing({ status: res.reason, message: res.message ?? "" } as ListingState);
            return;
          }
          setListing(
            res.entries.length === 0
              ? { status: "empty" }
              : { status: "ready", entries: res.entries },
          );
        }),
      );
    }
    try {
      await Promise.all(jobs);
    } finally {
      setRefreshing(false);
    }
  }, [path]);

  /* Tirer pour actualiser : relit le dossier courant (racines, dossiers
     et sous-dossiers) sans perdre la position ni la sélection. */
  usePullToRefresh(onRefresh);

  const sortedEntries = useMemo(() => {
    if (listing.status !== "ready") return [] as FileEntry[];
    return sortEntries(listing.entries, sortKey, sortOrder, foldersFirst);
  }, [listing, sortKey, sortOrder, foldersFirst]);

  const selectedEntries = useMemo(() => selectionEntries(selection), [selection]);

  /** Regroupe des entrées par dossier d'origine (sélection multi-dossiers). */
  const groupsFor = useCallback(
    (entries: FileEntry[]) => {
      const origin = new Map<FileEntry, PathRef>();
      for (const item of selection.values()) origin.set(item.entry, item.parent);
      const byParent = new Map<string, { parent: PathRef; entries: FileEntry[] }>();
      for (const entry of entries) {
        const parent = origin.get(entry) ?? path;
        if (!parent) continue;
        const k = pathKeyOf(parent);
        const group = byParent.get(k);
        if (group) group.entries.push(entry);
        else byParent.set(k, { parent, entries: [entry] });
      }
      return [...byParent.values()];
    },
    [selection, path],
  );

  /* ---------- selection handlers ---------- */

  const toggleSelect = useCallback(
    (entry: FileEntry) => {
      if (!path) return;
      if (pick) {
        /* Choix d'une destination : on ne sélectionne rien — un dossier
           s'ouvre, un fichier est ignoré. La destination est le dossier
           affiché, validé depuis la barre du bas. */
        if (pick.purpose === "destination") {
          if (entry.isDirectory)
            navigateTo({ rootId: path.rootId, segments: [...path.segments, entry.name] });
          return;
        }
        // Un dossier reste ouvrable quand la fonctionnalité ne veut que des fichiers.

        if (entry.isDirectory && pick.accept === "files") {
          navigateTo({ rootId: path.rootId, segments: [...path.segments, entry.name] });
          return;
        }
        // Élément incompatible (mauvaise extension) : rien à sélectionner.
        if (!pickAccepts(entry, pick)) return;
        /* Sélection unique : l'élément touché remplace le précédent et
           reste sélectionné jusqu'à « Valider ». */
        if (!pick.multi) {
          replaceSelection(path, [entry]);
          return;
        }
      }
      toggleSelection(path, entry);
    },
    [path, pick, navigateTo],
  );

  const beginSelection = useCallback(
    (entry: FileEntry) => {
      if (path) addSelection(path, [entry]);
    },
    [path],
  );

  const clearSelection = useCallback(() => clearSelectionStore(), []);

  const selectAll = useCallback(() => {
    if (path) addSelection(path, sortedEntries);
  }, [path, sortedEntries]);

  const selectRange = useCallback(() => {
    if (!path) return;
    const indices: number[] = [];
    sortedEntries.forEach((e, i) => {
      if (selection.has(selectionKey(path, e.name))) indices.push(i);
    });
    if (indices.length === 0) return;
    const lo = indices[0];
    const hi = indices[indices.length - 1];
    addSelection(path, sortedEntries.slice(lo, hi + 1));
  }, [path, selection, sortedEntries]);

  /* ---------- operations ---------- */

  const runTransfer = useCallback(
    (
      mode: "copy" | "move",
      entries: FileEntry[],
      dest: PathRef,
      /* Regroupement calculé AVANT le choix de la destination : la
         sélection d'origine est déjà retombée à ce moment-là. */
      precomputedGroups?: { parent: PathRef; entries: FileEntry[] }[],
    ) => {
      const destLabel = dest.segments.length
        ? dest.segments.join(" / ")
        : t("home.transfer.rootLabel");
      const groups = precomputedGroups ?? groupsFor(entries);
      if (groups.length === 0) return;

      // « 2 dossiers » ≠ « 2 fichiers » : le libellé suit la nature réelle.
      const unit = unitFor(entries);
      // La tâche vit dans le gestionnaire global : masquer la fenêtre,
      // naviguer ou quitter l'écran ne l'interrompt jamais.
      const id = startTransfer({
        mode,
        groups,
        destination: dest,
        onDone: (task) => {
          onRefresh();
          if (task.status === "cancelled") {
            toast.warning(t("home.transfer.cancelled"), {
              description: t("home.transfer.cancelledDetail", { count: task.succeeded, unit }),
            });
          } else if (task.status === "done") {
            const summary = summarize(
              mode === "copy" ? t("ops.transfer.copyDone") : t("ops.transfer.moveDone"),
              task.succeeded,
              unit,
              destLabel,
            );
            toast.success(summary.title, { description: summary.detail });
          } else {
            toast.error(
              t("home.transfer.mixedResult", {
                succeeded: task.succeeded,
                failed: task.failures.length,
              }),
              {
                description: task.failures
                  .slice(0, 3)
                  .map((f) => `${f.name} — ${f.reason}`)
                  .join("\n"),
              },
            );
          }
        },
      });
      setTransferTaskId(id);
      setProgressTitle(
        progressLabel(
          mode === "copy" ? t("home.transfer.copyLabel") : t("home.transfer.moveLabel"),
          undefined,
          entries.length,
          unit,
        ),
      );
      setProgressSubtitle(t("home.transfer.toLabel", { dest: destLabel }));
      setProgressOpen(true);
      clearSelection();
      invalidateSizes();
    },
    [clearSelection, groupsFor, onRefresh, t],
  );

  /**
   * Copier / Déplacer : l'utilisateur choisit la destination dans la
   * navigation habituelle de GeniusFiles (accueil, stockages, catégories,
   * dossiers, albums), puis valide « ici ». Aucun écran de sélection de
   * dossier séparé n'est affiché.
   */
  const startTransferFlow = useCallback(
    async (mode: "copy" | "move", entries: FileEntry[]) => {
      if (entries.length === 0) return;
      const items = [...entries];
      const groups = groupsFor(items);
      if (groups.length === 0) return;
      setDialog({ kind: "none" });
      const dest = await requestDestination({ mode });
      if (!dest) return;
      runTransfer(mode, items, dest, groups);
    },
    [groupsFor, runTransfer],
  );

  const runDelete = useCallback(
    async (entries: FileEntry[]) => {
      const groups = groupsFor(entries);
      if (groups.length === 0) return;
      const unit = unitFor(entries);
      let succeeded = 0;
      const failed: { name: string; reason?: string }[] = [];
      let cancelled = false;
      // Au-delà de quelques éléments, la suppression est suivie dans le
      // dialogue de progression : elle reste annulable et l'interface
      // continue de répondre pendant l'opération.
      const heavy = entries.length > 8;
      const signal = createSignal();
      if (heavy) {
        signalRef.current = signal;
        setProgress(null);
        setProgressTitle(progressLabel(t("home.delete.label"), undefined, entries.length, unit));
        setProgressSubtitle(t("home.delete.subtitle"));
        setProgressOpen(true);
      }
      try {
        for (const group of groups) {
          if (signal.cancelled) {
            cancelled = true;
            break;
          }
          const res = await deleteEntries(group.parent, group.entries, {
            signal,
            onProgress: heavy ? (p) => setProgress(p) : undefined,
          });
          succeeded += res.succeeded ?? 0;
          if (res.cancelled) cancelled = true;
          if (!res.ok) failed.push(...res.failed);
        }
      } finally {
        if (heavy) {
          setProgressOpen(false);
          signalRef.current = null;
        }
      }
      // Seuls les éléments réellement supprimés quittent la sélection ;
      // les échecs y restent pour permettre une nouvelle tentative.
      if (failed.length === 0) clearSelection();
      invalidateSizes();
      if (cancelled) {
        toast.info(
          succeeded > 0
            ? t("home.delete.cancelledWithCount", { count: succeeded, unit })
            : t("home.delete.cancelled"),
        );
        return;
      }
      if (failed.length === 0) {
        toast.success(
          entries.length === 1
            ? t("home.delete.doneSingle", { name: entries[0].name })
            : t("home.delete.doneMultiple", { count: succeeded, unit }),
        );
      } else {
        toast.error(t("home.delete.failed", { count: failed.length }), {
          description: failed
            .slice(0, 3)
            .map((f) => (f.reason ? `${f.name} — ${f.reason}` : f.name))
            .join("\n"),
        });
      }
    },
    [clearSelection, groupsFor, t],
  );

  const runShare = useCallback(
    async (entries: FileEntry[]) => {
      const groups = groupsFor(entries);
      if (groups.length === 0) return;
      for (const group of groups) {
        const res = await shareEntries(group.parent, group.entries);
        if (!res.ok) {
          toast.error(res.error ?? t("home.share.failed"));
          return;
        }
      }
    },
    [groupsFor, t],
  );

  const runRename = useCallback(
    async (entry: FileEntry, newName: string) => {
      // L'entrée peut provenir d'un autre dossier (sélection multi-dossiers).
      const parent = groupsFor([entry])[0]?.parent ?? path;
      if (!parent) return false;
      const res = await renameEntry(parent, entry, newName);
      if (res.ok) {
        toast.success(t("home.rename.done"));
        // Le visionneur suit le fichier renommé au lieu de retomber sur le
        // premier élément de la liste.
        setViewerName((current) => (current === entry.name ? newName : current));
        // La liste, la sélection, le fil d'Ariane et les vues dérivées
        // sont mis à jour par le patch : aucune relecture du dossier.
        invalidateSizes();
        return true;
      }

      toast.error(res.error ?? t("home.rename.failed"));
      return false;
    },
    [path, groupsFor, t],
  );

  const runCreateFolder = useCallback(
    async (name: string) => {
      if (!path) return false;
      const res = await createDirectory(path, name);
      if (res.ok) {
        toast.success(t("home.folder.created"));
        return true;
      }
      toast.error(res.error ?? t("home.folder.createFailed"));
      return false;
    },
    [path, t],
  );

  const openDetails = useCallback(
    async (entry: FileEntry) => {
      if (!path) return;
      setDialog({ kind: "details", info: null, loading: true });
      const info = await readDetails(path, entry);
      setDialog({ kind: "details", info, loading: false });
    },
    [path],
  );

  /* ---------- archive operations ---------- */

  const openArchive = useCallback(
    async (entry: FileEntry) => {
      if (!path) return;
      setDialog({ kind: "archiveViewer", entry, listing: null, loading: true });
      const res = await listArchive(path, entry);
      if (!res.ok) {
        toast.error(res.error);
        setDialog({ kind: "none" });
        return;
      }
      setDialog({ kind: "archiveViewer", entry, listing: res.listing, loading: false });
    },
    [path],
  );

  const runCreateArchive = useCallback(
    async (
      entries: FileEntry[],
      opts: {
        destination: PathRef;
        archiveName: string;
        format: ArchiveFormat;
        level: number;
        password?: string;
      },
    ) => {
      if (!path) return;
      const signal = createSignal();
      signalRef.current = signal;
      setProgress(null);
      setProgressTitle(t("home.archive.creatingTitle"));
      setProgressSubtitle(t("home.archive.creatingSubtitle"));
      setProgressOpen(true);
      const res = await createArchive({
        parent: path,
        entries,
        destination: opts.destination,
        archiveName: opts.archiveName,
        format: opts.format,
        level: opts.level,
        password: opts.password,
        signal,
        onProgress: (p) => setProgress(p),
      });
      setProgressOpen(false);
      signalRef.current = null;
      clearSelection();
      onRefresh();
      if (res.cancelled) toast.warning(t("home.archive.cancelled"));
      else if (res.ok)
        toast.success(
          res.size
            ? t("home.archive.createdWithSize", { size: `${(res.size / 1024).toFixed(0)} Ko` })
            : t("home.archive.created"),
        );
      else toast.error(res.error ?? t("home.archive.failed"));
    },
    [path, clearSelection, onRefresh, t],
  );

  const runExtract = useCallback(
    async (
      entry: FileEntry,
      selection: string[],
      opts: { destination: PathRef; conflict: ConflictPolicy; password?: string },
    ) => {
      if (!path) return;
      const signal = createSignal();
      signalRef.current = signal;
      setProgress(null);
      setProgressTitle(t("home.extract.title"));
      setProgressSubtitle(t("home.extract.subtitle"));
      setProgressOpen(true);
      const res = await extractArchive({
        parent: path,
        entry,
        destination: opts.destination,
        entries: selection.length > 0 ? selection : undefined,
        conflict: opts.conflict,
        password: opts.password,
        signal,
        onProgress: (p) => setProgress(p),
      });
      setProgressOpen(false);
      signalRef.current = null;
      onRefresh();
      if (res.cancelled) toast.warning(t("home.extract.cancelled"));
      else if (res.ok) toast.success(t("home.extract.done", { count: res.completed ?? 0 }));
      else toast.error(res.error ?? t("home.extract.failed"));
    },
    [path, onRefresh, t],
  );

  /* ---------- entry action sheet dispatcher ---------- */

  const handleEntryAction = useCallback(
    (entry: FileEntry, action: EntryAction) => {
      setDialog({ kind: "none" });
      switch (action) {
        case "info":
          openDetails(entry);
          break;
        case "rename":
          setDialog({ kind: "rename", entry });
          break;
        case "share":
          runShare([entry]);
          break;
        case "copy":
          void startTransferFlow("copy", [entry]);
          break;
        case "move":
          void startTransferFlow("move", [entry]);
          break;
        case "delete":
          setDialog({ kind: "confirmDelete", entries: [entry] });
          break;
        case "compress":
          setDialog({ kind: "archiveCreate", entries: [entry] });
          break;
        case "openArchive":
          openArchive(entry);
          break;
        case "extract":
          setDialog({ kind: "archiveExtract", entry, selection: [] });
          break;
        case "open":
          openEntry(entry);
          break;
        case "openWith":
          if (path) void openWithSystem(path, entry);
          break;
        case "editAudio":
          if (path)
            void routerNavigate({
              to: "/editeur-audio",
              search: audioEditorSearch(path, entry),
            });
          break;
      }
    },
    [openDetails, runShare, openArchive, openEntry, path, routerNavigate, startTransferFlow],
  );

  /* ---------- viewer action dispatcher ---------- */

  const handleViewerAction = useCallback(
    (entry: FileEntry, action: ViewerAction) => {
      // Le visionneur reste monté : seules les actions qui font disparaître
      // le fichier de l'écran (suppression) ou qui changent de dossier le
      // ferment. Tout le reste s'ouvre par-dessus, lecture conservée.
      switch (action) {
        case "share":
          runShare([entry]);
          break;
        case "info":
          openDetails(entry);
          break;
        case "rename":
          setDialog({ kind: "rename", entry });
          break;
        case "copy":
          void startTransferFlow("copy", [entry]);
          break;
        case "move":
          void startTransferFlow("move", [entry]);
          break;
        case "delete":
          setViewerName(null);
          setDialog({ kind: "confirmDelete", entries: [entry] });
          break;
        case "compress":
          setDialog({ kind: "archiveCreate", entries: [entry] });
          break;
        case "openFolder":
          setViewerName(null);
          break;
        case "openWith":
          if (path) void openWithSystem(path, entry);
          break;
      }
    },
    [openDetails, runShare, path, startTransferFlow],
  );

  return (
    <AppShell>
      {path ? (
        <FilesTopBar
          title={currentTitle}
          count={listing.status === "ready" ? sortedEntries.length : undefined}
          onBack={goBack}
          onSearch={() => {
            // Recherche contextuelle : limitée au stockage ou au dossier ouvert.
            if (path) setSearchScope({ label: currentTitle, path });
            routerNavigate({ to: "/recherche" });
          }}
          view={view}
          onViewChange={onViewChange}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          foldersFirst={foldersFirst}
          onFoldersFirstChange={onFoldersFirstChange}
          onNewFolder={
            pick && pick.purpose !== "destination"
              ? undefined
              : () => setDialog({ kind: "newFolder" })
          }
          selection={
            selectionMode
              ? {
                  count: selection.size,
                  sizeLabel: selectionSizeLabel,
                  onClear: clearSelection,
                  onSelectAll: selectAll,
                  onSelectRange: selection.size >= 1 ? selectRange : undefined,
                }
              : null
          }
        >
          <PathBreadcrumb
            path={path}
            roots={roots}
            onHome={() => navigateTo(null)}
            onNavigate={(segments) => path && navigateTo({ rootId: path.rootId, segments })}
          />
        </FilesTopBar>
      ) : null}

      {path ? (
        <DirectoryView
          key={pathKey(path) + ":" + historyLen}
          listing={listing}
          parent={path}
          onCreateFolder={() => setDialog({ kind: "newFolder" })}
          view={view}
          entries={sortedEntries}
          onOpen={openEntry}
          onQuickOpen={quickOpenEntry}
          onLongPress={beginSelection}
          onMore={(e) => {
            // Copier / déplacer / renommer / supprimer / partager sont masqués
            // pendant un parcours de sélection.
            if (!pick) setDialog({ kind: "actions", entry: e });
          }}
          onRefresh={onRefresh}
          selectionMode={selectionMode || pick !== null}
          isSelected={(e) => selection.has(selectionKey(path, e.name))}
          onToggleSelect={toggleSelect}
        />
      ) : (
        <RootView roots={roots} onOpenRoot={openRoot} pick={pick} />
      )}

      {selectionMode && !pick ? (
        <>
          <SelectionBar
            count={selection.size}
            onCopy={() => void startTransferFlow("copy", selectedEntries)}
            onMove={() => void startTransferFlow("move", selectedEntries)}
            onDelete={() => setDialog({ kind: "confirmDelete", entries: selectedEntries })}
            onRename={() =>
              selectedEntries[0] && setDialog({ kind: "rename", entry: selectedEntries[0] })
            }
            onShare={() => runShare(selectedEntries)}
            onMore={() => setMoreOpen(true)}
          />
          <MoreActionsSheet
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            actions={buildMoreActions(selectedEntries, {
              onShare: () => runShare(selectedEntries),
              onCompress: () => setDialog({ kind: "archiveCreate", entries: selectedEntries }),
              onProperties: () => selectedEntries[0] && openDetails(selectedEntries[0]),
              onCut: () => void startTransferFlow("move", selectedEntries),
            })}
          />
        </>
      ) : null}

      {/* Dialogs */}
      <NamePrompt
        open={dialog.kind === "newFolder"}
        title={t("home.folder.newTitle")}
        label={t("automations.field.folderName")}
        initial=""
        cta={t("automations.wizard.create")}
        onCancel={() => setDialog({ kind: "none" })}
        onSubmit={async (name) => {
          const ok = await runCreateFolder(name);
          if (ok) setDialog({ kind: "none" });
        }}
      />

      <NamePrompt
        open={dialog.kind === "rename"}
        title={t("home.rename.title")}
        label={t("home.rename.nameLabel")}
        initial={dialog.kind === "rename" ? dialog.entry.name : ""}
        cta={t("home.rename.cta")}
        onCancel={() => setDialog({ kind: "none" })}
        onSubmit={async (name) => {
          if (dialog.kind !== "rename") return;
          const ok = await runRename(dialog.entry, name);
          if (ok) setDialog({ kind: "none" });
        }}
      />

      <ConfirmDialog
        open={dialog.kind === "confirmDelete"}
        title={
          dialog.kind === "confirmDelete"
            ? confirmCopy.moveToTrash(dialog.entries.length).title
            : ""
        }
        danger
        confirmLabel={
          dialog.kind === "confirmDelete"
            ? confirmCopy.moveToTrash(dialog.entries.length).confirmLabel
            : ""
        }
        description={
          dialog.kind === "confirmDelete"
            ? confirmCopy.moveToTrash(dialog.entries.length).description
            : null
        }
        onCancel={() => setDialog({ kind: "none" })}
        onConfirm={async () => {
          if (dialog.kind !== "confirmDelete") return;
          const entries = dialog.entries;
          setDialog({ kind: "none" });
          await runDelete(entries);
        }}
      />

      <DetailsSheet
        open={dialog.kind === "details"}
        info={dialog.kind === "details" ? dialog.info : null}
        onClose={() => setDialog({ kind: "none" })}
      />

      <EntryActionSheet
        open={dialog.kind === "actions"}
        entry={dialog.kind === "actions" ? dialog.entry : null}
        onClose={() => setDialog({ kind: "none" })}
        onAction={(a) => {
          if (dialog.kind !== "actions") return;
          handleEntryAction(dialog.entry, a);
        }}
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

      <ArchiveCreateSheet
        open={dialog.kind === "archiveCreate"}
        entries={dialog.kind === "archiveCreate" ? dialog.entries : []}
        parent={path}
        caps={archiveCaps}
        onCancel={() => setDialog({ kind: "none" })}
        onSubmit={async (opts) => {
          const entries = dialog.kind === "archiveCreate" ? dialog.entries : [];
          setDialog({ kind: "none" });
          await runCreateArchive(entries, opts);
        }}
      />

      <ArchiveViewerSheet
        open={dialog.kind === "archiveViewer"}
        entry={dialog.kind === "archiveViewer" ? dialog.entry : null}
        listing={dialog.kind === "archiveViewer" ? dialog.listing : null}
        loading={dialog.kind === "archiveViewer" ? dialog.loading : false}
        onClose={() => setDialog({ kind: "none" })}
        onExtractAll={() => {
          if (dialog.kind !== "archiveViewer") return;
          const entry = dialog.entry;
          setDialog({ kind: "archiveExtract", entry, selection: [] });
        }}
        onExtractSelection={(selection) => {
          if (dialog.kind !== "archiveViewer") return;
          const entry = dialog.entry;
          setDialog({ kind: "archiveExtract", entry, selection });
        }}
        onRename={() => {
          if (dialog.kind !== "archiveViewer") return;
          setDialog({ kind: "rename", entry: dialog.entry });
        }}
        onShare={() => {
          if (dialog.kind !== "archiveViewer") return;
          const entry = dialog.entry;
          setDialog({ kind: "none" });
          runShare([entry]);
        }}
        onDelete={() => {
          if (dialog.kind !== "archiveViewer") return;
          setDialog({ kind: "confirmDelete", entries: [dialog.entry] });
        }}
      />

      <ArchiveExtractSheet
        open={dialog.kind === "archiveExtract"}
        entry={dialog.kind === "archiveExtract" ? dialog.entry : null}
        parent={path}
        initialDestination={path}
        selectionCount={dialog.kind === "archiveExtract" ? dialog.selection.length : 0}
        caps={archiveCaps}
        onCancel={() => setDialog({ kind: "none" })}
        onSubmit={async (opts) => {
          if (dialog.kind !== "archiveExtract") return;
          const entry = dialog.entry;
          const selection = dialog.selection;
          setDialog({ kind: "none" });
          await runExtract(entry, selection, opts);
        }}
      />

      <UniversalViewer
        open={viewerName != null}
        parent={path}
        entries={sortedEntries}
        index={
          viewerName != null
            ? Math.max(
                0,
                sortedEntries.findIndex((e) => e.name === viewerName),
              )
            : 0
        }
        onIndexChange={(i) => {
          const next = sortedEntries[i];
          if (next) setViewerName(next.name);
        }}
        onClose={() => setViewerName(null)}
        onAction={(entry, action) => handleViewerAction(entry, action)}
      />
    </AppShell>
  );
}

function DirectoryView({
  listing,
  parent,
  onCreateFolder,
  view,
  onRefresh,
  entries,
  onOpen,
  onQuickOpen,
  onLongPress,
  onMore,
  selectionMode,
  isSelected,
  onToggleSelect,
}: {
  listing: ListingState;
  parent: PathRef;
  onCreateFolder: () => void;
  view: ViewMode;
  onRefresh: () => void;
  entries: FileEntry[];
  onOpen: (e: FileEntry) => void;
  onQuickOpen: (e: FileEntry) => void;
  onLongPress: (e: FileEntry) => void;
  onMore: (e: FileEntry) => void;
  selectionMode: boolean;
  isSelected: (e: FileEntry) => boolean;
  onToggleSelect: (e: FileEntry) => void;
}) {
  return (
    <div className="animate-in-up -mx-4 pt-1">
      {listing.status === "loading" ? <LoadingState /> : null}
      {listing.status === "empty" ? (
        <EmptyFolder onCreateFolder={onCreateFolder} atRoot={parent.segments.length === 0} />
      ) : null}
      {listing.status === "denied" ? (
        <DeniedState onGrant={() => openStoragePermissionSettings()} />
      ) : null}
      {listing.status === "unavailable" ? <UnavailableState onRetry={onRefresh} /> : null}
      {listing.status === "error" ? (
        <ErrorState message={listing.message} onRetry={onRefresh} />
      ) : null}

      {listing.status === "ready" ? (
        view === "list" ? (
          <FileListView
            entries={entries}
            parent={parent}
            onOpen={onOpen}
            onQuickOpen={onQuickOpen}
            onLongPress={onLongPress}
            onMore={onMore}
            selectionMode={selectionMode}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
          />
        ) : (
          <FileGridView
            entries={entries}
            parent={parent}
            onOpen={onOpen}
            onQuickOpen={onQuickOpen}
            onLongPress={onLongPress}
            onMore={onMore}
            selectionMode={selectionMode}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
          />
        )
      ) : null}
    </div>
  );
}

function RootView({
  roots,
  onOpenRoot,
  pick,
}: {
  roots: ReturnType<typeof listRoots>;
  onOpenRoot: (id: PathRef["rootId"]) => void;
  /** Session de sélection en cours : l'accueil devient un mode sélection. */
  pick?: PickRequest | null;
}) {
  const navigate = useAppNavigate();
  const t = useT();

  /* ── Éditeurs intégrés : sélection via le parcours officiel ─────────
     Les tuiles « Éditeur d'images » et « Éditeur audio » n'ouvrent pas
     un éditeur vide : elles démarrent une session de sélection standard
     (accueil, stockages, catégories, dossiers, récents, recherche, tri)
     filtrée sur les formats réellement supportés. L'accueil reste monté
     pendant toute la session : l'annulation ou le bouton Retour Android
     y ramènent proprement, sans pile de navigation supplémentaire. */
  const [editorPick, setEditorPick] = useState<"image" | "audio" | null>(null);
  const [photoEdit, setPhotoEdit] = useState<{ parent: PathRef; entry: FileEntry } | null>(null);

  const onEditorPicked = useCallback(
    async (details: PickedDetail[]) => {
      const kind = editorPick;
      setEditorPick(null);
      const picked = details[0];
      if (!kind || !picked) return;
      const parent = picked.parent;
      if (!parent) {
        toast.error(t("home.editor.fileNotFound"), {
          description: t("home.editor.fileNotFoundDesc"),
        });
        return;
      }
      // Le fichier a pu être supprimé ou déplacé pendant le parcours.
      const listing = await listDirectory(parent);
      if (listing.ok && !listing.entries.some((e) => e.name === picked.entry.name)) {
        toast.error(t("home.editor.fileGone", { name: picked.entry.name }));
        return;
      }
      if (kind === "audio") {
        await navigate({ to: "/editeur-audio", search: audioEditorSearch(parent, picked.entry) });
        return;
      }
      setPhotoEdit({ parent, entry: picked.entry });
    },
    [editorPick, navigate, t],
  );

  const { stats } = useStorageStats();
  const [snapshots, setSnapshots] = useState<FreeSnapshot[]>([]);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [trashUsage, setTrashUsage] = useState<{ count: number; bytes: number } | null>(null);
  const [downloads, setDownloads] = useState<FileEntry[]>([]);
  const [downloadsCount, setDownloadsCount] = useState<number>(0);
  const [downloadsBytes, setDownloadsBytes] = useState<number>(0);

  useEffect(() => {
    autoPurgeTrash().catch(() => {});
    setSnapshots(loadSnapshots());
    usageTrash()
      .then(setTrashUsage)
      .catch(() => setTrashUsage(null));
  }, []);

  useEffect(() => {
    if (!stats) return;
    setSnapshots(recordSnapshot(stats.free, stats.total));
  }, [stats]);

  /* ─────────────────────────────────────────────────────────────
     Tailles des catégories — valeurs RÉELLES, jamais approximatives.

     • Tous les stockages sont parcourus : stockage interne + chaque
       volume amovible monté (carte SD, clé USB).
     • Le total affiché est la somme exacte des tailles des fichiers
       rencontrés (aucun échantillonnage, aucune estimation).
     • Toute mutation de fichier (création, suppression, déplacement,
       renommage) relance le calcul en tâche de fond, de même que le
       montage/démontage d'un volume et le retour au premier plan.
     ───────────────────────────────────────────────────────────── */
  const [scanTick, setScanTick] = useState(0);
  const [volumeIds, setVolumeIds] = useState<StorageRootId[]>(() =>
    getExternalVolumes().map((v) => v.id),
  );

  useEffect(() => {
    const sync = () => setVolumeIds(getExternalVolumes().map((v) => v.id));
    const unsub = subscribeRoots(sync);
    void refreshStorageVolumes().then(sync);
    return unsub;
  }, []);

  // Recalcul déclenché par les mutations de fichiers (débounce court :
  // une opération par lot ne provoque qu'un seul recalcul).
  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      if (typeof window === "undefined") return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setScanTick((t) => t + 1), 600);
    };
    const unsubPatch = subscribeFsPatch(schedule);
    const onChanged = () => schedule();
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    window.addEventListener("gf:storage-changed", onChanged);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      unsubPatch();
      window.removeEventListener("gf:storage-changed", onChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const scanRootsKey = volumeIds.join(",");

  /* Index persistant : les totaux connus sont affichés immédiatement et
     les mutations de fichiers ajustent l'index sans réanalyse. */
  useEffect(() => {
    const roots: PathRef[] = [
      { rootId: "internal", segments: [] },
      ...volumeIds.map((id) => ({ rootId: id, segments: [] as string[] })),
    ];
    const handle = subscribeStorageStats(`home:${scanRootsKey}`, roots, setScan);
    return () => handle.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanRootsKey]);

  // Téléchargements : somme récursive réelle du dossier Download, servie
  // depuis le même index persistant.
  useEffect(() => {
    const handle = subscribeStorageStats(
      "downloads",
      [{ rootId: "downloads", segments: [] }],
      (result) => {
        setDownloadsCount(result.totalFiles);
        setDownloadsBytes(result.totalBytes);
      },
    );
    return () => handle.cancel();
  }, []);

  useEffect(() => {
    let cancelled = false;
    listDirectory({ rootId: "downloads", segments: [] }).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setDownloads([]);
        return;
      }
      const files = res.entries.filter((e) => !e.isDirectory);
      files.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
      setDownloads(files.slice(0, 3));
    });
    return () => {
      cancelled = true;
    };
  }, [scanTick]);

  /* Applications : la tuile ouvre le gestionnaire d'applications, elle
     doit donc refléter les applications INSTALLÉES (taille APK + code +
     données), et non les seuls fichiers .apk posés sur le stockage —
     d'où les valeurs absurdes de type « 6 Mo » auparavant. */
  const [apps, setApps] = useState<{ count: number; bytes: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void listInstalledApps({ includeIcons: false }).then((res) => {
      if (cancelled || !res.usable) return;
      const bytes = res.apps.reduce(
        (acc, a) => acc + (a.totalBytes || a.codeBytes + a.dataBytes || a.apkSize || 0),
        0,
      );
      setApps({ count: res.apps.length, bytes });
    });
    return () => {
      cancelled = true;
    };
  }, [scanTick]);

  // Le salut dépend de l'heure locale : on rend une valeur stable au
  // premier passage (SSR + hydratation), puis on l'ajuste après montage.
  const [greeting, setGreeting] = useState(() => t("home.greeting.morning"));
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h < 6
        ? t("home.greeting.night")
        : h < 12
          ? t("home.greeting.morning")
          : h < 18
            ? t("home.greeting.afternoon")
            : t("home.greeting.evening"),
    );
  }, [t]);

  /* Tailles des tuiles : mêmes règles de catégorisation que les écrans de
     catégorie (voir `category-rules.ts`) — jamais l'espace de stockage,
     jamais une estimation. */
  const kinds = scan?.kinds;
  const totalFiles = scan?.totalFiles ?? 0;

  type CatDef = {
    key: string;
    label: string;
    icon: GfIconComponent;
    tint: string; // tailwind classes for icon bg/fg
    count?: number;
    bytes?: number;
    onOpen: () => void;
    hidden?: boolean;
  };

  const categories: CatDef[] = [
    {
      key: "documents",
      label: t("home.category.documents"),
      icon: GfDocument,
      tint: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
      count: kinds?.documents.count,
      bytes: kinds?.documents.bytes,
      onOpen: () => navigate({ to: "/categorie/$kind", params: { kind: "documents" } }),
    },
    {
      key: "images",
      label: t("home.category.images"),
      icon: GfImage,
      tint: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
      count: kinds?.images.count,
      bytes: kinds?.images.bytes,
      onOpen: () => navigate({ to: "/categorie/$kind", params: { kind: "images" } }),
    },
    {
      key: "videos",
      label: t("home.category.videos"),
      icon: GfVideo,
      tint: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
      count: kinds?.videos.count,
      bytes: kinds?.videos.bytes,
      onOpen: () => navigate({ to: "/categorie/$kind", params: { kind: "videos" } }),
    },
    {
      key: "audio",
      label: t("home.category.audio"),
      icon: GfAudio,
      tint: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
      count: kinds?.audio.count,
      bytes: kinds?.audio.bytes,
      onOpen: () => navigate({ to: "/categorie/$kind", params: { kind: "audio" } }),
    },
    {
      key: "downloads",
      label: t("home.category.downloads"),
      icon: GfDownload,
      tint: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
      count: downloadsCount || undefined,
      bytes: downloadsBytes || undefined,
      onOpen: () => navigate({ to: "/categorie/$kind", params: { kind: "downloads" } }),
    },
    {
      key: "apk",
      label: t("home.category.apps"),
      icon: GfApps,
      tint: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
      count: apps?.count,
      bytes: apps?.bytes,
      onOpen: () => navigate({ to: "/applications" }),
      /* Pendant une sélection, la tuile n'a de sens que si des APK sont
         acceptés (transfert, partage, sauvegarde…). */
      hidden: pick ? !pickAllowsApk(pick) : false,
    },
  ];

  /* Outils de l'accueil : classés par fréquence d'usage réelle. Les deux
     premières lignes couvrent 90 % des besoins. */
  const tools = [
    {
      title: t("home.tool.cleaner"),
      icon: GfCleaner,
      tint: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
      onOpen: () => navigate({ to: "/nettoyeur" }),
    },
    {
      title: t("home.tool.pdfTools"),
      icon: GfPdfTools,
      tint: "bg-primary/12 text-primary",
      onOpen: () => navigate({ to: "/pdf-outils" }),
    },
    {
      title: t("home.tool.vault"),
      icon: GfVault,
      tint: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
      onOpen: () => navigate({ to: "/coffre-fort" }),
    },
    {
      title: t("home.tool.imageEditor"),
      icon: GfPhotoEditor,
      tint: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
      onOpen: () => setEditorPick("image"),
    },
    {
      title: t("home.tool.audioEditor"),
      icon: GfAudioEditor,
      tint: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
      onOpen: () => setEditorPick("audio"),
    },
    {
      title: t("home.tool.trash"),
      icon: GfTrash,
      tint: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
      onOpen: () => navigate({ to: "/corbeille" }),
    },
  ];

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Salutation = titre principal de la page, en en-tête collant. */}
      <PageHeader
        title={pick ? pick.title : greeting}
        subtitle={
          pick
            ? pick.purpose === "destination"
              ? pick.mode === "move"
                ? t("files.pickDest.subtitleMove")
                : t("files.pickDest.subtitleCopy")
              : t("home.subtitle.pick")
            : t("home.subtitle.default")
        }
        action={
          <button
            type="button"
            onClick={() => {
              // Accueil : recherche globale (tous les stockages).
              setSearchScope(null);
              navigate({ to: "/recherche" });
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-primary transition-transform duration-100 ease-out active:scale-95 hover:border-primary/40"
            aria-label={t("action.search")}
          >
            <Search className="h-[19px] w-[19px]" strokeWidth={2.2} />
          </button>
        }
      />

      {pick ? (
        pick.purpose === "destination" ? null : (
          <PickHowTo multi={pick.multi} />
        )
      ) : (
        <ResumeBanner />
      )}

      {/* Stockages — accès direct au gestionnaire de fichiers */}
      <StorageCards onOpenRoot={onOpenRoot} internalFilesFallback={totalFiles || undefined} />

      {/* Categories grid — compact */}
      <section aria-label={t("cleaner.categories.title")}>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {t("cleaner.categories.title")}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {categories
            .filter((c) => !c.hidden)
            .map((c) => (
              <CategoryTile
                key={c.key}
                label={c.label}
                icon={c.icon}
                tint={c.tint}
                count={c.count}
                bytes={c.bytes}
                loading={!scan}
                onOpen={c.onOpen}
              />
            ))}
        </div>
      </section>

      {/* Fichiers récents */}
      <RecentFilesSection />

      {/* Tools grid — compact (masqués pendant une sélection) */}
      {pick ? null : (
        <section aria-label={t("home.section.tools")}>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {t("home.section.tools")}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {tools.map((t) => (
              <button
                key={t.title}
                type="button"
                onClick={t.onOpen}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-1.5 py-3.5 text-center transition-transform duration-100 ease-out active:scale-[0.96] hover:border-primary/30"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl ${t.tint}`}
                >
                  <t.icon className="h-[23px] w-[23px]" strokeWidth={1.5} />
                </span>
                <p className="w-full truncate text-[11.5px] font-semibold leading-tight">
                  {t.title}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Sélection officielle GeniusFiles, filtrée par éditeur. */}
      <FileSourcePicker
        open={editorPick !== null}
        title={
          editorPick === "audio"
            ? t("home.editorPicker.audioTitle")
            : t("home.editorPicker.imageTitle")
        }
        extensions={editorPick === "audio" ? [...AUDIO_EDITOR_EXTS] : [...IMAGE_EDITOR_EXTS]}
        multi={false}
        accept="files"
        onCancel={() => setEditorPick(null)}
        onConfirm={(_paths, _entries, details) => void onEditorPicked(details)}
      />

      {photoEdit ? (
        <PhotoEditor
          parent={photoEdit.parent}
          entry={photoEdit.entry}
          src={sourceUrlOf(photoEdit.parent, photoEdit.entry)}
          onClose={() => setPhotoEdit(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Aide contextuelle affichée à la place des outils pendant une session
 * de sélection : trois gestes suffisent, rien d'autre n'est proposé.
 */
function PickHowTo({ multi }: { multi: boolean }) {
  const t = useT();
  return (
    <section
      aria-label={t("home.pickHowTo.aria")}
      className="rounded-2xl border border-border bg-surface p-3.5"
    >
      <h2 className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {t("home.pickHowTo.title")}
      </h2>
      <ul className="space-y-1 text-[13px] leading-snug text-foreground/85">
        <li>• {t("home.pickHowTo.step1")}</li>
        <li>• {multi ? t("home.pickHowTo.step2Multi") : t("home.pickHowTo.step2Single")}</li>
        <li>• {t("home.pickHowTo.step3")}</li>
        <li>• {t("home.pickHowTo.step4")}</li>
      </ul>
    </section>
  );
}

function CategoryTile({
  label,
  icon: Icon,
  tint,
  count,
  bytes,
  loading,
  onOpen,
}: {
  label: string;
  icon: GfIconComponent;
  tint: string;
  count?: number;
  bytes?: number;
  loading: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  const sub =
    count == null && loading
      ? "…"
      : count == null
        ? "—"
        : bytes && bytes > 0
          ? formatSize(bytes)
          : t("count.files", { count });
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface px-1.5 py-3 text-center transition-transform duration-100 ease-out active:scale-[0.96] hover:border-primary/30"
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tint}`}>
        <Icon className="h-[21px] w-[21px]" />
      </span>
      <p className="w-full truncate text-[12px] font-semibold leading-tight">{label}</p>
      <p className="w-full truncate text-[10.5px] leading-none text-muted-foreground tabular-nums">
        {sub}
      </p>
    </button>
  );
}
