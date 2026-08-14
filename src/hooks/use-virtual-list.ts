/**
 * Virtualisation de listes pour GeniusFiles.
 *
 * L'application défile normalement dans le document (`<main>`), mais
 * certaines couches — en particulier le mode sélection (`PickLayer`) —
 * sont des superpositions `fixed` dotées de leur PROPRE conteneur
 * défilant. Dans ce cas `window.scrollY` reste à 0 : une virtualisation
 * « fenêtre » afficherait toujours les premières lignes et laisserait
 * une bande vide (« couche noire ») à la place du contenu.
 *
 * Le hook détecte donc l'ancêtre marqué `data-scroll-root` et bascule
 * automatiquement sur une virtualisation par conteneur ; sinon il
 * virtualise par rapport à la fenêtre. Les hauteurs de ligne restent
 * FIXES : aucun re-mesure, donc aucun tremblement au défilement.
 *
 * `scrollMargin` suit l'offset de la liste dans le contenu défilant —
 * sans lui, le mappage défilement → plage d'éléments est faux et les
 * lignes sautent ou disparaissent.
 */
import { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Marqueur posé sur tout conteneur défilant autre que la fenêtre. */
export const SCROLL_ROOT_ATTR = "data-scroll-root";

export type WindowVirtualOptions = {
  count: number;
  estimateSize: number;
  overscan?: number;
  gap?: number;
  /** Below this item count, virtualization is skipped. */
  threshold?: number;
};

export function useWindowVirtualList(opts: WindowVirtualOptions) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const threshold = opts.threshold ?? 30;
  const enabled = opts.count > threshold;
  const [scrollMargin, setScrollMargin] = useState(0);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollElRef = useRef<HTMLElement | null>(null);
  scrollElRef.current = scrollEl;

  const common = {
    count: enabled ? opts.count : 0,
    estimateSize: () => opts.estimateSize,
    overscan: opts.overscan ?? 8,
    gap: opts.gap ?? 0,
    scrollMargin,
  };

  const windowVirtualizer = useWindowVirtualizer(common);
  const elementVirtualizer = useVirtualizer({
    ...common,
    count: enabled && scrollEl ? opts.count : 0,
    getScrollElement: () => scrollElRef.current,
  });
  const virtualizer = scrollEl ? elementVirtualizer : windowVirtualizer;

  /* Mesure synchrone de l'offset de la liste dans son conteneur défilant.
     Elle s'exécute après CHAQUE rendu : entrer en mode sélection remplace
     l'en-tête, retire la barre de recherche et ajoute la barre d'actions,
     ce qui déplace la liste sans forcément changer la hauteur d'un élément
     observé — un ResizeObserver seul laisse alors un décalage permanent
     (bande vide « noire » à la place des lignes). */
  const measureNow = () => {
    const node = parentRef.current;
    if (!node) return;
    const root = node.closest<HTMLElement>(`[${SCROLL_ROOT_ATTR}]`);
    if (root !== scrollElRef.current) {
      scrollElRef.current = root;
      setScrollEl(root);
    }
    const top = root
      ? Math.round(node.getBoundingClientRect().top - root.getBoundingClientRect().top) +
        Math.round(root.scrollTop)
      : Math.round(node.getBoundingClientRect().top + window.scrollY);
    setScrollMargin((prev) => (Math.abs(prev - top) > 1 ? top : prev));
  };
  const measureRef = useRef(measureNow);
  measureRef.current = measureNow;

  useIsoLayoutEffect(() => {
    if (!enabled) return;
    measureRef.current();
  });

  useIsoLayoutEffect(() => {
    if (!enabled) return;
    const el = parentRef.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measureRef.current());
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    if (document.body) ro.observe(document.body);
    window.addEventListener("resize", measure);
    /* Filet de sécurité : toute dérive résiduelle (image chargée plus
       haut, en-tête collant qui se replie…) est corrigée dès la frame
       suivante pendant le défilement, sans jamais laisser de vide. */
    window.addEventListener("scroll", measure, { passive: true });
    const root = el.closest<HTMLElement>(`[${SCROLL_ROOT_ATTR}]`);
    if (root) {
      ro.observe(root);
      root.addEventListener("scroll", measure, { passive: true });
    }
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      if (root) root.removeEventListener("scroll", measure);
    };
  }, [enabled, scrollEl]);

  return { enabled, parentRef, virtualizer, scrollMargin };
}
