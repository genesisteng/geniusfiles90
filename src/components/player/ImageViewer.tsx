/**
 * ImageViewer — the single, universal premium image player of GeniusFiles.
 *
 * Every entry point of the app (file manager, categories, search, recents,
 * vault, trash, tools, pickers…) opens images through this component, via
 * the UniversalViewer. It keeps the calling screen untouched: the caller
 * owns the list, the index and the close callback, so scroll position,
 * filters, search and selection survive.
 *
 * - Portal-rendered on <body> (`z-[2000]`) so no transformed / filtered
 *   ancestor can break `position: fixed`; app navigation never shows.
 * - Instant paint: neighbours are preloaded and decoded so swiping never
 *   shows an empty frame.
 * - Gestures: horizontal swipe = prev/next, pinch = zoom, double tap =
 *   smart zoom, drag when zoomed = pan, swipe down = dismiss.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Image as ImageIcon,
  MoreVertical,
  Share2,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import type { FileEntry, PathRef } from "@/lib/files/types";
import { useOverlayZClass } from "@/lib/files/overlay-z";
import { sourceUrlOf } from "@/lib/viewer/source";
import { openWithSystem } from "@/lib/viewer/openWith";
import { formatDate, formatSize } from "@/lib/files/format";
import { acquireImmersive, setStatusBarHidden } from "@/lib/native/immersive";
import { useT } from "@/lib/i18n";

const CLOSE_MS = 220;
const DOUBLE_TAP_MS = 280;
const MAX_SCALE = 6;
/** Espace entre deux images de la pellicule (comme une galerie Android). */
const SLIDE_GAP = 16;
/** Durée du glissement qui termine un changement d'image. */
const SLIDE_MS = 240;

/* Full-resolution preloader — keeps decoded neighbours warm. */
const decoded = new Map<string, boolean>();
const DECODED_MAX = 60;

function preload(url: string) {
  if (!url || typeof window === "undefined" || decoded.has(url)) return;
  decoded.set(url, false);
  while (decoded.size > DECODED_MAX) {
    const first = decoded.keys().next().value;
    if (first === undefined) break;
    decoded.delete(first);
  }
  const img = new Image();
  img.decoding = "async";
  img.onload = () => decoded.set(url, true);
  img.src = url;
}

export function ImageViewer({
  parent,
  entries,
  index,
  onIndexChange,
  onClose,
  onMenu,
  onShare,
  onDelete,
  onEdit,
}: {
  parent: PathRef;
  entries: FileEntry[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onMenu: () => void;
  onShare: () => void;
  onDelete: () => void;
  onEdit?: () => void;
}) {
  const overlayZ = useOverlayZClass();
  const t = useT();
  const entry = entries[index];

  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [chrome, setChrome] = useState(true);

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [dragX, setDragX] = useState(0);
  const [dismissY, setDismissY] = useState(0);
  const [meta, setMeta] = useState<{ w?: number; h?: number }>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  // Body scroll lock — the viewer owns the whole screen.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* Barre d'état Android : masquée quand la chrome est cachée (plein
     écran réel), restaurée dès que les commandes réapparaissent. */
  useEffect(() => {
    const release = acquireImmersive();
    return () => {
      release();
    };
  }, []);
  useEffect(() => {
    setStatusBarHidden(!chrome);
  }, [chrome]);

  const src = useMemo(() => (entry ? sourceUrlOf(parent, entry) : ""), [entry, parent]);

  const resetTransform = useCallback(() => {
    setAnimate(true);
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  // Reset per-image state + warm the neighbours.
  // Keyed strictly on the resolved source: the caller often rebuilds the
  // `entries` array on every render, and resetting on that identity would
  // wipe the zoom/pan state continuously.
  const neighboursRef = useRef<string[]>([]);
  neighboursRef.current = [entries[index + 1], entries[index - 1]]
    .filter(Boolean)
    .map((n) => sourceUrlOf(parent, n as FileEntry));

  useEffect(() => {
    resetTransform();
    setMeta({});
    preload(src);
    neighboursRef.current.forEach(preload);
  }, [src, resetTransform]);

  const go = useCallback(
    (i: number) => {
      if (i < 0 || i > entries.length - 1) return;
      onIndexChange(i);
    },
    [entries.length, onIndexChange],
  );

  /**
   * Termine le geste horizontal : la pellicule glisse jusqu'à l'image
   * voisine, puis l'index change pendant que la transition est coupée —
   * aucun retour en arrière visible, aucun fondu.
   */
  const slideRef = useRef(0);
  const slideTo = useCallback(
    (direction: 1 | -1) => {
      const next = index + direction;
      if (next < 0 || next > entries.length - 1) {
        setAnimate(true);
        setDragX(0);
        return;
      }
      const width = (typeof window !== "undefined" ? window.innerWidth : 0) + SLIDE_GAP;
      setAnimate(true);
      setDragX(-direction * width);
      window.clearTimeout(slideRef.current);
      slideRef.current = window.setTimeout(() => {
        setAnimate(false);
        setDragX(0);
        onIndexChange(next);
        requestAnimationFrame(() => setAnimate(true));
      }, SLIDE_MS);
    },
    [entries.length, index, onIndexChange],
  );

  useEffect(() => () => window.clearTimeout(slideRef.current), []);

  const requestClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
      else if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, requestClose]);

  /* ---------------- gestures ---------------- */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ scale: number; tx: number; ty: number; distance: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const swipe = useRef<{ x: number; y: number; t: number; axis: "" | "x" | "y" } | null>(null);
  const lastTap = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setAnimate(false);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { scale, tx, ty, distance: Math.hypot(a.x - b.x, a.y - b.y) };
      panStart.current = null;
      swipe.current = null;
    } else if (pointers.current.size === 1) {
      if (scale > 1) panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
      else swipe.current = { x: e.clientX, y: e.clientY, t: performance.now(), axis: "" };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const next = pinch.current.scale * (dist / pinch.current.distance);
      setScale(Math.min(MAX_SCALE, Math.max(1, next)));
      return;
    }

    if (panStart.current && scale > 1) {
      setTx(panStart.current.tx + (e.clientX - panStart.current.x));
      setTy(panStart.current.ty + (e.clientY - panStart.current.y));
      return;
    }

    const s = swipe.current;
    if (s && scale === 1) {
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!s.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (s.axis === "x") {
        // Résistance en début / fin de série : l'image suit le doigt mais
        // freine nettement quand il n'y a aucune image de ce côté.
        const blocked = (dx > 0 && index === 0) || (dx < 0 && index === entries.length - 1);
        setDragX(blocked ? dx * 0.28 : dx);
      } else if (s.axis === "y" && dy > 0) setDismissY(dy);
    }
  };

  const finishPointer = (e: React.PointerEvent) => {
    const s = swipe.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) panStart.current = null;
    setAnimate(true);

    if (s && scale === 1) {
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const dt = performance.now() - s.t;
      swipe.current = null;

      if (s.axis === "x" && (Math.abs(dx) > 70 || (Math.abs(dx) > 30 && dt < 250))) {
        slideTo(dx < 0 ? 1 : -1);
        return;
      }
      if (s.axis === "y" && (dy > 140 || (dy > 60 && dt < 250))) {
        setDismissY(0);
        requestClose();
        return;
      }
      setDragX(0);
      setDismissY(0);

      if (s.axis === "") {
        const now = performance.now();
        if (now - lastTap.current < DOUBLE_TAP_MS) {
          lastTap.current = 0;
          smartZoom(e.clientX, e.clientY);
        } else {
          lastTap.current = now;
          window.setTimeout(() => {
            if (lastTap.current && performance.now() - lastTap.current >= DOUBLE_TAP_MS) {
              setChrome((v) => !v);
              lastTap.current = 0;
            }
          }, DOUBLE_TAP_MS + 10);
        }
      }
      return;
    }

    swipe.current = null;

    if (scale <= 1.02 && pointers.current.size === 0) resetTransform();

    if (scale > 1 && pointers.current.size === 0) {
      const now = performance.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) resetTransform();
      lastTap.current = now;
    }
  };

  /** Smart zoom: fit → 2.6× centred on the tap point, or back to fit. */
  const smartZoom = (cx: number, cy: number) => {
    if (scale > 1.05) {
      resetTransform();
      return;
    }
    const target = 2.6;
    const w = typeof window !== "undefined" ? window.innerWidth : 0;
    const h = typeof window !== "undefined" ? window.innerHeight : 0;
    setAnimate(true);
    setScale(target);
    setTx((w / 2 - cx) * (target - 1));
    setTy((h / 2 - cy) * (target - 1));
  };

  if (!entry) return null;

  /* ---------------- display fit ---------------- */
  const viewportRatio =
    typeof window !== "undefined" && window.innerHeight > 0
      ? window.innerWidth / window.innerHeight
      : 0.6;
  const imageRatio = meta.w && meta.h ? meta.w / meta.h : null;
  const useCover =
    imageRatio != null && Math.abs(imageRatio - viewportRatio) / viewportRatio < 0.12;

  /* La pellicule : l'image précédente, l'image courante et la suivante sont
     posées côte à côte et se déplacent ENSEMBLE avec le doigt — exactement
     comme une galerie moderne. Aucun fondu, aucun saut. */
  const trackStyle: React.CSSProperties = {
    transform: `translate3d(${dragX}px, ${dismissY}px, 0) scale(${
      dismissY > 0 ? Math.max(0.7, 1 - dismissY / 900) : 1
    })`,
    transition: animate ? "transform 260ms cubic-bezier(0.22,0.61,0.36,1)" : "none",
    willChange: "transform",
  };

  const zoomStyle: React.CSSProperties = {
    transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
    transformOrigin: "center center",
    transition: animate ? "transform 220ms cubic-bezier(0.22,0.61,0.36,1)" : "none",
  };

  const body = (
    <div
      className={`fixed inset-0 ${overlayZ} flex flex-col overflow-hidden bg-background text-foreground`}
      role="dialog"
      aria-modal
      style={{
        height: "100dvh",
        opacity: mounted && !closing ? Math.max(0.25, 1 - dismissY / 600) : 0,
        transition: `opacity ${CLOSE_MS}ms ease`,
      }}
    >
      {/* Ambient backdrop derived from the picture — avoids flat black. */}
      {src ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 scale-125 bg-cover bg-center opacity-30 blur-3xl"
          style={{ backgroundImage: `url(${src})` }}
        />
      ) : null}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-background/70" />

      {/* Stage */}
      <div
        className="absolute inset-0 touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      >
        <div className="absolute inset-0" style={trackStyle}>
          {[-1, 0, 1].map((off) => {
            const neighbour = entries[index + off];
            if (!neighbour) return null;
            const url = off === 0 ? src : sourceUrlOf(parent, neighbour);
            if (!url) return null;
            return (
              <div
                key={`${index + off}:${url}`}
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  transform: `translate3d(calc(${off * 100}% + ${off * SLIDE_GAP}px), 0, 0)`,
                }}
              >
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={off === 0 ? zoomStyle : undefined}
                >
                  <img
                    src={url}
                    alt={off === 0 ? entry.name : ""}
                    draggable={false}
                    decoding="async"
                    fetchPriority={off === 0 ? "high" : "low"}
                    onLoad={(e) => {
                      decoded.set(url, true);
                      if (off !== 0) return;
                      const img = e.currentTarget;
                      setMeta({ w: img.naturalWidth, h: img.naturalHeight });
                    }}
                    className={`max-h-full max-w-full ${
                      off === 0 && useCover ? "h-full w-full object-cover" : "object-contain"
                    }`}
                  />
                </div>
              </div>
            );
          })}
          {!src ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {t("media.player.imageUnavailable")}
            </p>
          ) : null}
        </div>
      </div>

      {/* Top bar */}
      <div
        className={`relative z-10 flex items-center gap-2 bg-gradient-to-b from-background via-background/90 to-transparent px-4 pb-6 pl-safe pr-safe pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] transition-all duration-200 ${
          chrome ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <RoundButton label={t("media.player.aria.back")} onClick={requestClose}>
          <ArrowLeft className="h-5 w-5" />
        </RoundButton>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-sm font-semibold">{entry.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {index + 1} / {entries.length}
          </p>
        </div>
        <RoundButton label={t("media.player.aria.moreActions")} onClick={onMenu}>
          <MoreVertical className="h-5 w-5" />
        </RoundButton>
      </div>

      <div className="flex-1" />

      {/* Metadata strip */}
      <div
        className={`relative z-10 px-6 pb-2 text-center text-[11px] text-foreground/80 transition-opacity duration-200 ${
          chrome ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span>{formatDate(entry.mtime)}</span>
          {entry.size ? <span>· {formatSize(entry.size)}</span> : null}
          {meta.w && meta.h ? (
            <span>
              · {meta.w}×{meta.h}
            </span>
          ) : null}
          {entry.ext ? <span>· {entry.ext.toUpperCase()}</span> : null}
        </div>
      </div>

      {/* Floating bottom action bar */}
      <div
        className={`relative z-10 bg-gradient-to-t from-background via-background/90 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pl-safe pr-safe pt-8 transition-all duration-200 ${
          chrome ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-[420px] items-center justify-around gap-1 rounded-2xl border border-border bg-surface px-2 py-2 shadow-soft">
          <BarAction icon={Share2} label={t("media.player.action.share")} onClick={onShare} />
          <BarAction
            icon={SlidersHorizontal}
            label={t("media.player.action.edit")}
            onClick={onEdit ?? (() => {})}
          />

          <BarAction
            icon={ImageIcon}
            label={t("media.player.action.setAs")}
            onClick={() => void openWithSystem(parent, entry, "setAs")}
          />

          <BarAction
            icon={Trash2}
            label={t("media.player.action.delete")}
            danger
            onClick={onDelete}
          />
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}

function RoundButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition-transform active:scale-95"
    >
      {children}
    </button>
  );
}

function BarAction({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Share2;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-transform active:scale-95 ${
        danger ? "text-destructive" : "text-foreground"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="truncate">{label}</span>
    </button>
  );
}
