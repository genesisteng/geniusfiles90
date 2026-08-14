/**
 * Compact segmented control letting the user pick which storage(s) a
 * feature (Nettoyeur, Recherche, Corbeille…) should operate on. Renders
 * NOTHING when only one storage is available — the choice is implicit.
 */
import type { StorageRoot, StorageRootId } from "@/lib/files/types";
import { useT } from "@/lib/i18n";

export type StorageScope = StorageRootId | "all";

export function StorageScopePicker({
  roots,
  value,
  onChange,
  label,
}: {
  roots: StorageRoot[];
  value: StorageScope;
  onChange: (v: StorageScope) => void;
  label?: string;
}) {
  const t = useT();
  const resolvedLabel = label ?? t("home.scopePicker.label");
  const available = roots.filter(
    (r) => r.available && (r.id === "internal" || r.id.startsWith("ext:")),
  );
  if (available.length < 2) return null;
  const options: { id: StorageScope; label: string }[] = [
    ...available.map((r) => ({ id: r.id as StorageScope, label: r.label })),
    { id: "all" as StorageScope, label: t("home.scopePicker.all") },
  ];
  return (
    <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
        {resolvedLabel}
      </span>
      <div className="flex gap-1">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-surface/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
