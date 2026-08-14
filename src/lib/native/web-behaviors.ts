/**
 * Supprime les comportements hérités du navigateur qui trahissent une
 * WebView : menu contextuel de sélection de texte au long-press, poignées
 * de sélection, drag d'images/liens, double-tap zoom, pull-to-refresh.
 *
 * Les vrais champs de saisie (input / textarea / contenteditable) gardent
 * un comportement 100 % normal : sélection, curseur, copier/coller.
 */

const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true']";
const SELECTABLE = "[data-gf-selectable='true'], [data-gf-reader='true']";

function isEditable(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  return !!el.closest(EDITABLE) || !!el.closest(SELECTABLE);
}

/** Installe les gardes globaux. Retourne une fonction de désinstallation. */
export function installNativeBehaviors(): () => void {
  if (typeof document === "undefined") return () => {};

  /* Dernier point de contact : Android émet parfois `selectstart` avec
     pour cible le document plutôt que le nœud texte touché. On se réfère
     alors à l'élément réellement pressé. */
  let lastTouchedSelectable = false;
  const onPointerDown = (e: Event) => {
    lastTouchedSelectable = isEditable(e.target);
  };

  const onContextMenu = (e: Event) => {
    // Le menu contextuel du navigateur ne doit jamais apparaître, sauf
    // dans un champ de saisie ou un document, où il sert au copier/partager.
    if (isEditable(e.target) || lastTouchedSelectable) return;
    e.preventDefault();
  };

  const onSelectStart = (e: Event) => {
    if (isEditable(e.target) || lastTouchedSelectable) return;
    e.preventDefault();
  };

  const onDragStart = (e: Event) => {
    if (isEditable(e.target) || lastTouchedSelectable) return;
    e.preventDefault();
  };

  // Double-tap zoom : Android l'active encore malgré maximum-scale sur
  // certaines WebViews. On neutralise le second tap rapproché.
  let lastTouchEnd = 0;
  const onTouchEnd = (e: TouchEvent) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300 && !isEditable(e.target) && !lastTouchedSelectable)
      e.preventDefault();
    lastTouchEnd = now;
  };

  // Pinch-zoom / gestes de zoom du navigateur.
  const onGesture = (e: Event) => e.preventDefault();

  document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
  document.addEventListener("contextmenu", onContextMenu, { capture: true });
  document.addEventListener("selectstart", onSelectStart, { capture: true });
  document.addEventListener("dragstart", onDragStart, { capture: true });
  document.addEventListener("touchend", onTouchEnd, { capture: false, passive: false });
  document.addEventListener("gesturestart", onGesture as EventListener);
  document.addEventListener("gesturechange", onGesture as EventListener);

  return () => {
    document.removeEventListener("pointerdown", onPointerDown, { capture: true });
    document.removeEventListener("contextmenu", onContextMenu, { capture: true });

    document.removeEventListener("selectstart", onSelectStart, { capture: true });
    document.removeEventListener("dragstart", onDragStart, { capture: true });
    document.removeEventListener("touchend", onTouchEnd);
    document.removeEventListener("gesturestart", onGesture as EventListener);
    document.removeEventListener("gesturechange", onGesture as EventListener);
  };
}
