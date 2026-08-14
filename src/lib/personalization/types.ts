/**
 * GeniusFiles — préférences de personnalisation (schéma & valeurs par défaut).
 *
 * Toutes les préférences sont sérialisables, versionnées et exportables.
 * Aucune modification d'interface n'est effectuée depuis ce fichier :
 * `applier.ts` applique le CSS, `store.ts` persiste, `index.ts` orchestre.
 *
 * Fondations réservées (voir `reserved.ts`) : profils, sync multi-appareils,
 * adaptation par habitudes.
 */

/** Thème de l'interface : automatique (Android), clair ou sombre. */
export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export type TextSize = "sm" | "md" | "lg" | "xl";
export type Density = "compact" | "cozy" | "comfortable";
export type DefaultView = "list" | "grid";
export type AnimationLevel = "none" | "reduced" | "standard" | "expressive";
export type DateFormat = "auto" | "iso" | "eu" | "us" | "relative";
export type TimeFormat = "auto" | "24h" | "12h";
export type SizeUnitFormat = "auto" | "binary" | "decimal";
export type IndexFrequency = "off" | "manual" | "hourly" | "daily" | "realtime";
export type AutoLockDelay = 0 | 60 | 300 | 900 | 1800; // sec, 0 = jamais
export type BatteryLimit = "off" | "20" | "30" | "50";

/** Sections modulaires du tableau de bord — l'utilisateur choisit l'ordre. */
export type DashboardSectionId =
  | "storage"
  | "recents"
  | "favorites"
  | "quick-actions"
  | "suggestions"
  | "categories"
  | "automations";

/** Raccourcis / actions rapides possibles sur l'écran d'accueil. */
export type QuickActionId =
  | "search"
  | "cleaner"
  | "vault"
  | "pdf"
  | "automations"
  | "organizer"
  | "trash";

export type NotificationChannel =
  | "backups"
  | "transfers"
  | "analysis"
  | "cleanup"
  | "automations"
  | "security";

export type SensitiveModule = "vault" | "automations" | "trash";

/** Widgets Android — fondations. Utilisés par le centre d'aperçu. */
export type WidgetId =
  | "storage-summary"
  | "favorites-shortcuts"
  | "cleaner"
  | "quick-search"
  | "quick-actions";

export type WidgetInstance = {
  id: string;
  kind: WidgetId;
  size: "1x1" | "2x1" | "2x2" | "4x1" | "4x2";
  enabled: boolean;
};

export type PersonalizationPrefs = {
  /** Version — incrémenter à chaque changement de schéma incompatible. */
  version: 1;

  appearance: {
    /** Thème choisi par l'utilisateur. */
    theme: ThemeMode;
    textSize: TextSize;
    density: Density;
    defaultView: DefaultView;
    animations: AnimationLevel;
    /** Force `prefers-reduced-motion` — override système. */
    reduceMotion: boolean;
  };

  navigation: {
    /** Actions rapides sur l'écran d'accueil, dans l'ordre. */
    quickActions: QuickActionId[];
    /** Modules prioritaires (affichés en tête). */
    priorityModules: QuickActionId[];
    /** Ordre des sections du tableau de bord. */
    dashboardOrder: DashboardSectionId[];
    /** Sections masquées. */
    hiddenSections: DashboardSectionId[];
  };

  files: {
    /** Path segments par rapport à la racine interne. Vide = racine. */
    startFolderSegments: string[];
    startRootId: "internal" | "sd";
    defaultSort: { key: "name" | "size" | "mtime" | "type"; order: "asc" | "desc" };
    foldersFirst: boolean;
    showHidden: boolean;
    showExtensions: boolean;
    sizeUnit: SizeUnitFormat;
    dateFormat: DateFormat;
    timeFormat: TimeFormat;
  };

  search: {
    keepHistory: boolean;
    autoClearDays: 0 | 7 | 30 | 90; // 0 = jamais
    smartIndex: boolean;
    indexFrequency: IndexFrequency;
  };

  notifications: {
    enabled: boolean;
    channels: Record<NotificationChannel, boolean>;
  };

  automations: {
    globallyEnabled: boolean;
    /** Uniquement quand connecté au chargeur. */
    onlyWhenCharging: boolean;
    /** Uniquement en Wi-Fi. */
    onlyOnWifi: boolean;
    batteryFloor: BatteryLimit;
  };

  privacy: {
    autoLockSec: AutoLockDelay;
    biometricUnlock: boolean;
    protectedModules: SensitiveModule[];
    clearCacheOnExit: boolean;
  };

  widgets: WidgetInstance[];

  /** Fondations — voir `reserved.ts`. Toujours écrits, jamais utilisés côté UI. */
  reserved: {
    profileId: string;
    syncEnabled: false;
    habitAdaptation: false;
  };
};

/* ---------- Valeurs par défaut ---------- */

export const DEFAULT_QUICK_ACTIONS: QuickActionId[] = ["search", "cleaner", "vault"];

export const DEFAULT_PRIORITY_MODULES: QuickActionId[] = ["organizer", "automations"];

export const DEFAULT_DASHBOARD_ORDER: DashboardSectionId[] = [
  "storage",
  "quick-actions",
  "recents",
  "favorites",
  "categories",
  "suggestions",
  "automations",
];

export const DEFAULT_PREFS: PersonalizationPrefs = {
  version: 1,
  appearance: {
    theme: "system",
    textSize: "md",
    density: "cozy",
    defaultView: "list",
    animations: "standard",
    reduceMotion: false,
  },
  navigation: {
    quickActions: DEFAULT_QUICK_ACTIONS,
    priorityModules: DEFAULT_PRIORITY_MODULES,
    dashboardOrder: DEFAULT_DASHBOARD_ORDER,
    hiddenSections: [],
  },
  files: {
    startFolderSegments: [],
    startRootId: "internal",
    defaultSort: { key: "name", order: "asc" },
    foldersFirst: true,
    showHidden: false,
    showExtensions: true,
    sizeUnit: "auto",
    dateFormat: "auto",
    timeFormat: "auto",
  },
  search: {
    keepHistory: true,
    autoClearDays: 30,
    smartIndex: true,
    indexFrequency: "daily",
  },
  notifications: {
    enabled: true,
    channels: {
      backups: true,
      transfers: true,
      analysis: true,
      cleanup: true,
      automations: true,
      security: true,
    },
  },
  automations: {
    globallyEnabled: true,
    onlyWhenCharging: false,
    onlyOnWifi: false,
    batteryFloor: "20",
  },
  privacy: {
    autoLockSec: 0,
    biometricUnlock: false,
    protectedModules: ["vault"],
    clearCacheOnExit: false,
  },
  widgets: [
    { id: "w-storage", kind: "storage-summary", size: "2x2", enabled: true },
    { id: "w-favorites", kind: "favorites-shortcuts", size: "4x1", enabled: true },
    { id: "w-cleaner", kind: "cleaner", size: "2x1", enabled: false },
    { id: "w-search", kind: "quick-search", size: "4x1", enabled: true },
    { id: "w-quick", kind: "quick-actions", size: "4x2", enabled: false },
  ],
  reserved: {
    profileId: "default",
    syncEnabled: false,
    habitAdaptation: false,
  },
};

/* ---------- Labels affichables (i18n-ready) ---------- */

export const QUICK_ACTION_LABEL: Record<QuickActionId, string> = {
  search: "Recherche",
  cleaner: "Nettoyeur",
  vault: "Coffre-fort",
  pdf: "Outils PDF",
  automations: "Automatisations",
  organizer: "Organisation",

  trash: "Corbeille",
};

export const DASHBOARD_SECTION_LABEL: Record<DashboardSectionId, string> = {
  storage: "Résumé de stockage",
  recents: "Récents",
  favorites: "Favoris",
  "quick-actions": "Actions rapides",
  suggestions: "Suggestions",
  categories: "Catégories",
  automations: "Automatisations",
};

export const NOTIFICATION_CHANNEL_LABEL: Record<NotificationChannel, string> = {
  backups: "Sauvegardes",
  transfers: "Transferts",
  analysis: "Analyses",
  cleanup: "Nettoyages",
  automations: "Automatisations",
  security: "Sécurité",
};

export const SENSITIVE_MODULE_LABEL: Record<SensitiveModule, string> = {
  vault: "Coffre-fort",
  automations: "Automatisations",
  trash: "Corbeille",
};

export const WIDGET_LABEL: Record<WidgetId, string> = {
  "storage-summary": "Espace de stockage",
  "favorites-shortcuts": "Dossiers favoris",
  cleaner: "Nettoyeur intelligent",
  "quick-search": "Recherche rapide",
  "quick-actions": "Actions rapides",
};
