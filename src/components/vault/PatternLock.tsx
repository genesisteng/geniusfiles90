/**
 * Verrouillage par schéma (3×3) — saisie tactile façon Android.
 *
 * Le schéma est sérialisé en une chaîne d'indices (`"0-1-2-5"`) puis traité
 * exactement comme un code PIN par `src/lib/vault/auth.ts` : il est dérivé en
 * PBKDF2-SHA256 et jamais stocké en clair.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

export const PATTERN_MIN = 4;

export function serializePattern(points: number[]): string {
  return points.join("-");
}

/** Nombre de points d'un schéma sérialisé. */
export function patternLength(value: string): number {
  return value ? value.split("-").filter(Boolean).length : 0;
}

type Point = { x: number; y: number };

export function PatternLock({
  onComplete,
  disabled,
  error,
  size = 260,
}: {
  onComplete: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  size?: number;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement | null>(null);
  const [path, setPath] = useState<number[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [drawing, setDrawing] = useState(false);
  const pathRef = useRef<number[]>([]);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  const centers = useCallback((): Point[] => {
    const step = size / 3;
    const out: Point[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        out.push({ x: step * c + step / 2, y: step * r + step / 2 });
      }
    }
    return out;
  }, [size]);

  const localPoint = useCallback((e: PointerEvent | React.PointerEvent): Point | null => {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  const hitTest = useCallback(
    (p: Point): number | null => {
      const cs = centers();
      const radius = size / 8;
      for (let i = 0; i < cs.length; i++) {
        const dx = cs[i].x - p.x;
        const dy = cs[i].y - p.y;
        if (dx * dx + dy * dy <= radius * radius) return i;
      }
      return null;
    },
    [centers, size],
  );

  const extend = useCallback(
    (p: Point) => {
      setCursor(p);
      const hit = hitTest(p);
      if (hit == null) return;
      setPath((prev) => {
        if (prev.includes(hit)) return prev;
        // Traverse automatiquement le point intermédiaire aligné (comportement Android).
        const last = prev[prev.length - 1];
        if (last != null) {
          const mid = midpointIndex(last, hit);
          if (mid != null && !prev.includes(mid)) return [...prev, mid, hit];
        }
        try {
          navigator.vibrate?.(8);
        } catch {
          /* ignore */
        }
        return [...prev, hit];
      });
    },
    [hitTest],
  );

  const finish = useCallback(() => {
    setDrawing(false);
    setCursor(null);
    const value = pathRef.current;
    if (value.length > 0) onComplete(serializePattern(value));
    setPath([]);
  }, [onComplete]);

  useEffect(() => {
    if (!drawing) return;
    const move = (e: PointerEvent) => {
      const p = localPoint(e);
      if (p) extend(p);
    };
    const up = () => finish();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drawing, extend, finish, localPoint]);

  const cs = centers();
  const lines: { a: Point; b: Point }[] = [];
  for (let i = 1; i < path.length; i++) lines.push({ a: cs[path[i - 1]], b: cs[path[i]] });
  const head = path.length ? cs[path[path.length - 1]] : null;

  return (
    <div
      ref={ref}
      role="application"
      aria-label={t("vault.pattern.grid")}
      className={`relative touch-none select-none ${disabled ? "pointer-events-none opacity-50" : ""}`}
      style={{ width: size, height: size }}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        setPath([]);
        setDrawing(true);
        const p = localPoint(e);
        if (p) extend(p);
      }}
    >
      <svg
        className="pointer-events-none absolute inset-0"
        width={size}
        height={size}
        aria-hidden
        viewBox={`0 0 ${size} ${size}`}
      >
        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.a.x}
            y1={l.a.y}
            x2={l.b.x}
            y2={l.b.y}
            className={error ? "stroke-destructive" : "stroke-primary"}
            strokeWidth={5}
            strokeLinecap="round"
          />
        ))}
        {head && cursor ? (
          <line
            x1={head.x}
            y1={head.y}
            x2={cursor.x}
            y2={cursor.y}
            className={error ? "stroke-destructive" : "stroke-primary"}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.55}
          />
        ) : null}
      </svg>
      {cs.map((c, i) => {
        const active = path.includes(i);
        return (
          <span
            key={i}
            className={`absolute rounded-full border-2 transition-all duration-150 ${
              active
                ? error
                  ? "border-destructive bg-destructive/25"
                  : "border-primary bg-primary/25"
                : "border-border bg-surface"
            }`}
            style={{
              width: size / 5.5,
              height: size / 5.5,
              left: c.x - size / 11,
              top: c.y - size / 11,
              transform: active ? "scale(1.08)" : "scale(1)",
            }}
          >
            <span
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all ${
                active ? (error ? "bg-destructive" : "bg-primary") : "bg-muted-foreground/40"
              }`}
              style={{ width: size / 22, height: size / 22 }}
            />
          </span>
        );
      })}
    </div>
  );
}

/** Point aligné traversé entre deux extrémités (ex. 0 → 2 traverse 1). */
function midpointIndex(a: number, b: number): number | null {
  const ar = Math.floor(a / 3);
  const ac = a % 3;
  const br = Math.floor(b / 3);
  const bc = b % 3;
  if ((ar + br) % 2 !== 0 || (ac + bc) % 2 !== 0) return null;
  const mr = (ar + br) / 2;
  const mc = (ac + bc) / 2;
  const mid = mr * 3 + mc;
  return mid === a || mid === b ? null : mid;
}
