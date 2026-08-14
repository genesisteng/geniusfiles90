/**
 * Coffre-fort — session watchdog.
 *
 * Owns the in-memory "unlocked" flag plus two triggers:
 *   1. Inactivity timer — resets on any user interaction while the vault
 *      route is open, locks the vault after the configured delay.
 *   2. Visibility / app-state — when `lockOnBackground` is on, locks the
 *      vault the moment the tab or the Android WebView loses focus.
 *
 * The unlock flag NEVER touches localStorage — that would defeat the point.
 * Coming back to the vault after killing the app requires re-authenticating.
 */
import { loadAutoLockMs, loadLockOnBackground } from "./preferences";

type Listener = (unlocked: boolean) => void;

let unlocked = false;
let lastActivityAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let visibilityBound = false;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l(unlocked);
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function scheduleAutoLock() {
  clearTimer();
  if (!unlocked) return;
  const ms = loadAutoLockMs();
  if (ms <= 0) return; // "Jamais"
  const elapsed = Date.now() - lastActivityAt;
  const remaining = Math.max(0, ms - elapsed);
  timer = setTimeout(() => {
    lockSession("auto");
  }, remaining);
}

function bindVisibilityOnce() {
  if (visibilityBound || typeof window === "undefined") return;
  visibilityBound = true;
  const onVisibility = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "hidden" && unlocked && loadLockOnBackground()) {
      lockSession("background");
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onVisibility);
  window.addEventListener("blur", onVisibility);
  window.addEventListener("gf:vault-preferences-changed", scheduleAutoLock);
}

export function isVaultUnlocked(): boolean {
  return unlocked;
}

export function markUnlocked(): void {
  unlocked = true;
  lastActivityAt = Date.now();
  bindVisibilityOnce();
  scheduleAutoLock();
  notify();
}

export function lockSession(_reason: "auto" | "background" | "manual" = "manual"): void {
  if (!unlocked) return;
  unlocked = false;
  clearTimer();
  notify();
}

/** Bump the inactivity timer — call on any user interaction inside the vault. */
export function bumpActivity(): void {
  if (!unlocked) return;
  lastActivityAt = Date.now();
  scheduleAutoLock();
}

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
