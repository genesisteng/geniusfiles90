import { t as translate } from "@/lib/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { useSystemIntegration } from "../lib/native/use-system-integration";
import { StorageAccessDialog } from "../components/storage/StorageAccessDialog";
import { BackNavigator } from "../components/navigation/BackNavigator";
import { PickLayer } from "@/components/files/PickLayer";
import { startAutomationScheduler } from "../lib/automations/scheduler";
import { startMediaIndexer } from "../lib/files/categories";
import { SplashOverlay, SPLASH_ART_SRCSET } from "../components/brand/SplashOverlay";
import { markStartupSignal, onStartupReady } from "../lib/startup/boot";
import { installNativeBehaviors } from "../lib/native/web-behaviors";
import { prefetchRoots } from "../lib/files/fs";
// Bootstrap personnalisation (thème / densité / animations / barres système).
import "../lib/personalization/applier";
import { awaitPersonalizationReady, resolveTheme } from "../lib/personalization/applier";
import { usePrefs } from "../lib/personalization/usePrefs";
import { useInitLocale, useT } from "../lib/i18n";
import { IllustratedEmptyState } from "@/components/ui/IllustratedEmptyState";
import {
  LowSpaceState,
  OperationFailedState,
  UnknownErrorState,
} from "@/components/files/StateViews";

function NotFoundComponent() {
  const t = useT();
  return (
    <div className="flex min-h-dvh items-center justify-center overflow-y-auto bg-background px-4 py-6">
      <IllustratedEmptyState
        id="notFound"
        title={t("copy.notFound.title")}
        description={t("copy.notFound.description")}
        action={
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            {t("copy.notFound.backHome")}
          </Link>
        }
      />
    </div>
  );
}

/**
 * Choisit l'état illustré le plus juste pour une erreur de route :
 * manque d'espace, échec d'une opération identifiée, sinon incident inconnu.
 */
function classifyRootError(error: Error): "lowSpace" | "operationFailed" | "unknownError" {
  const text = `${error?.name ?? ""} ${error?.message ?? ""}`;
  if (/ENOSPC|no space|storage full|quota|QuotaExceeded/i.test(text)) return "lowSpace";
  if (/failed|abort|EBUSY|EEXIST|EPERM|EINVAL|rejected|refus/i.test(text)) return "operationFailed";
  return "unknownError";
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const retry = () => {
    router.invalidate();
    reset();
  };
  const back = () => {
    window.location.href = "/";
  };
  const kind = classifyRootError(error);

  return (
    <div className="flex min-h-dvh items-center justify-center overflow-y-auto bg-background px-4 py-6">
      {kind === "lowSpace" ? (
        <LowSpaceState onFreeSpace={() => (window.location.href = "/nettoyeur")} onRetry={retry} />
      ) : kind === "operationFailed" ? (
        <OperationFailedState onRetry={retry} onBack={back} />
      ) : (
        <UnknownErrorState onRetry={retry} />
      )}
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, interactive-widget=resizes-content",
      },
      { name: "theme-color", content: "#191919" },
      { name: "color-scheme", content: "light dark" },

      { title: "GeniusFiles" },
      {
        name: "description",
        content: translate("app.tagline"),
      },
      { property: "og:title", content: "GeniusFiles" },
      {
        property: "og:description",
        content: translate("app.tagline"),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "GeniusFiles" },
      {
        name: "twitter:description",
        content: translate("app.tagline"),
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/5ae6e955-d890-481d-9b45-928f6fa3122a",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/5ae6e955-d890-481d-9b45-928f6fa3122a",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "apple-touch-icon", href: "/brand/geniusfiles-logo-256.png" },
      // Le logo d'interface est préchargé dans la déclinaison réellement
      // affichée (barre supérieure ≈ 28-64 px) : ~7 Ko au lieu du master
      // 1024² de 1 Mo, qui saturait le chemin critique du cold start.
      {
        rel: "preload",
        href: "/brand/geniusfiles-logo-128.png",
        as: "image",
        type: "image/png",
        fetchPriority: "high",
      },
      // Illustration du splash : préchargée en priorité haute, dans la
      // variante correspondant EXACTEMENT à la densité de l'écran (aucun
      // rééchantillonnage, aucun octet inutile). L'image est donc déjà
      // décodée quand l'overlay se peint : aucune variation de netteté et
      // aucun clignotement à la passation depuis le splash système.
      {
        rel: "preload",
        href: "/brand/geniusfiles-splash-2x.png",
        as: "image",
        type: "image/png",
        fetchPriority: "high",
        imageSrcSet: SPLASH_ART_SRCSET,
        imageSizes: "176px",
      },

      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      // The Google Fonts stylesheet is loaded lazily after hydration (see
      // RootComponent). Injecting it as a render-blocking <link> here would
      // stall first paint on APK cold-start and fail entirely when the
      // WebView boots offline. System-font fallbacks render immediately;
      // Inter/Space Grotesk swap in when the network delivers the sheet.
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/**
 * Script de pré-peinture : lit le thème persisté et le pose sur `<html>`
 * AVANT le premier frame. Aucun clignotement, aucun passage transitoire
 * par le thème sombre quand l'utilisateur a choisi le clair.
 */
const THEME_BOOTSTRAP = `(function(){try{
function ck(n){var x=document.cookie.match(new RegExp("(?:^|; )"+n+"=([^;]*)"));return x?x[1]:null;}
var s=ck("gf_sys");
var m=(s==="light"||s==="dark")?s:(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");
var cm=ck("gf_mode");if(cm==="light"||cm==="dark")m=cm;
var r=null;try{r=localStorage.getItem("gf.prefs.v1")}catch(_){}
var e=document.documentElement;if(r){var p=JSON.parse(r)||{};var a=p.appearance||{};var t=a.theme;
if(t==="light"||t==="dark")m=t;
if(t==="system"&&(s==="light"||s==="dark"))m=s;
if(a.textSize)e.setAttribute("data-text-size",a.textSize);
if(a.density)e.setAttribute("data-density",a.density);
if(a.animations)e.setAttribute("data-animations",a.animations);
if(a.reduceMotion||a.animations==="none")e.setAttribute("data-reduce-motion","1");}
e.setAttribute("data-theme",m);
e.classList.toggle("dark",m==="dark");e.style.colorScheme=m;
var bg=m==="light"?"#f5f6f8":"#191919";
e.style.backgroundColor=bg;
var q=document.querySelector('meta[name="theme-color"]');
if(q)q.setAttribute("content",bg);
}catch(_){}})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    // IMPORTANT : aucun thème n'est écrit ici. Le thème est posé uniquement
    // par THEME_BOOTSTRAP (avant la première frame) puis par l'applier.
    // Rendre `class="dark" data-theme="dark"` en SSR faisait réécrire ces
    // attributs par l'hydratation React, ce qui ramenait l'application au
    // thème sombre à chaque démarrage à froid.
    <html lang="fr" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [prefs] = usePrefs();
  // Langue mémorisée appliquée dès le montage (aucun rechargement).
  useInitLocale();
  // Les notifications reprennent exactement le thème actif.
  const toastTheme = resolveTheme(prefs.appearance.theme);

  // Étape 1 du démarrage : personnalisation restaurée (thème définitif).
  // Le thème persisté est déjà appliqué de façon SYNCHRONE à l'import du
  // module (localStorage), la lecture de la copie native n'est qu'un
  // filet de sécurité pour un stockage WebView purgé. Elle ne doit donc
  // jamais retarder l'ouverture : au-delà d'un court délai, le démarrage
  // continue et la restauration éventuelle s'applique en arrière-plan
  // (repeinture par jetons CSS, sans reconstruction ni clignotement).
  useEffect(() => {
    let done = false;
    const emit = () => {
      if (done) return;
      done = true;
      markStartupSignal("personalization");
    };
    // 90 ms suffisent : le thème persisté est déjà peint (script de
    // pré-peinture), la lecture native n'est qu'un filet de sécurité.
    const deadline = window.setTimeout(emit, 90);
    void awaitPersonalizationReady()
      .catch(() => {})
      .then(() => {
        window.clearTimeout(deadline);
        emit();
      });
    return () => window.clearTimeout(deadline);
  }, []);

  // Filet de sécurité : si le démarrage se fait sur une autre page que
  // l'accueil (lien profond, intention VIEW/SEND), c'est cette page qui
  // clôt le démarrage dès sa première peinture — le splash n'attend jamais
  // un signal qui ne viendra pas.
  useEffect(() => {
    if (router.state.location.pathname === "/") return;
    requestAnimationFrame(() => requestAnimationFrame(() => markStartupSignal("first-screen")));
  }, [router]);

  // Aucun menu contextuel de navigateur, aucune sélection de texte hors
  // champs de saisie : l'application se comporte comme une app Android.
  useEffect(() => installNativeBehaviors(), []);

  // Préchauffage des stockages : tâche NON critique. Elle est repoussée
  // après la fin du démarrage puis exécutée pendant un temps mort, afin de
  // ne consommer aucun cycle CPU ni accès disque avant l'affichage de la
  // première page.
  useEffect(() => {
    let idle: number | undefined;
    const off = onStartupReady(() => {
      const run = () => prefetchRoots();
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback;
      idle = ric ? ric(run) : window.setTimeout(run, 300);
    });
    return () => {
      off();
      if (idle !== undefined) window.clearTimeout(idle);
    };
  }, []);

  // Load remote webfonts *after* the first paint so they never block
  // rendering. Uses the classic "print → all" trick so the browser
  // downloads the sheet at low priority and applies it once ready.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap";
    if (document.querySelector(`link[data-gf="1"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.media = "print";
    link.dataset.gf = "1";
    link.onload = () => {
      link.media = "all";
    };
    document.head.appendChild(link);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SystemIntegrationBridge />
      <BackNavigator />
      {/* L'accueil réel est le point d'entrée : aucune barrière
          d'autorisation ne s'interpose avant l'application. */}
      <Outlet />
      <StorageAccessDialog />
      {/* Mode sélection : l'interface officielle de GeniusFiles est
          présentée par-dessus la fonctionnalité appelante, qui reste
          montée et conserve tout son contexte. */}
      <PickLayer />
      <Toaster
        position="bottom-center"
        theme={toastTheme}
        richColors
        closeButton
        swipeDirections={["left", "right", "bottom"]}
        offset={96}
      />
      <SplashOverlay />
    </QueryClientProvider>
  );
}

function SystemIntegrationBridge() {
  // Registers Android app-shortcuts, handles VIEW/SEND launch intents and
  // refreshes the home-screen widget. No-op off native.
  useSystemIntegration();
  useEffect(() => {
    // Travail NON critique au démarrage : index médias + planificateur
    // d'automatisations. Aucune permission n'est demandée ici (les
    // notifications sont demandées à l'usage réel).
    let stop: (() => void) | undefined;
    const start = () => {
      // Index persistant des catégories : chargé depuis le disque, puis
      // rafraîchi de façon incrémentale. Les catégories s'ouvrent ensuite
      // instantanément, sans jamais relancer d'analyse.
      void startMediaIndexer();
      stop = startAutomationScheduler();
    };
    const canIdle = typeof window !== "undefined" && "requestIdleCallback" in window;
    const idle: number = canIdle
      ? window.requestIdleCallback(start, { timeout: 1500 })
      : window.setTimeout(start, 300);
    return () => {
      if (canIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      stop?.();
    };
  }, []);
  return null;
}
