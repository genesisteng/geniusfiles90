/**
 * ScrollFeel — comportement de défilement natif de GeniusFiles.
 *
 * 1. Aucun rebond de page : `overscroll-behavior: none` (CSS) supprime
 *    l'étirement de la WebView. L'en-tête collant, la barre de navigation
 *    et tous les éléments fixes restent donc rigoureusement immobiles.
 * 2. Résistance de bord : en haut ou en bas de liste, seul le CONTENU
 *    (les enfants de `.gf-page` qui ne sont pas l'en-tête) se décale de
 *    quelques pixels, brièvement, puis revient.
 * 3. Tirer pour actualiser : uniquement quand la page a déclaré une action
 *    (usePullToRefresh) et que l'utilisateur est tout en haut.
 *
 * Le geste n'est intercepté que s'il est clairement vertical, hors zone
 * défilante interne, hors visualiseur et hors feuille modale.
 */
import { useEffect, useRef } from "react";
import { Loader2, ArrowDown } from "lucide-react";

import { getRefreshHandler } from "@/lib/gestures/pull-refresh";

const THRESHOLD = 64;
const MAX_PULL = 96;
const EDGE_MAX = 26;
const HOLD = 52;
const MIN_SPIN_MS = 480;

function resist(distance: number, max: number) {
  // Courbe asymptotique : la résistance augmente avec la distance.
  return max * (1 - Math.exp(-distance / (max * 1.35)));
}

function isBlocked(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  if (!el) return true;
  if (el.closest('[data-gf-nopull], [role="dialog"], .gf-video-shell, input, textarea'))
    return true;
  // Zone défilante interne (carrousel, feuille, panneau) : elle gère son
  // propre défilement, la page ne doit pas intercepter le geste.
  let node: Element | null = el;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 1)
      return true;
    node = node.parentElement;
  }
  return false;
}

export function ScrollFeel() {
  const badgeRef = useRef<HTMLDivElement | null>(null);
  const iconRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let page: HTMLElement | null = null;
    let mode: "refresh" | "edge-top" | "edge-bottom" | null = null;
    let decided = false;
    let startY = 0;
    let startX = 0;
    let offset = 0;
    let baseTop = 0;
    let refreshing = false;
    let releaseTimer = 0;

    const badge = () => badgeRef.current;

    const paint = (value: number, progress: number) => {
      if (page) page.style.setProperty("--gf-pull", `${value}px`);
      const b = badge();
      if (!b) return;
      b.style.opacity = progress > 0.02 ? "1" : "0";
      b.style.transform = `translate(-50%, ${Math.min(value, MAX_PULL)}px) scale(${
        0.7 + Math.min(1, progress) * 0.3
      })`;
      const i = iconRef.current;
      if (i) i.style.transform = `rotate(${Math.min(1, progress) * 180}deg)`;
    };

    const clear = () => {
      if (!page) return;
      const el = page;
      el.classList.add("gf-pull-release");
      el.style.setProperty("--gf-pull", "0px");
      const b = badge();
      if (b) {
        b.style.transition = "transform 320ms cubic-bezier(.22,1,.36,1), opacity 200ms ease";
        b.style.opacity = "0";
        b.style.transform = "translate(-50%, 0px) scale(0.7)";
      }
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(() => {
        el.classList.remove("gf-pull-release", "gf-pulling");
        el.style.removeProperty("--gf-pull");
        if (b) b.style.transition = "";
      }, 340);
      page = null;
      offset = 0;
      mode = null;
    };

    const atTop = () => window.scrollY <= 1;
    const atBottom = () =>
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1;

    const onStart = (e: TouchEvent) => {
      if (refreshing || e.touches.length !== 1) return;
      mode = null;
      decided = false;
      if (document.body.style.overflow === "hidden") return;
      if (isBlocked(e.target)) return;
      let host = document.querySelector<HTMLElement>("main > .gf-page");
      if (!host) return;
      /* Certaines pages (Accueil) enveloppent leur contenu dans un conteneur
         intermédiaire : l'en-tête collant n'est alors PAS un enfant direct de
         `.gf-page`. On descend jusqu'au conteneur qui possède réellement
         l'en-tête, sans quoi le header serait tiré avec le contenu. */
      if (!host.querySelector(":scope > header")) {
        const inner = host.firstElementChild;
        if (inner instanceof HTMLElement && inner.querySelector(":scope > header")) host = inner;
      }
      page = host;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      const header = page.querySelector<HTMLElement>(":scope > header");
      baseTop = header ? header.getBoundingClientRect().bottom - 42 : 12;
      const b = badge();
      if (b) {
        b.style.transition = "";
        b.style.top = `${Math.max(8, baseTop)}px`;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (!page || refreshing || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;

      if (!decided) {
        if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
        decided = true;
        // Geste horizontal : il appartient au composant touché.
        if (Math.abs(dx) >= Math.abs(dy)) {
          page = null;
          return;
        }
        if (dy > 0 && atTop()) mode = getRefreshHandler() ? "refresh" : "edge-top";
        else if (dy < 0 && atBottom()) mode = "edge-bottom";
        else {
          page = null;
          return;
        }
        /* Le geste est désormais vertical et appartient à la page : on
           annule proprement toute pression en cours sur la liste (appui
           long, amorce de sélection, ouverture) via un `pointercancel`
           réel — chaque composant le reçoit et libère son état. */
        if (e.target instanceof Element) {
          e.target.dispatchEvent(
            new PointerEvent("pointercancel", { bubbles: true, cancelable: false }),
          );
        }
        page.classList.remove("gf-pull-release");
        page.classList.add("gf-pulling");
      }

      if (!mode) return;
      if (e.cancelable) e.preventDefault();

      if (mode === "refresh") {
        offset = resist(Math.max(0, dy), MAX_PULL);
        paint(offset, offset / THRESHOLD);
      } else if (mode === "edge-top") {
        offset = resist(Math.max(0, dy), EDGE_MAX);
        paint(offset, 0);
      } else {
        offset = -resist(Math.max(0, -dy), EDGE_MAX);
        paint(offset, 0);
      }
    };

    const onEnd = () => {
      if (!page || refreshing) return;
      const handler = getRefreshHandler();
      if (mode === "refresh" && offset >= THRESHOLD && handler) {
        refreshing = true;
        const el = page;
        el.classList.add("gf-pull-release");
        el.style.setProperty("--gf-pull", `${HOLD}px`);
        const b = badge();
        if (b) {
          b.dataset.spin = "1";
          b.style.transition = "transform 240ms cubic-bezier(.22,1,.36,1)";
          b.style.transform = `translate(-50%, ${HOLD}px) scale(1)`;
        }
        const started = performance.now();
        void Promise.resolve()
          .then(handler)
          .catch(() => {})
          .then(() => {
            const wait = Math.max(0, MIN_SPIN_MS - (performance.now() - started));
            window.setTimeout(() => {
              refreshing = false;
              if (b) delete b.dataset.spin;
              page = el;
              clear();
            }, wait);
          });
        mode = null;
        offset = 0;
        return;
      }
      clear();
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.clearTimeout(releaseTimer);
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <div
      ref={badgeRef}
      aria-hidden
      className="pointer-events-none fixed left-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-foreground opacity-0 shadow-soft"
      style={{ top: 12, transform: "translate(-50%, 0px) scale(0.7)" }}
      data-gf-nopull
    >
      <div ref={iconRef} className="gf-pull-icon flex items-center justify-center">
        <ArrowDown className="h-[18px] w-[18px]" />
      </div>
      <Loader2 className="gf-pull-spinner absolute h-[18px] w-[18px] animate-spin" />
    </div>
  );
}
