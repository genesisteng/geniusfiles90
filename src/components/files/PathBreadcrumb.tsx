import { ChevronRight, Home } from "lucide-react";
import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import type { PathRef, StorageRoot } from "@/lib/files/types";

/**
 * Fil d'Ariane : Accueil › Stockage › … › Dossier courant.
 * Défile horizontalement, tronque intelligemment chaque segment et
 * met en avant le niveau courant.
 */
export function PathBreadcrumb({
  path,
  roots,
  onNavigate,
  onHome,
}: {
  path: PathRef | null;
  roots: StorageRoot[];
  onNavigate: (segments: string[]) => void;
  onHome: () => void;
}) {
  const t = useT();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }, [path?.rootId, path?.segments.length]);

  const rootLabel = path
    ? (roots.find((r) => r.id === path.rootId)?.label ?? path.rootId)
    : t("files.breadcrumb.home");

  return (
    <div
      ref={scrollerRef}
      className="scrollbar-none flex items-center gap-0.5 overflow-x-auto px-2 py-1.5"
      aria-label={t("files.breadcrumb.aria")}
    >
      <Crumb onClick={onHome} icon={<Home className="h-[15px] w-[15px]" strokeWidth={2.1} />}>
        {t("files.breadcrumb.home")}
      </Crumb>
      {path ? (
        <>
          <Sep />
          <Crumb onClick={() => onNavigate([])} active={path.segments.length === 0}>
            {rootLabel}
          </Crumb>
          {path.segments.map((seg, i) => (
            <div key={`${i}-${seg}`} className="flex shrink-0 items-center gap-0.5">
              <Sep />
              <Crumb
                onClick={() => onNavigate(path.segments.slice(0, i + 1))}
                active={i === path.segments.length - 1}
              >
                {seg}
              </Crumb>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

function Sep() {
  return <ChevronRight className="h-[15px] w-[15px] shrink-0 text-muted-foreground/50" />;
}

function Crumb({
  children,
  onClick,
  active,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex max-w-[150px] shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium transition-[background-color,color,transform] duration-150 active:scale-95 ${
        active
          ? "bg-primary-softer text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}
