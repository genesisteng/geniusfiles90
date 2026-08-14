/**
 * Applier — synchronise les préférences visuelles avec le DOM.
 *
 * GeniusFiles propose deux thèmes complets : sombre (par défaut) et clair.
 * Le thème choisi est posé sur `<html>` sous forme de `data-theme` + classe
 * `dark` (pour la variante Tailwind). Toutes les couleurs sont des jetons
 * CSS : changer d'attribut suffit à repeindre l'application entière, sans
 * reconstruction ni clignotement.
 *
 * Ce module applique également la taille de texte, la densité, les
 * animations, et synchronise les barres système Android.
 */
import { loadPrefs, subscribePrefs, hydratePrefsFromNative } from "./store";
import { syncSystemBars, syncThemeColorMeta } from "./system-bars";
import type { PersonalizationPrefs, ResolvedTheme, ThemeMode } from "./types";

/**
 * Source de vérité du thème système.
 *
 * Dans la WebView Android, `prefers-color-scheme` n'est pas fiable : selon
 * la version du WebView et la politique d'assombrissement algorithmique,
 * la requête média peut rester bloquée sur `dark` alors que le téléphone
 * est en thème clair. L'activité native écrit donc le thème système réel
 * dans un cookie (`gf_sys`) AVANT le chargement de la page, et le met à
 * jour à chaque changement de configuration. Ce cookie est lu de façon
 * synchrone, donc utilisable avant la première frame.
 */
function cookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

let systemThemeOverride: ResolvedTheme | null = null;

function readSystemTheme(): ResolvedTheme {
  if (systemThemeOverride) return systemThemeOverride;
  const native = cookie("gf_sys");
  if (native === "light" || native === "dark") return native;
  if (typeof window === "undefined") return "dark";
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/**
 * Résout le thème effectif. `system` suit Android en permanence.
 */
export function resolveTheme(mode: ThemeMode | undefined): ResolvedTheme {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  if (typeof window === "undefined") return "dark";
  return readSystemTheme();
}

function applyTheme(theme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (root.getAttribute("data-theme") !== theme) {
    root.setAttribute("data-theme", theme);
  }
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  syncThemeColorMeta(theme);
  syncSystemBars(theme, true);
}

function apply(prefs: PersonalizationPrefs) {
  if (typeof document === "undefined") return;
  applyTheme(resolveTheme(prefs.appearance.theme));
}

/** Thème effectivement appliqué au document (lecture sûre côté SSR). */
export function currentTheme(): ResolvedTheme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

let bootstrapped = false;
let personalizationReady: Promise<void> = Promise.resolve();

/** Résolu après la réconciliation localStorage ↔ stockage Android. */
export function awaitPersonalizationReady(): Promise<void> {
  return personalizationReady;
}

export function bootstrapPersonalization() {
  if (bootstrapped) return;
  bootstrapped = true;
  apply(loadPrefs());
  subscribePrefs(apply);
  if (typeof window !== "undefined") {
    // Filet de sécurité : si un rendu (hydratation, remontage du shell)
    // réécrivait les attributs de `<html>`, on les ré-impose dès la frame
    // suivante. Idempotent, aucun coût mesurable.
    requestAnimationFrame(() => apply(loadPrefs()));
    // Garde synchrone : React (hydratation) ou une extension peut réécrire
    // `class`/`data-theme` sur `<html>`. L'observateur corrige AVANT la
    // peinture suivante (microtâche), donc sans clignotement visible.
    try {
      const root = document.documentElement;
      let guarding = false;
      const observer = new MutationObserver(() => {
        if (guarding) return;
        const expected = resolveTheme(loadPrefs().appearance.theme);
        if (
          root.getAttribute("data-theme") === expected &&
          root.classList.contains("dark") === (expected === "dark")
        ) {
          return;
        }
        guarding = true;
        try {
          applyTheme(expected);
        } finally {
          guarding = false;
        }
      });
      observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
    } catch {
      /* MutationObserver indisponible */
    }
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) apply(loadPrefs());
    });
    // Suit le thème Android en direct, sans listener par écran.
    try {
      const media = window.matchMedia("(prefers-color-scheme: light)");
      media.addEventListener("change", () => {
        if (loadPrefs().appearance.theme === "system") apply(loadPrefs());
      });
    } catch {
      /* navigateur ancien */
    }
    // L'activité Android annonce le thème système réel (changement de
    // configuration, retour au premier plan). Prioritaire sur la requête
    // média, qui n'est pas fiable dans la WebView.
    window.addEventListener("gf:system-theme", (e) => {
      const detail = (e as CustomEvent<{ light?: boolean }>).detail;
      systemThemeOverride = detail?.light ? "light" : "dark";
      if (loadPrefs().appearance.theme === "system") apply(loadPrefs());
    });
    // Réconciliation immédiate au démarrage : le plugin natif connaît le
    // mode persisté ET l'état système, même si le stockage WebView a été purgé.
    void (async () => {
      try {
        const { nativeBridge } = await import("@/lib/native/geniusfiles-native");
        const native = nativeBridge<{
          getThemeState(): Promise<{ mode: string; systemLight: boolean }>;
        }>();
        const state = await native.getThemeState();
        systemThemeOverride = state.systemLight ? "light" : "dark";
        apply(loadPrefs());
      } catch {
        /* web / ancien APK */
      }
    })();
    // Restaure les préférences depuis la copie native si le
    // localStorage de la WebView a été purgé.
    personalizationReady = hydratePrefsFromNative()
      .then((restored) => {
        if (restored) apply(restored);
      })
      .catch(() => {});
  }
}

// Auto-bootstrap côté client dès l'import — évite un flash visuel avant
// l'application des préférences (thème, densité, animations, texte).
if (typeof window !== "undefined") {
  bootstrapPersonalization();
}
