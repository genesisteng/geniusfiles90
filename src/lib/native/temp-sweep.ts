/**
 * Lot 5 — Temp/cache sweep bridge.
 *
 * Wraps the native `sweepTempFiles` plugin method. On the web preview this
 * resolves to a no-op so calling code never has to branch.
 */
import { isAndroidNative, nativePlugin } from "./geniusfiles-native";

export type SweepStats = {
  filesDeleted: number;
  bytesReclaimed: number;
};

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export async function sweepTempFiles(maxAgeMs = DEFAULT_MAX_AGE_MS): Promise<SweepStats> {
  if (!isAndroidNative()) return { filesDeleted: 0, bytesReclaimed: 0 };
  const p = nativePlugin() as unknown as {
    sweepTempFiles?: (opts: { maxAgeMs: number }) => Promise<SweepStats>;
  } | null;
  if (!p?.sweepTempFiles) return { filesDeleted: 0, bytesReclaimed: 0 };
  try {
    const res = await p.sweepTempFiles({ maxAgeMs });
    return {
      filesDeleted: Number(res?.filesDeleted ?? 0),
      bytesReclaimed: Number(res?.bytesReclaimed ?? 0),
    };
  } catch {
    return { filesDeleted: 0, bytesReclaimed: 0 };
  }
}

/**
 * Fire-and-forget sweep, scheduled for when the main thread is idle so it
 * never competes with first-paint or navigation.
 */
export function scheduleIdleSweep(maxAgeMs = DEFAULT_MAX_AGE_MS): void {
  if (typeof window === "undefined") return;
  const run = () => {
    void sweepTempFiles(maxAgeMs);
  };
  const ric = (
    window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (ric) {
    ric(run, { timeout: 5000 });
  } else {
    window.setTimeout(run, 3000);
  }
}
