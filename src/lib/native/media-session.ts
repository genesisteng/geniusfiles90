/**
 * Native media notification bridge for the audio player.
 *
 * On Android (Capacitor) this talks to `GeniusFilesNative`'s media session
 * methods which post a foreground-service notification with Prev / Play-Pause
 * / Next / Stop action buttons and keep the WebView audio alive while the
 * app is backgrounded or the screen is locked.
 *
 * On web / preview these are no-ops so nothing throws.
 */
import { nativePlugin, isAndroidNative } from "./geniusfiles-native";

export type MediaSessionPayload = {
  title: string;
  artist: string;
  playing: boolean;
  position?: number;
  duration?: number;
  artworkBase64?: string;
};

export type MediaAction = "play" | "pause" | "toggle" | "next" | "prev" | "stop" | "open";

type MediaPlugin = {
  mediaSessionStart?: (o: MediaSessionPayload) => Promise<void>;
  mediaSessionUpdate?: (o: Partial<MediaSessionPayload>) => Promise<void>;
  mediaSessionStop?: () => Promise<void>;
  addListener?: (
    event: string,
    cb: (data: unknown) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
};

function plugin(): MediaPlugin | null {
  return (nativePlugin() as unknown as MediaPlugin | null) ?? null;
}

export function isMediaSessionAvailable(): boolean {
  return isAndroidNative() && typeof plugin()?.mediaSessionStart === "function";
}

export async function mediaSessionStart(p: MediaSessionPayload): Promise<void> {
  const pl = plugin();
  if (!pl?.mediaSessionStart) return;
  try {
    await pl.mediaSessionStart(p);
  } catch {
    /* ignore */
  }
}

export async function mediaSessionUpdate(p: Partial<MediaSessionPayload>): Promise<void> {
  const pl = plugin();
  if (!pl?.mediaSessionUpdate) return;
  try {
    await pl.mediaSessionUpdate(p);
  } catch {
    /* ignore */
  }
}

export async function mediaSessionStop(): Promise<void> {
  const pl = plugin();
  if (!pl?.mediaSessionStop) return;
  try {
    await pl.mediaSessionStop();
  } catch {
    /* ignore */
  }
}

const localBus = new Set<(a: MediaAction) => void>();
let nativeWired = false;

function wireNative() {
  if (nativeWired) return;
  nativeWired = true;
  const pl = plugin();
  if (!pl?.addListener) return;
  try {
    void pl.addListener("mediaAction", (data) => {
      const a = (data as { action?: string })?.action as MediaAction | undefined;
      if (!a) return;
      for (const fn of localBus) {
        try {
          fn(a);
        } catch {
          /* ignore */
        }
      }
    });
    void pl.addListener("mediaOpenRequested", () => {
      for (const fn of localBus) {
        try {
          fn("open");
        } catch {
          /* ignore */
        }
      }
    });
  } catch {
    /* ignore */
  }
}

export function onMediaAction(cb: (a: MediaAction) => void): () => void {
  wireNative();
  localBus.add(cb);
  return () => {
    localBus.delete(cb);
  };
}
