/**
 * Persistence layer for automations.
 *
 * Everything is kept in localStorage today, but the shape is aligned
 * with a future cross-device sync backend: rules are addressed by
 * stable `id`, carry a `syncKey`, and every mutation stamps
 * `updatedAt`.
 */
import type { Automation } from "./types";

const KEY = "gf.automations.rules";
const EVENT = "gf:automations-changed";

function safeGet(): Automation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Automation[]) : [];
  } catch {
    return [];
  }
}

function safeSet(items: Automation[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* quota / privacy — ignore */
  }
}

function newId() {
  return `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listAutomations(): Automation[] {
  return safeGet().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getAutomation(id: string): Automation | undefined {
  return safeGet().find((a) => a.id === id);
}

export function saveAutomation(
  input: Omit<Automation, "id" | "createdAt" | "updatedAt" | "runCount" | "source"> &
    Partial<Pick<Automation, "id" | "createdAt" | "runCount" | "source" | "syncKey">>,
): Automation {
  const all = safeGet();
  const now = Date.now();
  if (input.id) {
    const idx = all.findIndex((a) => a.id === input.id);
    if (idx >= 0) {
      const merged: Automation = {
        ...all[idx],
        ...input,
        id: all[idx].id,
        createdAt: all[idx].createdAt,
        runCount: all[idx].runCount,
        source: all[idx].source,
        updatedAt: now,
      };
      all[idx] = merged;
      safeSet(all);
      return merged;
    }
  }
  const created: Automation = {
    id: input.id ?? newId(),
    name: input.name,
    description: input.description,
    enabled: input.enabled,
    trigger: input.trigger,
    conditions: input.conditions,
    actions: input.actions,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    runCount: input.runCount ?? 0,
    source: input.source ?? "manual",
    syncKey: input.syncKey,
  };
  safeSet([created, ...all]);
  return created;
}

export function deleteAutomation(id: string) {
  safeSet(safeGet().filter((a) => a.id !== id));
}

export function toggleAutomation(id: string, enabled: boolean) {
  const all = safeGet();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], enabled, updatedAt: Date.now() };
  safeSet(all);
}

export function duplicateAutomation(id: string): Automation | undefined {
  const src = getAutomation(id);
  if (!src) return undefined;
  const now = Date.now();
  const copy: Automation = {
    ...src,
    id: newId(),
    name: `${src.name} (copie)`,
    enabled: false,
    createdAt: now,
    updatedAt: now,
    runCount: 0,
    lastRunAt: undefined,
  };
  safeSet([copy, ...safeGet()]);
  return copy;
}

export function recordRun(id: string) {
  const all = safeGet();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], lastRunAt: Date.now(), runCount: all[idx].runCount + 1 };
  safeSet(all);
}

export function subscribeAutomations(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
