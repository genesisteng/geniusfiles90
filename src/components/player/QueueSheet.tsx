import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { X, Play } from "lucide-react";
import type { FileEntry } from "@/lib/files/types";
import { useThumbnail } from "@/hooks/use-thumbnail";
import { parseTrackName, fmtTime } from "./format";
import { ArtworkFallback } from "./ArtworkFallback";
import { useT } from "@/lib/i18n";

/** Hauteur fixe d'une ligne : aucune re-mesure pendant le défilement. */
const ROW_HEIGHT = 64;

/**
 * Bottom sheet listing every media file in the current queue.
 *
 * Liste VIRTUALISÉE : seules les lignes réellement visibles (plus une petite
 * marge) sont montées, quel que soit le nombre de pistes. Une catégorie de
 * 100 000 fichiers s'ouvre donc instantanément, sans pic mémoire ni
 * génération massive de miniatures — chaque ligne demande sa vignette à la
 * demande et la relâche en sortant du champ. Le fond et le glissé vers le
 * bas ferment la feuille sans interrompre la lecture.
 */
export function QueueSheet({
  open,
  onClose,
  entries,
  activeIndex,
  onSelect,
  variant,
  durations,
  thumbFor,
  pathFor,
  title,
}: {
  open: boolean;
  onClose: () => void;
  entries: FileEntry[];
  activeIndex: number;
  onSelect: (index: number) => void;
  variant: "audio" | "video";
  /** Duration in seconds, keyed by entry.name. Optional; falls back gracefully. */
  durations?: Record<string, number | undefined>;
  /** Optional thumbnail URL per entry (video posters, audio artwork). */
  thumbFor?: (entry: FileEntry) => string | null;
  /**
   * Absolute path per entry. When provided, real thumbnails are generated
   * natively (and cached) asynchronously, row by row.
   */
  pathFor?: (entry: FileEntry) => string | null;
  title: string;
}) {
  const t = useT();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    // La position courante est immédiatement visible, sans rendu intermédiaire.
    const t = window.setTimeout(() => {
      if (activeIndex >= 0 && activeIndex < entries.length) {
        virtualizer.scrollToIndex(activeIndex, { align: "center" });
      }
    }, 30);
    return () => window.clearTimeout(t);
  }, [open, activeIndex, entries.length, virtualizer]);

  // Swipe-down to close.
  const drag = useRef<{ y: number; ty: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!sheetRef.current) return;
    drag.current = { y: e.clientY, ty: 0 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !sheetRef.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    drag.current.ty = dy;
    sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onPointerUp = () => {
    if (!drag.current || !sheetRef.current) return;
    const ty = drag.current.ty;
    sheetRef.current.style.transform = "";
    drag.current = null;
    if (ty > 120) onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end" role="dialog" aria-modal>
      <button
        type="button"
        aria-label={t("media.player.queueCloseLabel")}
        onClick={onClose}
        className="absolute inset-0 bg-scrim/60 animate-fade-in"
      />
      <div
        ref={sheetRef}
        className="relative z-10 flex max-h-[75vh] w-full flex-col rounded-t-3xl bg-media/95 text-media-foreground shadow-2xl backdrop-blur-xl animate-slide-in-right sm:mx-auto sm:max-w-lg"
        style={{ animation: "fade-in 0.2s ease-out, scale-in 0.2s ease-out" }}
      >
        <div
          className="flex cursor-grab items-center gap-3 px-5 pb-3 pt-3 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mx-auto h-1 w-10 rounded-full bg-media-foreground/25" />
        </div>
        <div className="flex items-center gap-3 px-5 pb-2">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("media.player.aria.close")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-media-foreground/10 gf-press"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="min-w-0 flex-1 truncate text-[14px] font-semibold">{title}</p>
          <span className="rounded-full bg-media-foreground/10 px-2 py-0.5 text-[11px] text-media-muted">
            {entries.length}
          </span>
        </div>
        <div
          ref={listRef}
          className="overflow-y-auto px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
          style={{ overscrollBehavior: "contain", flex: "1 1 auto", minHeight: 0 }}
        >
          <div style={{ position: "relative", height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((v) => {
              const entry = entries[v.index];
              if (!entry) return null;
              const i = v.index;
              const meta = parseTrackName(entry.name);
              const active = i === activeIndex;
              const dur = durations?.[entry.name];
              const thumb = thumbFor?.(entry) ?? null;
              return (
                <div
                  key={`${entry.name}-${i}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${ROW_HEIGHT}px`,
                    transform: `translateY(${v.start}px)`,
                    contain: "layout paint style",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(i);
                      onClose();
                    }}
                    className={`flex h-full w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${
                      active
                        ? "bg-media-foreground/10"
                        : "hover:bg-media-foreground/5 active:bg-media-foreground/10"
                    }`}
                  >
                    <div className="relative h-12 w-[68px] shrink-0 overflow-hidden rounded-lg bg-media-foreground/5">
                      <RowThumb
                        path={pathFor?.(entry) ?? null}
                        fallbackUrl={thumb}
                        title={meta.title}
                      />
                      {active ? (
                        <span className="absolute inset-0 flex items-center justify-center bg-scrim/45">
                          {variant === "audio" ? <WaveIndicator /> : <Play className="h-4 w-4" />}
                        </span>
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-[13.5px] font-medium ${
                          active ? "text-primary" : "text-media-foreground"
                        }`}
                      >
                        {meta.title}
                      </p>
                      <p className="truncate text-[11.5px] text-media-muted">
                        {meta.artist ??
                          (variant === "audio"
                            ? t("media.player.unknownArtist")
                            : t("media.player.video"))}
                      </p>
                    </div>
                    {dur ? (
                      <span className="shrink-0 text-[11px] tabular-nums text-media-muted">
                        {fmtTime(dur)}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Miniature de ligne : résolue nativement (et mise en cache LRU) de façon
 * asynchrone, avec repli immédiat sur l'artwork généré — aucun clignotement
 * lors du défilement puisque le cache est lu de manière synchrone.
 */
function RowThumb({
  path,
  fallbackUrl,
  title,
}: {
  path: string | null;
  fallbackUrl: string | null;
  title: string;
}) {
  const native = useThumbnail(path, 200);
  const url = native ?? fallbackUrl;
  if (!url) return <ArtworkFallback title={title} className="h-full w-full" />;
  return (
    <img
      src={url}
      alt=""
      decoding="async"
      loading="lazy"
      className="h-full w-full object-cover"
      style={{ contain: "paint" }}
    />
  );
}

function WaveIndicator() {
  return (
    <span className="flex h-4 items-end gap-[2px]" aria-hidden>
      <span className="h-2 w-[3px] animate-pulse rounded-sm bg-primary [animation-delay:-.2s]" />
      <span className="h-3.5 w-[3px] animate-pulse rounded-sm bg-primary" />
      <span className="h-2.5 w-[3px] animate-pulse rounded-sm bg-primary [animation-delay:-.4s]" />
    </span>
  );
}
