/**
 * Reader mode — signal partagé indiquant qu'un document est ouvert en
 * plein écran. La barre de navigation principale s'efface (et libère sa
 * hauteur) tant qu'un document est affiché, exactement comme dans les
 * lecteurs Android natifs.
 */
import { useSyncExternalStore } from "react";

let active = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setReaderMode(next: boolean): void {
  if (active === next) return;
  active = next;
  if (typeof document !== "undefined") {
    if (next) document.documentElement.dataset["gfReader"] = "1";
    else delete document.documentElement.dataset["gfReader"];
  }
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useReaderMode(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => active,
    () => false,
  );
}
