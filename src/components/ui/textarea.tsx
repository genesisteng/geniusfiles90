import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        autoCorrect="on"
        autoCapitalize="sentences"
        spellCheck
        lang="fr"
        className={cn(
          "flex min-h-[96px] w-full rounded-2xl border border-transparent bg-input px-4 py-3 text-[15px] text-foreground leading-relaxed transition-all duration-150 ease-out placeholder:text-muted-foreground-2 focus-visible:outline-none focus-visible:border-primary focus-visible:bg-surface focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
