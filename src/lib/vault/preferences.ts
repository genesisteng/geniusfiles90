/**
 * Coffre-fort — user preferences.
 *
 * Auto-lock delay, lock-on-background, sort and view settings persist in
 * localStorage. Every setter emits `gf:vault-preferences-changed` so the
 * session watchdog can pick up new timeouts without reload.
 */
import type { VaultSortKey, VaultSortOrder } from "./types";
import { t } from "@/lib/i18n";

const KEYS = {
  autoLockMs: "gf.vault.autoLockMs",
  lockOnBackground: "gf.vault.lockOnBackground",
  sort: "gf.vault.sort",
  view: "gf.vault.view",
  favorites: "gf.vault.favorites",
} as const;

export const AUTO_LOCK_VALUES = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, -1] as const;

/** Options traduites, à recalculer à chaque rendu (la langue peut changer). */
export function autoLockOptions(): { value: number; label: string }[] {
  const labels: Record<number, string> = {
    30_000: t("vault.autoLock.30s"),
    60_000: t("vault.autoLock.1m"),
    [5 * 60_000]: t("vault.autoLock.5m"),
    [15 * 60_000]: t("vault.autoLock.15m"),
    [30 * 60_000]: t("vault.autoLock.30m"),
    [-1]: t("vault.autoLock.never"),
  };
  return AUTO_LOCK_VALUES.map((value) => ({ value, label: labels[value] }));
}

const DEFAULT_AUTO_LOCK = 60_000;

function safeGet(k: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

function safeSet(k: string, v: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(k, v);
    window.dispatchEvent(new CustomEvent("gf:vault-preferences-changed"));
  } catch {
    /* ignore */
  }
}

export function loadAutoLockMs(): number {
  const raw = safeGet(KEYS.autoLockMs);
  if (!raw) return DEFAULT_AUTO_LOCK;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return DEFAULT_AUTO_LOCK;
  return n;
}

export function saveAutoLockMs(ms: number): void {
  safeSet(KEYS.autoLockMs, String(ms));
}

export function loadLockOnBackground(): boolean {
  const v = safeGet(KEYS.lockOnBackground);
  return v == null ? true : v === "1";
}

export function saveLockOnBackground(on: boolean): void {
  safeSet(KEYS.lockOnBackground, on ? "1" : "0");
}

export function loadVaultSort(): { key: VaultSortKey; order: VaultSortOrder } {
  const raw = safeGet(KEYS.sort);
  if (!raw) return { key: "date", order: "desc" };
  try {
    const parsed = JSON.parse(raw) as { key: VaultSortKey; order: VaultSortOrder };
    return parsed;
  } catch {
    return { key: "date", order: "desc" };
  }
}

export function saveVaultSort(s: { key: VaultSortKey; order: VaultSortOrder }): void {
  safeSet(KEYS.sort, JSON.stringify(s));
}

export function loadVaultView(): "list" | "grid" {
  return safeGet(KEYS.view) === "grid" ? "grid" : "list";
}

export function saveVaultView(v: "list" | "grid"): void {
  safeSet(KEYS.view, v);
}
