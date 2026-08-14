import type { ReactNode } from "react";

/**
 * En-tête de page — structure commune à tous les écrans « simples »
 * (hors gestionnaire de fichiers et catégories qui utilisent FilesTopBar).
 *
 * Règles structurelles :
 * - l'en-tête est **collant** (sticky top:0) et **opaque** : le contenu
 *   défile dessous, jamais au-dessus ;
 * - il absorbe lui-même l'inset supérieur (`pt-safe`), c'est donc lui —
 *   et non le conteneur de page — qui gère la barre d'état ;
 * - `-mx-4` annule le padding horizontal de la zone scrollable pour que le
 *   fond couvre toute la largeur ; le contenu interne le rétablit.
 *
 * La barre d'état elle-même est couverte par l'écran opaque monté dans
 * AppShell : aucun contenu ne peut apparaître derrière elle pendant le scroll.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
  leading,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  eyebrow?: string;
  leading?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background pt-safe">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-3 pl-[calc(1rem+env(safe-area-inset-left,0px))] pr-[calc(1rem+env(safe-area-inset-right,0px))] pt-3">
        <div className="flex min-w-0 items-center gap-2">
          {leading ? <div className="shrink-0">{leading}</div> : null}
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mb-1 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="truncate font-display text-[26px] font-bold leading-[1.15] tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[12.5px] leading-snug text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
