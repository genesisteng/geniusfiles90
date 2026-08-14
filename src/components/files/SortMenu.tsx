/**
 * Bloc de tri unifié de GeniusFiles.
 *
 * Un seul composant sert le gestionnaire de fichiers, les stockages, les
 * catégories (images, musiques, vidéos, documents…) et toutes les listes
 * qui trient : même apparence, même comportement, partout.
 *
 * Comportement :
 *  - fond totalement opaque (jamais de liste visible derrière) ;
 *  - les choix sont provisoires : la liste n'est pas retriée pendant la
 *    sélection, le bloc reste ouvert ;
 *  - « OK » valide et applique le tri immédiatement ;
 *  - un toucher à l'extérieur ferme le bloc sans rien appliquer.
 *
 * Aucune action « Sélectionner » ni « Actualiser » n'y figure.
 */
import { useEffect, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Check } from "lucide-react";
import type { SortKey, SortOrder } from "@/lib/files/types";
import { useT } from "@/lib/i18n";

export function useSortLabels(): Record<SortKey, string> {
  const t = useT();
  return {
    name: t("files.sort.name"),
    date: t("files.sort.date"),
    size: t("files.sort.size"),
    type: t("files.sort.type"),
  };
}

export function SortMenu({
  sortKey,
  sortOrder,
  onApply,
  foldersFirst,
  onFoldersFirstChange,
  className = "",
}: {
  sortKey: SortKey;
  sortOrder: SortOrder;
  onApply: (key: SortKey, order: SortOrder) => void;
  foldersFirst?: boolean;
  onFoldersFirstChange?: (on: boolean) => void;
  className?: string;
}) {
  const t = useT();
  const labels = useSortLabels();
  const [draftKey, setDraftKey] = useState<SortKey>(sortKey);
  const [draftOrder, setDraftOrder] = useState<SortOrder>(sortOrder);
  const [draftFolders, setDraftFolders] = useState<boolean>(foldersFirst ?? true);

  /* Le bloc s'ouvre toujours sur l'état réellement appliqué. */
  useEffect(() => setDraftKey(sortKey), [sortKey]);
  useEffect(() => setDraftOrder(sortOrder), [sortOrder]);
  useEffect(() => setDraftFolders(foldersFirst ?? true), [foldersFirst]);

  return (
    <div
      role="menu"
      aria-label={t("files.sort.optionsAria")}
      className={`w-60 overflow-hidden rounded-2xl border border-border-strong bg-popover p-1.5 text-popover-foreground shadow-elevated ${className}`}
    >
      <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("files.sort.by")}
      </p>
      {(Object.keys(labels) as SortKey[]).map((k) => {
        const active = k === draftKey;
        return (
          <button
            key={k}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            onClick={() => setDraftKey(k)}
            className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-[13.5px] transition-colors ${
              active
                ? "bg-primary-soft font-medium text-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <span className="truncate">{labels[k]}</span>
            {active ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
          </button>
        );
      })}

      <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("files.sort.order")}
      </p>
      <div className="flex gap-1 px-0.5">
        <OrderButton
          active={draftOrder === "asc"}
          onClick={() => setDraftOrder("asc")}
          icon={<ArrowUpAZ className="h-4 w-4" />}
          label={t("files.sort.ascending")}
        />
        <OrderButton
          active={draftOrder === "desc"}
          onClick={() => setDraftOrder("desc")}
          icon={<ArrowDownAZ className="h-4 w-4" />}
          label={t("files.sort.descending")}
        />
      </div>

      {onFoldersFirstChange ? (
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={draftFolders}
          onClick={() => setDraftFolders((v) => !v)}
          className="mt-1.5 flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-[13.5px] text-muted-foreground transition-colors hover:bg-secondary"
        >
          <span className="truncate">{t("files.sort.foldersFirst")}</span>
          <span
            className={`flex h-[18px] w-8 shrink-0 items-center rounded-full p-0.5 transition-colors ${
              draftFolders ? "bg-primary" : "bg-secondary"
            }`}
          >
            <span
              className={`h-[14px] w-[14px] rounded-full bg-surface transition-transform duration-150 ${
                draftFolders ? "translate-x-[14px]" : ""
              }`}
            />
          </span>
        </button>
      ) : null}

      <div className="mt-1.5 px-0.5 pb-0.5">
        <button
          type="button"
          onClick={() => {
            if (onFoldersFirstChange && draftFolders !== (foldersFirst ?? true)) {
              onFoldersFirstChange(draftFolders);
            }
            onApply(draftKey, draftOrder);
          }}
          className="w-full rounded-xl bg-primary py-2 text-[13.5px] font-semibold text-primary-foreground transition-colors active:bg-primary/90"
        >
          {t("action.ok")}
        </button>
      </div>
    </div>
  );
}

function OrderButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-[12px] transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
