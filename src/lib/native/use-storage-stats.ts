/**
 * React hook exposing real device storage statistics.
 *
 * On native Android, calls `GeniusFilesNative.getStorageStats` and refreshes
 * whenever the app returns to foreground (so values stay accurate after the
 * user deletes/copies files). On web / SSR, returns null and the caller
 * renders a placeholder.
 */
import { useEffect, useState } from "react";
import {
  getStorageStats,
  isAndroidNative,
  type NativeStorageStats,
} from "@/lib/native/geniusfiles-native";

export type StorageStats = NativeStorageStats & {
  usedPct: number;
  freePct: number;
};

function decorate(s: NativeStorageStats): StorageStats {
  const pct = s.total > 0 ? Math.max(0, Math.min(100, (s.used / s.total) * 100)) : 0;
  return { ...s, usedPct: pct, freePct: 100 - pct };
}

export function useStorageStats(): {
  stats: StorageStats | null;
  loading: boolean;
  supported: boolean;
  refresh: () => void;
} {
  const supported = isAndroidNative();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState<boolean>(supported);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!supported) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getStorageStats().then((s) => {
      if (cancelled) return;
      setStats(s ? decorate(s) : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [supported, tick]);

  useEffect(() => {
    if (!supported || typeof window === "undefined") return;
    let unsub: (() => void) | null = null;
    let cancelled = false;
    import("@capacitor/app")
      .then(({ App }) => {
        if (cancelled) return;
        const handle = App.addListener("appStateChange", (state) => {
          if (state.isActive) setTick((t) => t + 1);
        });
        unsub = () => {
          Promise.resolve(handle).then((h) => h?.remove?.());
        };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [supported]);

  return { stats, loading, supported, refresh: () => setTick((t) => t + 1) };
}
