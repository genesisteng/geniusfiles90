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
