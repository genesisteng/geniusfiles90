import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Aucune View Transition : sur WebView Android elle fige un instantané
    // de la page pendant toute la durée du changement, ce qui rendait le
    // passage d'une section à l'autre visiblement lent. L'apparition est
    // désormais assurée par une seule animation CSS (`gf-page`), identique
    // pour Accueil, Genius Ai, Automatisations et Paramètres.
    defaultViewTransition: false,
    // Un état de chargement n'apparaît que si l'écran tarde vraiment :
    // les navigations normales sont instantanées, sans clignotement.
    defaultPendingMs: 400,
    defaultPendingMinMs: 0,
    // Précharge la route dès que l'utilisateur survole/pointe un lien
    // (~50 ms), rendant la navigation quasi-instantanée.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
