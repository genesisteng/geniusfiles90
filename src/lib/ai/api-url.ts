/**
 * Resolves the base URL to use for the assistant API.
 *
 * - Web/dev/preview: relative paths ("") — served by the same origin.
 * - Native Android/iOS (Capacitor): must be an absolute URL, because the
 *   WebView loads static assets from a capacitor:// / https://localhost
 *   origin that has no backend.
 *
 * Priority:
 *   1. VITE_API_BASE_URL (build-time override)
 *   2. Stable Lovable production URL for this project
 */
import { isNativeRuntime } from "@/lib/native/platform";

// URL publiée de CE projet Lovable. Pour la modifier manuellement :
// remplace la valeur ci-dessous, ou définis VITE_API_BASE_URL dans `.env`
// avant `bun run build:mobile` (l'override est prioritaire).
const PUBLISHED_URL = "https://geniusfiles.lovable.app";

/**
 * Détecte une origine « application native » même si le pont Capacitor
 * n'est pas encore injecté au moment du premier rendu :
 *  - capacitor://localhost (iOS)
 *  - https://localhost (Android WebView)
 *  - file:// (fallback)
 * Le dev/preview web tourne sur http://localhost:<port> → non concerné.
 */
function isNativeOrigin(): boolean {
  if (typeof window === "undefined" || typeof location === "undefined") return false;
  const { protocol, hostname } = location;
  if (protocol === "capacitor:" || protocol === "file:") return true;
  return protocol === "https:" && (hostname === "localhost" || hostname === "127.0.0.1");
}

export function apiBaseUrl(): string {
  const override = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (override) return override.replace(/\/+$/, "");
  if (isNativeRuntime() || isNativeOrigin()) return PUBLISHED_URL.replace(/\/+$/, "");

  return "";
}

export function chatApiUrl(): string {
  const base = apiBaseUrl();
  return `${base}/api/public/chat`;
}
