import { Capacitor } from "@capacitor/core";
import { Filesystem } from "@capacitor/filesystem";
import type { StorageLocation } from "./types";
import { listDirRaw } from "./driver";
import { t } from "@/lib/i18n";

/**
 * Canonical internal storage: the shared user-visible root of the
 * device (`/storage/emulated/0`). Requires `MANAGE_EXTERNAL_STORAGE`
 * (or the legacy `READ_EXTERNAL_STORAGE`) permission to enumerate.
 */
export const INTERNAL_LOCATION: StorageLocation = {
  id: "internal",
  label: "Stockage interne",
  hint: t("system.memoirePrincipaleDeLAppareil"),
  kind: "internal",
  directory: "ExternalStorage",
};

/** Mount points we should never surface (Android internals). */
const SKIP_MOUNTS = new Set(["emulated", "self", "enc_emulated", "container"]);

/**
 * Probe `/storage` for removable volumes (SD card / USB OTG) that the
 * user has actually granted access to. Returns an empty list when
 * nothing is mounted or we're not running natively.
 */
export async function detectExternalLocations(): Promise<StorageLocation[]> {
  if (!Capacitor.isNativePlatform()) return [];
  const out: StorageLocation[] = [];
  try {
    // Read /storage as an absolute path — no Directory scope.
    const res = await Filesystem.readdir({ path: "/storage" });
    for (const entry of res.files) {
      if (entry.type !== "directory") continue;
      if (SKIP_MOUNTS.has(entry.name)) continue;
      const absolutePath = `/storage/${entry.name}`;
      // Confirm we can actually read it — otherwise it's not truly mounted
      // or the user hasn't granted access.
      const probe = await listDirRaw({ absolutePath }, "");
      if (!probe.supported || probe.reason) continue;
      const isUsb =
        /^[A-Fa-f0-9]{4}-?[A-Fa-f0-9]{4}$/.test(entry.name) === false &&
        !/^[A-Za-z0-9-]{6,}$/.test(entry.name);
      out.push({
        id: `external-${entry.name}`,
        label: isUsb ? t("storage.usbDevice") : t("storage.sdCard"),
        hint: absolutePath,
        kind: "external",
        absolutePath,
        removable: true,
      });
    }
  } catch {
    // /storage isn't listable on this device — no removable media.
  }
  return out;
}

export async function detectStorageLocations(): Promise<StorageLocation[]> {
  const ext = await detectExternalLocations();
  return [INTERNAL_LOCATION, ...ext];
}

export function locationById(list: StorageLocation[], id: string): StorageLocation {
  return list.find((l) => l.id === id) ?? INTERNAL_LOCATION;
}
