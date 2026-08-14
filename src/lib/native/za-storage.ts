import { registerPlugin, Capacitor } from "@capacitor/core";

export interface ZaStoragePlugin {
  check(): Promise<{ granted: boolean }>;
  request(): Promise<{ granted: boolean; opened?: boolean }>;
  stats(options?: { path?: string }): Promise<{ total: number; free: number; used: number }>;
}

/** Native "All files access" + StatFs bridge. Only functional on Android. */
export const ZaStorage = registerPlugin<ZaStoragePlugin>("ZaStorage");

export const hasZaStorage = () => Capacitor.getPlatform() === "android";
