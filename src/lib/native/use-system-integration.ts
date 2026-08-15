/**
 * Wires the Lot 3 system-integration surface into the React tree:
 *
 *  1. Register dynamic App Shortcuts once, on the first mount.
 *  2. Handle the launch intent (Shortcut deep-link → router.navigate;
 *     external VIEW/SEND uri → toast + `gf:open-external-uri` event
 *     that UniversalViewer / gestionnaire can subscribe to).
 *  3. Push a fresh widget summary each time storage stats change.
 *
 * Web / SSR: every native call short-circuits to a no-op inside the
 * bridge, so this hook is safe to run in the Lovable preview too.
 */
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { getStorageStats } from "./geniusfiles-native";
import {
  consumeLaunchIntent,
  registerDefaultShortcuts,
  updateWidgetSummary,
} from "./system-integration";
import { scheduleIdleSweep } from "./temp-sweep";
import { t } from "@/lib/i18n";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 100 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

async function pushWidgetSummary(): Promise<void> {
  const stats = await getStorageStats();
  if (!stats) return;
  await updateWidgetSummary(`${formatBytes(stats.free)} libres sur ${formatBytes(stats.total)}`);
}

export function useSystemIntegration(): void {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    void registerDefaultShortcuts();
    // Lot 5 — reclaim yesterday's thumbnails / extraction scratch on idle.
    scheduleIdleSweep();

    const handleLaunchIntent = async () => {
      const intent = await consumeLaunchIntent();
      if (cancelled || !intent) return;

      if (intent.route) {
        try {
          router.navigate({ to: intent.route as never });
        } catch {
          /* unknown route — ignore */
        }
        // Widget « Fichiers récents » : la route porte aussi le fichier visé.
        if (intent.uri || intent.path) {
          window.dispatchEvent(
            new CustomEvent("gf:open-external-uri", {
              detail: {
                uri: intent.uri,
                path: intent.path,
                mime: intent.mime,
                action: intent.action,
              },
            }),
          );
        }
        return;
      }

      if (intent.uri || intent.path) {
        window.dispatchEvent(
          new CustomEvent("gf:open-external-uri", {
            detail: {
              uri: intent.uri,
              path: intent.path,
              mime: intent.mime,
              action: intent.action,
            },
          }),
        );
        if (!intent.source) toast.info(t("system.native.openedFromOtherApp"));
      } else if (intent.uris?.length) {
        window.dispatchEvent(
          new CustomEvent("gf:open-external-uri", {
            detail: { uris: intent.uris, mime: intent.mime, action: intent.action },
          }),
        );
        toast.info(t("system.native.openedFromOtherApp"));
      }
    };

    void handleLaunchIntent();
    // L'app déjà ouverte reçoit les appuis suivants sur un widget / raccourci.
    const onRelaunch = () => {
      void handleLaunchIntent();
    };
    window.addEventListener("gf:launch-intent", onRelaunch);

    // Initial widget refresh + refresh on any filesystem change (throttled).
    void pushWidgetSummary();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        void pushWidgetSummary();
      }, 5_000);
    };
    window.addEventListener("gf:storage-changed", onChange);

    return () => {
      cancelled = true;
      window.removeEventListener("gf:launch-intent", onRelaunch);
      window.removeEventListener("gf:storage-changed", onChange);
      if (pending) clearTimeout(pending);
    };
  }, [router]);
}
