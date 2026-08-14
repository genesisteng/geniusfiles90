/**
 * Foreground-service bridge — keeps long operations alive when the app
 * is backgrounded.
 *
 * The bridge is invoked automatically from `src/lib/jobs/journal.ts`:
 * `beginJob` starts the service once a job crosses the "long enough"
 * threshold, `updateJob` refreshes the ongoing notification, and
 * `finishJob` stops the service as soon as the last active job ends.
 * Nothing in the operations code (copy/move/archive/cleaner) has to
 * change.
 *
 * Notification permission (Android 13+) is requested lazily the first
 * time a job needs it, never at app launch.
 */
import { isAndroidNative, nativePlugin } from "./geniusfiles-native";

type Plugin = {
  startForegroundJob?: (o: { title: string; text: string; progress: number }) => Promise<void>;
  updateForegroundJob?: (o: { title?: string; text?: string; progress: number }) => Promise<void>;
  stopForegroundJob?: () => Promise<void>;
  checkNotificationPermission?: () => Promise<{ granted: boolean }>;
  requestNotificationPermission?: () => Promise<{ granted: boolean; requested?: boolean }>;
};

function fg(): Plugin | null {
  return nativePlugin() as unknown as Plugin | null;
}

let notifPromptDone = false;
async function ensureNotificationPromptOnce(): Promise<void> {
  if (notifPromptDone) return;
  notifPromptDone = true;
  const p = fg();
  if (!p?.checkNotificationPermission || !p.requestNotificationPermission) return;
  try {
    const { granted } = await p.checkNotificationPermission();
    if (!granted) await p.requestNotificationPermission();
  } catch {
    /* ignore — the service still starts, only the notification is missing */
  }
}

/** Threshold above which a job is worth a foreground notification. */
export function isLongJob(input: { total?: number; totalBytes?: number }): boolean {
  const items = input.total ?? 0;
  const bytes = input.totalBytes ?? 0;
  return items > 1000 || bytes > 200 * 1024 * 1024;
}

export async function startForegroundJob(input: {
  title: string;
  text: string;
  progress?: number;
}): Promise<void> {
  if (!isAndroidNative()) return;
  const p = fg();
  if (!p?.startForegroundJob) return;
  void ensureNotificationPromptOnce();
  try {
    await p.startForegroundJob({
      title: input.title,
      text: input.text,
      progress: input.progress ?? -1,
    });
  } catch {
    /* swallow — never let notification failures break the operation */
  }
}

export async function updateForegroundJob(input: {
  title?: string;
  text?: string;
  progress?: number;
}): Promise<void> {
  if (!isAndroidNative()) return;
  const p = fg();
  if (!p?.updateForegroundJob) return;
  try {
    await p.updateForegroundJob({
      title: input.title,
      text: input.text,
      progress: input.progress ?? -1,
    });
  } catch {
    /* ignore */
  }
}

export async function stopForegroundJob(): Promise<void> {
  if (!isAndroidNative()) return;
  const p = fg();
  if (!p?.stopForegroundJob) return;
  try {
    await p.stopForegroundJob();
  } catch {
    /* ignore */
  }
}
