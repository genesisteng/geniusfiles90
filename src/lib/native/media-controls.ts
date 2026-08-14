/**
 * Volume multimédia système et luminosité réelle de la fenêtre.
 *
 * Les gestes verticaux du lecteur pilotaient auparavant des valeurs
 * fictives (`video.volume`, `filter: brightness()`), invisibles pour le
 * système et désynchronisées des boutons physiques. Ces ponts agissent sur
 * `AudioManager.STREAM_MUSIC` et `WindowManager.LayoutParams.screenBrightness`.
 *
 * Hors Android, des replis purement web conservent une prévisualisation
 * fonctionnelle (volume de l'élément, filtre CSS).
 */
import { isAndroidNative, nativePlugin } from "./geniusfiles-native";

type Plugin = {
  getMediaVolume?: () => Promise<{ value: number; index: number; max: number }>;
  setMediaVolume?: (o: { value: number }) => Promise<{ value: number }>;
  getWindowBrightness?: () => Promise<{ value: number }>;
  setWindowBrightness?: (o: { value: number }) => Promise<{ value: number }>;
};

function plugin(): Plugin | null {
  return nativePlugin() as unknown as Plugin | null;
}

export function hasNativeVolume(): boolean {
  return isAndroidNative() && typeof plugin()?.setMediaVolume === "function";
}

export function hasNativeBrightness(): boolean {
  return isAndroidNative() && typeof plugin()?.setWindowBrightness === "function";
}

/** Volume média système, normalisé 0→1. `null` si indisponible. */
export async function getSystemVolume(): Promise<number | null> {
  const p = plugin();
  if (!hasNativeVolume() || !p?.getMediaVolume) return null;
  try {
    const r = await p.getMediaVolume();
    return Math.max(0, Math.min(1, r.value));
  } catch {
    return null;
  }
}

export async function setSystemVolume(value: number): Promise<boolean> {
  const p = plugin();
  if (!hasNativeVolume() || !p?.setMediaVolume) return false;
  try {
    await p.setMediaVolume({ value: Math.max(0, Math.min(1, value)) });
    return true;
  } catch {
    return false;
  }
}

/** Luminosité de la fenêtre du lecteur, 0→1. `null` si indisponible. */
export async function getWindowBrightness(): Promise<number | null> {
  const p = plugin();
  if (!hasNativeBrightness() || !p?.getWindowBrightness) return null;
  try {
    const r = await p.getWindowBrightness();
    return r.value < 0 ? null : Math.max(0, Math.min(1, r.value));
  } catch {
    return null;
  }
}

export async function setWindowBrightness(value: number): Promise<boolean> {
  const p = plugin();
  if (!hasNativeBrightness() || !p?.setWindowBrightness) return false;
  try {
    await p.setWindowBrightness({ value: Math.max(0.01, Math.min(1, value)) });
    return true;
  } catch {
    return false;
  }
}

/** Rend la luminosité au système (à la fermeture du lecteur). */
export async function releaseWindowBrightness(): Promise<void> {
  const p = plugin();
  if (!hasNativeBrightness() || !p?.setWindowBrightness) return;
  try {
    await p.setWindowBrightness({ value: -1 });
  } catch {
    /* ignore */
  }
}
