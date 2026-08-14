/**
 * Execution history for automations.
 *
 * Bounded log kept in localStorage. Each record captures enough detail
 * to power the history screen: date, automation, per-action outcome,
 * files processed and error messages.
 */
import type { ExecutionRecord } from "./types";

const KEY = "gf.automations.history";
const MAX = 300;
const EVENT = "gf:automations-history-changed";

function safeGet(): ExecutionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ExecutionRecord[]) : [];
  } catch {
    return [];
  }
}

function safeSet(items: ExecutionRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* ignore */
  }
}

export function loadExecutionHistory(): ExecutionRecord[] {
  return safeGet();
}

export function recordExecution(record: ExecutionRecord) {
  safeSet([record, ...safeGet()]);
}

export function clearExecutionHistory() {
  safeSet([]);
}

export function subscribeExecutionHistory(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
