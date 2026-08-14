/**
 * Native PDF I/O bridge.
 *
 * Reads and writes raw bytes to real device paths via the GeniusFilesNative
 * plugin. On web / SSR falls back to an in-memory map keyed by absolute path
 * so the mock file tree (see src/lib/files/fs.ts) stays usable inside the
 * Lovable preview — PDFs created in the preview are still previewable.
 */
import { t } from "@/lib/i18n";
import { isAndroidNative, nativePlugin } from "@/lib/native/geniusfiles-native";

const mem = new Map<string, Uint8Array>();

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/**
 * Return a writable path suitable for transient work (preview, staging).
 *
 * On Android `/tmp` does NOT exist — writing there fails with IO_FAILED.
 * We fall back to the app's private cache directory instead, and on web
 * we return a virtual key routed to the in-memory map.
 */
export function resolveTempPath(name: string): string {
  const safe = name.replace(/[^\w.-]+/g, "_") || "document.pdf";
  if (isAndroidNative()) {
    // Android app-private cache is always writable and auto-cleaned by
    // the OS. Path chosen to match GeniusFilesNativePlugin.getCacheDir().
    return `/data/local/tmp/gf-cache/${Date.now()}-${safe}`;
  }
  return `mem://tmp/${Date.now()}-${safe}`;
}

export async function readBytes(absolutePath: string): Promise<Uint8Array> {
  // In-memory virtual paths (web preview + resolveTempPath fallback).
  if (absolutePath.startsWith("mem://")) {
    const cached = mem.get(absolutePath);
    if (cached) return cached;
    throw new Error(t("system.io.previewMissing"));
  }
  if (isAndroidNative()) {
    const p = nativePlugin();
    if (!p) throw new Error("Plugin indisponible");
    const res = await p.readFileBase64({ path: absolutePath });
    return base64ToBytes(res.data);
  }
  const cached = mem.get(absolutePath);
  if (cached) return cached;
  throw new Error(t("system.io.previewMissing"));
}

export async function writeBytes(
  absolutePath: string,
  bytes: Uint8Array,
  opts: { overwrite?: boolean; autoRename?: boolean } = {},
): Promise<{ path: string; size: number }> {
  // Virtual in-memory sink — used by preview generation on every runtime.
  if (absolutePath.startsWith("mem://")) {
    mem.set(absolutePath, bytes);
    return { path: absolutePath, size: bytes.byteLength };
  }
  // Default policy: never silently overwrite an existing user file. When
  // caller does not force overwrite, auto-suffix "(2)", "(3)"… so tools
  // never surface a raw EXISTS error and never destroy previous exports.
  const overwrite = opts.overwrite === true;
  const autoRename = opts.autoRename ?? !overwrite;
  let target = absolutePath;
  if (!overwrite && autoRename) {
    const slash = absolutePath.lastIndexOf("/");
    const dir = slash >= 0 ? absolutePath.slice(0, slash) : "";
    const name = slash >= 0 ? absolutePath.slice(slash + 1) : absolutePath;
    if (await pathExists(target)) target = await resolveAvailablePath(dir, name);
  }
  if (isAndroidNative()) {
    const p = nativePlugin();
    if (!p) throw new Error("Plugin indisponible");
    try {
      return await p.writeFileBase64({
        path: target,
        data: bytesToBase64(bytes),
        overwrite,
      });
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e);
      if (/DENIED/i.test(msg)) {
        throw new Error(t("system.io.storageDenied"));
      }
      if (/EXISTS/i.test(msg)) {
        throw new Error(t("system.io.fileExists"));
      }
      if (/NOT_A_DIRECTORY|NOT_FOUND/i.test(msg)) {
        throw new Error(t("system.io.destMissing"));
      }
      throw new Error(`Écriture impossible — ${msg}`);
    }
  }
  mem.set(target, bytes);
  return { path: target, size: bytes.byteLength };
}

export function memHas(absolutePath: string): boolean {
  return mem.has(absolutePath);
}

/**
 * Non-throwing existence check. Used by the conflict resolver before
 * writing so the user gets Replace / Auto-rename / Cancel options instead
 * of an opaque `EXISTS` error later.
 */
export async function pathExists(absolutePath: string): Promise<boolean> {
  if (absolutePath.startsWith("mem://")) return mem.has(absolutePath);
  if (isAndroidNative()) {
    const p = nativePlugin();
    if (!p) return false;
    try {
      await p.stat({ path: absolutePath });
      return true;
    } catch {
      return false;
    }
  }
  return mem.has(absolutePath);
}

function splitNameExt(filename: string): { base: string; ext: string } {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return { base: filename, ext: "" };
  return { base: filename.slice(0, dot), ext: filename.slice(dot) };
}

/**
 * Given a target directory + preferred filename, returns the first available
 * variant: `document.pdf`, `document (2).pdf`, `document (3).pdf`, …
 * Used by "Renommer automatiquement" in the conflict resolver.
 */
export async function resolveAvailablePath(dir: string, filename: string): Promise<string> {
  const { base, ext } = splitNameExt(filename);
  const cleanDir = dir.replace(/\/+$/, "");
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? filename : `${base} (${i})${ext}`;
    const abs = `${cleanDir}/${candidate}`;

    if (!(await pathExists(abs))) return abs;
  }
  // Safety fallback with a timestamp — should never realistically hit.
  return `${cleanDir}/${base}-${Date.now()}${ext}`;
}
