/**
 * Pile de navigation unifiée (Android Back / geste de retour / bouton
 * Retour de l'interface).
 *
 * Un seul point d'entrée : `resolveBack()`. Toutes les surfaces qui
 * doivent « absorber » un retour (mode sélection, recherche ouverte,
 * contrôles d'un lecteur, dossier courant…) s'enregistrent via
 * `useBackHandler`. Le contrôleur applique l'ordre Android natif :
 *
 *   1. handlers enregistrés (priorité décroissante, puis LIFO) :
 *      dialogues, menus, panneaux, mode sélection, recherche, dossier
 *      courant, contrôles d'un lecteur… ;
 *   2. écran précédent réel de la pile applicative ;
 *   3. page d'accueil → confirmation de sortie.
 *
 * Aucune redirection arbitraire vers l'accueil : si un écran précédent
 * existe, c'est lui qui est restauré.
 */
import { useEffect, useRef } from "react";

export type BackHandler = () => boolean;

export const BACK_PRIORITY = {
  /** Surfaces temporaires rendues en overlay (menus, panneaux). */
  overlay: 300,
  /** Mode sélection, recherche ouverte… */
  mode: 200,
  /** Navigation interne à une page (dossier courant, onglet…). */
  page: 100,
} as const;

type Registration = { fn: () => boolean; priority: number; seq: number };

const registry: Registration[] = [];
let seqCounter = 0;

export function registerBackHandler(
  fn: () => boolean,
  priority: number = BACK_PRIORITY.page,
): () => void {
  const reg: Registration = { fn, priority, seq: ++seqCounter };
  registry.push(reg);
  return () => {
    const i = registry.indexOf(reg);
    if (i >= 0) registry.splice(i, 1);
  };
}

/** Exécute le handler le plus prioritaire ; `true` si le retour est absorbé. */
export function runRegisteredBackHandlers(): boolean {
  const ordered = [...registry].sort((a, b) => b.priority - a.priority || b.seq - a.seq);
  for (const reg of ordered) {
    try {
      if (reg.fn()) return true;
    } catch {
      /* un handler défaillant ne doit jamais bloquer la navigation */
    }
  }
  return false;
}

/**
 * Enregistre un handler de retour tant que `enabled` est vrai.
 * La fonction est conservée dans une ref : aucun ré-enregistrement à
 * chaque rendu, donc aucun coût sur le scroll ni sur les listes.
 */
export function useBackHandler(
  enabled: boolean,
  fn: () => boolean,
  priority: number = BACK_PRIORITY.page,
) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);
  useEffect(() => {
    if (!enabled) return;
    return registerBackHandler(() => ref.current(), priority);
  }, [enabled, priority]);
}

/* --------------------------------------------------------------------- */
/* Profondeur réelle de la pile applicative                               */
/* --------------------------------------------------------------------- */

/**
 * Profondeur réelle lue dans l'état d'historique du routeur
 * (`__TSR_index`). C'est la seule source de vérité fiable : elle survit
 * à une rotation d'écran, à un rechargement du WebView et à un retour
 * depuis l'arrière-plan, contrairement à un compteur en mémoire qui
 * repartait de zéro et renvoyait l'utilisateur à l'accueil.
 */
export function backStackIndex(): number {
  if (typeof window === "undefined") return 0;
  const state = window.history.state as { __TSR_index?: number } | null | undefined;
  const index = state?.__TSR_index;
  return typeof index === "number" && index > 0 ? index : 0;
}

/** Vrai lorsqu'un écran précédent appartenant à l'app existe réellement. */
export function canGoBackInApp(): boolean {
  return backStackIndex() > 0;
}
