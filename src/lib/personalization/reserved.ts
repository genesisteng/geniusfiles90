/**
 * Fondations réservées — extensions futures typées mais non branchées.
 *
 * Aucun code de l'app ne dépend de ces surfaces aujourd'hui. Les ajouter
 * ne demandera pas de refonte de la page Paramètres ni du schéma des
 * préférences (ils sont déjà réservés dans `PersonalizationPrefs.reserved`).
 */
import type { PersonalizationPrefs } from "./types";

/** Profils utilisateur (multi-comptes local, futur). */
export type UserProfile = {
  id: string;
  label: string;
  createdAt: number;
  prefs: PersonalizationPrefs;
};

/** Synchronisation multi-appareils. */
export type SyncClient = {
  deviceId: string;
  push: (prefs: PersonalizationPrefs) => Promise<void>;
  pull: () => Promise<PersonalizationPrefs | null>;
  isAvailable: () => boolean;
};

/** Adaptation par habitudes — observations agrégées, jamais brutes. */
export type HabitProfile = {
  updatedAt: number;
  observations: number;
  topModules: string[];
  patch: Partial<PersonalizationPrefs>;
};
