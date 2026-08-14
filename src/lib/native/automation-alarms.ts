/**
 * Bridge to the native AutomationAlarm* plugin methods.
 *
 * Alarms are scheduled through Android's AlarmManager and fire even
 * when GeniusFiles is fully closed, backgrounded, or the screen is
 * locked. Off-native (web preview) all calls become no-ops so the
 * scheduler still runs the in-app tick without extra branches.
 */
import { isAndroidNative, nativePlugin } from "./geniusfiles-native";

export type AlarmRepeat = "once" | "daily" | "weekly";

export type ScheduleAlarmInput = {
  id: string;
  atMs: number;
  title: string;
  body: string;
  route?: string;
  repeat: AlarmRepeat;
  /** Hour of day in local time (0-23) — required for daily/weekly reschedule. */
  hour: number;
  /** Minute of hour (0-59). */
  minute: number;
  /** Bit mask, bit 0 = Sunday … bit 6 = Saturday (weekly only). */
  daysMask?: number;
};

type AlarmPlugin = {
  scheduleAutomationAlarm?: (input: ScheduleAlarmInput) => Promise<{
    scheduled: boolean;
    atMs: number;
    notifId: number;
  }>;
  cancelAutomationAlarm?: (input: { id: string }) => Promise<{ cancelled: boolean }>;
  cancelAllAutomationAlarms?: () => Promise<{ cancelled: boolean }>;
  listAutomationAlarms?: () => Promise<{ alarms: Array<Record<string, unknown>> }>;
};

function plugin(): AlarmPlugin | null {
  return nativePlugin() as unknown as AlarmPlugin | null;
}

export function isAlarmSchedulingAvailable(): boolean {
  return isAndroidNative() && typeof plugin()?.scheduleAutomationAlarm === "function";
}

export async function scheduleAlarm(input: ScheduleAlarmInput): Promise<void> {
  const p = plugin();
  if (!p?.scheduleAutomationAlarm) return;
  try {
    await p.scheduleAutomationAlarm(input);
  } catch {
    /* ignore — a missing alarm just means we fall back to in-app ticks */
  }
}

export async function cancelAlarm(id: string): Promise<void> {
  const p = plugin();
  if (!p?.cancelAutomationAlarm) return;
  try {
    await p.cancelAutomationAlarm({ id });
  } catch {
    /* ignore */
  }
}

export async function cancelAllAlarms(): Promise<void> {
  const p = plugin();
  if (!p?.cancelAllAutomationAlarms) return;
  try {
    await p.cancelAllAutomationAlarms();
  } catch {
    /* ignore */
  }
}
