/**
 * Primitives de design partagées par TOUS les outils PDF.
 *
 * Un seul endroit définit les marges, espacements, tailles de texte,
 * hauteurs de champs, hauteurs de boutons, rayons et animations : chaque
 * écran d'outil doit passer par ces composants pour rester strictement
 * cohérent avec les autres.
 */
import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/states";

/** Espacement vertical unique entre les blocs d'un outil. */
export function PdfToolBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

/** Bloc « étape » : titre court + aide, puis contenu. */
export function PdfStep({
  index,
  title,
  hint,
  children,
}: {
  index?: number;
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        {index != null ? (
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-bold text-primary">
            {index}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h4 className="text-[14px] font-semibold leading-tight text-foreground">{title}</h4>
          {hint ? (
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Carte neutre utilisée pour les zones d'options / de résumé. */
export function PdfCard({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-surface-2/60 p-3">{children}</div>;
}

/**
 * Bouton unique de l'expérience PDF : même hauteur (44 px), même rayon,
 * mêmes états (normal / pressé / désactivé / chargement).
 */
export function PdfButton({
  children,
  onClick,
  disabled,
  loading,
  variant = "primary",
  full,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "ghost" | "danger" | "outline";
  full?: boolean;
}) {
  const tone =
    variant === "primary"
      ? "bg-primary text-primary-foreground shadow-soft hover:brightness-105"
      : variant === "danger"
        ? "bg-destructive text-destructive-foreground shadow-soft hover:brightness-105"
        : variant === "outline"
          ? "border border-border bg-surface text-foreground hover:bg-surface-2"
          : "text-primary hover:bg-primary-softer";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl px-5 text-[14px] font-semibold transition-all duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${tone} ${
        full ? "w-full" : ""
      }`}
    >
      {loading ? <Spinner size={16} /> : null}
      {children}
    </button>
  );
}
