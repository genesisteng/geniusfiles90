/**
 * Navigation « consciente » de la session de sélection.
 *
 * Les écrans officiels de GeniusFiles (accueil, catégories, fichiers
 * récents, recherche) sont réutilisés tels quels pendant une sélection.
 * Ils naviguent normalement via le routeur ; mais lorsqu'une session de
 * sélection est active, la navigation reste *dans* la session afin que la
 * fonctionnalité appelante ne soit jamais démontée (son contexte est
 * conservé).
 */
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import type { CategoryKind } from "@/lib/files/categories";
import { isPickActive, pushPickScreen } from "@/lib/files/pick-session";

export type AppNavigateOptions = {
  to: string;
  params?: Record<string, string>;
  search?: unknown;
  replace?: boolean;
};

const CATEGORY_KINDS = new Set<string>(["images", "videos", "audio", "documents", "downloads"]);

export function useAppNavigate(): (opts: AppNavigateOptions) => Promise<void> {
  const navigate = useNavigate();
  return useCallback(
    async (opts: AppNavigateOptions) => {
      if (isPickActive()) {
        const to = opts.to;
        if (to === "/") {
          pushPickScreen({ kind: "home" });
          return;
        }
        if (to === "/recherche") {
          pushPickScreen({ kind: "search" });
          return;
        }
        if (to === "/applications") {
          pushPickScreen({ kind: "apps" });
          return;
        }
        if (to === "/fichiers-recents") {
          pushPickScreen({ kind: "recents" });
          return;
        }
        if (to === "/categorie/$kind" || to.startsWith("/categorie/")) {
          const kind = opts.params?.["kind"] ?? to.split("/")[2] ?? "";
          if (CATEGORY_KINDS.has(kind)) {
            pushPickScreen({ kind: "category", category: kind as CategoryKind });
            return;
          }
        }
        /* Toute autre destination (éditeurs, outils, paramètres…) est
           ignorée : on ne quitte pas un parcours de sélection en cours. */
        return;
      }
      await navigate(opts as never);
    },
    [navigate],
  );
}
