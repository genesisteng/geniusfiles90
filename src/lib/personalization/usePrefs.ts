/**
 * Hook `usePrefs` — lecture réactive des préférences.
 *
 * Retourne un tuple `[prefs, setPrefs]` où `setPrefs` reçoit un patch
 * partiel ou un updater. Chaque écriture invalide toutes les vues
 * abonnées via l'événement `gf:prefs-changed`.
 */
import { useCallback, useEffect, useState } from "react";
import { loadPrefs, savePrefs, subscribePrefs, updatePrefs } from "./store";
import { DEFAULT_PREFS, type PersonalizationPrefs } from "./types";

export function usePrefs(): [
  PersonalizationPrefs,
  (
    patch: Partial<PersonalizationPrefs> | ((prev: PersonalizationPrefs) => PersonalizationPrefs),
  ) => void,
] {
  // Le premier rendu client doit être identique au SSR. Le thème visuel est
  // déjà posé avant paint par le bootstrap ; les contrôles adoptent ensuite
  // les préférences persistées dès le montage.
  const [prefs, setState] = useState<PersonalizationPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    setState(loadPrefs());
    return subscribePrefs(setState);
  }, []);
  const set = useCallback(
    (
      patch: Partial<PersonalizationPrefs> | ((prev: PersonalizationPrefs) => PersonalizationPrefs),
    ) => {
      if (typeof patch === "function") {
        updatePrefs(patch);
      } else {
        const cur = loadPrefs();
        savePrefs({ ...cur, ...patch });
      }
    },
    [],
  );
  return [prefs, set];
}
