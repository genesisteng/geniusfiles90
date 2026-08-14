/**
 * Static catalogs for the Automatisations editor.
 */
import type { TFunction } from "@/lib/i18n";
import type { ActionKind, ConditionKind, TriggerKind } from "./types";

export type CatalogEntry<K extends string> = {
  kind: K;
  label: string;
  description: string;
  soon?: boolean;
};

export function getTriggerCatalog(t: TFunction): CatalogEntry<TriggerKind>[] {
  return [
    {
      kind: "scheduled_time",
      label: t("automations.trigger.scheduled_time.label"),
      description: t("automations.trigger.scheduled_time.desc"),
    },
    {
      kind: "daily",
      label: t("automations.trigger.daily.label"),
      description: t("automations.trigger.daily.desc"),
    },
    {
      kind: "weekly",
      label: t("automations.trigger.weekly.label"),
      description: t("automations.trigger.weekly.desc"),
    },
    {
      kind: "app_open",
      label: t("automations.trigger.app_open.label"),
      description: t("automations.trigger.app_open.desc"),
    },
    {
      kind: "file_added",
      label: t("automations.trigger.file_added.label"),
      description: t("automations.trigger.file_added.desc"),
    },
    {
      kind: "folder_changed",
      label: t("automations.trigger.folder_changed.label"),
      description: t("automations.trigger.folder_changed.desc"),
    },
    {
      kind: "storage_low",
      label: t("automations.trigger.storage_low.label"),
      description: t("automations.trigger.storage_low.desc"),
    },
    {
      kind: "device_connected",
      label: t("automations.trigger.device_connected.label"),
      description: t("automations.trigger.device_connected.desc"),
    },
  ];
}

export function getConditionCatalog(t: TFunction): CatalogEntry<ConditionKind>[] {
  return [
    {
      kind: "file_type",
      label: t("automations.condition.file_type.label"),
      description: t("automations.condition.file_type.desc"),
    },
    {
      kind: "size_min",
      label: t("automations.condition.size_min.label"),
      description: t("automations.condition.size_min.desc"),
    },
    {
      kind: "size_max",
      label: t("automations.condition.size_max.label"),
      description: t("automations.condition.size_max.desc"),
    },
    {
      kind: "name_contains",
      label: t("automations.condition.name_contains.label"),
      description: t("automations.condition.name_contains.desc"),
    },
    {
      kind: "location",
      label: t("automations.condition.location.label"),
      description: t("automations.condition.location.desc"),
    },
    {
      kind: "created_after",
      label: t("automations.condition.created_after.label"),
      description: t("automations.condition.created_after.desc"),
    },
    {
      kind: "modified_after",
      label: t("automations.condition.modified_after.label"),
      description: t("automations.condition.modified_after.desc"),
    },
    {
      kind: "storage_available",
      label: t("automations.condition.storage_available.label"),
      description: t("automations.condition.storage_available.desc"),
    },
  ];
}

export function getActionCatalog(t: TFunction): CatalogEntry<ActionKind>[] {
  return [
    {
      kind: "copy",
      label: t("automations.action.copy.label"),
      description: t("automations.action.copy.desc"),
    },
    {
      kind: "move",
      label: t("automations.action.move.label"),
      description: t("automations.action.move.desc"),
    },
    {
      kind: "rename",
      label: t("automations.action.rename.label"),
      description: t("automations.action.rename.desc"),
    },
    {
      kind: "trash",
      label: t("automations.action.trash.label"),
      description: t("automations.action.trash.desc"),
    },
    {
      kind: "compress",
      label: t("automations.action.compress.label"),
      description: t("automations.action.compress.desc"),
    },
    {
      kind: "extract",
      label: t("automations.action.extract.label"),
      description: t("automations.action.extract.desc"),
    },
    {
      kind: "backup",
      label: t("automations.action.backup.label"),
      description: t("automations.action.backup.desc"),
    },
    {
      kind: "mkdir",
      label: t("automations.action.mkdir.label"),
      description: t("automations.action.mkdir.desc"),
    },
    {
      kind: "organize",
      label: t("automations.action.organize.label"),
      description: t("automations.action.organize.desc"),
    },
    {
      kind: "cleaner_scan",
      label: t("automations.action.cleaner_scan.label"),
      description: t("automations.action.cleaner_scan.desc"),
    },
    {
      kind: "notify",
      label: t("automations.action.notify.label"),
      description: t("automations.action.notify.desc"),
    },
    {
      kind: "open_module",
      label: t("automations.action.open_module.label"),
      description: t("automations.action.open_module.desc"),
    },
  ];
}

export function getOpenableModules(t: TFunction): { route: string; label: string }[] {
  return [
    { route: "/", label: t("automations.module.files") },
    { route: "/nettoyeur", label: t("automations.module.cleaner") },
    { route: "/corbeille", label: t("automations.module.trash") },
    { route: "/pdf-outils", label: t("automations.module.pdfTools") },
    { route: "/coffre-fort", label: t("automations.module.vault") },
  ];
}

export function getWeekDays(t: TFunction): string[] {
  return [
    t("automations.day.sun"),
    t("automations.day.mon"),
    t("automations.day.tue"),
    t("automations.day.wed"),
    t("automations.day.thu"),
    t("automations.day.fri"),
    t("automations.day.sat"),
  ];
}
