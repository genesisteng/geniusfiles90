import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import {
  GfAutomations,
  GfGeniusAi,
  GfHome,
  GfSettings,
  type GfIconComponent,
} from "@/components/icons";
import { type ReactNode } from "react";
import { PlayerHost } from "@/components/player/PlayerHost";
import { QuickScrollFab } from "@/components/common/QuickScrollFab";
import { ScrollFeel } from "@/components/common/ScrollFeel";
import { TransferTracker } from "@/components/jobs/TransferTracker";
import { useReaderMode } from "@/lib/viewer/reader-mode";
import { useInPickLayer } from "@/components/files/pick-layer-context";
import { PackageSheetHost } from "@/components/files/PackageSheet";
import { IncomingFileHost } from "@/components/viewer/IncomingFileHost";

type NavItem = {
  to: string;
  labelKey: "nav.home" | "nav.assistant" | "nav.automations" | "nav.settings";
  icon: GfIconComponent;
};

/* Quatre destinations, ni plus ni moins : la barre se divise en quatre
   colonnes de largeur strictement identique. */
const NAV: NavItem[] = [
  { to: "/", labelKey: "nav.home", icon: GfHome },
  { to: "/assistant", labelKey: "nav.assistant", icon: GfGeniusAi },
  { to: "/automatisations", labelKey: "nav.automations", icon: GfAutomations },
  { to: "/parametres", labelKey: "nav.settings", icon: GfSettings },
];

export function AppShell({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  /* Pendant la lecture d'un document, la navigation principale est
     entièrement retirée de l'arbre : aucune hauteur, aucun événement. */
  const reader = useReaderMode();
  /* Rendu à l'intérieur d'une session de sélection : la navigation
     principale, le lecteur et les suivis sont déjà montés par l'écran
     appelant — on ne les duplique pas. */
  const inPick = useInPickLayer();
  const isHome = pathname === "/" || inPick;
  /* Écrans dotés d'un en-tête collant (FilesTopBar ou PageHeader) : ils
     absorbent eux-mêmes l'inset supérieur. Un padding ici laisserait une
     bande vide au-dessus du titre. */
  const ownsSafeArea =
    isHome ||
    [
      "/categorie",
      "/parametres",
      "/automatisations",
      "/pdf-outils",
      "/corbeille",
      "/coffre-fort",
      "/fichiers-recents",
      "/nettoyeur",
      "/applications",
    ].some((p) => pathname.startsWith(p));
  /* La conversation gère elle-même sa hauteur et son espace bas (nav + clavier). */
  const isChat = pathname.startsWith("/assistant");

  return (
    <div
      /* overflow-x-clip (et non hidden) : « hidden » crée un conteneur de
         défilement qui casse position:sticky des en-têtes. */
      className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col overflow-x-clip bg-background"
    >
      <main
        className={
          isChat
            ? "flex h-dvh min-h-0 flex-1 flex-col overflow-hidden px-0 pb-0 pt-0"
            : `flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] ${
                ownsSafeArea ? "pt-0" : "pt-safe"
              }`
        }
      >
        {/* Aucune clé sur le conteneur : une clé par chemin remonterait
            tout l'écran à chaque navigation (perte d'état, de position de
            défilement et clignotement au retour). */}
        <div className={isChat ? "gf-page flex min-h-0 flex-1 flex-col" : "gf-page"}>
          {children ?? <Outlet />}
        </div>
      </main>
      {inPick ? null : <PlayerHost />}
      {/* Fiche paquet Android (APK / AAB / XAPK) : montée une seule fois,
          partagée par tous les écrans qui listent des fichiers. */}
      <PackageSheetHost />
      {/* « Ouvrir avec… » entrant : fichier confié par une autre
          application Android, affiché dans la visionneuse universelle. */}
      {inPick ? null : <IncomingFileHost />}
      {/* Sensation de défilement native : résistance de bord sur le seul
          contenu + tirer pour actualiser (jamais en mode lecture). */}
      {reader || inPick ? null : <ScrollFeel />}

      {/* Navigation verticale rapide : la fenêtre est le conteneur défilant
          de tous les écrans de listes. */}
      {isChat || reader || inPick ? null : <QuickScrollFab topInset={72} bottomInset={104} />}
      {/* Copies / déplacements en arrière-plan : suivi permanent (sans interface). */}
      {inPick ? null : <TransferTracker />}
      {reader || inPick ? null : <BottomNav pathname={pathname} />}
      {/* Écran opaque de la barre d'état. */}
      {reader ? null : (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-50 h-safe-top bg-background"
        />
      )}
    </div>
  );
}

/**
 * Barre de navigation principale.
 *
 * Composition : quatre colonnes strictement égales (`flex-1 basis-0`), donc
 * un équilibre parfait quelle que soit la longueur du libellé. Aucun calcul
 * de position en JavaScript, aucune mesure au redimensionnement : l'état
 * actif est un simple aplat compact derrière l'icône, animé par CSS.
 */
function BottomNav({ pathname }: { pathname: string }) {
  const t = useT();
  const activeTo =
    NAV.find(({ to }) => (to === "/" ? pathname === "/" : pathname.startsWith(to)))?.to ?? null;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[560px] justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pl-safe pr-safe"
      aria-label={t("home.nav.aria")}
    >
      <div className="pointer-events-auto flex w-full items-stretch rounded-[26px] bg-nav-bar px-1.5 py-1.5 shadow-[0_12px_32px_-10px_rgb(11_63_143/0.45)]">
        {NAV.map(({ to, labelKey, icon: Icon }) => {
          const active = to === activeTo;
          return (
            <Link
              key={to}
              to={to}
              /* Les quatre destinations sont préchargées dès l'affichage de
                 la barre : passer d'une section à l'autre n'attend plus
                 aucun chargement de module. */
              preload="render"
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-[20px] px-0.5 py-1 transition-transform duration-150 ease-out active:scale-95"
            >
              <span
                aria-hidden
                className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-200 ease-out ${
                  active ? "bg-nav-pill" : "bg-transparent"
                }`}
              >
                <Icon
                  className={`h-[22px] w-[22px] shrink-0 transition-colors duration-200 ease-out ${
                    active ? "text-nav-pill-foreground" : "text-nav-inactive"
                  }`}
                  strokeWidth={1.5}
                />
              </span>
              <span
                className={`w-full truncate text-center text-[10.5px] leading-none transition-colors duration-200 ease-out ${
                  active ? "font-semibold text-nav-pill" : "font-medium text-nav-inactive"
                }`}
              >
                {t(labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
