/**
 * Barre d'état Android synchronisée avec l'interface des lecteurs.
 *
 * Quand la chrome d'un lecteur (image / vidéo) est masquée, le média doit
 * occuper réellement tout l'écran : la barre d'état est retirée. Dès que
 * la chrome revient, la barre réapparaît afin que l'heure, la batterie et
 * les commandes restent lisibles au-dessus d'un fond opaque.
 *
 * Tous les appels natifs sont dynamiques : no-op sur le web / SSR.
 */

let depth = 0;

async function apply(hidden: boolean): Promise<void> {
  try {
    const { StatusBar } = await import("@capacitor/status-bar");
    if (hidden) await StatusBar.hide();
    else await StatusBar.show();
  } catch {
    /* plugin indisponible (web) */
  }
}

/** Masque ou réaffiche la barre d'état système. */
export function setStatusBarHidden(hidden: boolean): void {
  if (typeof window === "undefined") return;
  void apply(hidden);
}

/**
 * Réservation d'un lecteur plein écran : garantit que la barre d'état est
 * restaurée dès que le dernier lecteur se ferme.
 */
export function acquireImmersive(): () => void {
  if (typeof window === "undefined") return () => {};
  depth += 1;
  return () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) setStatusBarHidden(false);
  };
}
