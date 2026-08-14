/**
 * Petit pub/sub interne à l'organizer.
 *
 * On écoute `gf:storage-changed` (émis par `@/lib/files/operations`)
 * pour invalider automatiquement rapport et collections. On émet
 * `gf:organizer-updated` quand un rapport est fraîchement disponible.
 */

const listeners = new Set<() => void>();

export function subscribeOrganizer(cb: () => void): () => void {
  listeners.add(cb);
  if (typeof window !== "undefined") {
    const handler = () => cb();
    window.addEventListener("gf:storage-changed", handler);
    window.addEventListener("gf:organizer-updated", handler);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("gf:storage-changed", handler);
      window.removeEventListener("gf:organizer-updated", handler);
    };
  }
  return () => listeners.delete(cb);
}

export function emitOrganizerUpdated() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("gf:organizer-updated"));
  } catch {
    /* ignore */
  }
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}
