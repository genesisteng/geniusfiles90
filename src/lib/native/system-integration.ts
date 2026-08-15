/**
 * Lot 3 — System integration bridge.
 *
 * Exposes:
 *   - registerDefaultShortcuts(): pushes dynamic App Shortcuts (long-press
 *     on the launcher icon → Recherche / IA / Nettoyeur). Called once
 *     per cold start.
 *   - updateWidgetSummary(text): demande au natif de rafraîchir les widgets
 *     d'écran d'accueil (Stockage / Accès rapide / Fichiers récents). Chaque
 *     widget remesure ses propres données : rien de périmé n'est affiché.
 *   - consumeLaunchIntent(): returns the intent that opened / resumed
 *     the app (shortcut route, incoming VIEW / SEND uri). Consumed once.
 *
 * All calls are no-ops off native, so the same code runs safely in the
 * Lovable web preview.
 */
import { t } from "@/lib/i18n";
import { isAndroidNative, nativePlugin } from "./geniusfiles-native";

type ShortcutSpec = { id: string; label: string; longLabel?: string; route: string };

type Plugin = {
  registerShortcuts?: (o: { shortcuts: ShortcutSpec[] }) => Promise<void>;
  updateWidgetSummary?: (o: { summary: string }) => Promise<void>;
  getLaunchIntent?: () => Promise<LaunchIntent>;
};

export type LaunchIntent = {
  action?: string;
  route?: string;
  shortcutId?: string;
  uri?: string;
  uris?: string[];
  mime?: string;
  /** Chemin réel du fichier visé (widget « Fichiers récents »). */
  path?: string;
  /** `widget` quand l'ouverture vient d'un widget d'écran d'accueil. */
  source?: string;
};

function plugin(): Plugin | null {
  return nativePlugin() as unknown as Plugin | null;
}

/** Raccourcis traduits au moment de l'enregistrement, pas à l'import. */
const defaultShortcuts = (): ShortcutSpec[] => [
  {
    id: "search",
    label: t("nav.search"),
    longLabel: t("system.shortcut.search"),
    route: "/recherche",
  },
  {
    id: "cleaner",
    label: t("nav.cleaner"),
    longLabel: t("system.shortcut.analyze"),
    route: "/nettoyeur",
  },
];

let shortcutsRegistered = false;
export async function registerDefaultShortcuts(): Promise<void> {
  if (shortcutsRegistered || !isAndroidNative()) return;
  const p = plugin();
  if (!p?.registerShortcuts) return;
  try {
    await p.registerShortcuts({ shortcuts: defaultShortcuts() });
    shortcutsRegistered = true;
  } catch {
    /* silent — retried on next cold start */
  }
}

export async function updateWidgetSummary(summary: string): Promise<void> {
  if (!isAndroidNative()) return;
  const p = plugin();
  if (!p?.updateWidgetSummary) return;
  try {
    await p.updateWidgetSummary({ summary });
  } catch {
    /* silent — widget updates are best-effort */
  }
}

export async function consumeLaunchIntent(): Promise<LaunchIntent | null> {
  if (!isAndroidNative()) return null;
  const p = plugin();
  if (!p?.getLaunchIntent) return null;
  try {
    const ret = await p.getLaunchIntent();
    if (!ret || (!ret.route && !ret.uri && !ret.uris && !ret.path)) return null;
    return ret;
  } catch {
    return null;
  }
}
