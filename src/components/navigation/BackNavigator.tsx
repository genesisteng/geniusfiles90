/**
 * Contrôleur unique du retour Android (bouton physique + geste système).
 *
 * Il applique la même logique que le bouton Retour de l'interface :
 * fermer d'abord ce qui est superposé, puis remonter d'un écran réel,
 * et seulement sur l'accueil proposer de quitter l'application.
 */
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EXIT_REQUEST_EVENT, useAppBack } from "@/lib/navigation/use-app-back";
import { useT } from "@/lib/i18n";

export function BackNavigator() {
  const t = useT();
  const [exitOpen, setExitOpen] = useState(false);
  const handleBack = useAppBack();

  // La demande de sortie peut venir du retour système comme d'un bouton
  // Retour de l'interface : une seule boîte de dialogue pour les deux.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onExit = () => setExitOpen(true);
    window.addEventListener(EXIT_REQUEST_EVENT, onExit);
    return () => window.removeEventListener(EXIT_REQUEST_EVENT, onExit);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let remove: (() => void) | null = null;
    let cancelled = false;
    import("@capacitor/app")
      .then(({ App }) => {
        if (cancelled) return;
        const handle = App.addListener("backButton", () => handleBack());
        remove = () => {
          Promise.resolve(handle).then((h) => h?.remove?.());
        };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [handleBack]);

  const quit = useCallback(() => {
    setExitOpen(false);
    import("@capacitor/app").then(({ App }) => App.exitApp?.()).catch(() => {});
  }, []);

  return (
    <ConfirmDialog
      open={exitOpen}
      copy={{
        title: t("home.exit.title"),
        description: t("home.exit.description"),
        confirmLabel: t("home.exit.confirm"),
      }}
      onCancel={() => setExitOpen(false)}
      onConfirm={quit}
    />
  );
}
