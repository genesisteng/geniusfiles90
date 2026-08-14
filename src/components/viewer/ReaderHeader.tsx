/**
 * ReaderHeader — barre supérieure opaque, commune à tous les lecteurs de
 * documents (PDF, Word, TXT, CSV, Markdown, RTF, EPUB, …).
 *
 * Règles :
 * - totalement opaque, soudée à la barre d'état (safe-area incluse) ;
 * - hauteur confortable (56dp) et marges homogènes façon Material ;
 * - hors du flux scrollable : le document défile *sous* elle, jamais
 *   derrière une couche translucide ;
 * - jamais sélectionnable — seul le contenu du document l'est.
 */
import type { ReactNode } from "react";
import { ArrowLeft, MoreVertical, Share2 } from "lucide-react";
import { useT } from "@/lib/i18n";

export function ReaderHeader({
  title,
  subtitle,
  onBack,
  onShare,
  onMenu,
  extra,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onShare?: () => void;
  onMenu?: () => void;
  extra?: ReactNode;
}) {
  const t = useT();
  return (
    <header className="relative z-30 shrink-0 select-none border-b border-border bg-reader-header pt-[env(safe-area-inset-top,0px)] pl-safe pr-safe shadow-soft">
      <div className="flex h-14 items-center gap-1 px-1">
        <HeaderButton label={t("action.back")} onClick={onBack}>
          <ArrowLeft className="h-[22px] w-[22px]" strokeWidth={2} />
        </HeaderButton>
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate text-[16px] font-semibold leading-tight text-reader-header-foreground">
            {title}
          </p>
          {subtitle ? (
            <p className="truncate text-[11.5px] leading-tight text-reader-header-foreground/65">
              {subtitle}
            </p>
          ) : null}
        </div>
        {extra}
        {onShare ? (
          <HeaderButton label={t("action.share")} onClick={onShare}>
            <Share2 className="h-[21px] w-[21px]" strokeWidth={2} />
          </HeaderButton>
        ) : null}
        {onMenu ? (
          <HeaderButton label={t("cleaner.trash.moreActions.aria")} onClick={onMenu}>
            <MoreVertical className="h-[22px] w-[22px]" strokeWidth={2} />
          </HeaderButton>
        ) : null}
      </div>
    </header>
  );
}

export function HeaderButton({
  children,
  onClick,
  label,
  active,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors active:bg-foreground/15 disabled:opacity-35 ${
        active
          ? "bg-foreground/10 text-primary"
          : "text-reader-header-foreground hover:bg-foreground/10"
      }`}
    >
      {children}
    </button>
  );
}
