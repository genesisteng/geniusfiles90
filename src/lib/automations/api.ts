/**
 * High-level programmatic API for automations — the surface the AI
 * assistant talks to.
 *
 * Every function is a thin, side-effect-explicit wrapper around
 * `src/lib/automations/store.ts`. The AI never touches the store nor
 * the filesystem directly: it drafts an intent, calls `previewDraft`
 * to validate it, presents the summary to the user, waits for an
 * explicit confirmation, then calls `saveDraft`. All other operations
 * (list, get, toggle, delete, duplicate, rename, update) mirror the
 * UI editor exactly so an AI-created automation is indistinguishable
 * from a manually created one and remains fully editable from the
 * graphical editor.
 */
import type { FileEntry, PathRef } from "@/lib/files/types";
import { listDirectory } from "@/lib/files/fs";
import {
  deleteAutomation,
  duplicateAutomation,
  getAutomation,
  listAutomations,
  saveAutomation,
  toggleAutomation,
} from "./store";
import { describeAction, summarizeActions } from "./engine";
import type {
  Action,
  ActionKind,
  Automation,
  Condition,
  FileSelection,
  Trigger,
  TriggerKind,
} from "./types";
import { t } from "@/lib/i18n";

/* ---------- Drafts (what the AI proposes) ---------- */

/** File-selection input the AI can propose without knowing FileEntry shape. */
export type SelectionDraft = {
  parent: PathRef;
  /** Explicit names to include (resolved via `listDirectory`). */
  names?: string[];
  /** Take every entry in `parent` (files and folders). */
  all?: boolean;
  /** Include only files (not folders) when `all` is set. */
  filesOnly?: boolean;
};

export type ActionDraft =
  | { kind: "copy"; source: SelectionDraft; destination: PathRef }
  | { kind: "move"; source: SelectionDraft; destination: PathRef }
  | { kind: "rename"; source: SelectionDraft; pattern: string }
  | { kind: "trash"; source: SelectionDraft }
  | { kind: "compress"; source: SelectionDraft; destination: PathRef; archiveName: string }
  | { kind: "backup"; source: SelectionDraft; destination: PathRef }
  | { kind: "mkdir"; parent: PathRef; name: string }
  | { kind: "organize"; folder: PathRef; rule: "type" | "date" | "name" }
  | { kind: "cleaner_scan" }
  | { kind: "notify"; message: string }
  | { kind: "open_module"; route: string };

export type AutomationDraft = {
  id?: string;
  name: string;
  description?: string;
  enabled?: boolean;
  trigger: Trigger;
  conditions?: Condition[];
  actions: ActionDraft[];
};

/* ---------- Validation ---------- */

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

function validateTrigger(trig: Trigger | undefined): string[] {
  if (!trig || !trig.kind) return [t("automations.api.trigger.missing")];
  const errs: string[] = [];
  switch (trig.kind) {
    case "scheduled_time":
    case "daily":
      if (!HHMM.test(trig.at ?? "")) errs.push(t("automations.api.trigger.invalidTime"));
      break;
    case "weekly":
      if (!HHMM.test(trig.at ?? "")) errs.push(t("automations.api.trigger.invalidTime"));
      if (!Array.isArray(trig.days) || trig.days.length === 0)
        errs.push(t("automations.api.trigger.noDay"));
      break;
    case "file_added":
    case "folder_changed":
      if (!trig.folder?.trim()) errs.push(t("automations.api.trigger.missingFolder"));
      break;
    case "storage_low":
      if (
        typeof trig.thresholdPct !== "number" ||
        trig.thresholdPct <= 0 ||
        trig.thresholdPct > 100
      )
        errs.push(t("automations.api.trigger.invalidThreshold"));
      break;
    default:
      break;
  }
  return errs;
}

function validateActionDraft(a: ActionDraft, idx: number): string[] {
  const errs: string[] = [];
  const label = t("automations.api.action.label", { index: idx + 1, kind: a.kind });
  switch (a.kind) {
    case "copy":
    case "move":
    case "backup":
      if (!a.source?.parent) errs.push(t("automations.api.action.missingSource", { label }));
      if (!a.destination) errs.push(t("automations.api.action.missingDestination", { label }));
      if (!a.source?.all && !(a.source?.names?.length ?? 0))
        errs.push(t("automations.api.action.missingSelection", { label }));
      break;
    case "rename":
      if (!a.source?.parent) errs.push(t("automations.api.action.missingSource", { label }));
      if (!a.pattern?.trim()) errs.push(t("automations.api.action.missingPattern", { label }));
      break;
    case "trash":
      if (!a.source?.parent) errs.push(t("automations.api.action.missingSource", { label }));
      if (!a.source?.all && !(a.source?.names?.length ?? 0))
        errs.push(t("automations.api.action.missingSelection", { label }));
      break;
    case "compress":
      if (!a.source?.parent) errs.push(t("automations.api.action.missingSource", { label }));
      if (!a.destination) errs.push(t("automations.api.action.missingDestination", { label }));
      if (!a.archiveName?.trim())
        errs.push(t("automations.api.action.missingArchiveName", { label }));
      break;
    case "mkdir":
      if (!a.parent) errs.push(t("automations.api.action.missingLocation", { label }));
      if (!a.name?.trim()) errs.push(t("automations.api.action.missingName", { label }));
      break;
    case "organize":
      if (!a.folder) errs.push(t("automations.api.action.missingFolder", { label }));
      break;
    case "notify":
      if (!a.message?.trim()) errs.push(t("automations.api.action.missingMessage", { label }));
      break;
    case "open_module":
      if (!a.route?.trim()) errs.push(t("automations.api.action.missingRoute", { label }));
      break;
    default:
      break;
  }
  return errs;
}

/* ---------- Selection resolution ---------- */

async function resolveSelection(
  sel: SelectionDraft,
): Promise<{ ok: true; selection: FileSelection } | { ok: false; message: string }> {
  const listing = await listDirectory(sel.parent);
  if (!listing.ok) {
    return { ok: false, message: listing.message ?? t("automations.api.selection.unreadable") };
  }
  let entries: FileEntry[] = [];
  if (sel.all) {
    entries = sel.filesOnly ? listing.entries.filter((e) => !e.isDirectory) : listing.entries;
  } else {
    const byName = new Map(listing.entries.map((e) => [e.name, e]));
    const missing: string[] = [];
    for (const n of sel.names ?? []) {
      const hit = byName.get(n);
      if (hit) entries.push(hit);
      else missing.push(n);
    }
    if (missing.length && entries.length === 0)
      return {
        ok: false,
        message: t("automations.api.selection.notFound", { names: missing.join(", ") }),
      };
  }
  if (entries.length === 0) return { ok: false, message: t("automations.api.selection.empty") };
  return { ok: true, selection: { parent: sel.parent, entries } };
}

async function materializeAction(
  draft: ActionDraft,
): Promise<{ ok: true; action: Action } | { ok: false; message: string }> {
  switch (draft.kind) {
    case "copy":
    case "move":
    case "backup": {
      const r = await resolveSelection(draft.source);
      if (!r.ok) return r;
      return {
        ok: true,
        action: { kind: draft.kind, source: r.selection, destination: draft.destination },
      };
    }
    case "rename": {
      const r = await resolveSelection(draft.source);
      if (!r.ok) return r;
      return { ok: true, action: { kind: "rename", source: r.selection, pattern: draft.pattern } };
    }
    case "trash": {
      const r = await resolveSelection(draft.source);
      if (!r.ok) return r;
      return { ok: true, action: { kind: "trash", source: r.selection } };
    }
    case "compress": {
      const r = await resolveSelection(draft.source);
      if (!r.ok) return r;
      return {
        ok: true,
        action: {
          kind: "compress",
          source: r.selection,
          destination: draft.destination,
          archiveName: draft.archiveName,
        },
      };
    }
    case "mkdir":
      return { ok: true, action: { kind: "mkdir", parent: draft.parent, name: draft.name } };
    case "organize":
      return { ok: true, action: { kind: "organize", folder: draft.folder, rule: draft.rule } };
    case "cleaner_scan":
      return { ok: true, action: { kind: "cleaner_scan" } };
    case "notify":
      return { ok: true, action: { kind: "notify", message: draft.message } };
    case "open_module":
      return { ok: true, action: { kind: "open_module", route: draft.route } };
  }
}

/* ---------- Public API ---------- */

export type PreviewResult = {
  ok: boolean;
  missing: string[];
  summary?: {
    name: string;
    description?: string;
    trigger: string;
    actions: { kind: ActionKind; label: string; detail: string }[];
    conditions?: string[];
  };
  /** Validated + resolved automation ready for `saveDraft` — only when ok. */
  ready?: Omit<Automation, "id" | "createdAt" | "updatedAt" | "runCount" | "source">;
};

const TRIGGER_LABEL: Record<TriggerKind, (trig: Trigger) => string> = {
  scheduled_time: (trig) =>
    trig.kind === "scheduled_time" ? t("automations.api.trigger.once", { at: trig.at }) : "",
  daily: (trig) =>
    trig.kind === "daily" ? t("automations.api.trigger.daily", { at: trig.at }) : "",
  weekly: (trig) =>
    trig.kind === "weekly"
      ? t("automations.api.trigger.weekly", {
          days: trig.days.map((d) => "DLMMJVS"[d]).join(", "),
          at: trig.at,
        })
      : "",
  app_open: () => t("automations.api.trigger.appOpen"),
  file_added: (trig) =>
    trig.kind === "file_added"
      ? t("automations.api.trigger.fileAdded", { folder: trig.folder })
      : "",
  folder_changed: (trig) =>
    trig.kind === "folder_changed"
      ? t("automations.api.trigger.folderChanged", { folder: trig.folder })
      : "",
  storage_low: (trig) =>
    trig.kind === "storage_low"
      ? t("automations.api.trigger.storageLow", { pct: trig.thresholdPct })
      : "",
  device_connected: (trig) =>
    trig.kind === "device_connected"
      ? t("automations.api.trigger.deviceConnected", { type: trig.deviceType ?? "any" })
      : "",
};

function describeConditions(cs: Condition[] | undefined): string[] {
  if (!cs?.length) return [];
  return cs.map((c) => {
    switch (c.kind) {
      case "file_type":
        return t("automations.api.condition.fileType", { types: c.types.join(", ") });
      case "size_min":
        return t("automations.api.condition.sizeMin", { bytes: c.bytes });
      case "size_max":
        return t("automations.api.condition.sizeMax", { bytes: c.bytes });
      case "name_contains":
        return t("automations.api.condition.nameContains", { text: c.text });
      case "location":
        return t("automations.api.condition.location", { folder: c.folder });
      case "created_after":
        return t("automations.api.condition.createdAfter", { date: c.date });
      case "modified_after":
        return t("automations.api.condition.modifiedAfter", { date: c.date });
      case "storage_available":
        return t("automations.api.condition.storageAvailable", { bytes: c.minBytes });
    }
  });
}

/** Validate a draft, resolve selections, return a summary + ready payload. */
export async function previewDraft(draft: AutomationDraft): Promise<PreviewResult> {
  const missing: string[] = [];
  if (!draft?.name?.trim()) missing.push(t("automations.api.name.missing"));
  if (!Array.isArray(draft?.actions) || draft.actions.length === 0)
    missing.push(t("automations.api.actions.none"));
  missing.push(...validateTrigger(draft?.trigger));
  (draft?.actions ?? []).forEach((a, i) => missing.push(...validateActionDraft(a, i)));
  if (missing.length) return { ok: false, missing };

  const materialized: Action[] = [];
  for (const a of draft.actions) {
    const r = await materializeAction(a);
    if (!r.ok) return { ok: false, missing: [r.message] };
    materialized.push(r.action);
  }

  const ready = {
    name: draft.name.trim(),
    description: draft.description?.trim(),
    enabled: draft.enabled ?? true,
    trigger: draft.trigger,
    conditions: draft.conditions ?? [],
    actions: materialized,
    syncKey: undefined,
  };

  const previewSummary = {
    name: ready.name,
    description: ready.description,
    trigger: TRIGGER_LABEL[draft.trigger.kind](draft.trigger),
    actions: materialized.map((a) => {
      const p = describeAction(a);
      return { kind: a.kind, label: p.label, detail: p.detail };
    }),
    conditions: describeConditions(ready.conditions),
  };
  return { ok: true, missing: [], summary: previewSummary, ready };
}

export type SavePayload = NonNullable<PreviewResult["ready"]>;

/** Persist a previously-previewed draft. Never called before user confirmation. */
export function saveDraft(payload: SavePayload, opts?: { id?: string }): Automation {
  return saveAutomation({
    id: opts?.id,
    name: payload.name,
    description: payload.description,
    enabled: payload.enabled,
    trigger: payload.trigger,
    conditions: payload.conditions,
    actions: payload.actions,
    source: "ai",
  });
}

/* ---------- Management ---------- */

/** Compact serialisation for the AI — hides internal FileEntry shape. */
export function serializeAutomation(a: Automation) {
  return {
    id: a.id,
    name: a.name,
    description: a.description ?? null,
    enabled: a.enabled,
    trigger: a.trigger,
    conditions: a.conditions,
    actions: a.actions.map((act) => describeAction(act)),
    summary: summarizeActions(a),
    createdAt: new Date(a.createdAt).toISOString(),
    updatedAt: new Date(a.updatedAt).toISOString(),
    lastRunAt: a.lastRunAt ? new Date(a.lastRunAt).toISOString() : null,
    runCount: a.runCount,
    source: a.source,
  };
}

export function findByName(name: string): Automation | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  const items = listAutomations();
  return (
    items.find((a) => a.name.toLowerCase() === needle) ??
    items.find((a) => a.name.toLowerCase().includes(needle))
  );
}

export function listAll(filter?: "enabled" | "disabled" | "all") {
  const items = listAutomations();
  const f = filter ?? "all";
  return items
    .filter((a) => (f === "enabled" ? a.enabled : f === "disabled" ? !a.enabled : true))
    .map(serializeAutomation);
}

export function toggle(id: string, enabled: boolean): boolean {
  if (!getAutomation(id)) return false;
  toggleAutomation(id, enabled);
  return true;
}

export function remove(id: string): boolean {
  if (!getAutomation(id)) return false;
  deleteAutomation(id);
  return true;
}

export function rename(id: string, newName: string): boolean {
  const a = getAutomation(id);
  if (!a) return false;
  saveAutomation({ ...a, id, name: newName.trim() || a.name });
  return true;
}

export function duplicate(id: string): Automation | undefined {
  return duplicateAutomation(id);
}

/** Partial update of an existing automation — used for "make it weekly" etc. */
export async function updateExisting(
  id: string,
  patch: Partial<AutomationDraft>,
): Promise<PreviewResult> {
  const current = getAutomation(id);
  if (!current) return { ok: false, missing: [`automatisation introuvable : ${id}`] };
  const draft: AutomationDraft = {
    id,
    name: patch.name ?? current.name,
    description: patch.description ?? current.description,
    enabled: patch.enabled ?? current.enabled,
    trigger: patch.trigger ?? current.trigger,
    conditions: patch.conditions ?? current.conditions,
    // If the AI doesn't send new actions, keep the current ones (already
    // materialized) — repackage them as no-op drafts of kind "notify" so
    // preview doesn't try to resolve selections again.
    actions: patch.actions ?? (current.actions.map((a) => reverseAction(a)) as ActionDraft[]),
  };
  return previewDraft(draft);
}

/**
 * Best-effort reverse of a materialised Action into an ActionDraft — used
 * only when re-previewing an existing automation whose actions were
 * already validated. Selection is reconstructed as an explicit name list.
 */
function reverseAction(a: Action): ActionDraft {
  const src = (s?: FileSelection): SelectionDraft => ({
    parent: s?.parent ?? { rootId: "internal", segments: [] },
    names: s?.entries?.map((e) => e.name) ?? [],
  });
  switch (a.kind) {
    case "copy":
    case "move":
    case "backup":
      return {
        kind: a.kind,
        source: src(a.source),
        destination: a.destination ?? { rootId: "internal", segments: [] },
      };
    case "rename":
      return { kind: "rename", source: src(a.source), pattern: a.pattern };
    case "trash":
      return { kind: "trash", source: src(a.source) };
    case "compress":
      return {
        kind: "compress",
        source: src(a.source),
        destination: a.destination ?? { rootId: "internal", segments: [] },
        archiveName: a.archiveName,
      };
    case "extract":
      return { kind: "notify", message: t("automations.api.extractKept") };
    case "mkdir":
      return {
        kind: "mkdir",
        parent: a.parent ?? { rootId: "internal", segments: [] },
        name: a.name,
      };
    case "organize":
      return {
        kind: "organize",
        folder: a.folder ?? { rootId: "internal", segments: [] },
        rule: a.rule,
      };
    case "cleaner_scan":
      return { kind: "cleaner_scan" };
    case "notify":
      return { kind: "notify", message: a.message };
    case "open_module":
      return { kind: "open_module", route: a.route };
  }
}
