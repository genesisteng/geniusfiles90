/**
 * Contexte « je suis dans une session de sélection ».
 *
 * Les écrans officiels de GeniusFiles sont réutilisés tels quels pendant
 * une sélection : l'AppShell doit alors éviter de remonter une deuxième
 * navigation principale, un deuxième lecteur, etc.
 */
import { createContext, useContext } from "react";

const PickLayerContext = createContext(false);

export const PickLayerProvider = PickLayerContext.Provider;

export function useInPickLayer(): boolean {
  return useContext(PickLayerContext);
}
