/**
 * Version de l'application, injectée au build depuis `package.json`
 * (voir `vite.config.ts`). Source unique partagée par l'écran « À propos »
 * et le `versionName` Android (`scripts/apply-android-overrides.mjs`).
 */
declare const __APP_VERSION__: string;
