/**
 * Coordinateur de démarrage de GeniusFiles.
 *
 * Objectif : le splash officiel est le masque visuel de TOUTE la phase
 * d'initialisation. Il ne se retire que lorsque la première page est
 * réellement construite — jamais avant, jamais après un délai artificiel.
 *
 * Trois garde-fous :
 *  1. des signaux explicites (`markStartupSignal`) émis par les modules
 *     réellement indispensables au premier écran ;
 *  2. un plafond dur (`HARD_CAP_MS`) : sur un appareil lent ou si un
 *     signal manque, l'application s'ouvre quand même — le splash ne
 *     ralentit jamais l'utilisateur ;
 *  3. aucun minimum imposé ici : si tout est prêt en 200 ms, l'accueil
 *     s'affiche en 200 ms (l'anti-scintillement vit dans le composant).
 *
 * Module 100 % isomorphe : aucun accès DOM au chargement.
 */

/** Signaux attendus avant de considérer le démarrage terminé. */
const REQUIRED_SIGNALS = ["personalization", "first-screen"] as const;

export type StartupSignal = (typeof REQUIRED_SIGNALS)[number];

/**
 * Plafond dur : au-delà, on ouvre l'application quoi qu'il arrive.
 *
 * Abaissé à 900 ms : les deux signaux attendus arrivent en pratique bien
 * avant (thème persisté appliqué de façon synchrone, premier écran peint
 * dès que les stockages sont connus). Sur un appareil lent ou si un signal
 * manque, l'accueil s'ouvre donc plus tôt — jamais plus tard.
 */
const HARD_CAP_MS = 900;

const received = new Set<StartupSignal>();
const listeners = new Set<() => void>();
let ready = false;
let capArmed = false;

let capTimer: number | null = null;

function armCap() {
  if (capArmed || typeof window === "undefined") return;
  capArmed = true;
  capTimer = window.setTimeout(() => finish(), HARD_CAP_MS);
}

function finish() {
  if (ready) return;
  ready = true;
  // Appareil rapide : on libère le minuteur de secours au lieu de laisser
  // le fil principal se réveiller pour rien 900 ms plus tard.
  if (capTimer != null && typeof window !== "undefined") {
    window.clearTimeout(capTimer);
    capTimer = null;
  }
  for (const l of Array.from(listeners)) l();
}

/** Déclare qu'une étape d'initialisation est terminée. Idempotent. */
export function markStartupSignal(signal: StartupSignal): void {
  if (ready) return;
  armCap();
  received.add(signal);
  if (REQUIRED_SIGNALS.every((s) => received.has(s))) finish();
}

/** Vrai dès que l'initialisation est terminée (ou le plafond atteint). */
export function isStartupReady(): boolean {
  return ready;
}

/** S'abonne à la fin du démarrage. Rappelle immédiatement si déjà prêt. */
export function onStartupReady(cb: () => void): () => void {
  if (ready) {
    cb();
    return () => {};
  }
  armCap();
  listeners.add(cb);
  return () => listeners.delete(cb);
}
