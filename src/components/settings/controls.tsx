/**
 * Composants UI réutilisables pour la page Paramètres.
 *
 * Layout list-first : plus de « boîtes » card-surface autour des
 * sections. Chaque groupe = un micro-titre + une liste divisée. Les
 * groupes secondaires peuvent être repliables (`collapsible`).
 */
import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function SettingsGroup({
  title,
  hint,
  icon: Icon,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-baseline justify-between px-1">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="group -mx-1 flex flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-secondary/40"
            aria-expanded={isOpen}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                isOpen ? "" : "-rotate-90"
              }`}
            />
            <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {title}
            </h2>
            {hint ? (
              <span className="ml-auto text-[11px] text-muted-foreground/70">{hint}</span>
            ) : null}
          </button>
        ) : (
          <>
            <h2 className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {Icon ? <Icon className="h-3.5 w-3.5 text-primary" /> : null}
              {title}
            </h2>
            {hint ? <span className="text-[11px] text-muted-foreground/70">{hint}</span> : null}
          </>
        )}
      </div>
      {isOpen ? <div className="divide-y divide-border/50">{children}</div> : null}
    </section>
  );
}

export function SettingsRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-1 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-foreground">{label}</p>
        {desc ? <p className="mt-0.5 text-[12px] text-muted-foreground/80">{desc}</p> : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

export function SegButtons<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-secondary"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function SelectRow<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const opt = options.find((o) => String(o.value) === raw);
          if (opt) onChange(opt.value);
        }}
        className="appearance-none rounded-lg border border-border bg-surface py-1.5 pl-2.5 pr-7 text-[12px] font-medium text-foreground focus:border-primary focus:outline-none"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
