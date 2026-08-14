/**
 * "Ouvrir avec…" bridge.
 *
 * On Android the FileProvider intent is triggered through the native
 * bridge (when `openWith` is exposed on window.GeniusFilesNative). On the
 * web preview we fall back to the Web Share API, then to a plain new-tab
 * navigation, then to a toast.
 */
import { toast } from "sonner";
import { nativePlugin } from "@/lib/native/geniusfiles-native";

import type { FileEntry, PathRef } from "@/lib/files/types";
import { absolutePathOf, sourceUrlOf } from "./source";
import { touchRecentEntry } from "@/lib/recents/store";
import { t } from "@/lib/i18n";

/** Which Android intent the caller wants: view, edit, or "set as". */
export type OpenWithAction = "view" | "edit" | "setAs";

type NativeBridge = {
  openWith?: (payload: {
    path: string;
    mime?: string;
    name: string;
    action?: OpenWithAction;
  }) => Promise<void> | void;
};

function bridge(): NativeBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { GeniusFilesNative?: NativeBridge }).GeniusFilesNative ?? null;
}

export async function openWithSystem(
  parent: PathRef,
  entry: FileEntry,
  action: OpenWithAction = "view",
): Promise<void> {
  const path = absolutePathOf(parent, entry);
  const url = sourceUrlOf(parent, entry);
  touchRecentEntry(parent, entry, "open");

  const b = bridge();
  if (b?.openWith) {
    try {
      await b.openWith({ path, name: entry.name, action });
      return;
    } catch (e) {
      toast.error(t("native.openWith.noApp"));
      console.error(e);
      return;
    }
  }

  // Capacitor plugin: real Android chooser intent (`openFile`).
  const plug = nativePlugin() as unknown as {
    openFile?: (o: { path: string; action?: string }) => Promise<unknown>;
  } | null;
  if (plug?.openFile) {
    try {
      await plug.openFile({ path, action });
      return;
    } catch (e) {
      toast.error(t("native.openWith.noApp"));
      console.error(e);
      return;
    }
  }

  // Web fallback — Share API is the closest equivalent to Android's chooser.
  if (url && typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
        title: entry.name,
        url,
      });
      return;
    } catch {
      /* user cancelled */
    }
  }

  if (url && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  toast.info(t("native.openWith.unavailableWeb"));
}
