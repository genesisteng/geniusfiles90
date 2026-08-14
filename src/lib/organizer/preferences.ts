/**
 * Préférences utilisateur du moteur d'organisation.
 *
 * Toutes les valeurs par défaut sont conservatrices : rien n'est
 * automatique. L'utilisateur reste maître de chaque action.
 */
import type { OrgCategoryId } from "./types";

export type OrganizerPreferences = {
  /** Seuil au-delà duquel un dossier est jugé « surchargé ». */
  overloadedThreshold: number;
  /** Ratio minimal d'un kind pour qu'un dossier soit « thématique ». */
  dominantKindRatio: number;
  /** Nombre de jours pour considérer un fichier comme « récemment ajouté ». */
  recentDays: number;
  /** Catégories désactivées (ne produiront ni recommandations ni collections). */
  disabledCategories: OrgCategoryId[];
  /** Réservé — organisation automatique en arrière-plan. */
  autoOrganize: false;
  /** Réservé — apprentissage progressif des habitudes. */
  learnHabits: false;
};

const KEY = "gf.organizer.prefs.v1";

const DEFAULTS: OrganizerPreferences = {
  overloadedThreshold: 80,
  dominantKindRatio: 0.7,
  recentDays: 7,
  disabledCategories: [],
  autoOrganize: false,
  learnHabits: false,
};

export function loadPreferences(): OrganizerPreferences {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<OrganizerPreferences>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePreferences(prefs: OrganizerPreferences) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}
