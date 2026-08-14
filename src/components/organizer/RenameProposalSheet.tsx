/**
 * Feuille de renommage intelligent — éditable ligne par ligne.
 *
 * Chaque proposition peut être : décochée, éditée, ou validée telle
 * quelle. Aucun renommage n'a lieu sans confirmation via le bouton
 * principal.
 */
import { useState } from "react";
import { PencilLine, RefreshCw } from "lucide-react";
import { BottomSheet, PrimaryButton } from "@/components/files/BottomSheet";
import type { RenameProposal } from "@/lib/organizer";
import { useT } from "@/lib/i18n";

export function RenameProposalSheet({
  open,
  proposals,
  onClose,
  onApply,
}: {
  open: boolean;
  proposals: RenameProposal[];
  onClose: () => void;
  onApply: (accepted: RenameProposal[]) => void;
}) {
  const [state, setState] = useState<RenameProposal[]>(proposals);
  const t = useT();

  // Sync when proposals change (open toggles).
  if (open && state !== proposals && state.length === 0) {
    // Only reset the first time — user edits should persist while open.
  }

  const toggle = (i: number) =>
    setState((s) => s.map((p, idx) => (idx === i ? { ...p, selected: !p.selected } : p)));
  const edit = (i: number, val: string) =>
    setState((s) => s.map((p, idx) => (idx === i ? { ...p, edited: val } : p)));

  const active = state.filter((p) => p.selected).length;
  const list = state.length > 0 ? state : proposals;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("organize.rename.planTitle")}
      footer={
        <>
          <PrimaryButton variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </PrimaryButton>
          <PrimaryButton
            disabled={active === 0}
            onClick={() =>
              onApply(
                list
                  .filter((p) => p.selected)
                  .map((p) => ({ ...p, proposed: (p.edited ?? p.proposed).trim() || p.proposed })),
              )
            }
          >
            {t("organize.rename.applyCount", { count: active })}
          </PrimaryButton>
        </>
      }
    >
      <p className="mb-2 text-[12px] text-muted-foreground">{t("organize.rename.hint")}</p>
      <div className="max-h-[52vh] space-y-2 overflow-y-auto">
        {list.map((p, i) => (
          <div key={p.entryName + i} className="rounded-xl border border-border p-3">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={p.selected}
                onChange={() => toggle(i)}
                className="mt-1.5"
                aria-label={t("organize.rename.checkboxAria", { name: p.entryName })}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] text-muted-foreground line-through">
                  {p.entryName}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <PencilLine className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <input
                    type="text"
                    value={p.edited ?? p.proposed}
                    onChange={(e) => edit(i, e.target.value)}
                    autoCorrect="on"
                    autoCapitalize="sentences"
                    spellCheck
                    inputMode="text"
                    className="h-8 w-full rounded-lg border border-border bg-surface px-2 text-[12px] focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => edit(i, p.proposed)}
                    aria-label={t("organize.rename.resetAria")}
                    className="rounded-lg border border-border bg-surface p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{p.reason}</p>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-[12px] text-muted-foreground">
            {t("organize.rename.empty")}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
