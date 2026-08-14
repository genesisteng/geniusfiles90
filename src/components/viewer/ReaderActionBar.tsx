/**
 * ReaderActionBar — barre d'actions propre au lecteur (PDF, Word, texte…),
 * placée directement sous la barre supérieure du fichier.
 *
 * Règles :
 * - une seule ligne, compacte (44dp) ;
 * - défilement horizontal naturel *uniquement* pour cette barre ;
 * - jamais mélangée aux actions générales du fichier (menu « Actions ») ni
 *   aux actions de sélection de texte (barre contextuelle).
 */
import type { ReaderTool } from "@/lib/viewer/reader-tools";

export function ReaderActionBar({ tools }: { tools: ReaderTool[] }) {
  if (!tools.length) return null;
  return (
    <div className="relative z-20 shrink-0 select-none border-b border-border bg-reader-header pl-safe pr-safe">
      <div className="gf-photo-scroll flex items-center gap-1.5 overflow-x-auto px-2 py-1.5">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={t.onSelect}
              disabled={t.disabled}
              aria-pressed={t.active}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors active:scale-95 disabled:opacity-35 ${
                t.active
                  ? "bg-primary/15 text-primary"
                  : "bg-reader-header-foreground/10 text-reader-header-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="whitespace-nowrap">{t.label}</span>
              {t.value ? (
                <span className="whitespace-nowrap text-[11px] text-reader-header-foreground/60">
                  {t.value}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
