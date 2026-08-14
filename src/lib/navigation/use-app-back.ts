/**
 * Point d'entrée UNIQUE du retour dans GeniusFiles.
 *
 * Le bouton Retour Android, le geste système et tous les boutons Retour de
 * l'interface appellent exactement la même fonction : `resolveBack()`.
 * Aucun écran ne décide plus lui-même de « remonter à l'accueil ».
 *
 * Ordre appliqué (identique à une application Android native) :
 *   1. handlers enregistrés (dialogue, menu, panneau, mode sélection,
 *      recherche ouverte, dossier courant…) ;
 *   2. écran précédent réel de la pile ;
 *   3. accueil (ou arrivée par lien profond) → confirmation de sortie.
 */
import { useCallback } from "react";
import { useRouter, useRouterState, type AnyRouter } from "@tanstack/react-router";
import { canGoBackInApp, runRegisteredBackHandlers } from "@/lib/navigation/back-stack";

/** Demande de sortie de l'application (accueil + pile vide). */
export const EXIT_REQUEST_EVENT = "gf:exit-request";

export function requestAppExit(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EXIT_REQUEST_EVENT));
}

/**
 * Pages atteignables directement depuis la barre de navigation
 * principale. Depuis l'une d'elles, le retour ramène TOUJOURS à
 * l'accueil (en une seule fois) : l'utilisateur ne reparcourt jamais
 * l'historique complet des écrans déjà visités.
 */
const MAIN_NAV_PAGES = ["/assistant", "/automatisations", "/parametres"];

function isMainNavPage(pathname: string): boolean {
  return MAIN_NAV_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function resolveBack(router: AnyRouter, pathname: string): void {
  // 1. Surfaces internes de la page (priorité décroissante) : lecteur
  //    ouvert, dialogue, menu, mode sélection, dossier courant…
  if (runRegisteredBackHandlers()) return;

  // 2. Accueil : plus rien à refermer, plus rien à remonter → sortie.
  //    On ne redéroule JAMAIS l'historique depuis l'accueil, sinon un
  //    retour renverrait dans les écrans déjà quittés.
  if (pathname === "/") {
    requestAppExit();
    return;
  }

  // 3. Page principale de la navigation (Genius Ai, Automatisations,
  //    Paramètres) : retour direct à l'accueil, en un seul appui, sans
  //    dérouler l'historique écran par écran.
  if (isMainNavPage(pathname)) {
    router.navigate({ to: "/", replace: true });
    return;
  }

  // 4. Écran secondaire : écran précédent réel de la pile.
  if (canGoBackInApp()) {
    router.history.back();
    return;
  }

  // 5. Lien profond hors accueil : l'accueil devient le parent logique.
  router.navigate({ to: "/", replace: true });
}

/**
 * Hook à utiliser pour TOUT bouton Retour de l'interface, afin qu'il se
 * comporte exactement comme le retour système.
 */
export function useAppBack(): () => void {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return useCallback(() => resolveBack(router, pathname), [router, pathname]);
}
