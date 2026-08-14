/**
 * Notifications locales — enveloppe fine du bridge natif.
 *
 * La permission Android 13+ n'est JAMAIS demandée au lancement : elle est
 * demandée paresseusement, à la première notification réellement utile
 * (fin d'automatisation, fin de transfert, opération longue…). Un refus
 * n'interrompt jamais l'opération en cours : l'interface affiche déjà un
 * retour visuel.
 */
import { nativePlugin, isAndroidNative } from "./geniusfiles-native";

type NotifyPlugin = {
  showLocalNotification?: (opts: {
    id?: number;
    title: string;
    body: string;
    route?: string;
    channelId?: string;
    channelName?: string;
  }) => Promise<{ posted: boolean; id: number }>;
  checkNotificationPermission?: () => Promise<{ granted: boolean }>;
  requestNotificationPermission?: () => Promise<{ granted: boolean }>;
};

function plugin(): NotifyPlugin | null {
  return nativePlugin() as unknown as NotifyPlugin | null;
}

export function isNotificationsAvailable(): boolean {
  return isAndroidNative() && typeof plugin()?.showLocalNotification === "function";
}

let requested = false;

/**
 * Demande la permission une seule fois, au moment où une fonctionnalité en
 * a réellement besoin. À n'appeler QUE depuis un besoin fonctionnel réel.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const p = plugin();
  if (!p?.requestNotificationPermission) return false;
  try {
    if (p.checkNotificationPermission) {
      const { granted } = await p.checkNotificationPermission();
      if (granted) return true;
    }
    if (requested) return false;
    requested = true;
    const res = await p.requestNotificationPermission();
    return Boolean(res?.granted);
  } catch {
    return false;
  }
}

export async function showNotification(opts: {
  id?: number;
  title: string;
  body: string;
  route?: string;
}): Promise<void> {
  const p = plugin();
  if (!p?.showLocalNotification) return;
  try {
    // Demande contextuelle : c'est ici, et seulement ici, qu'une
    // notification est réellement nécessaire.
    await ensureNotificationPermission();
    await p.showLocalNotification({
      id: opts.id,
      title: opts.title,
      body: opts.body,
      route: opts.route ?? "/automatisations",
      channelId: "gf_automations",
      channelName: "Automatisations",
    });
  } catch {
    /* refus ou indisponibilité : le toast dans l'interface suffit */
  }
}
