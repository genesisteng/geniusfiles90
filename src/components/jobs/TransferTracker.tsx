/**
 * TransferTracker — suivi des transferts *sans interface*.
 *
 * L'ancienne bannière interne (« Copie — 2 éléments / Terminé ») a été
 * supprimée : elle doublonnait la notification Android du service de
 * transfert et encombrait le bas de chaque écran.
 *
 * Ce composant conserve la seule partie réellement nécessaire : la
 * réadoption des tâches encore vivantes dans le service natif au retour
 * dans l'application. Le moteur (`lib/transfers/manager`) continue donc de
 * connaître l'état, la progression, les erreurs et la fin de chaque
 * opération, y compris en parallèle, et les écrans qui le souhaitent
 * peuvent toujours s'y abonner via `useTransferTasks()`.
 *
 * Aucun rendu → aucun coût de layout, aucun repaint, aucun doublon d'UI.
 */
import { useEffect } from "react";
import { adoptNativeTransfers } from "@/lib/transfers/manager";

export function TransferTracker() {
  useEffect(() => {
    void adoptNativeTransfers();
    const onVisible = () => {
      if (document.visibilityState === "visible") void adoptNativeTransfers();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}
