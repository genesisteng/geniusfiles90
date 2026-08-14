import { Music2 } from "lucide-react";

/**
 * Deterministic gradient tile shown when a track has no embedded artwork.
 * The gradient is derived from the title so every song has its own colour
 * signature — never an empty grey placeholder.
 */
export function ArtworkFallback({ title, className = "" }: { title: string; className?: string }) {
  const hue = hashHue(title);
  const initial = (
    title
      .replace(/^\s*\d+\s*[-.)]?\s*/, "")
      .trim()
      .charAt(0) || "♪"
  ).toUpperCase();
  const bg = `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 55) % 360} 65% 30%))`;
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: bg }}
      aria-hidden
    >
      <span className="absolute inset-0 opacity-30 mix-blend-overlay [background-image:radial-gradient(circle_at_30%_30%,white,transparent_60%)]" />
      <span className="text-white/90 font-semibold" style={{ fontSize: "min(38%, 6rem)" }}>
        {initial}
      </span>
      <Music2 className="absolute bottom-3 right-3 h-5 w-5 text-white/60" />
    </div>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}
