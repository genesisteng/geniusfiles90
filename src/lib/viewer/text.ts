/**
 * Text loader for the Universal Viewer.
 *
 * Fetches text content via the WebView (works with Capacitor's
 * convertFileSrc URL on Android). Guards against huge files by exposing
 * a size threshold and truncating the response.
 */
import { t } from "@/lib/i18n";

export const TEXT_SOFT_LIMIT = 2 * 1024 * 1024; // 2 MB
export const TEXT_HARD_LIMIT = 8 * 1024 * 1024; // 8 MB

export type TextLoadResult =
  | { ok: true; content: string; truncated: boolean; bytes: number }
  | { ok: false; error: string };

export async function loadTextFile(
  url: string,
  maxBytes = TEXT_HARD_LIMIT,
): Promise<TextLoadResult> {
  if (!url) return { ok: false, error: "Source indisponible" };
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const buf = await res.arrayBuffer();
    const bytes = buf.byteLength;
    const view = new Uint8Array(buf, 0, Math.min(bytes, maxBytes));
    const content = new TextDecoder("utf-8", { fatal: false }).decode(view);
    return { ok: true, content, truncated: bytes > maxBytes, bytes };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? t("system.io.readFailed") };
  }
}
