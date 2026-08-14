/**
 * GeniusFiles — préférences de personnalisation (schéma & valeurs par défaut).
 *
 * Le schéma est volontairement réduit aux réglages RÉELLEMENT exposés dans
 * l'écran Paramètres et qui ont un effet observable :
 *   - thème de l'interface (clair / sombre / système)
 *   - affichage des fichiers cachés
 *   - notifications activées ou non
 *
 * Toute préférence sans UI ni effet a été supprimée (taille de texte,
 * densité, animations, indexation, canaux de notification, contraintes
 * d'automatisation, verrouillage/biométrie hors coffre-fort, widgets
 * fictifs). Les widgets Android réels seront pilotés par leur propre
 * module natif, pas par ce schéma.
 */

/** Thème de l'interface : automatique (Android), clair ou sombre. */
export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export type PersonalizationPrefs = {
  /** Version — incrémenter à chaque changement de schéma incompatible. */
  version: 1;

  appearance: {
    /** Thème choisi par l'utilisateur. */
    theme: ThemeMode;
  };

  files: {
    /** Afficher les fichiers et dossiers commençant par un point. */
    showHidden: boolean;
  };

  notifications: {
    enabled: boolean;
  };
};

export const DEFAULT_PREFS: PersonalizationPrefs = {
  version: 1,
  appearance: {
    theme: "system",
  },
  files: {
    showHidden: false,
  },
  notifications: {
    enabled: true,
  },
};
