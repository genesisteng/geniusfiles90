import { useEffect, useRef } from "react";
import { Music4 } from "lucide-react";

/**
 * Premium vinyl record illustration.
 *
 * Rotation is driven by requestAnimationFrame with an eased angular velocity:
 * starting playback ramps the disc up smoothly, pausing decelerates it to a
 * stop instead of freezing the CSS animation abruptly.
 */
export function VinylDisc({
  playing,
  artworkUrl,
  title,
  className = "",
}: {
  playing: boolean;
  artworkUrl?: string | null;
  title: string;
  className?: string;
}) {
  const discRef = useRef<HTMLDivElement | null>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const el = discRef.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) return;

    let angle = 0;
    let speed = 0; // deg / second
    let last = performance.now();
    let raf = 0;

    const TARGET = 20; // ~3 tours / minute, lent et régulier

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = playingRef.current ? TARGET : 0;
      // Ease vers la vitesse cible : montée douce, arrêt progressif.
      const k = playingRef.current ? 1.6 : 0.9;
      speed += (target - speed) * Math.min(1, k * dt);
      if (!playingRef.current && speed < 0.05) speed = 0;
      angle = (angle + speed * dt) % 360;
      el.style.transform = `rotate(${angle}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Halo très léger derrière le disque */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-full opacity-70 blur-2xl transition-opacity duration-700"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary) 32%, transparent) 0%, transparent 68%)",
          opacity: playing ? 0.8 : 0.35,
        }}
      />

      <div
        ref={discRef}
        className="relative aspect-square w-full rounded-full will-change-transform"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, #3a3a3f 0%, #1c1c1f 38%, #121214 70%, #202024 100%)",
          boxShadow: "0 24px 60px -18px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        {/* Sillons du vinyle */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-full opacity-70"
          style={{
            background:
              "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 5px)",
            maskImage:
              "radial-gradient(circle, transparent 33%, black 35%, black 99%, transparent)",
            WebkitMaskImage:
              "radial-gradient(circle, transparent 33%, black 35%, black 99%, transparent)",
          }}
        />
        {/* Anneaux marqués */}
        <div
          aria-hidden
          className="absolute inset-[8%] rounded-full"
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)" }}
        />
        <div
          aria-hidden
          className="absolute inset-[18%] rounded-full"
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)" }}
        />
        {/* Reflet lumineux */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-full opacity-60"
          style={{
            background:
              "conic-gradient(from 210deg, transparent 0deg, rgba(255,255,255,0.12) 25deg, transparent 70deg, transparent 190deg, rgba(255,255,255,0.08) 215deg, transparent 260deg)",
          }}
        />

        {/* Étiquette centrale / miniature */}
        <div
          className="absolute left-1/2 top-1/2 aspect-square w-[42%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
          style={{
            background: "linear-gradient(150deg, var(--primary), var(--primary-2, var(--primary)))",
            boxShadow: "0 6px 18px -6px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.14)",
          }}
        >
          {artworkUrl ? (
            <img src={artworkUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center">
              <Music4 className="h-[22%] w-[22%] min-h-4 min-w-4 text-primary-foreground/90" />
              <span className="line-clamp-2 text-[10px] font-medium leading-tight text-primary-foreground/85">
                {title}
              </span>
            </div>
          )}
        </div>

        {/* Trou central */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 aspect-square w-[6%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-background"
          style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.35)" }}
        />
      </div>
    </div>
  );
}
