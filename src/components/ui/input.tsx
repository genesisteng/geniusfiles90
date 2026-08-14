import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // Active par défaut les suggestions / correction / majuscule auto pour
    // les champs textuels sur Android WebView (Gboard & co). Les types
    // sensibles (mot de passe, email, url, tel, number) conservent leur
    // comportement natif.
    const isText = !type || type === "text" || type === "search";
    const kb: React.InputHTMLAttributes<HTMLInputElement> = isText
      ? {
          autoCorrect: "on",
          autoCapitalize: "sentences",
          spellCheck: true,
          lang: "fr",
        }
      : {};
    return (
      <input
        type={type}
        className={cn(
          "flex h-[52px] w-full rounded-2xl border border-transparent bg-input px-4 text-[15px] text-foreground transition-all duration-150 ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground-2 focus-visible:outline-none focus-visible:border-primary focus-visible:bg-surface focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...kb}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
