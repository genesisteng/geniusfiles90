/**
 * Ordonnanceur des opérations de stockage.
 *
 * Objectifs (cf. exigences « gros volumes » et « plusieurs opérations ») :
 * - jamais un nombre illimité de tâches lourdes en parallèle : deux au
 *   maximum, les suivantes attendent leur tour (CPU, RAM, batterie) ;
 * - isolation : une opération qui échoue ne peut pas corrompre l'état
 *   d'une autre, chaque tâche possède sa propre progression ;
 * - respiration : `tick()` rend la main à la boucle d'événements entre
 *   les lots afin que le fil principal ne soit jamais bloqué (pas d'ANR,
 *   défilement fluide pendant une suppression de 50 000 fichiers).
 */

const MAX_CONCURRENT = 2;

let running = 0;
const waiting: (() => void)[] = [];

function release() {
  running--;
  const next = waiting.shift();
  if (next) next();
}

async function acquire(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running++;
    return;
  }
  await new Promise<void>((resolve) => {
    waiting.push(() => {
      running++;
      resolve();
    });
  });
}

/** Exécute `fn` en respectant la limite globale de concurrence. */
export async function runQueued<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

/** Nombre d'opérations lourdes actuellement en cours. */
export function activeOperations(): number {
  return running;
}

/**
 * Rend la main au navigateur. Appelé entre les lots d'une boucle longue :
 * l'interface continue de peindre, de défiler et de répondre.
 */
export function tick(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined") {
      setTimeout(resolve, 0);
      return;
    }
    // `setTimeout(0)` laisse passer un frame de rendu, contrairement à
    // une micro-tâche qui garderait le fil monopolisé.
    window.setTimeout(resolve, 0);
  });
}

/**
 * Découpe une liste en lots de taille `size`.
 * Aucun tableau intermédiaire géant n'est matérialisé.
 */
export function* chunks<T>(items: readonly T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) {
    yield items.slice(i, i + size);
  }
}
