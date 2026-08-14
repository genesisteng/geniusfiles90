/**
 * Runtime detection helpers for GeniusFiles.
 *
 * Guarded to stay safe during SSR / Lovable preview — Capacitor is present
 * as an npm package but its runtime bridge only exists inside the Android
 * WebView. Every call site must handle the "not native" case gracefully.
 */

export function isNativeRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : false;
}

export function nativePlatform(): "android" | "ios" | "web" {
  if (typeof window === "undefined") return "web";
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = typeof cap?.getPlatform === "function" ? cap.getPlatform() : "web";
  return p === "android" || p === "ios" ? p : "web";
}
