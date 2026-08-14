import type { AppIcon } from "@/components/icons";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: AppIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="gf-appear flex flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span aria-hidden className="absolute inset-0 rounded-[32px] bg-primary-softer" />
        <span aria-hidden className="absolute inset-3 rounded-[24px] bg-primary-soft/60" />
        <Icon className="relative h-9 w-9 text-primary" strokeWidth={1.6} />
      </div>
      <div className="max-w-[320px] space-y-1.5">
        <p className="text-[17px] font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="text-[14px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
