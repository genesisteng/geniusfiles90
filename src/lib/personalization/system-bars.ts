/**
 * Synchronisation des barres système Android avec le thème actif.
 *
 * GeniusFiles propose deux thèmes : sombre et clair. Les barres système
 * restent toujours transparentes (edge-to-edge) et seul le style des
 * icônes change :
 *  - thème sombre  → icônes claires (Style.Dark)
 *  - thème clair   → icônes sombres (Style.Light)
 *
 * Aucune couleur de fond n'est peinte derrière la barre d'état : c'est le
 * contenu de la page qui remonte sous la barre, ce qui évite toute bande
 * blanchâtre parasite et tout recouvrement du contenu.
 *
 * Tous les appels natifs sont dynamiques : no-op sur le web / SSR.
 */
import type { ResolvedTheme } from "./types";

/** Couleurs de fond officielles par thème (`<meta name="theme-color">`). */
export const THEME_BACKGROUND: Record<ResolvedTheme, string> = {
  dark: "#191919",
  light: "#f5f6f8",
};

const TRANSPARENT = "#00000000";

let appliedTheme: ResolvedTheme | null = null;
let nativeApplyVersion = 0;

async function applyNative(theme: ResolvedTheme): Promise<void> {
  const { StatusBar, Style } = await import("@capacitor/status-bar");

  // Le style des icônes est appliqué EN PREMIER et isolé : sur Android 15+,
  // `setOverlaysWebView` et `setBackgroundColor` lèvent une exception.
  // Style.Dark = contenu clair (icônes blanches) → thème sombre.
  // Style.Light = contenu sombre (icônes noires) → thème clair.
  try {
    await StatusBar.setStyle({ style: theme === "light" ? Style.Light : Style.Dark });
  } catch {
    /* plugin indisponible */
  }

  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    /* non supporté (Android 15+) — déjà edge-to-edge nativement */
  }
  try {
    await StatusBar.setBackgroundColor({ color: TRANSPARENT });
  } catch {
    /* non supporté (Android 15+) — la barre est déjà transparente */
  }

  // Synchronise aussi la barre de navigation et mémorise le thème côté
  // activité. Le pont est absent sur le web et sur les anciens APK.
  try {
    const { nativeBridge } = await import("@/lib/native/geniusfiles-native");
    const native = nativeBridge<{
      applySystemBarTheme(o: { light: boolean }): Promise<void>;
    }>();
    await native.applySystemBarTheme({ light: theme === "light" });
  } catch {
    /* fallback StatusBar déjà appliqué */
  }
}

/**
 * Applique l'apparence des barres système pour le thème donné.
 * `force` ignore le cache (retour au premier plan, plugin prêt tardivement).
 */
export function syncSystemBars(theme: ResolvedTheme = "dark", force = false): void {
  if (typeof window === "undefined") return;
  if (!force && appliedTheme === theme) return;
  appliedTheme = theme;
  const version = ++nativeApplyVersion;

  void (async () => {
    try {
      await applyNative(theme);
      // Certaines ROM réinitialisent le style juste après le premier rendu.
      setTimeout(() => {
        // Un nouveau choix peut être arrivé pendant le délai : ne jamais
        // réappliquer une ancienne couleur de barre par-dessus le thème actif.
        if (version === nativeApplyVersion) void applyNative(theme).catch(() => {});
      }, 350);
    } catch {
      /* pas de plateforme native */
    }
  })();
}

/** Met à jour `<meta name="theme-color">` (barre système WebView / PWA). */
export function syncThemeColorMeta(theme: ResolvedTheme = "dark"): void {
  if (typeof document === "undefined") return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = THEME_BACKGROUND[theme];
}
