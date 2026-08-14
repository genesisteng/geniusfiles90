import { useEffect, useState } from "react";

export type ViewportInset = {
  /** Hauteur réellement visible (hors clavier), en px. `null` avant hydratation. */
  height: number | null;
  /** Hauteur occupée par le clavier logiciel, en px (0 si fermé). */
  keyboardInset: number;
};

/**
 * Suit le viewport visuel : permet d'ancrer le formulaire de saisie
 * juste au-dessus du clavier, quel que soit le mode de redimensionnement
 * de la WebView Android.
 */
export function useViewportInset(): ViewportInset {
  const [state, setState] = useState<ViewportInset>({ height: null, keyboardInset: 0 });

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;

    const update = () => {
      if (!vv) {
        setState({ height: window.innerHeight, keyboardInset: 0 });
        return;
      }
      const inset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setState({ height: vv.height, keyboardInset: inset > 80 ? inset : 0 });
    };

    update();
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return state;
}
