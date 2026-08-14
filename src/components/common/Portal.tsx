import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Rend ses enfants directement dans <body>.
 *
 * Indispensable pour toute surface `position: fixed` (dialogues, bottom
 * sheets, menus, barres du mode sélection) : un ancêtre avec `transform`,
 * `filter`, `backdrop-filter` ou `contain` transforme un élément `fixed`
 * en élément relatif à cet ancêtre — le voile s'affiche alors décalé ou
 * hors écran pendant que le panneau devient invisible.
 *
 * SSR-safe : rien n'est rendu tant que le document n'existe pas.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  if (!host) return null;
  return createPortal(children, host);
}
