/**
 * Pilotage du SplashScreen natif.
 *
 * `capacitor.config.ts` désactive `launchAutoHide` : le splash natif reste
 * donc affiché jusqu'à ce que l'application appelle explicitement
 * `hideSplash()`.
 *
 * Ce masquage est déclenché par `SplashOverlay` UNIQUEMENT après que son
 * illustration a été décodée puis peinte : le splash applicatif recouvre
 * déjà l'écran quand le splash natif s'efface. Aucun trou visuel (blanc,
 * noir, gris) ne peut donc apparaître entre les deux.
 *
 * Le module `@capacitor/splash-screen` est importé dynamiquement afin de ne
 * jamais partir dans le bundle SSR / web.
 */
import { isAndroidNative } from "@/lib/native/geniusfiles-native";

let hidden = false;

/** Masque le splash natif (fondu court). No-op hors Android / si déjà masqué. */
export async function hideSplash(): Promise<void> {
  if (hidden) return;
  hidden = true;
  if (!isAndroidNative()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    // Fondu court : le splash applicatif dessous est strictement identique
    // (même fond, même illustration, même position) — la transition est
    // donc invisible pour l'utilisateur.
    await SplashScreen.hide({ fadeOutDuration: 120 });
  } catch {
    // Plugin absent (build web) — rien à masquer.
  }
}
