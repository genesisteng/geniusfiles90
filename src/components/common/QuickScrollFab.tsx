/**
 * Bouton flottant de navigation verticale rapide (« fast scroller »).
 *
 * Comportement calqué sur les meilleurs gestionnaires de fichiers Android :
 *   • une pastille fixée sur le bord droit, alignée sur la position réelle
 *     du défilement ;
 *   • glisser verticalement = défilement proportionnel au doigt, instantané
 *     (écriture directe de scrollTop, aucun state React pendant le geste) ;
 *   • appui simple en haut de la pastille = retour au début ;
 *   • appui simple en bas = saut à la fin ;
 *   • invisible tant que le contenu tient à l'écran ;
 *   • s'estompe après quelques instants d'inactivité, sans jamais devenir
 *     inatteignable.
 *
 * Fonctionne aussi bien sur la fenêtre (listes de l'application, qui
 * défilent le document) que sur un conteneur donné (lecteurs de documents).
 */
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useT } from "@/lib/i18n";

const THUMB_H = 64;
/** En dessous de ce défilement disponible, la pastille n'apparaît pas. */
const MIN_OVERFLOW = 320;
/** Délai d'effacement après la dernière interaction de défilement. */
const IDLE_MS = 1200;

type Props = {
  /** Conteneur défilant. Absent = défilement de la fenêtre. */
  targetRef?: RefObject<HTMLElement | null>;
  /** Marges de la piste, en pixels (barres fixes, nav du bas…). */
  topInset?: number;
  bottomInset?: number;
  className?: string;
};

type Metrics = {
  scrollTop: number;
  maxScroll: number;
  /** Bornes verticales de la zone défilante, en coordonnées écran. */
  rectTop: number;
  rectBottom: number;
};

function readMetrics(el: HTMLElement | null): Metrics {
  if (typeof window === "undefined") {
    return { scrollTop: 0, maxScroll: 0, rectTop: 0, rectBottom: 0 };
  }
  if (el) {
    const rect = el.getBoundingClientRect();
    return {
      scrollTop: el.scrollTop,
      maxScroll: Math.max(0, el.scrollHeight - el.clientHeight),
      rectTop: rect.top,
      rectBottom: rect.bottom,
    };
  }
  const doc = document.documentElement;
  return {
    scrollTop: window.scrollY,
    maxScroll: Math.max(0, doc.scrollHeight - window.innerHeight),
    rectTop: 0,
    rectBottom: window.innerHeight,
  };
}

export function QuickScrollFab({ targetRef, topInset = 12, bottomInset = 12, className }: Props) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  /** Vrai uniquement pendant / juste après une interaction de défilement. */
  const [active, setActive] = useState(false);
  const [dragging, setDragging] = useState(false);

  const thumbRef = useRef<HTMLDivElement | null>(null);
  const metricsRef = useRef<Metrics>({ scrollTop: 0, maxScroll: 0, rectTop: 0, rectBottom: 0 });
  const activeRef = useRef(false);
  const frameRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ offset: number; moved: boolean; startY: number } | null>(null);

  /** Piste utilisable : hauteur du conteneur moins les marges et la pastille. */
  const track = useCallback(() => {
    const m = metricsRef.current;
    const top = m.rectTop + topInset;
    const length = Math.max(1, m.rectBottom - bottomInset - top - THUMB_H);
    return { top, length };
  }, [topInset, bottomInset]);

  /** Positionne la pastille sans repasser par React (0 re-render pendant le scroll). */
  const paint = useCallback(() => {
    const node = thumbRef.current;
    if (!node) return;
    const m = metricsRef.current;
    const { top, length } = track();
    const ratio = m.maxScroll > 0 ? Math.min(1, Math.max(0, m.scrollTop / m.maxScroll)) : 0;
    node.style.transform = `translate3d(0, ${Math.round(top + ratio * length)}px, 0)`;
  }, [track]);

  /** Révèle la pastille et programme son effacement complet. */
  const wake = useCallback(() => {
    if (!activeRef.current) {
      activeRef.current = true;
      setActive(true);
    }
    paint();
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      activeRef.current = false;
      setActive(false);
      paint();
    }, IDLE_MS);
  }, [paint]);

  const sync = useCallback(() => {
    const el = targetRef?.current ?? null;
    const next = readMetrics(el);
    metricsRef.current = next;
    setVisible(next.maxScroll > MIN_OVERFLOW);
    paint();
  }, [targetRef, paint]);

  const scheduleSync = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(sync);
  }, [sync]);

  /* Écoute du défilement + des changements de taille de contenu. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = targetRef?.current ?? null;
    const scrollSource: HTMLElement | Window = el ?? window;

    const onScroll = () => {
      scheduleSync();
      wake();
    };
    scrollSource.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", scheduleSync);

    const ro = new ResizeObserver(scheduleSync);
    if (el) {
      ro.observe(el);
      if (el.firstElementChild) ro.observe(el.firstElementChild);
    } else if (document.body) {
      ro.observe(document.body);
    }

    sync();

    return () => {
      cancelAnimationFrame(frameRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      scrollSource.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", scheduleSync);
      ro.disconnect();
    };
  }, [targetRef, scheduleSync, sync, wake]);

  const scrollTo = useCallback(
    (top: number, smooth: boolean) => {
      const el = targetRef?.current ?? null;
      if (el) el.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
      else window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
    },
    [targetRef],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const node = thumbRef.current;
    if (!node) return;
    node.setPointerCapture(e.pointerId);
    const rect = node.getBoundingClientRect();
    dragRef.current = { offset: e.clientY - rect.top, moved: false, startY: e.clientY };
    setDragging(true);
    wake();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientY - drag.startY) > 4) drag.moved = true;
    if (!drag.moved) return;
    e.preventDefault();
    const m = metricsRef.current;
    const { top, length } = track();
    const pos = Math.min(top + length, Math.max(top, e.clientY - drag.offset));
    const ratio = (pos - top) / length;
    metricsRef.current = { ...m, scrollTop: ratio * m.maxScroll };
    paint();
    scrollTo(ratio * m.maxScroll, false);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    wake();
    if (!drag) return;
    if (!drag.moved) {
      const rect = e.currentTarget.getBoundingClientRect();
      const upper = e.clientY - rect.top < rect.height / 2;
      scrollTo(upper ? 0 : metricsRef.current.maxScroll, true);
    }
    scheduleSync();
  };

  /* La pastille n'existe dans le DOM qu'une fois visible : on la place dès
     son apparition, sans attendre le premier événement de défilement. */
  useEffect(() => {
    if (visible) paint();
  }, [visible, paint]);

  if (!visible) return null;

  const shown = active || dragging;

  return (
    <div
      ref={thumbRef}
      role="scrollbar"
      aria-orientation="vertical"
      aria-hidden={!shown}
      aria-label={t("common.quickScroll.aria")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        top: 0,
        height: THUMB_H,
        touchAction: "none",
        willChange: "transform, opacity",
        transitionProperty: "opacity, background-color",
        transitionDuration: shown ? "160ms" : "260ms",
        transitionTimingFunction: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      }}
      className={`fixed right-1.5 z-50 flex w-8 flex-col items-center justify-between rounded-full border border-border/60 bg-surface/95 py-1.5 shadow-[0_6px_18px_-6px_rgb(0_0_0/0.45)] backdrop-blur-sm select-none ${
        dragging ? "bg-primary text-primary-foreground" : "text-foreground/70"
      } ${shown ? "opacity-100" : "pointer-events-none opacity-0"} ${className ?? ""}`}
    >
      <ChevronUp className="h-4 w-4" strokeWidth={2.4} />
      <span aria-hidden className="h-3 w-[3px] rounded-full bg-current opacity-40" />
      <ChevronDown className="h-4 w-4" strokeWidth={2.4} />
    </div>
  );
}
