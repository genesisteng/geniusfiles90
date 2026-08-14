/**
 * Automations scheduler — strict time-slot dispatch + native alarms.
 *
 * Two mechanisms run in parallel:
 *
 * 1. An in-app tick (every 30 s) fires the real execution pipeline when
 *    the app is open: file operations, history, in-app notifications.
 *
 * 2. Native Android alarms (AlarmManager + BroadcastReceiver) are
 *    synced every time the automation list changes. These alarms post
 *    a real system notification at the scheduled moment *even when
 *    GeniusFiles is fully closed, backgrounded, or the screen is
 *    locked* — and survive device reboots because AutomationBootReceiver
 *    rearms them.
 *
 * The two mechanisms share a stable per-automation notification id so
 * the in-app "execution completed" notification simply replaces the
 * native "scheduled" one when the user opens the app — no duplicates.
 */
import { runAutomation, summarizeActions } from "./engine";
import { listAutomations, subscribeAutomations } from "./store";
import type { Automation, Trigger } from "./types";
import {
  cancelAlarm,
  cancelAllAlarms,
  isAlarmSchedulingAvailable,
  scheduleAlarm,
  type AlarmRepeat,
} from "@/lib/native/automation-alarms";
import { t } from "@/lib/i18n";

const SLOT_KEY = "gf.automations.slots";
const SESSION_KEY = "gf.automations.session";
const TICK_MS = 30_000;
/** How long after a scheduled moment we still consider the slot fresh. */
const SLOT_TOLERANCE_MS = 5 * 60_000;

type SlotMap = Record<string, string>;

function readSlots(): SlotMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SLOT_KEY);
    return raw ? (JSON.parse(raw) as SlotMap) : {};
  } catch {
    return {};
  }
}
function writeSlots(m: SlotMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SLOT_KEY, JSON.stringify(m));
  } catch {
    /* quota */
  }
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseHM = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
};

type SlotInfo = { key: string; momentMs: number };

/** Slot info for a trigger at the given "now" — null when it must not fire. */
function computeSlot(trigger: Trigger, now: Date, sessionId: string): SlotInfo | null {
  const dk = dayKey(now);
  const nowTs = now.getHours() * 60 + now.getMinutes();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  switch (trigger.kind) {
    case "app_open":
      return { key: `session:${sessionId}`, momentMs: now.getTime() };
    case "scheduled_time": {
      const t = parseHM(trigger.at);
      if (t == null || nowTs < t) return null;
      return { key: `once:${dk}:${trigger.at}`, momentMs: dayStart + t * 60_000 };
    }
    case "daily": {
      const t = parseHM(trigger.at);
      if (t == null || nowTs < t) return null;
      return { key: `day:${dk}:${trigger.at}`, momentMs: dayStart + t * 60_000 };
    }
    case "weekly": {
      const t = parseHM(trigger.at);
      if (t == null || nowTs < t) return null;
      if (!trigger.days?.includes(now.getDay())) return null;
      return { key: `week:${dk}:${trigger.at}`, momentMs: dayStart + t * 60_000 };
    }
    default:
      return null;
  }
}

function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let sid = window.sessionStorage?.getItem(SESSION_KEY);
  if (!sid) {
    sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      window.sessionStorage?.setItem(SESSION_KEY, sid);
    } catch {
      /* private mode */
    }
  }
  return sid;
}

const running = new Set<string>();

async function runOnce(auto: Automation, slot: string) {
  if (running.has(auto.id)) return;
  running.add(auto.id);
  const slots = readSlots();
  slots[auto.id] = slot;
  writeSlots(slots);
  try {
    await runAutomation(auto, { simulate: false });
  } catch {
    /* engine records failures */
  } finally {
    running.delete(auto.id);
  }
}

// ---------- Native alarm sync ----------

/**
 * Next fire time (ms since epoch) for a schedulable trigger, or null
 * for triggers that don't map to a wall-clock moment (app_open, etc).
 */
function nextFireMs(trigger: Trigger, from: number, createdAt: number): number | null {
  if (trigger.kind === "scheduled_time" || trigger.kind === "daily") {
    const t = parseHM(trigger.at);
    if (t == null) return null;
    const base = new Date(from);
    base.setSeconds(0, 0);
    base.setHours(Math.floor(t / 60), t % 60);
    let ms = base.getTime();
    while (ms <= from || ms < createdAt) ms += 24 * 3600_000;
    if (trigger.kind === "scheduled_time") {
      // "One-shot" schedule: if the moment already passed today, arm for tomorrow.
      return ms;
    }
    return ms;
  }
  if (trigger.kind === "weekly") {
    const t = parseHM(trigger.at);
    if (t == null || !trigger.days?.length) return null;
    for (let i = 0; i < 14; i++) {
      const d = new Date(from + i * 24 * 3600_000);
      d.setSeconds(0, 0);
      d.setHours(Math.floor(t / 60), t % 60);
      const ms = d.getTime();
      if (ms <= from || ms < createdAt) continue;
      if (trigger.days.includes(d.getDay())) return ms;
    }
    return null;
  }
  return null;
}

function repeatOf(trigger: Trigger): AlarmRepeat {
  if (trigger.kind === "daily") return "daily";
  if (trigger.kind === "weekly") return "weekly";
  return "once";
}

function daysMask(days: number[] | undefined): number {
  if (!days?.length) return 0;
  return days.reduce((mask, d) => mask | (1 << (d & 7)), 0);
}

async function syncNativeAlarms(): Promise<void> {
  if (!isAlarmSchedulingAvailable()) return;
  const now = Date.now();
  const items = listAutomations();
  const enabled = items.filter((a) => a.enabled);

  // Cancel alarms for disabled or removed automations.
  const disabled = items.filter((a) => !a.enabled);
  for (const a of disabled) {
    await cancelAlarm(a.id);
  }

  for (const a of enabled) {
    const at = nextFireMs(a.trigger, now, a.createdAt);
    if (at == null) {
      await cancelAlarm(a.id);
      continue;
    }
    const hm =
      a.trigger.kind === "scheduled_time" ||
      a.trigger.kind === "daily" ||
      a.trigger.kind === "weekly"
        ? parseHM(a.trigger.at)
        : null;
    const hour = hm != null ? Math.floor(hm / 60) : 9;
    const minute = hm != null ? hm % 60 : 0;
    const summary = summarizeActions(a);

    await scheduleAlarm({
      id: a.id,
      atMs: at,
      title: `✅ ${a.name}`,
      body: summary || t("automations.scheduler.notifyBodyFallback"),
      route: "/automatisations",
      repeat: repeatOf(a.trigger),
      hour,
      minute,
      daysMask: a.trigger.kind === "weekly" ? daysMask(a.trigger.days) : 0,
    });
  }
}

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let stopSub: (() => void) | null = null;

async function tick() {
  const now = new Date();
  const nowMs = now.getTime();
  const sid = sessionId();
  const slots = readSlots();
  const items = listAutomations().filter((a) => a.enabled);
  for (const a of items) {
    const info = computeSlot(a.trigger, now, sid);
    if (!info) continue;
    // Never fire a slot whose scheduled moment is before this automation
    // was created — this is the "no premature execution at creation" fix.
    if (a.trigger.kind !== "app_open" && info.momentMs < a.createdAt) continue;
    // Ignore slots that are too far in the past (e.g. the phone was off
    // for hours). The user asked for exact schedules, not catch-ups.
    if (a.trigger.kind !== "app_open" && nowMs - info.momentMs > SLOT_TOLERANCE_MS) continue;
    if (slots[a.id] === info.key) continue;

    await runOnce(a, info.key);
  }
}

export function startAutomationScheduler(): () => void {
  if (started) return () => {};
  started = true;
  void tick();
  void syncNativeAlarms();
  timer = setInterval(() => void tick(), TICK_MS);
  const onVis = () => {
    if (typeof document !== "undefined" && !document.hidden) {
      void tick();
      void syncNativeAlarms();
    }
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);
  stopSub = subscribeAutomations(() => {
    void tick();
    void syncNativeAlarms();
  });
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
    stopSub?.();
    stopSub = null;
    started = false;
    void cancelAllAlarms();
  };
}
