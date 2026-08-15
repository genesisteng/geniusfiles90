/* eslint-disable react-refresh/only-export-components */
/**
 * Universal Viewer — a single fullscreen overlay that plays *every* file
 * type the WebView can render (images, video, audio, PDF, text) and shows
 * a rich fallback card for the rest, with a clear "Ouvrir avec…" bridge.
 *
 * Design principles
 * -----------------
 * - **One chrome, all viewers.** Same top bar, same auto-hide behavior,
 *   same gestures, same "more actions" menu.
 * - **Native feel.** Auto-hiding controls, tap-to-toggle, swipe between
 *   siblings, pinch/zoom, hardware-backed video, MediaSession for audio.
 * - **Zero coupling to the file manager.** The viewer is a controlled
 *   overlay — the parent route keeps its scroll position and selection
 *   untouched.
 * - **Android back button** dismisses the viewer instead of leaving the
 *   route (a history entry is pushed on open, popped on close).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FolderOpen,
  Gauge,
  Info,
  ListMusic,
  MoreHorizontal,
  Pause,
  PictureInPicture2,
  Play,
  Printer,
  Repeat,
  RotateCw,
  Search,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  SquarePen,
  Subtitles,
  Timer,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { BACK_PRIORITY, registerBackHandler } from "@/lib/navigation/back-stack";
import { formatDate, formatSize } from "@/lib/files/format";
import { viewerKindOf, type ViewerKind } from "@/lib/viewer/kinds";
import { entryKey, sourceUrlOf } from "@/lib/viewer/source";
import { getResume, setResume } from "@/lib/viewer/resume";
import { touchRecentEntry } from "@/lib/recents/store";
import { loadTextFile, TEXT_SOFT_LIMIT, type TextLoadResult } from "@/lib/viewer/text";
import { BottomSheet } from "@/components/files/BottomSheet";
import { audioStore } from "@/lib/player/audio-store";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { ImageViewer } from "@/components/player/ImageViewer";
import { PdfStage } from "@/components/viewer/PdfStage";
import { DocumentStage } from "@/components/viewer/DocumentStage";
import { WordEditor } from "@/components/viewer/WordEditor";
import { isEditableWord } from "@/lib/office/docx-edit";
import { ReaderHeader } from "@/components/viewer/ReaderHeader";
import { ReaderActionBar } from "@/components/viewer/ReaderActionBar";
import { setReaderMode } from "@/lib/viewer/reader-mode";
import type { ReaderTool } from "@/lib/viewer/reader-tools";
import { QuickScrollFab } from "@/components/common/QuickScrollFab";
import { PhotoEditor } from "@/components/photo/PhotoEditor";
import { useT } from "@/lib/i18n/react";
import type { TFunction } from "@/lib/i18n/types";

export type ViewerAction =
  | "share"
  | "rename"
  | "move"
  | "copy"
  | "delete"
  | "compress"
  | "info"
  | "openFolder"
  | "openWith";

const AUTO_HIDE_MS = 3000;

export function UniversalViewer({
  open,
  parent,
  entries,
  index,
  onIndexChange,
  onClose,
  onAction,
  parentOf,
}: {
  open: boolean;
  parent: PathRef | null;
  entries: FileEntry[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onAction: (entry: FileEntry, action: ViewerAction) => void;
  /**
   * Dossier réel d'une entrée, requis pour les listes agrégées
   * (catégories, récents, recherche) dont les fichiers proviennent de
   * dossiers différents. Sans lui la file audio résoudrait toutes les
   * pistes dans le dossier de la piste sélectionnée.
   */
  parentOf?: (entry: FileEntry) => PathRef | null;
}) {
  const t = useT();
  const entry = entries[index] ?? null;
  const kind: ViewerKind = entry ? viewerKindOf(entry) : "none";
  const [menuOpen, setMenuOpen] = useState(false);
  /* Éditeur photo intégré : aucune application externe n'est lancée. */
  const [editing, setEditing] = useState(false);
  /* Édition Word intégrée : le document reste dans GeniusFiles. */
  const [wordEdit, setWordEdit] = useState(false);
  /* Outils remontés par la scène active (zoom, rotation, recherche…) et
     affichés dans le menu du lecteur : aucune barre flottante en bas. */
  const [tools, setTools] = useState<ReaderTool[]>([]);

  /* ─────────────────────────────────────────────────────────────
     Fratrie du même type — calculée UNE SEULE FOIS par liste/type.

     Sur une catégorie globale (100 000+ fichiers), refaire `filter` et
     `indexOf` à chaque rendu bloquait le thread principal : chaque appui
     sur lecture/pause, chaque seconde de lecture et chaque ouverture de
     playlist relançaient des parcours O(n). Le tableau et les tables de
     correspondance rel↔abs sont désormais mémoïsés.
     ───────────────────────────────────────────────────────────── */
  const { siblings, relOf, absOf } = useMemo(() => {
    const list: FileEntry[] = [];
    const rel = new Map<FileEntry, number>();
    const abs: number[] = [];
    if (kind !== "none") {
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (viewerKindOf(e) !== kind) continue;
        rel.set(e, list.length);
        abs.push(i);
        list.push(e);
      }
    }
    return { siblings: list, relOf: rel, absOf: abs };
  }, [entries, kind]);

  const relIndexOf = useCallback((e: FileEntry | null) => (e ? (relOf.get(e) ?? -1) : -1), [relOf]);
  const toAbsIndex = useCallback((rel: number) => absOf[rel] ?? 0, [absOf]);

  /* `parentOf` est souvent une lambda recréée à chaque rendu : on la lit via
     une ref pour ne jamais recartographier 100 000 entrées inutilement. */
  const parentOfRef = useRef(parentOf);
  useEffect(() => {
    parentOfRef.current = parentOf;
  });
  const siblingParents = useMemo(
    () =>
      kind === "audio" && parentOfRef.current
        ? siblings.map((e) => parentOfRef.current?.(e) ?? null)
        : undefined,
    [siblings, kind],
  );

  // Les lecteurs de documents (PDF, Office, texte, ebook, fallback) gardent
  // une chrome permanente et opaque ; les médias immersifs (image / vidéo)
  // ont leurs propres lecteurs dédiés avec auto-masquage.
  const bumpChrome = useCallback(() => {}, []);

  // ---- Mode lecture : la barre de navigation principale s'efface ----
  const readerActive = open && !!entry && kind !== "image" && kind !== "video" && kind !== "audio";
  useEffect(() => {
    setReaderMode(readerActive);
    return () => setReaderMode(false);
  }, [readerActive]);

  useEffect(() => {
    setMenuOpen(false);
    setTools([]);
    setWordEdit(false);
  }, [index]);

  // ---- Journal « Fichiers récents » : toute ouverture est enregistrée ----
  useEffect(() => {
    if (!open || !parent || !entry || entry.isDirectory) return;
    touchRecentEntry(parent, entry, "open");
  }, [open, parent, entry]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndexChange(Math.min(entries.length - 1, index + 1));
      else if (e.key === "ArrowLeft") onIndexChange(Math.max(0, index - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, entries.length, index, onClose, onIndexChange]);

  // ---- Retour Android ----
  // Le rappel est conservé dans une ref pour que l'effet ne s'exécute
  // qu'une fois par cycle d'ouverture (un `onClose` recréé à chaque rendu
  // relançait auparavant le nettoyage à chaque changement d'index).
  // Le retour passe par le registre unifié : plus aucune entrée
  // d'historique n'est empilée, donc la pile de navigation reste exacte.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    // Priorité « overlay » et enregistrement LIFO : une feuille ouverte
    // par-dessus la visionneuse se ferme d'abord, puis la visionneuse.
    return registerBackHandler(() => {
      closeRef.current();
      return true;
    }, BACK_PRIORITY.overlay);
  }, [open]);

  // ---- Preload adjacent images ----
  useEffect(() => {
    if (!open || !parent) return;
    if (kind !== "image") return;
    [1, -1].forEach((delta) => {
      const target = entries[index + delta];
      if (!target || viewerKindOf(target) !== "image") return;
      const url = sourceUrlOf(parent, target);
      if (!url) return;
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    });
  }, [open, parent, entries, index, kind]);

  /* ---- Passage de relais audio (hors rendu) ----------------------------
     La file est confiée au lecteur global dans un effet : la lecture démarre
     immédiatement, sans recalcul de liste ni travail lourd pendant le rendu. */
  const audioHandoff = open && !!parent && !!entry && kind === "audio";
  const audioRel = kind === "audio" ? relIndexOf(entry) : -1;
  useEffect(() => {
    if (!audioHandoff || !parent) return;
    try {
      audioStore.playQueue(parent, siblings, Math.max(0, audioRel), siblingParents ?? undefined);
      audioStore.openUI();
    } catch {
      /* ignore */
    }
    closeRef.current();
  }, [audioHandoff, parent, siblings, siblingParents, audioRel]);

  if (!open || !entry || !parent) return null;
  if (kind === "audio") return null;

  // Dedicated full-screen premium players for audio and video kinds.
  // Images use the premium universal image player, whatever the entry point.
  if (kind === "image") {
    const rel = Math.max(0, relIndexOf(entry));

    const fireI = (a: ViewerAction) => {
      setMenuOpen(false);
      onAction(entry, a);
    };
    return (
      <>
        <ImageViewer
          parent={parent}
          entries={siblings}
          index={rel}
          onIndexChange={(i: number) => onIndexChange(toAbsIndex(i))}
          onClose={onClose}
          onMenu={() => setMenuOpen(true)}
          onShare={() => fireI("share")}
          onDelete={() => fireI("delete")}
          onEdit={() => setEditing(true)}
        />
        {editing ? (
          <PhotoEditor
            parent={parent}
            entry={entry}
            src={sourceUrlOf(parent, entry)}
            onClose={() => setEditing(false)}
          />
        ) : null}
        <BottomSheet
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          title={t("viewer.actions.title")}
        >
          <div className="flex flex-col">
            <MenuRow icon={Info} label={t("viewer.actions.info")} onClick={() => fireI("info")} />
            <MenuRow
              icon={ExternalLink}
              label={t("viewer.actions.openWith")}
              onClick={() => fireI("openWith")}
            />
            <MenuRow
              icon={FolderOpen}
              label={t("viewer.actions.openFolder")}
              onClick={() => fireI("openFolder")}
            />
            <MenuRow
              icon={SquarePen}
              label={t("viewer.actions.rename")}
              onClick={() => fireI("rename")}
            />
            <MenuRow icon={Copy} label={t("viewer.actions.copyTo")} onClick={() => fireI("copy")} />
            <MenuRow
              icon={FolderOpen}
              label={t("viewer.actions.moveTo")}
              onClick={() => fireI("move")}
            />
            <MenuRow
              icon={FileArchive}
              label={t("viewer.actions.compress")}
              onClick={() => fireI("compress")}
            />
            <MenuRow
              icon={Share2}
              label={t("viewer.actions.share")}
              onClick={() => fireI("share")}
            />
            <div className="my-1 h-px bg-border/40" />
            <MenuRow
              icon={Trash2}
              label={t("viewer.actions.delete")}
              onClick={() => fireI("delete")}
              danger
            />
          </div>
        </BottomSheet>
      </>
    );
  }

  if (kind === "video") {
    const rel = relIndexOf(entry);
    const setRel = (i: number) => onIndexChange(toAbsIndex(i));
    const fireP = (a: ViewerAction) => {
      setMenuOpen(false);
      onAction(entry, a);
    };
    const Player = VideoPlayer;

    return (
      <>
        <Player
          parent={parent}
          entries={siblings}
          index={Math.max(0, rel)}
          onIndexChange={setRel}
          onClose={onClose}
          onMenu={() => setMenuOpen(true)}
          parentFor={parentOf}
        />

        <BottomSheet
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          title={t("viewer.actions.title")}
        >
          <div className="flex flex-col">
            <MenuRow icon={Info} label={t("viewer.actions.info")} onClick={() => fireP("info")} />
            <MenuRow
              icon={ExternalLink}
              label={t("viewer.actions.openWith")}
              onClick={() => fireP("openWith")}
            />
            <MenuRow
              icon={FolderOpen}
              label={t("viewer.actions.openFolder")}
              onClick={() => fireP("openFolder")}
            />
            <MenuRow
              icon={SquarePen}
              label={t("viewer.actions.rename")}
              onClick={() => fireP("rename")}
            />
            <MenuRow icon={Copy} label={t("viewer.actions.copyTo")} onClick={() => fireP("copy")} />
            <MenuRow
              icon={FolderOpen}
              label={t("viewer.actions.moveTo")}
              onClick={() => fireP("move")}
            />
            <MenuRow
              icon={Share2}
              label={t("viewer.actions.share")}
              onClick={() => fireP("share")}
            />
            <div className="my-1 h-px bg-border/40" />
            <MenuRow
              icon={Trash2}
              label={t("viewer.actions.delete")}
              onClick={() => fireP("delete")}
              danger
            />
          </div>
        </BottomSheet>
      </>
    );
  }

  const src = sourceUrlOf(parent, entry);
  const key = entryKey(parent, entry);
  const relIndex = relIndexOf(entry);
  const previewCount = siblings.length;

  const fire = (a: ViewerAction) => {
    setMenuOpen(false);
    onAction(entry, a);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-reader-surface animate-fade-in"
      role="dialog"
      aria-modal
    >
      {/* En-tête Android opaque — hors du flux scrollable, jamais transparent */}
      <ReaderHeader
        title={entry.name}
        subtitle={`${
          previewCount > 1 && relIndex >= 0
            ? `${relIndex + 1} / ${previewCount} · ${labelOf(kind, t)}`
            : labelOf(kind, t)
        }${entry.size ? ` · ${formatSize(entry.size)}` : ""}`}
        onBack={onClose}
        onShare={() => fire("share")}
        onMenu={() => setMenuOpen(true)}
      />

      {/* Actions propres au lecteur, juste sous la barre supérieure. */}
      <ReaderActionBar tools={tools} />

      {/* Scène — seule zone défilable de l'écran */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-reader-surface">
        {kind === "pdf" ? (
          <PdfStage src={src} resumeKey={key} onTools={setTools} />
        ) : kind === "office" || kind === "ebook" ? (
          <DocumentStage
            parent={parent}
            entry={entry}
            onTools={setTools}
            onEdit={isEditableWord(entry.name) ? () => setWordEdit(true) : undefined}
          />
        ) : kind === "text" ? (
          <TextStage src={src} entry={entry} parent={parent} />
        ) : (
          <FallbackStage
            entry={entry}
            kind={kind}
            onOpenWith={() => fire("openWith")}
            onShare={() => fire("share")}
            onInfo={() => fire("info")}
          />
        )}
      </div>

      {/* Actions — compact centered modal, shared with the file manager */}
      <BottomSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={t("viewer.actions.title")}
      >
        <div className="flex flex-col">
          <MenuRow icon={Info} label={t("viewer.actions.info")} onClick={() => fire("info")} />
          <MenuRow
            icon={ExternalLink}
            label={t("viewer.actions.openWith")}
            onClick={() => fire("openWith")}
          />
          <MenuRow
            icon={FolderOpen}
            label={t("viewer.actions.openFolder")}
            onClick={() => fire("openFolder")}
          />
          <MenuRow
            icon={SquarePen}
            label={t("viewer.actions.rename")}
            onClick={() => fire("rename")}
          />
          <MenuRow icon={Copy} label={t("viewer.actions.copyTo")} onClick={() => fire("copy")} />
          <MenuRow
            icon={FolderOpen}
            label={t("viewer.actions.moveTo")}
            onClick={() => fire("move")}
          />
          <MenuRow
            icon={FileArchive}
            label={t("viewer.actions.compress")}
            onClick={() => fire("compress")}
          />
          <MenuRow icon={Share2} label={t("viewer.actions.share")} onClick={() => fire("share")} />
          <div className="my-1 h-px bg-border/40" />
          <MenuRow
            icon={Trash2}
            label={t("viewer.actions.delete")}
            onClick={() => fire("delete")}
            danger
          />
        </div>
      </BottomSheet>

      {/* Éditeur Word intégré : superposé au lecteur, il garde son propre
          retour protégé (« Modifications non enregistrées »). */}
      {wordEdit ? (
        <WordEditor parent={parent} entry={entry} onClose={() => setWordEdit(false)} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                           Shared chrome                             */
/* ------------------------------------------------------------------ */

function IconButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-media-foreground/10 backdrop-blur-sm transition-transform active:scale-95"
    >
      {children}
    </button>
  );
}

function MenuRow({
  icon: Icon,
  label,
  onClick,
  danger,
  value,
  disabled,
}: {
  icon: typeof Info;
  label: string;
  onClick: () => void;
  danger?: boolean;
  value?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-left text-[13.5px] transition-colors active:bg-secondary/60 hover:bg-secondary/60 disabled:opacity-40 ${
        danger ? "text-red-400" : "text-foreground"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          danger ? "bg-red-500/12 text-red-400" : "bg-secondary/60 text-muted-foreground"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value ? (
        <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{value}</span>
      ) : null}
    </button>
  );
}

function labelOf(kind: ViewerKind, t: TFunction): string {
  switch (kind) {
    case "image":
    case "video":
    case "audio":
    case "pdf":
    case "text":
    case "office":
    case "ebook":
      return t(`viewer.kind.${kind}`);
    default:
      return t("viewer.kind.file");
  }
}

/* ------------------------------------------------------------------ */
/*                             Video stage                             */
/* ------------------------------------------------------------------ */

function VideoStage({ src, resumeKey }: { src: string; resumeKey: string }) {
  const t = useT();
  const ref = useRef<HTMLVideoElement | null>(null);
  const [rate, setRate] = useState(1);
  const [pip, setPip] = useState(false);
  const [overlay, setOverlay] = useState<
    { kind: "volume" | "brightness"; value: number } | { kind: "seek"; delta: number } | null
  >(null);
  const gesture = useRef<
    | { kind: "seek"; startTime: number; startX: number }
    | { kind: "volume" | "brightness"; startY: number; startValue: number }
    | null
  >(null);
  const [brightness, setBrightness] = useState(1);
  const [tracks, setTracks] = useState<{ id: string; label: string; kind: string }[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);
  const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];

  // ---- Resume + progress persistence ----
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const resume = getResume(resumeKey);
    if (resume && resume.pos > 3 && (!resume.extra || resume.pos < resume.extra - 5)) {
      const apply = () => {
        v.currentTime = resume.pos;
      };
      if (v.readyState >= 1) apply();
      else v.addEventListener("loadedmetadata", apply, { once: true });
    }
    const save = () => setResume(resumeKey, v.currentTime, v.duration || undefined);
    const iv = window.setInterval(() => v.currentTime > 0 && save(), 4000);
    v.addEventListener("pause", save);
    v.addEventListener("ended", () => setResume(resumeKey, 0, v.duration || undefined));
    const collectTracks = () => {
      const list: { id: string; label: string; kind: string }[] = [];
      for (const tr of Array.from(v.textTracks)) {
        list.push({
          id: tr.language || tr.label || "sub",
          label: tr.label || tr.language || t("viewer.media.track"),
          kind: tr.kind,
        });
      }
      setTracks(list);
    };
    v.addEventListener("loadedmetadata", collectTracks);
    return () => {
      window.clearInterval(iv);
      save();
      v.removeEventListener("pause", save);
      v.removeEventListener("loadedmetadata", collectTracks);
    };
  }, [resumeKey, src, t]);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate]);

  // ---- Picture in Picture ----
  const togglePip = useCallback(async () => {
    const v = ref.current;
    if (!v) return;
    const doc = document as Document & { pictureInPictureElement?: Element | null };
    try {
      if (doc.pictureInPictureElement) {
        await (
          document as Document & { exitPictureInPicture?: () => Promise<void> }
        ).exitPictureInPicture?.();
        setPip(false);
      } else if ("requestPictureInPicture" in v) {
        await (
          v as HTMLVideoElement & { requestPictureInPicture: () => Promise<PictureInPictureWindow> }
        ).requestPictureInPicture();
        setPip(true);
      }
    } catch {
      /* not supported / user cancelled */
    }
  }, []);

  // ---- Gesture layer ----
  const startGesture = (e: React.PointerEvent) => {
    const v = ref.current;
    if (!v) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const localX = e.clientX - rect.left;
    // Horizontal drag = seek; vertical drag: left half = brightness, right half = volume.
    gesture.current = null;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    (e.currentTarget as HTMLElement).dataset.gestureStart = JSON.stringify({
      x: e.clientX,
      y: e.clientY,
      localX,
      width: rect.width,
    });
  };
  const moveGesture = (e: React.PointerEvent) => {
    const v = ref.current;
    if (!v) return;
    const raw = (e.currentTarget as HTMLElement).dataset.gestureStart;
    if (!raw) return;
    const start = JSON.parse(raw) as { x: number; y: number; localX: number; width: number };
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (!gesture.current) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        gesture.current = { kind: "seek", startTime: v.currentTime, startX: e.clientX };
      } else if (start.localX < start.width / 2) {
        gesture.current = { kind: "brightness", startY: e.clientY, startValue: brightness };
      } else {
        gesture.current = { kind: "volume", startY: e.clientY, startValue: v.volume };
      }
    }
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "seek") {
      const delta = (e.clientX - g.startX) * 0.25; // 4px per sec
      const target = Math.max(0, Math.min(v.duration || 0, g.startTime + delta));
      v.currentTime = target;
      setOverlay({ kind: "seek", delta });
    } else {
      const delta = (g.startY - e.clientY) / 200; // full swipe ~ 1.0
      const next = Math.max(0, Math.min(1, g.startValue + delta));
      if (g.kind === "volume") v.volume = next;
      else setBrightness(next);
      setOverlay({ kind: g.kind, value: next });
    }
  };
  const endGesture = (e: React.PointerEvent) => {
    delete (e.currentTarget as HTMLElement).dataset.gestureStart;
    gesture.current = null;
    setTimeout(() => setOverlay(null), 400);
  };

  const setSubtitle = (id: string | null) => {
    const v = ref.current;
    if (!v) return;
    for (const tr of Array.from(v.textTracks)) {
      tr.mode = id && (tr.language === id || tr.label === id) ? "showing" : "disabled";
    }
    setActiveSubtitle(id);
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {src ? (
        <>
          <video
            ref={ref}
            src={src}
            controls
            autoPlay
            playsInline
            style={{ filter: `brightness(${brightness})` }}
            className="max-h-full max-w-full"
          />
          {/* Gesture overlay — sits on top but stays transparent */}
          <div
            className="absolute inset-0 z-[5]"
            style={{ touchAction: "none" }}
            onPointerDown={startGesture}
            onPointerMove={moveGesture}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
          />
        </>
      ) : (
        <p className="text-sm text-media-muted">{t("viewer.media.videoUnavailable")}</p>
      )}

      {/* Gesture value overlay */}
      {overlay ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-scrim/70 px-3 py-1.5 text-[12px] backdrop-blur">
          {overlay.kind === "seek"
            ? `${overlay.delta >= 0 ? "+" : ""}${overlay.delta.toFixed(1)}s`
            : `${overlay.kind === "volume" ? t("viewer.media.volume") : t("viewer.media.brightness")} · ${Math.round(overlay.value * 100)}%`}
        </div>
      ) : null}

      {/* Speed / PiP / subtitles chip */}
      <div
        className="pointer-events-auto absolute right-3 top-14 z-10 flex items-center gap-1 rounded-full bg-scrim/60 px-1.5 py-1 text-[11px] backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="flex items-center gap-1 rounded-full px-1.5 py-0.5">
          <Gauge className="h-3.5 w-3.5 text-media-muted" />
          <select
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="bg-transparent text-[11px] text-media-foreground outline-none"
            aria-label={t("viewer.media.playbackSpeed")}
          >
            {rates.map((r) => (
              <option key={r} value={r} className="bg-media">
                {r}×
              </option>
            ))}
          </select>
        </label>
        {tracks.length ? (
          <label className="flex items-center gap-1 rounded-full px-1.5 py-0.5">
            <Subtitles className="h-3.5 w-3.5 text-media-muted" />
            <select
              value={activeSubtitle ?? ""}
              onChange={(e) => setSubtitle(e.target.value || null)}
              className="bg-transparent text-[11px] text-media-foreground outline-none"
              aria-label={t("viewer.media.subtitles")}
            >
              <option value="" className="bg-media">
                {t("viewer.media.off")}
              </option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id} className="bg-media">
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <ChipButton onClick={togglePip} active={pip} label={t("viewer.media.pip")}>
          <PictureInPicture2 className="h-3.5 w-3.5" />
        </ChipButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                             Audio stage                             */
/* ------------------------------------------------------------------ */

function AudioStage({
  src,
  resumeKey,
  entry,
  queue,
  onQueueSelect,
}: {
  src: string;
  resumeKey: string;
  entry: FileEntry;
  queue: FileEntry[];
  onQueueSelect: (target: FileEntry) => void;
}) {
  const t = useT();
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const sleepRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rates = [0.75, 1, 1.25, 1.5, 2];

  const activeIndex = queue.findIndex((e) => e.name === entry.name);

  const goRelative = useCallback(
    (delta: 1 | -1) => {
      if (queue.length <= 1) return;
      let next = activeIndex + delta;
      if (shuffle) next = Math.floor(Math.random() * queue.length);
      if (next < 0) next = loop ? queue.length - 1 : 0;
      if (next >= queue.length) next = loop ? 0 : queue.length - 1;
      const target = queue[next];
      if (target && target !== entry) onQueueSelect(target);
    },
    [queue, activeIndex, shuffle, loop, entry, onQueueSelect],
  );

  // ---- Playback wiring ----
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const resume = getResume(resumeKey);
    if (resume && resume.pos > 3) {
      const apply = () => {
        a.currentTime = resume.pos;
      };
      if (a.readyState >= 1) apply();
      else a.addEventListener("loadedmetadata", apply, { once: true });
    }
    const onTime = () => setPos(a.currentTime);
    const onMeta = () => setDur(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      setResume(resumeKey, a.currentTime, a.duration || undefined);
    };
    const onEnded = () => {
      setResume(resumeKey, 0, a.duration || undefined);
      goRelative(1);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      setResume(resumeKey, a.currentTime, a.duration || undefined);
    };
  }, [resumeKey, src, goRelative]);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate]);

  // ---- MediaSession for background & lock screen ----
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = (navigator as Navigator & { mediaSession: MediaSession }).mediaSession;
    ms.metadata = new MediaMetadata({
      title: entry.name,
      artist: "GeniusFiles",
      album: entry.ext?.toUpperCase() ?? "Audio",
    });
    ms.setActionHandler("play", () => ref.current?.play().catch(() => {}));
    ms.setActionHandler("pause", () => ref.current?.pause());
    ms.setActionHandler("previoustrack", () => goRelative(-1));
    ms.setActionHandler("nexttrack", () => goRelative(1));
    ms.setActionHandler("seekbackward", () => {
      const a = ref.current;
      if (a) a.currentTime = Math.max(0, a.currentTime - 15);
    });
    ms.setActionHandler("seekforward", () => {
      const a = ref.current;
      if (a) a.currentTime = Math.min(a.duration || 0, a.currentTime + 30);
    });
  }, [entry.name, entry.ext, goRelative]);

  // ---- Sleep timer ----
  useEffect(() => {
    if (sleepRef.current) clearTimeout(sleepRef.current);
    if (!sleepMinutes) return;
    sleepRef.current = setTimeout(() => {
      ref.current?.pause();
      setSleepMinutes(null);
    }, sleepMinutes * 60_000);
    return () => {
      if (sleepRef.current) clearTimeout(sleepRef.current);
    };
  }, [sleepMinutes]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };
  const seek = (t: number) => {
    const a = ref.current;
    if (a) a.currentTime = t;
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-6">
      <audio ref={ref} src={src} preload="metadata" />
      <div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/40 to-primary/10 shadow-lg">
        <Volume2 className="h-16 w-16 text-media-foreground/80" />
      </div>
      <div className="w-full max-w-md text-center">
        <p className="truncate text-[15px] font-semibold">{entry.name}</p>
        <p className="text-[11px] text-media-muted">
          {formatSize(entry.size)}
          {entry.ext ? ` · ${entry.ext.toUpperCase()}` : ""}
          {queue.length > 1 ? ` · ${activeIndex + 1}/${queue.length}` : ""}
        </p>
      </div>
      <div className="w-full max-w-md">
        <input
          type="range"
          min={0}
          max={Math.max(1, dur)}
          step={0.1}
          value={pos}
          onChange={(e) => seek(parseFloat(e.target.value))}
          className="w-full accent-primary"
          aria-label={t("viewer.media.progress")}
        />
        <div className="flex justify-between text-[10px] text-media-muted">
          <span>{fmtTime(pos)}</span>
          <span>{fmtTime(dur)}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <IconButton onClick={() => goRelative(-1)} label={t("viewer.media.prevTrack")}>
          <SkipBack className="h-5 w-5" />
        </IconButton>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t("viewer.media.pause") : t("viewer.media.play")}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
        >
          {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </button>
        <IconButton onClick={() => goRelative(1)} label={t("viewer.media.nextTrack")}>
          <SkipForward className="h-5 w-5" />
        </IconButton>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
        <ChipButton
          onClick={() => setLoop((v) => !v)}
          active={loop}
          label={t("viewer.media.repeat")}
        >
          <Repeat className="h-3.5 w-3.5" /> {t("viewer.media.loop")}
        </ChipButton>
        <ChipButton
          onClick={() => setShuffle((v) => !v)}
          active={shuffle}
          label={t("viewer.media.shuffle")}
        >
          <Shuffle className="h-3.5 w-3.5" /> {t("viewer.media.shuffle")}
        </ChipButton>
        <label className="flex items-center gap-1 rounded-full bg-media-foreground/10 px-2 py-1 text-media-foreground/80">
          <Gauge className="h-3.5 w-3.5" />
          <select
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="bg-transparent outline-none"
            aria-label={t("viewer.media.speed")}
          >
            {rates.map((r) => (
              <option key={r} value={r} className="bg-media">
                {r}×
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 rounded-full bg-media-foreground/10 px-2 py-1 text-media-foreground/80">
          <Timer className="h-3.5 w-3.5" />
          <select
            value={sleepMinutes ?? ""}
            onChange={(e) => setSleepMinutes(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="bg-transparent outline-none"
            aria-label={t("viewer.media.sleepTimer")}
          >
            <option value="" className="bg-media">
              {t("viewer.media.off")}
            </option>
            {[5, 10, 15, 30, 45, 60].map((m) => (
              <option key={m} value={m} className="bg-media">
                {t("viewer.media.minutes", { count: m })}
              </option>
            ))}
          </select>
        </label>
        {queue.length > 1 ? (
          <ChipButton onClick={() => setQueueOpen(true)} label={t("viewer.media.queue")}>
            <ListMusic className="h-3.5 w-3.5" /> {t("viewer.media.queueShort")}
          </ChipButton>
        ) : null}
      </div>

      <BottomSheet
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        title={t("viewer.media.queue")}
      >
        <ul className="max-h-[50vh] divide-y divide-border/40 overflow-y-auto">
          {queue.map((q, i) => (
            <li key={q.name}>
              <button
                type="button"
                onClick={() => {
                  onQueueSelect(q);
                  setQueueOpen(false);
                }}
                className={`flex w-full items-center gap-3 py-2 text-left text-[13px] ${
                  q === entry ? "text-primary" : "text-foreground"
                }`}
              >
                <span className="w-5 shrink-0 text-right text-[11px] text-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{q.name}</span>
                {q === entry ? <Play className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                              PDF stage                              */
/* ------------------------------------------------------------------ */

// PdfStage moved to src/components/viewer/PdfStage.tsx — a full pdf.js-based
// renderer with pinch/zoom, rotation, search, resume and a bottom-anchored
// auto-hiding control bar.

/* ------------------------------------------------------------------ */
/*                              Text stage                             */
/* ------------------------------------------------------------------ */

function TextStage({ src, entry, parent }: { src: string; entry: FileEntry; parent: PathRef }) {
  const t = useT();
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "confirm"; bytes: number }
    | { status: "ready"; result: TextLoadResult & { ok: true } }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const res = await loadTextFile(src);
    if (!res.ok) setState({ status: "error", message: res.error });
    else {
      setState({ status: "ready", result: res });
      setDraft(res.content);
      setDirty(false);
    }
  }, [src]);

  useEffect(() => {
    if (!src) {
      setState({ status: "error", message: t("viewer.text.error.unavailable") });
      return;
    }
    if (entry.size && entry.size > TEXT_SOFT_LIMIT) {
      setState({ status: "confirm", bytes: entry.size });
    } else {
      load();
    }
  }, [src, entry.size, load, t]);

  const content = state.status === "ready" ? state.result.content : "";
  const highlighted = useMemo(() => {
    if (!query || !content) return null;
    const q = query.toLowerCase();
    const lines = content.split("\n");
    let matches = 0;
    lines.forEach((l) => {
      let idx = l.toLowerCase().indexOf(q);
      while (idx !== -1) {
        matches++;
        idx = l.toLowerCase().indexOf(q, idx + q.length);
      }
    });
    return { matches };
  }, [query, content]);

  const canEdit = state.status === "ready" && !state.result.truncated;

  const onSave = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const { writeBytes } = await import("@/lib/pdf/native-io");
      const { absolutePathOf } = await import("@/lib/viewer/source");
      const abs = absolutePathOf(parent, entry);
      const bytes = new TextEncoder().encode(draft);
      await writeBytes(abs, bytes, { overwrite: true });
      setDirty(false);
      setSaveMsg(t("viewer.text.saved"));
      setTimeout(() => setSaveMsg(null), 1600);
    } catch (e) {
      setSaveMsg((e as Error)?.message ?? t("viewer.text.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, draft, parent, entry, t]);

  return (
    <div className="flex h-full w-full flex-col bg-reader-surface">
      {/* Sous-barre opaque, soudée à l'en-tête : jamais superposée au texte */}
      <div className="flex shrink-0 select-none items-center gap-2 border-b border-reader-header-foreground/10 bg-reader-header px-2 py-1.5">
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-reader-header-foreground/10 text-reader-header-foreground active:scale-95"
          aria-label={t("viewer.text.search")}
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
        {searchOpen ? (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("viewer.text.searchPlaceholder")}
            className="min-w-0 flex-1 rounded-full bg-reader-header-foreground/10 px-3 py-1.5 text-[12.5px] text-reader-header-foreground outline-none placeholder:text-reader-header-foreground/40"
          />
        ) : (
          <p className="min-w-0 flex-1 truncate text-[11.5px] text-reader-header-foreground/60">
            {state.status === "ready"
              ? `${t("viewer.text.bytes", { bytes: state.result.bytes.toLocaleString() })}${
                  state.result.truncated ? t("viewer.text.truncated") : ""
                }${dirty ? t("viewer.text.modified") : ""}`
              : ""}
          </p>
        )}
        {highlighted && !editing ? (
          <span className="shrink-0 text-[11px] text-reader-header-foreground/70">
            {t("viewer.text.matches", { count: highlighted.matches })}
          </span>
        ) : null}
        {!editing ? (
          <>
            <button
              type="button"
              onClick={() => setFontScale((v) => Math.max(0.8, +(v - 0.1).toFixed(2)))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-reader-header-foreground/10 text-[12px] font-semibold text-reader-header-foreground active:scale-95"
              aria-label={t("viewer.text.reduce")}
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontScale((v) => Math.min(1.8, +(v + 0.1).toFixed(2)))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-reader-header-foreground/10 text-[13px] font-semibold text-reader-header-foreground active:scale-95"
              aria-label={t("viewer.text.enlarge")}
            >
              A+
            </button>
          </>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[11.5px] font-medium active:scale-95 ${
              editing
                ? "bg-primary text-primary-foreground"
                : "bg-reader-header-foreground/10 text-reader-header-foreground"
            }`}
            aria-label={editing ? t("viewer.text.read") : t("viewer.text.edit")}
          >
            <SquarePen className="h-3.5 w-3.5" />
            {editing ? t("viewer.text.read") : t("viewer.text.edit")}
          </button>
        ) : null}
        {editing ? (
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="flex h-9 shrink-0 items-center rounded-full bg-success px-3 text-[11.5px] font-semibold text-success-foreground disabled:opacity-40 active:scale-95"
          >
            {saving ? "…" : t("viewer.text.save")}
          </button>
        ) : null}
      </div>
      {saveMsg ? (
        <div className="shrink-0 bg-reader-header/95 px-3 py-1 text-center text-[11px] text-reader-header-foreground/85">
          {saveMsg}
        </div>
      ) : null}
      <div
        className={`min-h-0 flex-1 bg-reader-surface ${
          state.status === "ready" && !editing ? "overflow-hidden" : "overflow-auto p-4"
        }`}
      >
        {state.status === "loading" ? (
          <p className="text-[12.5px] text-reader-muted">{t("viewer.text.loading")}</p>
        ) : state.status === "confirm" ? (
          <div className="mx-auto max-w-sm text-center">
            <p className="text-[12.5px] text-reader-ink">
              {t("viewer.text.confirmLoad", { size: formatSize(state.bytes) })}
            </p>
            <button
              type="button"
              onClick={load}
              className="mt-3 rounded-full bg-primary px-4 py-1.5 text-[12.5px] font-medium text-primary-foreground"
            >
              {t("viewer.text.load")}
            </button>
          </div>
        ) : state.status === "error" ? (
          <p className="text-[12.5px] text-red-600">
            {t("viewer.text.error", { message: state.message })}
          </p>
        ) : state.status === "ready" ? (
          editing ? (
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setDirty(true);
              }}
              spellCheck={false}
              data-gf-selectable="true"
              className="h-full w-full resize-none bg-reader-surface font-mono text-[13px] leading-relaxed text-reader-ink outline-none"
            />
          ) : (
            <TextBody content={content} query={query} fontScale={fontScale} />
          )
        ) : null}
      </div>
    </div>
  );
}

function TextBody({
  content,
  query,
  fontScale,
}: {
  content: string;
  query: string;
  fontScale: number;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => content.split("\n"), [content]);
  const qLower = query.toLowerCase();

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => Math.round(20 * fontScale),
    overscan: 24,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <>
      <div
        ref={parentRef}
        data-gf-selectable="true"
        data-gf-reader="true"
        className="h-full w-full overflow-y-auto overscroll-contain px-4 py-4"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {items.map((v) => {
            const line = lines[v.index] ?? "";
            return (
              <div
                key={v.key}
                data-index={v.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  transform: `translateY(${v.start}px)`,
                  width: "100%",
                  fontSize: `${12 * fontScale}px`,
                }}
                className="mx-auto max-w-[720px] whitespace-pre-wrap break-words font-mono leading-relaxed text-reader-ink"
                /* La taille suit le réglage A- / A+ du lecteur. */
              >
                {query ? (
                  <HighlightedLine line={line} query={query} qLower={qLower} />
                ) : (
                  line || "\u00A0"
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* TXT / CSV / MD / JSON / XML / HTML : pastille de navigation rapide. */}
      <QuickScrollFab targetRef={parentRef} topInset={16} bottomInset={24} />
    </>
  );
}

function HighlightedLine({ line, query, qLower }: { line: string; query: string; qLower: string }) {
  if (!query) return <>{line}</>;
  const lower = line.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(qLower);
  while (idx !== -1) {
    if (idx > i) parts.push(line.slice(i, idx));
    parts.push(
      <mark key={idx} className="rounded bg-yellow-400/40 text-reader-ink">
        {line.slice(idx, idx + query.length)}
      </mark>,
    );
    i = idx + query.length;
    idx = lower.indexOf(qLower, i);
  }
  if (i < line.length) parts.push(line.slice(i));
  return <>{parts}</>;
}

/* ------------------------------------------------------------------ */
/*                             Fallback                                */
/* ------------------------------------------------------------------ */

function FallbackStage({
  entry,
  kind,
  onOpenWith,
  onShare,
  onInfo,
}: {
  entry: FileEntry;
  kind: ViewerKind;
  onOpenWith: () => void;
  onShare: () => void;
  onInfo: () => void;
}) {
  const t = useT();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-reader-ink/5">
        <Download className="h-8 w-8 text-reader-muted" />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-reader-ink">{entry.name}</p>
        <p className="mt-1 text-[11px] text-reader-muted">
          {labelOf(kind, t)}
          {entry.ext ? ` · ${entry.ext.toUpperCase()}` : ""}
          {entry.size ? ` · ${formatSize(entry.size)}` : ""}
        </p>
        <p className="mt-3 max-w-[20rem] text-[12px] leading-relaxed text-reader-muted">
          {t("viewer.fallback.description")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onOpenWith}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground transition-transform active:scale-95"
        >
          <ExternalLink className="h-3.5 w-3.5" /> {t("viewer.fallback.openWith")}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-full bg-reader-ink/6 px-3 py-2 text-[12px] font-medium text-reader-ink transition-transform active:scale-95"
        >
          <Share2 className="h-3.5 w-3.5" /> {t("viewer.fallback.share")}
        </button>
        <button
          type="button"
          onClick={onInfo}
          className="inline-flex items-center gap-1.5 rounded-full bg-reader-ink/6 px-3 py-2 text-[12px] font-medium text-reader-ink transition-transform active:scale-95"
        >
          <Info className="h-3.5 w-3.5" /> {t("viewer.fallback.info")}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                             Utilities                               */
/* ------------------------------------------------------------------ */

function ChipButton({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors ${
        active ? "bg-primary/30 text-media-foreground" : "bg-media-foreground/10 text-media-foreground/80 hover:text-media-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Silence "X import declared but never used" for lucide icons kept for future
// hooks (subtitle track panel, close-panel etc.) — the tree-shaker drops them.
export const __viewerIcons = { X };
