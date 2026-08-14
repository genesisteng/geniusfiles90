/**
 * Cartes de réglages — design premium, repliables avec animation fluide.
 *
 * Une carte = une catégorie. En-tête tactile (48dp min, marges Material),
 * contenu animé via la technique `grid-template-rows: 0fr -> 1fr`.
 */
import { useId, useState, type ComponentType, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function SettingsCard({
  title,
  description,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-surface shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-left transition-colors active:bg-secondary/50 sm:px-5"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-foreground">{title}</span>
          {description ? (
            <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>

      <div
        id={panelId}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="divide-y divide-border/50 border-t border-border/50 px-4 sm:px-5">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SettingsItem({
  label,
  desc,
  children,
  stacked = false,
}: {
  label: string;
  desc?: string;
  children?: ReactNode;
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="py-4">
        <p className="text-[14px] font-medium text-foreground">{label}</p>
        {desc ? <p className="mt-0.5 text-[12px] text-muted-foreground">{desc}</p> : null}
        <div className="mt-3">{children}</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-foreground">{label}</p>
        {desc ? (
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{desc}</p>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

/** Bouton d'action secondaire, cohérent avec le reste de l'app. */
export function SettingsAction({
  children,
  onClick,
  icon: Icon,
  danger = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  icon?: ComponentType<{ className?: string }>;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${
        danger
          ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
          : "border-border bg-background text-foreground hover:bg-secondary"
      }`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

/** Ligne cliquable type « lien » (À propos). */
export function SettingsLink({
  label,
  desc,
  href,
  icon: Icon,
}: {
  label: string;
  desc?: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4 transition-colors active:bg-secondary/40"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-foreground">{label}</span>
        {desc ? (
          <span className="block truncate text-[12px] text-muted-foreground">{desc}</span>
        ) : null}
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-muted-foreground/70" />
    </a>
  );
}
