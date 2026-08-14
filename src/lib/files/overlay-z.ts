/**
 * Superpositions plein écran pendant une session de sélection.
 *
 * Le mode sélection (`PickLayer`) s'affiche à `z-[3500]`. Les lecteurs
 * (image, vidéo, audio) sont montés au niveau du <body> à `z-[2000]` :
 * sans élévation, une prévisualisation lancée depuis la sélection
 * resterait invisible DERRIÈRE la couche de sélection. Ce hook renvoie la
 * classe de profondeur adaptée au contexte.
 */
import { usePickRequest } from "@/lib/files/pick-session";

export function useOverlayZClass(base = "z-[2000]"): string {
  const pick = usePickRequest();
  // Au-dessus de la couche de sélection (3500), de sa barre de
  // validation (3600) et de ses feuilles (3800).
  return pick ? "z-[3900]" : base;
}
