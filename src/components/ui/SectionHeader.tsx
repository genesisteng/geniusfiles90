import type { ReactNode } from "react";

export function SectionHeader({
  title,
  action,
  hint,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 mt-8 flex items-end justify-between gap-3 first:mt-2">
      <div className="min-w-0">
        <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
        {hint ? <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

/**
 * Titre de groupe collant — utilisé par les listes groupées (catégories,
 * fichiers récents). Un seul rendu partout : même taille, même fond, même
 * flou, pour que deux écrans groupés ne se distinguent jamais.
 */
export function GroupHeading({ label }: { label: string }) {
  return (
    <h2 className="sticky top-0 z-10 bg-background/95 px-4 py-1.5 text-[12.5px] font-semibold text-foreground/90 backdrop-blur">
      {label}
    </h2>
  );
}
