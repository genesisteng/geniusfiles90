/**
 * Contexte et hook partagés des panneaux de l'éditeur photo.
 *
 * Séparés de `EditorPanels.tsx` pour que ce fichier n'exporte que des
 * composants (rechargement à chaud). Comportement inchangé.
 */
import { createContext, useEffect, useRef, useState } from "react";

/**
 * Every continuous control reports the end of an interaction here so the
 * editor shell can turn it into a single, undoable history step.
 */
export const CommitContext = createContext<() => void>(() => {});

/** Small helper so panels can measure their own height for the stage inset. */
export function usePanelHeight() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    setHeight(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);
  return { ref, height };
}
