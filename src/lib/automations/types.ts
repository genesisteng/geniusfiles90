/**
 * Automatisations — type contracts.
 *
 * Actions that touch the filesystem carry a structured `source`
 * (parent folder + selected entries) and, where relevant, a typed
 * `destination`. These fields are serialisable so the entire store
 * still round-trips through localStorage.
 */
import type { FileEntry, PathRef } from "@/lib/files/types";

export type TriggerKind =
  | "scheduled_time"
  | "daily"
  | "weekly"
  | "app_open"
  | "file_added"
  | "folder_changed"
  | "storage_low"
  | "device_connected";

export type Trigger =
  | { kind: "scheduled_time"; at: string /* HH:mm */ }
  | { kind: "daily"; at: string }
  | { kind: "weekly"; at: string; days: number[] /* 0-6, 0=Sun */ }
  | { kind: "app_open" }
  | { kind: "file_added"; folder: string }
  | { kind: "folder_changed"; folder: string }
  | { kind: "storage_low"; thresholdPct: number }
  | { kind: "device_connected"; deviceType?: "usb" | "sdcard" | "any" };

export type ConditionKind =
  | "file_type"
  | "size_min"
  | "size_max"
  | "name_contains"
  | "location"
  | "created_after"
  | "modified_after"
  | "storage_available";

export type Condition =
  | { kind: "file_type"; types: string[] }
  | { kind: "size_min"; bytes: number }
  | { kind: "size_max"; bytes: number }
  | { kind: "name_contains"; text: string }
  | { kind: "location"; folder: string }
  | { kind: "created_after"; date: string }
  | { kind: "modified_after"; date: string }
  | { kind: "storage_available"; minBytes: number };

export type ActionKind =
  | "copy"
  | "move"
  | "rename"
  | "trash"
  | "compress"
  | "extract"
  | "backup"
  | "mkdir"
  | "organize"
  | "cleaner_scan"
  | "notify"
  | "open_module";

/** Serialisable file selection captured at design time. */
export type FileSelection = { parent: PathRef; entries: FileEntry[] };

export type Action =
  | { kind: "copy"; source?: FileSelection; destination?: PathRef }
  | { kind: "move"; source?: FileSelection; destination?: PathRef }
  | { kind: "rename"; source?: FileSelection; pattern: string }
  | { kind: "trash"; source?: FileSelection }
  | { kind: "compress"; source?: FileSelection; destination?: PathRef; archiveName: string }
  | { kind: "extract"; archive?: FileSelection; destination?: PathRef }
  | { kind: "backup"; source?: FileSelection; destination?: PathRef }
  | { kind: "mkdir"; parent?: PathRef; name: string }
  | { kind: "organize"; folder?: PathRef; rule: "type" | "date" | "name" }
  | { kind: "cleaner_scan" }
  | { kind: "notify"; message: string }
  | { kind: "open_module"; route: string };

export type AutomationSource = "manual" | "ai" | "template" | "recommendation";

export type Automation = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: Trigger;
  conditions: Condition[];
  actions: Action[];
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  runCount: number;
  source: AutomationSource;
  syncKey?: string;
};

export type ExecutionStatus = "ok" | "partial" | "failed" | "simulated";

export type ExecutionActionResult = {
  action: ActionKind;
  label: string;
  status: "ok" | "failed" | "skipped";
  filesProcessed: number;
  message?: string;
};

export type ExecutionRecord = {
  id: string;
  automationId: string;
  automationName: string;
  startedAt: number;
  finishedAt: number;
  status: ExecutionStatus;
  simulated: boolean;
  filesProcessed: number;
  actions: ExecutionActionResult[];
  errors: string[];
};

/** Displayable state for an automation card. */
export type DisplayStatus = "disabled" | "pending" | "running" | "success" | "partial" | "failed";
