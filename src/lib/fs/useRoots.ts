/**
 * Reactive hook returning the current list of storage roots, including
 * dynamically-detected external volumes (SD card, USB OTG). Re-renders
 * whenever a volume is mounted or unmounted natively.
 */
import { useEffect, useState } from "react";
import { listRoots, refreshStorageVolumes, subscribeRoots } from "@/lib/files/fs";
import type { StorageRoot } from "@/lib/files/types";

export function useRoots(): {
  roots: StorageRoot[];
  available: StorageRoot[];
  refresh: () => void;
} {
  const [roots, setRoots] = useState<StorageRoot[]>(() => listRoots());
  useEffect(() => {
    const update = () => setRoots(listRoots());
    const unsub = subscribeRoots(update);
    void refreshStorageVolumes().then(update);
    if (typeof document !== "undefined") {
      const onVis = () => {
        if (document.visibilityState === "visible") void refreshStorageVolumes().then(update);
      };
      document.addEventListener("visibilitychange", onVis);
      return () => {
        unsub();
        document.removeEventListener("visibilitychange", onVis);
      };
    }
    return () => unsub();
  }, []);
  return {
    roots,
    available: roots.filter((r) => r.available),
    refresh: () => {
      void refreshStorageVolumes().then(() => setRoots(listRoots()));
    },
  };
}
