/**
 * PickLayer — couche « mode sélection » de GeniusFiles.
 *
 * Elle ne contient AUCUNE interface propre : elle affiche les écrans
 * officiels de l'application (accueil / gestionnaire de fichiers,
 * catégories, fichiers récents, recherche) au-dessus de la
 * fonctionnalité qui a demandé la sélection. Celle-ci reste montée : son
 * contexte (fichiers déjà chargés, annotations, options) est intégralement
 * conservé, et la validation lui renvoie directement les éléments choisis.
 */
import { Suspense, lazy } from "react";

import { AppsPickScreen } from "@/components/files/AppsPickScreen";
import { PickBar } from "@/components/files/PickBar";
import { PickLayerProvider } from "@/components/files/pick-layer-context";
import { LoadingState } from "@/components/files/StateViews";
import { cancelPick, popPickScreen, usePickRequest, usePickScreen } from "@/lib/files/pick-session";
import { BACK_PRIORITY, useBackHandler } from "@/lib/navigation/back-stack";

const HomeScreen = lazy(() => import("@/routes/index").then((m) => ({ default: m.FilesPage })));
const CategoryScreen = lazy(() =>
  import("@/routes/categorie.$kind").then((m) => ({ default: m.CategoryPage })),
);
const RecentsScreen = lazy(() =>
  import("@/routes/fichiers-recents").then((m) => ({ default: m.AddedFilesPage })),
);
const SearchScreen = lazy(() =>
  import("@/routes/recherche").then((m) => ({ default: m.SearchPage })),
);

export function PickLayer() {
  const request = usePickRequest();
  const screen = usePickScreen();

  useBackHandler(
    request !== null,
    () => {
      if (popPickScreen()) return true;
      cancelPick();
      return true;
    },
    BACK_PRIORITY.overlay,
  );

  if (!request) return null;

  return (
    <PickLayerProvider value={true}>
      {/* z au-dessus des feuilles (z-3000) éventuellement ouvertes par
          l'écran appelant : aucun ancien écran ne peut rester visible. */}
      {/* `data-scroll-root` : ce conteneur défile à la place de la
          fenêtre — les listes virtualisées s'y rattachent, sinon leurs
          lignes restent bloquées en haut (bande vide à l'écran). */}
      <div
        data-scroll-root
        className="fixed inset-0 z-[3500] overflow-y-auto overscroll-contain bg-background"
      >
        <Suspense fallback={<LoadingState />}>
          {screen.kind === "home" ? <HomeScreen /> : null}
          {screen.kind === "category" ? <CategoryScreen kind={screen.category} /> : null}
          {screen.kind === "apps" ? <AppsPickScreen request={request} /> : null}
          {screen.kind === "recents" ? <RecentsScreen /> : null}
          {screen.kind === "search" ? <SearchScreen /> : null}
        </Suspense>
        <PickBar request={request} />
      </div>
    </PickLayerProvider>
  );
}
