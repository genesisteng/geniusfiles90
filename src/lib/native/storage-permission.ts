/**
 * Storage permission API — thin re-export over the native bridge.
 *
 * Kept as a separate module so the rest of the app (onboarding gate,
 * error states, refresh handlers) can import a single stable contract
 * regardless of the underlying implementation.
 */
import {
  checkAllFilesAccess,
  isAndroidNative,
  requestAllFilesAccess,
  type StoragePermissionState,
} from "./geniusfiles-native";

export type { StoragePermissionState };

export async function checkStoragePermission(): Promise<StoragePermissionState> {
  return checkAllFilesAccess();
}

export async function requestStoragePermission(): Promise<{ ok: boolean; message?: string }> {
  return requestAllFilesAccess();
}

/** Kept for backwards compatibility with existing call sites. */
export async function openStoragePermissionSettings(): Promise<{ ok: boolean; message?: string }> {
  return requestAllFilesAccess();
}

export function isStorageManaged(): boolean {
  return isAndroidNative();
}
