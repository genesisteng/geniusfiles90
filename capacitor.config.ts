import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for GeniusFiles.
 *
 * webDir points to the static SPA export produced by `bun run build:mobile`.
 * The web/SSR build (`bun run build`) is unaffected — this file is consumed
 * only by the Capacitor CLI during the native mobile build pipeline.
 */
const config: CapacitorConfig = {
  appId: "app.geniusfiles.mobile",
  appName: "GeniusFiles",
  webDir: "dist-mobile",
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    // captureInput must stay false — when true, the WebView intercepts
    // hardware/IME key events, which disables Gboard suggestions, auto-
    // capitalization and autocorrect across every input in the app
    // (assistant, search, rename, folder name, etc.).
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      // Le splash n'est PLUS masqué après un délai arbitraire : il reste
      // visible jusqu'à ce que l'interface soit réellement prête, puis
      // `hideSplash()` (src/lib/native/splash.ts) le retire en fondu.
      // Résultat : aucun écran blanc/noir, aucun clignotement, aucune
      // reconstruction visible entre le splash et l'accueil.
      launchAutoHide: false,
      // Android 12+ utilise @color/splash_background (avec values-night).
      // Cette valeur ne sert que de fallback Capacitor pré-Android 12.
      backgroundColor: "#f5f6f8",
      showSpinner: false,
      androidSpinnerStyle: "small",
      androidSplashResourceName: "splash",
      // FIT_CENTER keeps the entire brand mark visible without cropping
      // on tall phones. CENTER_CROP was scaling the 2732x2732 splash to
      // fill the viewport, clipping the logo edges on 20:9 devices.
      androidScaleType: "FIT_CENTER",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
