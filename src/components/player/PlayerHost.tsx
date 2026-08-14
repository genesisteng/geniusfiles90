import { Pause, Play, SkipForward, X } from "lucide-react";
import { audioStore, useAudioState } from "@/lib/player/audio-store";
import { AudioPlayer } from "./AudioPlayer";
import { ArtworkFallback } from "./ArtworkFallback";
import { parseTrackName } from "./format";
import { useT } from "@/lib/i18n";

/**
 * Persistent audio surface mounted once at the AppShell level.
 *
 * - Renders the full-screen `AudioPlayer` overlay when the store's UI flag
 *   is on (opened from the file viewer or from the mini-player).
 * - Renders the always-visible mini-player above the bottom nav whenever
 *   a track is loaded and the full player is closed — the audio itself
 *   never depends on any of this being mounted.
 */
export function PlayerHost() {
  const s = useAudioState();
  // Retour Android : quand le lecteur plein écran est ouvert, le retour
  // le referme et redonne l'écran précédent — jamais de sortie de l'app.
  useBackHandler(
    s.uiOpen,
    () => {
      audioStore.closeUI();
      return true;
    },
    BACK_PRIORITY.overlay,
  );
  const entry = s.queue[s.index];
  if (!entry) return null;

  return <>{s.uiOpen ? <AudioPlayer onClose={() => audioStore.closeUI()} /> : <MiniPlayer />}</>;
}


function MiniPlayer() {
  const t = useT();
  const s = useAudioState();
  const entry = s.queue[s.index];
  if (!entry) return null;
  const meta = parseTrackName(entry.name);
  const progress = s.duration > 0 ? Math.min(1, s.position / s.duration) : 0;
  return (
    <div
      className="fixed inset-x-0 z-40 mx-auto flex max-w-[520px] justify-center px-2"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.25rem)" }}
    >
      <button
        type="button"
        onClick={() => audioStore.openUI()}
        className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-background/95 px-2 py-2 pr-1 text-left shadow-[0_8px_25px_-10px_rgba(0,0,0,0.5)] backdrop-blur active:scale-[0.99]"
        aria-label={t("media.player.aria.openPlayer")}
      >
        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
          <ArtworkFallback title={meta.title} className="h-full w-full" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-foreground">
            {meta.title}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {meta.artist ?? t("media.player.unknownArtist")}
          </span>
        </span>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            audioStore.toggle();
          }}
          role="button"
          aria-label={s.playing ? t("media.player.aria.pause") : t("media.player.aria.play")}
        >
          {s.playing ? (
            <Pause className="h-4 w-4" fill="currentColor" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
          )}
        </span>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            audioStore.next();
          }}
          role="button"
          aria-label={t("media.player.aria.next")}
        >
          <SkipForward className="h-4 w-4" />
        </span>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            audioStore.stop();
          }}
          role="button"
          aria-label={t("media.player.aria.stop")}
        >
          <X className="h-4 w-4" />
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-primary transition-[width] duration-150"
          style={{ width: `${progress * 100}%` }}
        />
      </button>
    </div>
  );
}
