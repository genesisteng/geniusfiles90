/**
 * Very light haptic feedback for editor controls.
 *
 * Uses Capacitor Haptics on device (loaded lazily so the web build never
 * pays for it) and falls back to the Vibration API in the browser. Ticks are
 * rate-limited so a fast slider drag can never turn into a continuous buzz.
 */
let impact: ((opts: { style: string }) => Promise<void>) | null = null;
let styleEnum: Record<string, string> | null = null;
let loading = false;
let last = 0;

function ensureNative() {
  if (impact || loading) return;
  loading = true;
  void import("@capacitor/haptics")
    .then((m) => {
      impact = (opts) => m.Haptics.impact(opts as never);
      styleEnum = m.ImpactStyle as unknown as Record<string, string>;
    })
    .catch(() => {
      impact = null;
    });
}

/** A single, discreet tick — used when a slider crosses a graduation. */
export function tick(strength: "light" | "medium" = "light") {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  // Never more than ~25 ticks per second, whatever the drag speed.
  if (now - last < 38) return;
  last = now;
  ensureNative();
  if (impact && styleEnum) {
    void impact({ style: strength === "medium" ? styleEnum.Medium : styleEnum.Light }).catch(
      () => {},
    );
    return;
  }
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(strength === "medium" ? 12 : 5);
  }
}
