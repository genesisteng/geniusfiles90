/**
 * Hôte du « Ouvrir avec… » entrant.
 *
 * Monté une seule fois dans l'AppShell. Quand une autre application
 * Android confie un fichier à GeniusFiles, il est résolu par le pont
 * natif puis affiché dans la visionneuse universelle — exactement comme
 * un fichier ouvert depuis l'explorateur.
 *
 * Fermeture :
 *  - lancement à froid par l'intent → retour à l'application appelante ;
 *  - fichier reçu alors que GeniusFiles tournait déjà → simple fermeture.
 * Dans les deux cas, la copie de travail éventuelle est purgée.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { UniversalViewer, type ViewerAction } from "./UniversalViewer";
import {
  clearIncomingTemp,
  consumeIncomingFile,
  finishToCaller,
  onIncomingFile,
  type IncomingFile,
} from "@/lib/native/incoming-file";
import { openWithSystem } from "@/lib/viewer/openWith";
import { useT } from "@/lib/i18n/react";

export function IncomingFileHost() {
  const t = useT();
  const [file, setFile] = useState<IncomingFile | null>(null);
  /* Vrai uniquement quand l'intent a démarré l'application : la
     fermeture doit alors rendre la main à l'appelant. */
  const coldStart = useRef(false);
  const mountedAt = useRef(Date.now());

  const pull = useCallback(async () => {
    const incoming = await consumeIncomingFile();
    if (!incoming) return;
    coldStart.current = Date.now() - mountedAt.current < 2000;
    setFile(incoming);
  }, []);

  useEffect(() => {
    void clearIncomingTemp().then(() => pull());
    return onIncomingFile(() => void pull());
  }, [pull]);

  const close = useCallback(() => {
    const wasCold = coldStart.current;
    setFile(null);
    void clearIncomingTemp();
    if (wasCold) void finishToCaller();
  }, []);

  const onAction = useCallback(
    (entry: NonNullable<IncomingFile>["entry"], a: ViewerAction) => {
      if (!file) return;
      if (a === "openWith" || a === "share") {
        void openWithSystem(file.parent, entry, a === "share" ? "send" : "view");
        return;
      }
      /* Le fichier reçu n'appartient pas à l'arborescence de
         l'utilisateur : renommer / déplacer / supprimer n'aurait pas de
         sens ici, on l'annonce plutôt que de faire semblant. */
      toast.info(t("system.native.openedFromOtherApp"));
    },
    [file, t],
  );

  if (!file) return null;
  return (
    <UniversalViewer
      open
      parent={file.parent}
      entries={[file.entry]}
      index={0}
      onIndexChange={() => {}}
      onClose={close}
      onAction={onAction}
    />
  );
}
