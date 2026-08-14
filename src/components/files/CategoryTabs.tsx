/**
 * Barre d'onglets style Android (TabLayout) : libellés répartis, indicateur
 * animé qui glisse sous l'onglet actif.
 */
import { useT } from "@/lib/i18n";

export type CategoryTabId = string;

type Tab = { id: CategoryTabId; label: string };

export function CategoryTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab[];
  active: CategoryTabId;
  onChange: (id: CategoryTabId) => void;
}) {
  const t = useT();
  const index = Math.max(
    0,
    tabs.findIndex((t) => t.id === active),
  );
  const width = 100 / Math.max(1, tabs.length);

  return (
    <div className="border-t border-border/40">
      <div role="tablist" aria-label={t("files.category.tabsAria")} className="relative flex">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.id)}
              className={`flex-1 px-2 py-2 text-[13px] font-medium tracking-wide transition-colors duration-200 active:bg-secondary/40 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
        <span
          aria-hidden
          className="absolute bottom-0 h-[2.5px] rounded-full bg-primary transition-transform duration-300 ease-out"
          style={{
            width: `${width}%`,
            left: 0,
            transform: `translateX(${index * 100}%)`,
          }}
        />
      </div>
    </div>
  );
}
