/**
 * Conservation de la position de défilement des listes de GeniusFiles.
 *
 * Comportement unique pour le gestionnaire de fichiers, les stockages, les
 * catégories et les listes de fichiers :
 *
 * - la position de la liste affichée est mémorisée en continu ;
 * - en ouvrant un élément (dossier, album, catégorie…), la position de la
 *   liste quittée est conservée ;
 * - au retour, elle est restituée AVANT le premier rendu peint — aucun
 *   saut visible, aucune animation, aucun rechargement ;
 * - la position est ensuite oubliée : on ne restaure jamais la position
 *   d'un dossier visité plus tôt dans la session.
 */
import { useEffect, useLayoutEffect, useRef } from "react";

import { saveScrollFor, takeScrollFor } from "./scroll-memory";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * @param key   Identifiant de la liste affichée (dossier, catégorie…).
 * @param ready `true` dès que la liste a son contenu : la restauration
 *              n'a de sens qu'à ce moment-là.
 */
export function useListScrollMemory(key: string, ready: boolean): void {
  const restoredFor = useRef<string | null>(null);

  // Mémorisation continue + sauvegarde au moment de quitter la liste.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => saveScrollFor(key, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      saveScrollFor(key, window.scrollY);
      window.removeEventListener("scroll", onScroll);
    };
  }, [key]);

  // Restauration synchrone, avant peinture : rien ne clignote.
  useIsoLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!ready || restoredFor.current === key) return;
    restoredFor.current = key;
    const y = takeScrollFor(key);
    if (y <= 0) return;
    window.scrollTo({ top: y, behavior: "auto" });
    /* Listes virtualisées : la hauteur totale peut n'être connue qu'à la
       frame suivante. On réapplique une seule fois, toujours sans
       animation, si la position n'a pas pu être atteinte. */
    const frame = requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - y) > 2) window.scrollTo({ top: y, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [key, ready]);
}
