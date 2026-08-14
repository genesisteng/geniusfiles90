import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Rewind,
  FastForward,
  Shuffle,
  SkipBack,
  SkipForward,
  Waves,
  X,
} from "lucide-react";
import { VinylDisc } from "./VinylDisc";
import { QueueSheet } from "./QueueSheet";
import { fmtTime, parseTrackName } from "./format";
import { audioStore, useAudioState } from "@/lib/player/audio-store";
import { audioEditorSearch } from "@/lib/audio/routes";
import { useOverlayZClass } from "@/lib/files/overlay-z";
import { useT } from "@/lib/i18n";

/**
 * Full-screen audio player — premium Android styling.
 *
 * Purely a controlled view over `audioStore`; it never owns an
 * HTMLAudioElement, so opening/closing it cannot interrupt playback.
 * Rendered through a portal on <body> so no transformed ancestor can
 * offset it and no app navigation stays visible behind it.
 */
export function AudioPlayer({ onClose }: { onClose: () => void }) {
  const overlayZ = useOverlayZClass();
  const t = useT();
  const navigate = useNavigate();
  const state = useAudioState();
  const { queue, index, playing, duration, shuffle, repeat, parent, loaded } = state;
  const entry = queue[index];
  const currentParent = state.parents?.[index] ?? parent;
  const canEdit = !!entry && !!currentParent && entry.kind === "audio";
  const [queueOpen, setQueueOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [artworkUrl] = useState<string | null>(null);

  const meta = useMemo(() => (entry ? parseTrackName(entry.name) : { title: "" }), [entry]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ---- Smooth position (rAF) instead of the 4 Hz `timeupdate` cadence ----
  const [smoothPos, setSmoothPos] = useState(state.position);
  const scrubRef = useRef<number | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  scrubRef.current = scrub;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const a = audioStore.getAudioEl();
      if (a && scrubRef.current == null) setSmoothPos(a.currentTime || 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Lock background scroll while the player is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        audioStore.toggle();
      } else if (e.key === "ArrowRight")
        audioStore.seek((audioStore.getAudioEl()?.currentTime ?? 0) + 10);
      else if (e.key === "ArrowLeft")
        audioStore.seek((audioStore.getAudioEl()?.currentTime ?? 0) - 10);
      else if (e.key === "n") audioStore.next();
      else if (e.key === "p") audioStore.prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ---- Progress bar drag ----
  const barRef = useRef<HTMLDivElement | null>(null);
  const posFromPointer = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar || duration <= 0) return null;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  const skip = (delta: number) => {
    const a = audioStore.getAudioEl();
    audioStore.seek((a?.currentTime ?? smoothPos) + delta);
  };

  if (!entry || !parent || !mounted) return null;

  const displayPos = scrub ?? smoothPos;
  const progress = duration > 0 ? Math.min(1, Math.max(0, displayPos / duration)) : 0;

  const bitrate =
    entry.size && duration > 1 ? Math.round((entry.size * 8) / duration / 1000) : null;

  const ui = (
    <div
      className={`fixed inset-0 ${overlayZ} flex flex-col overflow-hidden bg-background text-foreground animate-fade-in`}
      role="dialog"
      aria-modal
      aria-label={t("media.player.aria.audioPlayer")}
    >
      {/* Fond doux : dégradé d'accent très discret, jamais d'aplat noir brut */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 70% at 50% -10%, color-mix(in oklab, var(--primary) 16%, transparent) 0%, transparent 60%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-surface/40" />

      {/* Barre supérieure — marges Android natives */}
      <header
        className="flex items-center gap-3 px-5 pb-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("media.player.aria.minimize")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-foreground shadow-sm transition-transform active:scale-95"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t("media.player.aria.playing")}
          </p>
          <p className="truncate text-[11px] text-muted-foreground/80">
            {index + 1} / {queue.length}
            {entry.ext ? ` · ${entry.ext.toUpperCase()}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            audioStore.stop();
            onClose();
          }}
          aria-label={t("media.player.aria.closeStop")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-foreground shadow-sm transition-transform active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Disque vinyle */}
      <div className="flex flex-1 items-center justify-center px-8 py-4">
        <div
          key={index}
          className="w-full max-w-[min(74vw,340px)] animate-scale-in"
          style={{ animationDuration: "320ms" }}
        >
          <VinylDisc playing={playing} artworkUrl={artworkUrl} title={meta.title} />
        </div>
      </div>

      {/* Informations du morceau */}
      <section className="px-6 text-center">
        <h2
          key={`t-${index}`}
          className="line-clamp-2 text-[19px] font-semibold leading-tight text-foreground animate-fade-in"
          title={meta.title}
        >
          {meta.title}
        </h2>
        <p className="mt-1.5 truncate text-[13px] font-medium text-muted-foreground animate-fade-in">
          {meta.artist ?? t("media.player.unknownArtist")}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {[
            entry.ext ? entry.ext.toUpperCase() : null,
            bitrate ? `${bitrate} kbps` : null,
            duration > 0 ? fmtTime(duration) : loaded ? null : t("media.player.loading"),
          ]
            .filter(Boolean)
            .map((chip) => (
              <span
                key={chip as string}
                className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {chip}
              </span>
            ))}
        </div>
      </section>

      {/* Progression */}
      <div className="px-6 pt-6">
        <div
          ref={barRef}
          className="relative flex h-9 cursor-pointer items-center"
          style={{ touchAction: "none" }}
          role="slider"
          aria-label={t("media.player.aria.progress")}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(displayPos)}
          tabIndex={0}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            const v = posFromPointer(e.clientX);
            if (v != null) setScrub(v);
          }}
          onPointerMove={(e) => {
            if (scrub == null) return;
            const v = posFromPointer(e.clientX);
            if (v != null) setScrub(v);
          }}
          onPointerUp={() => {
            if (scrub != null) audioStore.seek(scrub);
            setScrub(null);
          }}
          onPointerCancel={() => setScrub(null)}
        >
          <div className="absolute inset-x-0 h-[5px] rounded-full bg-surface-3" />
          <div
            className="absolute h-[5px] rounded-full bg-primary"
            style={{
              width: `${progress * 100}%`,
              transition: scrub == null ? "width 90ms linear" : "none",
            }}
          />
          <div
            className="absolute h-4 w-4 -translate-x-1/2 rounded-full bg-primary shadow-[0_2px_8px_-1px_color-mix(in_oklab,var(--primary)_60%,transparent)] ring-4 ring-background"
            style={{
              left: `${progress * 100}%`,
              transform: `translateX(-50%) scale(${scrub != null ? 1.25 : 1})`,
              transition:
                scrub == null ? "left 90ms linear, transform 150ms ease" : "transform 150ms ease",
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] font-medium tabular-nums text-muted-foreground">
          <span>{fmtTime(displayPos)}</span>
          <span>{duration > 0 ? fmtTime(duration) : "--:--"}</span>
        </div>
      </div>

      {/* Contrôles principaux */}
      <div className="flex items-center justify-between gap-2 px-7 pt-5">
        <IconButton
          label={t("media.player.aria.shuffle")}
          active={shuffle}
          onClick={() => audioStore.setShuffle(!shuffle)}
        >
          <Shuffle className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton
          label={t("media.player.aria.previous")}
          size="lg"
          onClick={() => audioStore.prev()}
        >
          <SkipBack className="h-6 w-6" fill="currentColor" />
        </IconButton>
        <button
          type="button"
          onClick={() => audioStore.toggle()}
          aria-label={playing ? t("media.player.aria.pause") : t("media.player.aria.play")}
          className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_28px_-10px_color-mix(in_oklab,var(--primary)_75%,transparent)] transition-transform duration-150 active:scale-95"
        >
          {playing ? (
            <Pause className="h-8 w-8" fill="currentColor" />
          ) : (
            <Play className="ml-1 h-8 w-8" fill="currentColor" />
          )}
        </button>
        <IconButton label={t("media.player.aria.next")} size="lg" onClick={() => audioStore.next()}>
          <SkipForward className="h-6 w-6" fill="currentColor" />
        </IconButton>
        <IconButton
          label={t("media.player.aria.repeat")}
          active={repeat !== "off"}
          onClick={() =>
            audioStore.setRepeat(repeat === "off" ? "all" : repeat === "all" ? "one" : "off")
          }
        >
          {repeat === "one" ? (
            <Repeat1 className="h-[18px] w-[18px]" />
          ) : (
            <Repeat className="h-[18px] w-[18px]" />
          )}
        </IconButton>
      </div>

      {/* Contrôles secondaires */}
      <div
        className="flex flex-wrap items-center justify-center gap-2 px-6 pt-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.75rem)" }}
      >
        <SecondaryButton label={t("media.player.aria.rewind10")} onClick={() => skip(-10)}>
          <Rewind className="h-4 w-4" />
          10s
        </SecondaryButton>
        <SecondaryButton label={t("media.player.aria.queue")} onClick={() => setQueueOpen(true)}>
          <ListMusic className="h-4 w-4" />
          {t("media.player.queueLabel")}
        </SecondaryButton>
        <SecondaryButton label={t("media.player.aria.forward10")} onClick={() => skip(10)}>
          10s
          <FastForward className="h-4 w-4" />
        </SecondaryButton>
        <SecondaryButton
          label={t("media.player.aria.editAudio")}
          onClick={() => {
            if (!entry || !currentParent) return;
            audioStore.closeUI();
            void navigate({
              to: "/editeur-audio",
              search: audioEditorSearch(currentParent, entry),
            });
          }}
          disabled={!canEdit}
        >
          <Waves className="h-4 w-4" />
          {t("media.player.editLabel")}
        </SecondaryButton>
      </div>

      <QueueSheet
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        entries={queue}
        activeIndex={index}
        onSelect={(i) => audioStore.jumpTo(i)}
        variant="audio"
        title={t("media.player.queueTitle")}
      />
    </div>
  );

  return createPortal(ui, document.body);
}

function IconButton({
  label,
  onClick,
  active,
  size = "md",
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex items-center justify-center rounded-full transition-all duration-150 active:scale-90 ${
        size === "lg" ? "h-13 w-13 p-3" : "h-11 w-11"
      } ${active ? "bg-primary/15 text-primary" : "text-foreground/80 hover:bg-surface-2"}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 text-[12px] font-medium text-foreground/85 shadow-sm transition-all duration-150 active:scale-95 hover:bg-surface-3 ${disabled ? "cursor-not-allowed opacity-50 active:scale-100" : ""}`}
    >
      {children}
    </button>
  );
}
