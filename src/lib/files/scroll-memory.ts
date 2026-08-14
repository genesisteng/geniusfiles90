/**
 * Mémoire de retour : position de la liste que l'on vient de quitter.
 *
 * Règle volontairement simple — seule la position nécessaire au RETOUR est
 * conservée, puis consommée. Ouvrir un dossier ou une liste part donc
 * toujours du haut ; revenir en arrière restitue instantanément la position
 * exacte d'avant l'ouverture, sans rechargement, clignotement ni animation.
 *
 * Le cache reste minuscule (quelques niveaux de profondeur) : aucune
 * accumulation de positions de pages ou de dossiers déjà visités.
 */
const MAX_ENTRIES = 12;
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

/** Lit ET oublie : la position ne sert qu'au retour immédiat. */
export function takeScrollFor(key: string): number {
  const y = positions.get(key) ?? 0;
  positions.delete(key);
  return y;
}

export function forgetScrollFor(key: string): void {
  positions.delete(key);
}
