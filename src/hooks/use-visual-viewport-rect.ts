import { useEffect, useState } from "react";

export type ViewportRect = { top: number; left: number; width: number; height: number };

function readRect(): ViewportRect {
  if (typeof window === "undefined") return { top: 0, left: 0, width: 0, height: 0 };
  const vv = window.visualViewport;
  if (!vv) return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
  return { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height };
}

/**
 * Rectangle réellement visible de la fenêtre (visualViewport).
 *
 * Sur Android, après une rotation, la WebView peut conserver un instant la
 * taille de mise en page précédente : un conteneur `fixed inset-0` se
 * retrouve alors décalé (bande vide en haut en paysage). Mesurer le
 * visualViewport et l'appliquer explicitement supprime la cause : la scène
 * est recalculée à chaque changement d'orientation ou d'insets système.
 *
 * `null` avant hydratation (SSR sûr) : l'appelant retombe sur `inset-0`.
 */
export function useVisualViewportRect(active = true): ViewportRect | null {
  const [rect, setRect] = useState<ViewportRect | null>(null);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    let raf1 = 0;
    let raf2 = 0;
    let timer = 0;

    const apply = () => {
      const next = readRect();
      setRect((prev) =>
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
    };

    // Après une rotation, la géométrie n'est fiable qu'une fois la nouvelle
    // mise en page appliquée : on remesure sur deux frames puis à 250 ms.
    const settle = () => {
      apply();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
      raf1 = requestAnimationFrame(() => {
        apply();
        raf2 = requestAnimationFrame(apply);
      });
      timer = window.setTimeout(apply, 250);
    };

    settle();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", settle);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", settle);
    window.addEventListener("orientationchange", settle);
    const so = screen.orientation as ScreenOrientation | undefined;
    so?.addEventListener?.("change", settle);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
      vv?.removeEventListener("resize", settle);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", settle);
      window.removeEventListener("orientationchange", settle);
      so?.removeEventListener?.("change", settle);
    };
  }, [active]);

  return rect;
}
