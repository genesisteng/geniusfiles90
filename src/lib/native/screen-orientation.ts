/**
 * Orientation réelle de l'activité Android.
 *
 * `screen.orientation.lock()` est refusé dans la WebView Capacitor (aucun
 * plein écran document). Le plugin natif agit donc directement sur
 * `Activity.requestedOrientation`, ce qui fait pivoter *toute* l'interface
 * du lecteur — et non uniquement l'élément vidéo.
 */
import { isAndroidNative, nativePlugin } from "./geniusfiles-native";

export type OrientationMode = "portrait" | "landscape" | "auto";

type Plugin = {
  setOrientation?: (o: { mode: OrientationMode }) => Promise<{ mode: OrientationMode }>;
  getOrientation?: () => Promise<{ mode: OrientationMode; landscape: boolean }>;
};

function plugin(): Plugin | null {
  return nativePlugin() as unknown as Plugin | null;
}

export async function setOrientation(mode: OrientationMode): Promise<boolean> {
  const p = plugin();
  if (isAndroidNative() && p?.setOrientation) {
    try {
      await p.setOrientation({ mode });
      return true;
    } catch {
      /* repli navigateur ci-dessous */
    }
  }
  try {
    const so = (
      screen as Screen & {
        orientation?: { lock?: (t: string) => Promise<void>; unlock?: () => void };
      }
    ).orientation;
    if (mode === "auto") {
      so?.unlock?.();
      return true;
    }
    if (so?.lock) {
      await so.lock(mode);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Vrai quand la fenêtre est effectivement plus large que haute. */
export function isLandscapeViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth > window.innerHeight;
}
