/**
 * Réservations typées — fondations pour évolutions futures sans casser
 * la surface publique du moteur d'organisation.
 *
 * Aucune de ces interfaces n'est branchée aujourd'hui. Les activer plus
 * tard ne demandera pas de refonte des composants consommateurs.
 */
import type { OrgCategoryId, OrgRecommendation } from "./types";

/** Politique d'organisation automatique (OFF par défaut, hors périmètre). */
export type AutoOrganizePolicy = {
  enabled: boolean;
  requireConfirmation: boolean;
  allowedCategories: OrgCategoryId[];
  scheduleCron?: string;
};

/** Modèle d'apprentissage des habitudes (read-only en attendant). */
export type HabitModel = {
  observations: number;
  preferredFolders: Partial<Record<OrgCategoryId, string[]>>;
  lastUpdated: number;
};

/** Suggestions proactives à surfacer par les notifications. */
export type ProactiveSuggestion = {
  id: string;
  createdAt: number;
  recommendation: OrgRecommendation;
  dismissed?: boolean;
};

/** Synchronisation multi-appareils (stub). */
export type MultiDeviceSync = {
  deviceId: string;
  lastSyncAt?: number;
};

/** Extension future : renommage assisté par IA quand une clé est dispo. */
export type AIRenameProvider = {
  id: string;
  label: string;
  isAvailable: () => boolean;
  suggest: (context: unknown) => Promise<string>;
};
