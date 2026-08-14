/**
 * Bandeau de suggestions Genius AI.
 *
 * Défilement automatique continu vers la gauche (rAF), boucle infinie via
 * duplication de la liste, et manipulation libre au doigt : le glissement
 * horizontal met l'animation en pause puis elle reprend. Le conteneur ne
 * doit jamais utiliser `scroll-behavior: smooth` : cela annulerait les
 * micro-déplacements de `scrollLeft` frame par frame (défilement figé).
 */
import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import { TEMPLATE_KEYS } from "./templates";

const SPEED = 24; // px / seconde
const PAUSE_MS = 2500;

export function TemplateMarquee({ onPick }: { onPick: (text: string) => void }) {
  const t = useT();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pausedUntilRef = useRef(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last = performance.now();
    // Position en flottant : `scrollLeft` arrondit à l'entier, ce qui
    // bloquerait l'avancée quand le pas d'une frame est inférieur à 1 px.
    let pos = el.scrollLeft;

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(now - last, 64);
      last = now;
      const half = el.scrollWidth / 2;
      if (half <= 0) return;

      // L'utilisateur a fait défiler manuellement : on se resynchronise.
      if (Math.abs(el.scrollLeft - pos) > 2) pos = el.scrollLeft;

      if (now >= pausedUntilRef.current) {
        pos += (SPEED * dt) / 1000;
        if (pos >= half) pos -= half;
        el.scrollLeft = pos;
      } else if (pos >= half) {
        pos -= half;
        el.scrollLeft = pos;
      }
    };
    raf = requestAnimationFrame(step);

    const pause = () => {
      pausedUntilRef.current = performance.now() + PAUSE_MS;
    };
    el.addEventListener("pointerdown", pause);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchmove", pause, { passive: true });
    el.addEventListener("wheel", pause, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchmove", pause);
      el.removeEventListener("wheel", pause);
    };
  }, []);

  const templates = TEMPLATE_KEYS.map((key) => t(`assistant.templates.${key}`));
  const items = [...templates, ...templates];

  return (
    <div
      ref={scrollerRef}
      className="gf-no-scrollbar -mx-1 flex max-w-full gap-2 overflow-x-auto px-1 py-1"
      style={{ scrollbarWidth: "none", scrollBehavior: "auto", touchAction: "pan-x" }}
      aria-label={t("assistant.templates.ariaLabel")}
    >
      {items.map((text, i) => (
        <button
          key={`${i}-${text}`}
          type="button"
          onClick={() => {
            pausedUntilRef.current = performance.now() + PAUSE_MS;
            onPick(text);
          }}
          className="h-9 shrink-0 whitespace-nowrap rounded-full border border-border/70 bg-surface px-3.5 text-[12.5px] leading-none text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-foreground active:scale-[0.98]"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
