/**
 * Barre de validation d'une session de sélection.
 *
 * Aucune action de gestion (copier, déplacer, renommer, supprimer,
 * partager) n'est proposée : pendant un parcours de sélection, seules
 * « Annuler » et « Valider » existent. Le bouton « Valider » reste lié à
 * l'action qui a déclenché la sélection.
 */
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Portal } from "@/components/common/Portal";
import { useT } from "@/lib/i18n";
import { cancelPick, confirmPick, pickAccepts, type PickRequest } from "@/lib/files/pick-session";
import { selectionEntries, useSelection } from "@/lib/files/selection-store";
import { useReaderMode } from "@/lib/viewer/reader-mode";

export function PickBar({ request }: { request: PickRequest }) {
  const t = useT();
  const selection = useSelection();
  /* Une prévisualisation plein écran ouverte depuis la sélection doit
     rester entièrement visible : la barre de validation s'efface tant que
     le lecteur est affiché, puis revient à sa fermeture. */
  const reader = useReaderMode();
  const eligible = selectionEntries(selection).filter((e) => pickAccepts(e, request));
  const count = eligible.length;

  const validate = () => {
    if (count === 0) {
      toast.info(t("files.pickBar.noneEligible"));
      return;
    }
    confirmPick();
  };

  return (
    <>
      <div aria-hidden className="h-24 w-full shrink-0" />
      {reader ? null : (
        <Portal>
          <nav
            className="fixed inset-x-0 z-[3600] mx-auto max-w-[560px] px-3 pl-safe pr-safe"
            aria-label={t("files.pickBar.aria")}
            style={{
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
              animation: "gf-bar-in-bottom 220ms cubic-bezier(0.2, 0, 0, 1) both",
            }}
          >
            <div className="flex items-center gap-2 rounded-[22px] border border-border bg-surface px-3 py-2.5 shadow-elevated">
              <button
                type="button"
                onClick={cancelPick}
                className="flex h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-colors active:bg-secondary/60"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={2.1} />
                {t("action.cancel")}
              </button>
              <span className="min-w-0 flex-1 truncate px-1 text-[12.5px] font-medium text-muted-foreground">
                {count === 0
                  ? request.multi
                    ? t("files.pickBar.selectItems")
                    : t("files.pickBar.tapItem")
                  : t("files.pickBar.selectedCount", { count })}
              </span>
              <button
                type="button"
                onClick={validate}
                disabled={count === 0}
                className="flex h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-[13.5px] font-semibold text-primary-foreground shadow-sm transition-opacity disabled:opacity-40"
              >
                <Check className="h-[18px] w-[18px]" strokeWidth={2.4} />
                {count > 0 && request.multi
                  ? t("files.pickBar.validateCount", { count })
                  : t("files.pickBar.validate")}
              </button>
            </div>
          </nav>
        </Portal>
      )}
    </>
  );
}
