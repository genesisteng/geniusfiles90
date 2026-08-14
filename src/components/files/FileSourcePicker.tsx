/**
 * Déclencheur de sélection de fichiers / dossiers.
 *
 * Ce composant n'affiche AUCUNE interface : il ouvre une *session de
 * sélection* qui présente l'interface officielle de GeniusFiles (accueil,
 * stockages, catégories, dossiers, fichiers récents, recherche, tri) par
 * dessus la fonctionnalité appelante. Celle-ci reste montée, conserve son
 * contexte, et reçoit les éléments réellement choisis à la validation.
 *
 * L'API publique est inchangée : tous les appelants (outils PDF,
 * automatisations, coffre-fort, transfert, éditeur audio) fonctionnent
 * sans modification.
 */
import { useEffect, useRef } from "react";

import type { FileEntry } from "@/lib/files/types";
import {
  cancelPick,
  requestPick,
  type PickAccept,
  type PickedDetail,
} from "@/lib/files/pick-session";

export type { PickAccept, PickedDetail };

export function FileSourcePicker({
  open,
  title,
  extensions,
  multi,
  accept = "files",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** Message affiché en tête du mode sélection (« Sélectionnez les PDF… »). */
  title?: string;
  /** Extensions minuscules sans point, ex. ["pdf"]. */
  extensions: string[];
  multi: boolean;
  /** Types acceptés par la fonctionnalité appelante (défaut : fichiers). */
  accept?: PickAccept;
  /** @deprecated la sélection d'applications n'existe plus. */
  apps?: boolean;
  onCancel: () => void;
  onConfirm: (paths: string[], entries: FileEntry[], details: PickedDetail[]) => void;
}) {
  const started = useRef(false);
  const callbacks = useRef({ onCancel, onConfirm });
  useEffect(() => {
    callbacks.current = { onCancel, onConfirm };
  }, [onCancel, onConfirm]);

  const extKey = extensions.join(",");
  useEffect(() => {
    if (!open) {
      if (started.current) {
        started.current = false;
        cancelPick();
      }
      return;
    }
    if (started.current) return;
    started.current = true;
    void requestPick({
      accept,
      multi,
      title,
      extensions: extKey ? extKey.split(",") : [],
    }).then((result) => {
      started.current = false;
      if (!result) {
        callbacks.current.onCancel();
        return;
      }
      callbacks.current.onConfirm(
        result.map((d) => d.absolutePath),
        result.map((d) => d.entry),
        result,
      );
    });
    /* `title` figure dans les dépendances par correction : la garde
       `started` empêche toute relance de la session en cours. */
  }, [open, accept, multi, extKey, title]);

  return null;
}
