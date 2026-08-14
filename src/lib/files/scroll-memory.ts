/**
 * Mémoire de défilement par dossier.
 *
 * Chaque niveau de navigation conserve sa propre position : revenir d'un
 * sous-dossier restaure instantanément la position exacte (pas d'animation,
 * pas de saut), y compris après plusieurs niveaux d'exploration.
 *
 * La liste est virtualisée sur la fenêtre : mémoriser `window.scrollY` suffit
 * et coûte zéro mémoire par ligne. Le cache est borné pour éviter toute fuite.
 */
const MAX_ENTRIES = 200;
const positions = new Map<string, number>();

export function saveScrollFor(key: string, y: number): void {
  if (!key) return;
  positions.delete(key);
  positions.set(key, y);
  if (positions.size > MAX_ENTRIES) {
    const oldest = positions.keys().next().value;
    if (oldest !== undefined) positions.delete(oldest);
  }
}

export function readScrollFor(key: string): number {
  return positions.get(key) ?? 0;
}

export function forgetScrollFor(key: string): void {
  positions.delete(key);
}
