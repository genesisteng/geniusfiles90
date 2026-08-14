/**
 * Mémoire d'écran (session).
 *
 * Permet à une page de retrouver son état exact lorsqu'on y revient :
 * dossier ouvert, position de défilement, onglet actif… La portée est la
 * session applicative (effacée à la fermeture), ce qui correspond au
 * comportement d'une back stack Android.
 */
const PREFIX = "gf.screen.";

export function saveScreenState<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : la page repart simplement de zéro */
  }
}

export function loadScreenState<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearScreenState(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
