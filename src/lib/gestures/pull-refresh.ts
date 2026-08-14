/**
 * Registre du geste « tirer pour actualiser ».
 *
 * Une seule page est visible à la fois : elle déclare son action
 * d'actualisation, le contrôleur global (ScrollFeel) l'exécute quand le
 * geste franchit le seuil. Les pages statiques n'enregistrent rien : le
 * geste se limite alors à une très légère résistance de bord.
 */
import { useEffect, useRef } from "react";

export type RefreshHandler = () => void | Promise<void>;

let current: RefreshHandler | null = null;

export function getRefreshHandler(): RefreshHandler | null {
  return current;
}

/**
 * Enregistre l'action d'actualisation de la page montée.
 * `enabled` permet de la désactiver temporairement (verrou, plein écran…).
 */
export function usePullToRefresh(handler: RefreshHandler, enabled = true): void {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const fn: RefreshHandler = () => ref.current();
    current = fn;
    return () => {
      if (current === fn) current = null;
    };
  }, [enabled]);
}
