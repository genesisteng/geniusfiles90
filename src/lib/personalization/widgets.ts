/**
 * Widgets Android — fondations.
 *
 * Ce module décrit les widgets possibles (id, tailles supportées, résumé
 * dynamique) et expose une couche de prévisualisation web utilisée dans
 * le centre de personnalisation. L'intégration Capacitor / AppWidgets
 * viendra plus tard sans modifier cette surface.
 */
import type { WidgetId } from "./types";
import { t } from "@/lib/i18n";

export type WidgetSize = "1x1" | "2x1" | "2x2" | "4x1" | "4x2";

export type WidgetDefinition = {
  id: WidgetId;
  label: string;
  description: string;
  supportedSizes: WidgetSize[];
  /** Route ouverte par un tap sur le widget. */
  route: string;
};

export const widgetDefinitions = (): WidgetDefinition[] => [
  {
    id: "storage-summary",
    label: t("perso.widget.storage"),
    description: t("system.apercuDeLEspaceUtiliseDisponible"),
    supportedSizes: ["2x1", "2x2", "4x1"],
    route: "/",
  },
  {
    id: "favorites-shortcuts",
    label: t("system.dossiersFavoris"),
    description: t("system.ouvertureDirecteDeVosDossiersMarques"),
    supportedSizes: ["2x1", "4x1", "4x2"],
    route: "/",
  },
  {
    id: "cleaner",
    label: t("perso.widget.cleaner"),
    description: t("system.espaceRecuperableEtLancementRapideDe"),
    supportedSizes: ["2x1", "2x2"],
    route: "/nettoyeur",
  },
  {
    id: "quick-search",
    label: t("perso.widget.quickSearch"),
    description: t("perso.widget.quickSearchDesc"),
    supportedSizes: ["4x1"],
    route: "/recherche",
  },
  {
    id: "quick-actions",
    label: t("perso.widget.quickActions"),
    description: t("system.vosActionsPrefereesSurLEcran"),
    supportedSizes: ["4x1", "4x2"],
    route: "/",
  },
];

export function getWidgetDefinition(id: WidgetId): WidgetDefinition | undefined {
  return widgetDefinitions().find((w) => w.id === id);
}
