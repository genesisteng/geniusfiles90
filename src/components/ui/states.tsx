/**
 * États partagés par toutes les pages de GeniusFiles.
 *
 * Chaque écran utilise les mêmes visuels pour le chargement, la liste
 * vide, l'absence de résultat, l'erreur et la progression d'une tâche,
 * afin qu'aucune page ne paraisse moins soignée qu'une autre.
 */
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Loader2, RotateCcw, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/lib/i18n";

/**
 * Indicateur de chargement en ligne — une seule rotation dans toute
 * l'application, pour que « ça travaille » se lise toujours pareil.
 */
export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <Loader2
      className={`animate-spin ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

/** Squelette de liste — chargement élégant, sans clignotement. */
export function ListSkeleton({ rows = 6, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`gf-card gf-appear divide-y divide-border/60 ${className}`} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="gf-row">
          <span className="gf-skeleton h-11 w-11 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <span
              className="gf-skeleton block h-3.5 rounded-full"
              style={{ width: `${58 + ((i * 13) % 30)}%` }}
            />
            <span
              className="gf-skeleton block h-3 rounded-full"
              style={{ width: `${32 + ((i * 7) % 22)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Squelette de cartes — pour les grilles d'outils et de catégories. */
export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="gf-appear grid grid-cols-2 gap-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="gf-card space-y-3 p-4">
          <span className="gf-skeleton block h-11 w-11 rounded-2xl" />
          <span className="gf-skeleton block h-3.5 w-2/3 rounded-full" />
          <span className="gf-skeleton block h-3 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Aucun résultat — recherche et filtres. */
export function NoResults({
  title,
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  const t = useT();
  return (
    <EmptyState
      icon={SearchX}
      title={title ?? t("state.noResults")}
      description={description ?? t("home.states.noResultsDesc")}
      action={action}
    />
  );
}

/** Erreur — message clair et action de reprise. */
export function ErrorPanel({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const t = useT();
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title ?? t("state.error")}
      description={message ?? t("home.states.errorDesc")}
      action={
        onRetry ? (
          <button type="button" onClick={onRetry} className="btn-secondary gf-press">
            <RotateCcw className="h-4 w-4" />
            {t("action.retry")}
          </button>
        ) : null
      }
    />
  );
}

/** Progression d'une tâche — même présentation partout. */
export function TaskProgress({
  icon: Icon,
  label,
  detail,
  value,
}: {
  icon?: LucideIcon;
  label: string;
  detail?: string;
  /** 0–100 ; omis pour une progression indéterminée. */
  value?: number;
}) {
  const indeterminate = value == null;
  return (
    <div className="gf-card gf-appear flex items-center gap-3.5 p-4">
      {Icon ? (
        <span className="gf-icon-tile bg-primary-softer text-primary">
          <Icon className="h-[22px] w-[22px]" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="gf-row-title truncate">{label}</p>
        {detail ? <p className="gf-row-meta truncate">{detail}</p> : null}
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full bg-primary transition-[width] duration-300 ease-out ${
              indeterminate ? "w-1/3 animate-pulse" : ""
            }`}
            style={indeterminate ? undefined : { width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
      </div>
      {!indeterminate ? (
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-primary">
          {Math.round(value)} %
        </span>
      ) : null}
    </div>
  );
}
