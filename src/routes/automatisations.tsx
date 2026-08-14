/**
 * Automatisations — main route.
 *
 * The page walks users through a strict, guided creation flow:
 *   1. Trigger  (with mandatory params)
 *   2. Actions (each with required sources/destinations)
 *   3. Conditions (optional)
 *   4. Summary + activation
 *
 * The wizard never runs the automation on save. It also never fires a
 * notification at creation. Execution is only triggered from an
 * explicit "Exécuter maintenant" action on an existing card, or by
 * the scheduler when the exact trigger moment is reached.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  History,
  Loader2,
  Plus,
  Play,
  Power,
  Trash2,
  Wand2,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { BACK_PRIORITY, useBackHandler } from "@/lib/navigation/back-stack";
import { usePullToRefresh } from "@/lib/gestures/pull-refresh";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { errorMessage } from "@/lib/errors/humanize";
import {
  BottomSheet,
  ConfirmDialog,
  PrimaryButton,
  TextField,
} from "@/components/files/BottomSheet";
import { DestinationPicker } from "@/components/files/DestinationPicker";
import { FileIcon } from "@/components/files/FileIcon";
import { FileSourcePicker } from "@/components/files/FileSourcePicker";
import {
  getActionCatalog,
  getConditionCatalog,
  getOpenableModules,
  getTriggerCatalog,
  getWeekDays,
} from "@/lib/automations/catalog";
import { formatDateValue, t as translateNow, useT } from "@/lib/i18n";
import { buildPreview, runAutomation, type ActionPreview } from "@/lib/automations/engine";
import { loadExecutionHistory, subscribeExecutionHistory } from "@/lib/automations/history";
import { displayStatus, isRunning, subscribeRunning } from "@/lib/automations/status";
import {
  deleteAutomation,
  duplicateAutomation,
  listAutomations,
  saveAutomation,
  subscribeAutomations,
  toggleAutomation,
} from "@/lib/automations/store";
import { toAbsolutePath } from "@/lib/files/fs";
import type {
  Action,
  ActionKind,
  Automation,
  Condition,
  ConditionKind,
  ExecutionRecord,
  FileSelection,
  Trigger,
  TriggerKind,
} from "@/lib/automations/types";
import type { FileEntry, PathRef } from "@/lib/files/types";

export const Route = createFileRoute("/automatisations")({
  head: () => ({
    meta: [
      { title: "Automatisations — GeniusFiles" },
      {
        name: "description",
        content: translateNow("meta.automations.description"),
      },
      { property: "og:title", content: "Automatisations — GeniusFiles" },
      {
        property: "og:description",
        content: translateNow("meta.automations.ogDescription"),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AutomationsPage,
});

/* ─────────────────────── Draft helpers ─────────────────────── */

type Draft = {
  id?: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: Trigger;
  conditions: Condition[];
  actions: Action[];
};

function emptyDraft(): Draft {
  return {
    name: "",
    description: "",
    enabled: true,
    trigger: { kind: "daily", at: "09:00" },
    conditions: [],
    actions: [],
  };
}

function fromAutomation(a: Automation): Draft {
  return {
    id: a.id,
    name: a.name,
    description: a.description ?? "",
    enabled: a.enabled,
    trigger: a.trigger,
    conditions: a.conditions.map((c) => ({ ...c })),
    actions: a.actions.map((c) => ({ ...c })),
  };
}

/* ─────────────────────── Root component ─────────────────────── */

function AutomationsPage() {
  /* Position de la liste restituée au retour depuis un aperçu. */
  useListScrollMemory("automations", true);

  const tr = useT();
  const [items, setItems] = useState<Automation[]>([]);
  const [history, setHistory] = useState<ExecutionRecord[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Automation | null>(null);
  const [, forceTick] = useState(0);

  const refresh = useCallback(() => {
    setItems(listAutomations());
    setHistory(loadExecutionHistory());
  }, []);

  /* Tirer pour actualiser : relit les règles et l'historique réels. */
  usePullToRefresh(refresh);

  useEffect(() => {
    refresh();
    const un1 = subscribeAutomations(refresh);
    const un2 = subscribeExecutionHistory(refresh);
    const un3 = subscribeRunning(() => forceTick((n) => n + 1));
    return () => {
      un1();
      un2();
      un3();
    };
  }, [refresh]);

  const activeCount = useMemo(() => items.filter((a) => a.enabled).length, [items]);

  const openCreate = () => setEditing(emptyDraft());
  const openEdit = (a: Automation) => setEditing(fromAutomation(a));

  const onSave = (draft: Draft) => {
    saveAutomation({
      id: draft.id,
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      enabled: draft.enabled,
      trigger: draft.trigger,
      conditions: draft.conditions,
      actions: draft.actions,
    });
    setEditing(null);
    toast.success(
      draft.id ? tr("automations.toast.updated.title") : tr("automations.toast.created.title"),
      {
        description: draft.id
          ? tr("automations.toast.updated.desc")
          : tr("automations.toast.created.desc"),
      },
    );
  };

  return (
    <AppShell>
      <PageHeader
        title={tr("automations.title")}
        subtitle={tr("automations.subtitle")}
        action={
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[12.5px] font-semibold text-primary-foreground shadow-soft transition-transform active:scale-95"
          >
            <Plus className="h-4 w-4" />
            {tr("automations.new")}
          </button>
        }
      />

      {items.length ? (
        <>
          {/* Compteurs : une seule et unique présentation du volume. */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <StatTile
              icon={Zap}
              value={String(items.length)}
              label={tr("automations.stat.count", { count: items.length }).replace(
                `${items.length} `,
                "",
              )}
            />
            <StatTile
              icon={CheckCircle2}
              value={String(activeCount)}
              label={tr("automations.stat.active", { count: activeCount }).replace(
                `${activeCount} `,
                "",
              )}
              muted={activeCount === 0}
            />
          </div>

          <SectionHeader title={tr("automations.section.list")} />
          <ul className="flex flex-col gap-2">
            {items.map((a) => (
              <AutomationCard
                key={a.id}
                automation={a}
                history={history}
                onEdit={() => openEdit(a)}
                onToggle={() => toggleAutomation(a.id, !a.enabled)}
                onDuplicate={() => {
                  duplicateAutomation(a.id);
                  toast.success(tr("automations.toast.duplicated.title"), {
                    description: tr("automations.toast.duplicated.desc"),
                  });
                }}
                onDelete={() => setConfirmDelete(a)}
                onRun={async () => {
                  try {
                    const rec = await runAutomation(a, { simulate: false });
                    if (rec.status === "ok") {
                      toast.success(tr("automations.toast.ran.title"), {
                        description: tr("automations.toast.ran.desc", { name: a.name }),
                      });
                    } else if (rec.status === "partial") {
                      toast.warning(tr("automations.toast.partial.title"), {
                        description: tr("automations.toast.partial.desc", {
                          name: a.name,
                          count: rec.errors.length,
                        }),
                      });
                    } else {
                      toast.error(tr("automations.toast.failed.title"), {
                        description: rec.errors[0]
                          ? errorMessage(new Error(rec.errors[0]))
                          : tr("automations.toast.failed.desc", { name: a.name }),
                      });
                    }
                  } catch (err) {
                    toast.error(tr("automations.toast.failed.title"), {
                      description: errorMessage(err, tr("automations.toast.failed.generic")),
                    });
                  }
                }}
              />
            ))}
          </ul>
        </>
      ) : (
        /* État vide : un seul message, une seule action. */
        <div className="card-surface mt-4 flex flex-col items-center gap-3 px-5 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Wand2 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-foreground">
              {tr("automations.empty.title")}
            </p>
            <p className="mx-auto mt-1 max-w-[38ch] text-[12.5px] leading-relaxed text-muted-foreground">
              {tr("automations.empty.desc")}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="mt-1 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-soft transition-transform active:scale-95"
          >
            <Plus className="h-4 w-4" />
            {tr("automations.empty.cta")}
          </button>
        </div>
      )}

      {/* Historique : toujours accessible, compact, aux deux états. */}
      <SectionHeader title={tr("automations.history.section")} />
      <Link
        to="/automatisations/historique"
        className="card-surface flex w-full items-center gap-3 p-3.5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <History className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium text-foreground">
            {history.length
              ? tr("automations.history.count", { count: history.length })
              : tr("automations.history.none")}
          </p>
          <p className="truncate text-[11.5px] text-muted-foreground">
            {history[0]
              ? tr("automations.history.last", {
                  name: history[0].automationName,
                  when: formatDateValue(history[0].finishedAt, {
                    dateStyle: "short",
                    timeStyle: "short",
                  }),
                })
              : tr("automations.history.hint")}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      {editing ? (
        <AutomationWizard draft={editing} onCancel={() => setEditing(null)} onSave={onSave} />
      ) : null}

      <ConfirmDialog
        open={!!confirmDelete}
        title={tr("automations.delete.title")}
        danger
        confirmLabel={tr("action.delete")}
        description={
          <>
            {tr("automations.delete.desc.before")}
            <span className="font-medium text-foreground"> {confirmDelete?.name} </span>
            {tr("automations.delete.desc.after")}
          </>
        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            deleteAutomation(confirmDelete.id);
            toast.success(tr("automations.toast.deleted.title"), {
              description: tr("automations.toast.deleted.desc", { name: confirmDelete.name }),
            });
          }
          setConfirmDelete(null);
        }}
      />
    </AppShell>
  );
}

/* ─────────────────────── Stat tile ─────────────────────── */

function StatTile({
  icon: Icon,
  value,
  label,
  muted,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className="card-surface flex items-center gap-3 p-3.5">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          muted ? "bg-secondary text-muted-foreground" : "bg-primary/12 text-primary"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[18px] font-bold leading-none tabular-nums text-foreground">{value}</p>
        <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/* ─────────────────────── Card ─────────────────────── */

function AutomationCard({
  automation,
  history,
  onEdit,
  onToggle,
  onDuplicate,
  onDelete,
  onRun,
}: {
  automation: Automation;
  history: ExecutionRecord[];
  onEdit: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRun: () => Promise<void>;
}) {
  const tr = useT();
  const summary = triggerSummary(automation.trigger);
  const st = displayStatus(automation, history);
  const running = isRunning(automation.id);
  const [busy, setBusy] = useState(false);
  const lastReal = history.find((r) => r.automationId === automation.id && !r.simulated);
  return (
    <li className="card-surface flex flex-col gap-2 p-3.5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={
            automation.enabled ? tr("automations.toggle.disable") : tr("automations.toggle.enable")
          }
          className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
            automation.enabled
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-accent text-muted-foreground"
          }`}
        >
          <Power className="h-4 w-4" />
        </button>
        <button type="button" onClick={onEdit} className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-medium text-foreground">{automation.name}</p>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${st.tone}`}
            >
              {st.label}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {summary} · {tr("automations.card.actionsCount", { count: automation.actions.length })}
            {automation.conditions.length
              ? ` · ${tr("automations.card.conditionsCount", { count: automation.conditions.length })}`
              : ""}
          </p>
          {lastReal ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {tr("automations.card.lastRun", {
                when: formatDateValue(lastReal.finishedAt, {
                  dateStyle: "short",
                  timeStyle: "short",
                }),
              })}
            </p>
          ) : null}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-12">
        <RowChip
          icon={running || busy ? Loader2 : Play}
          label={running || busy ? tr("automations.card.running") : tr("automations.card.run")}
          onClick={async () => {
            if (busy || running) return;
            setBusy(true);
            try {
              await onRun();
            } finally {
              setBusy(false);
            }
          }}
          primary
          spinning={running || busy}
        />
        <RowChip icon={Copy} label={tr("automations.card.duplicate")} onClick={onDuplicate} />
        <RowChip icon={Trash2} label={tr("automations.card.delete")} onClick={onDelete} danger />
      </div>
    </li>
  );
}

function RowChip({
  icon: Icon,
  label,
  onClick,
  primary,
  danger,
  spinning,
}: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  spinning?: boolean;
}) {
  const cls = primary
    ? "bg-primary text-primary-foreground shadow-soft"
    : danger
      ? "border border-red-500/30 text-red-500 hover:bg-red-500/10"
      : "border border-border bg-surface text-muted-foreground hover:text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${cls}`}
    >
      <Icon className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}

/* ─────────────────────── Wizard ─────────────────────── */

type Step = 1 | 2 | 3 | 4;

const STEP_KEYS: Record<Step, string> = {
  1: "automations.step.trigger",
  2: "automations.step.actions",
  3: "automations.step.conditions",
  4: "automations.step.summary",
};

function AutomationWizard({
  draft: initial,
  onCancel,
  onSave,
}: {
  draft: Draft;
  onCancel: () => void;
  onSave: (draft: Draft) => void;
}) {
  const tr = useT();
  const [draft, setDraft] = useState<Draft>(initial);
  const [step, setStep] = useState<Step>(1);
  useEffect(() => setDraft(initial), [initial]);

  /* Retour Android dans l'assistant : revient à l'étape précédente avant de
     fermer la feuille (priorité au-dessus de l'overlay qui la contient). */
  useBackHandler(
    step > 1,
    () => {
      setStep((n) => (n - 1) as Step);
      return true;
    },
    BACK_PRIORITY.overlay + 10,
  );

  const triggerErr = validateTrigger(draft.trigger);
  const actionErr = validateActions(draft.actions);
  const conditionErr = draft.conditions.map((c) => validateCondition(c)).find((e) => e) as
    | string
    | undefined;

  const canNext =
    (step === 1 && !triggerErr) ||
    (step === 2 && !actionErr) ||
    (step === 3 && !conditionErr) ||
    step === 4;

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error(tr("automations.wizard.nameRequired"));
      return;
    }
    if (triggerErr) {
      toast.error(triggerErr);
      setStep(1);
      return;
    }
    if (actionErr) {
      toast.error(actionErr);
      setStep(2);
      return;
    }
    if (conditionErr) {
      toast.error(conditionErr);
      setStep(3);
      return;
    }
    onSave(draft);
  };

  return (
    <BottomSheet
      open
      onClose={onCancel}
      title={draft.id ? tr("automations.wizard.editTitle") : tr("automations.wizard.createTitle")}
      footer={
        <>
          {step > 1 ? (
            <PrimaryButton variant="ghost" onClick={() => setStep((s) => (s - 1) as Step)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> {tr("action.back")}
            </PrimaryButton>
          ) : (
            <PrimaryButton variant="ghost" onClick={onCancel}>
              {tr("action.cancel")}
            </PrimaryButton>
          )}
          {step < 4 ? (
            <PrimaryButton
              onClick={() => canNext && setStep((s) => (s + 1) as Step)}
              disabled={!canNext}
            >
              {tr("action.next")} <ArrowRight className="ml-1 h-4 w-4" />
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={submit}>
              <Check className="mr-1 h-4 w-4" />
              {draft.id ? tr("action.save") : tr("automations.wizard.create")}
            </PrimaryButton>
          )}
        </>
      }
    >
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
        <StepIndicator step={step} onGo={setStep} />

        {step === 1 ? (
          <TriggerStep
            trigger={draft.trigger}
            onChange={(trigger) => setDraft((d) => ({ ...d, trigger }))}
            error={triggerErr}
          />
        ) : null}

        {step === 2 ? (
          <ActionsStep
            actions={draft.actions}
            onChange={(actions) => setDraft((d) => ({ ...d, actions }))}
            error={actionErr}
          />
        ) : null}

        {step === 3 ? (
          <ConditionsStep
            conditions={draft.conditions}
            onChange={(conditions) => setDraft((d) => ({ ...d, conditions }))}
          />
        ) : null}

        {step === 4 ? (
          <SummaryStep
            draft={draft}
            onName={(name) => setDraft((d) => ({ ...d, name }))}
            onDescription={(description) => setDraft((d) => ({ ...d, description }))}
            onEnabled={(enabled) => setDraft((d) => ({ ...d, enabled }))}
          />
        ) : null}
      </div>
    </BottomSheet>
  );
}

function StepIndicator({ step, onGo }: { step: Step; onGo: (s: Step) => void }) {
  const tr = useT();
  return (
    <ol className="flex items-center gap-1 text-[11px]">
      {[1, 2, 3, 4].map((n) => {
        const active = n === step;
        const done = n < step;
        return (
          <li key={n} className="flex flex-1 items-center gap-1">
            <button
              type="button"
              onClick={() => onGo(n as Step)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors ${
                active
                  ? "bg-primary/15 text-primary"
                  : done
                    ? "text-emerald-500"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-emerald-500/20 text-emerald-500"
                      : "bg-accent text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : n}
              </span>
              <span className="text-[10px] font-medium">{tr(STEP_KEYS[n as Step])}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ─────────────────────── Step 1 — trigger ─────────────────────── */

function TriggerStep({
  trigger,
  onChange,
  error,
}: {
  trigger: Trigger;
  onChange: (t: Trigger) => void;
  error?: string;
}) {
  const tr = useT();
  const TRIGGER_CATALOG = getTriggerCatalog(tr);
  const [pickerOpen, setPickerOpen] = useState(false);
  const current = TRIGGER_CATALOG.find((entry) => entry.kind === trigger.kind)!;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {tr("automations.trigger.stepHint")}
      </p>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="card-surface flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Zap className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <p className="text-[13px] font-medium text-foreground">{current.label}</p>
          <p className="text-[11px] text-muted-foreground">{triggerSummary(trigger)}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
      <TriggerParams trigger={trigger} onChange={onChange} />
      {error ? <p className="text-[11px] text-red-500">{error}</p> : null}

      <BottomSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={tr("automations.trigger.pickTitle")}
      >
        <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
          {TRIGGER_CATALOG.map((entry) => (
            <li key={entry.kind}>
              <button
                type="button"
                onClick={() => {
                  onChange(defaultTrigger(entry.kind));
                  setPickerOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent"
              >
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-foreground">{entry.label}</p>
                  <p className="text-[11px] text-muted-foreground">{entry.description}</p>
                </div>
                {trigger.kind === entry.kind ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}

function TriggerParams({
  trigger,
  onChange,
}: {
  trigger: Trigger;
  onChange: (t: Trigger) => void;
}) {
  const tr = useT();
  const WEEK_DAYS = getWeekDays(tr);
  if (trigger.kind === "scheduled_time" || trigger.kind === "daily") {
    return (
      <div>
        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Heure</label>
        <input
          type="time"
          value={trigger.at}
          onChange={(e) => onChange({ ...trigger, at: e.target.value })}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground"
        />
      </div>
    );
  }
  if (trigger.kind === "weekly") {
    return (
      <div className="space-y-2">
        <label className="block text-[11px] font-medium text-muted-foreground">Jours</label>
        <div className="flex flex-wrap gap-1.5">
          {WEEK_DAYS.map((label, idx) => {
            const active = trigger.days.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const set = new Set(trigger.days);
                  if (active) set.delete(idx);
                  else set.add(idx);
                  onChange({ ...trigger, days: Array.from(set).sort() });
                }}
                className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-surface text-muted-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <label className="block text-[11px] font-medium text-muted-foreground">Heure</label>
        <input
          type="time"
          value={trigger.at}
          onChange={(e) => onChange({ ...trigger, at: e.target.value })}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground"
        />
      </div>
    );
  }
  if (trigger.kind === "file_added" || trigger.kind === "folder_changed") {
    return (
      <div>
        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
          {translateNow("automation.trigger.folderLabel")}
        </label>
        <TextField
          value={trigger.folder}
          onChange={(folder) => onChange({ ...trigger, folder })}
          placeholder="/DCIM/Camera"
        />
      </div>
    );
  }
  if (trigger.kind === "storage_low") {
    return (
      <div>
        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
          Seuil (% libre)
        </label>
        <input
          type="number"
          min={1}
          max={99}
          value={trigger.thresholdPct}
          onChange={(e) =>
            onChange({
              ...trigger,
              thresholdPct: Math.max(1, Math.min(99, Number(e.target.value) || 10)),
            })
          }
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground"
        />
      </div>
    );
  }
  return null;
}

function defaultTrigger(kind: TriggerKind): Trigger {
  switch (kind) {
    case "scheduled_time":
      return { kind, at: nextRoundTime() };
    case "daily":
      return { kind, at: "09:00" };
    case "weekly":
      return { kind, at: "09:00", days: [1, 2, 3, 4, 5] };
    case "app_open":
      return { kind };
    case "file_added":
      return { kind, folder: "" };
    case "folder_changed":
      return { kind, folder: "" };
    case "storage_low":
      return { kind, thresholdPct: 10 };
    case "device_connected":
      return { kind, deviceType: "any" };
  }
}

function nextRoundTime(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
}

function triggerSummary(t: Trigger): string {
  switch (t.kind) {
    case "scheduled_time":
      return translateNow("automations.summary.once", { at: t.at });
    case "daily":
      return translateNow("automations.summary.daily", { at: t.at });
    case "weekly":
      return translateNow("automations.summary.weekly", {
        days:
          t.days.map((d) => getWeekDays(translateNow)[d]).join(", ") ||
          translateNow("automations.summary.weeklyNoDay"),
        at: t.at,
      });
    case "app_open":
      return translateNow("automations.summary.appOpen");
    case "file_added":
      return t.folder
        ? translateNow("automations.summary.fileAddedFolder", { folder: t.folder })
        : translateNow("automations.summary.fileAdded");
    case "folder_changed":
      return t.folder
        ? translateNow("automations.summary.folderChanged", { folder: t.folder })
        : translateNow("automations.summary.folderChangedGeneric");
    case "storage_low":
      return translateNow("automations.summary.storageLow", { pct: t.thresholdPct });
    case "device_connected":
      return translateNow("automations.summary.deviceConnected");
  }
}

function validateTrigger(t: Trigger): string | undefined {
  const validHM = (s: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(s.trim());
  switch (t.kind) {
    case "scheduled_time":
    case "daily":
      return validHM(t.at) ? undefined : translateNow("automations.trigger.err.time");
    case "weekly":
      if (!validHM(t.at)) return translateNow("automations.trigger.err.time");
      if (!t.days.length) return translateNow("automations.trigger.err.days");
      return undefined;
    case "file_added":
    case "folder_changed":
      return t.folder.trim() ? undefined : translateNow("automations.trigger.err.folder");
    case "storage_low":
      return t.thresholdPct >= 1 && t.thresholdPct <= 99
        ? undefined
        : translateNow("automations.trigger.err.threshold");
    default:
      return undefined;
  }
}

/* ─────────────────────── Step 2 — actions ─────────────────────── */

function ActionsStep({
  actions,
  onChange,
  error,
}: {
  actions: Action[];
  onChange: (a: Action[]) => void;
  error?: string;
}) {
  const tr = useT();
  const ACTION_CATALOG = getActionCatalog(tr);
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {tr("automations.actions.title")}
        </p>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
        >
          <Plus className="h-3 w-3" />
          {tr("automations.actions.add")}
        </button>
      </div>
      {actions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface px-3 py-3 text-center text-[11px] text-muted-foreground">
          {tr("automations.actions.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {actions.map((a, i) => (
            <li key={i} className="card-surface p-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[12px] font-medium text-foreground">
                  {i + 1}. {ACTION_CATALOG.find((entry) => entry.kind === a.kind)?.label}
                </p>
                <div className="flex items-center gap-2">
                  {i > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const copy = [...actions];
                        [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
                        onChange(copy);
                      }}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      ↑
                    </button>
                  ) : null}
                  {i < actions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const copy = [...actions];
                        [copy[i + 1], copy[i]] = [copy[i], copy[i + 1]];
                        onChange(copy);
                      }}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      ↓
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onChange(actions.filter((_, j) => j !== i))}
                    className="text-[11px] text-red-500 hover:brightness-110"
                  >
                    {tr("automations.actions.remove")}
                  </button>
                </div>
              </div>
              <ActionParams
                action={a}
                onChange={(next) => onChange(actions.map((aa, j) => (j === i ? next : aa)))}
              />
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
      <BottomSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={tr("automations.actions.pickTitle")}
      >
        <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
          {ACTION_CATALOG.map((entry) => (
            <li key={entry.kind}>
              <button
                type="button"
                onClick={() => {
                  onChange([...actions, defaultAction(entry.kind)]);
                  setPickerOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent"
              >
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-foreground">{entry.label}</p>
                  <p className="text-[11px] text-muted-foreground">{entry.description}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}

/** UI to configure a single action. All file selections are typed. */
function ActionParams({ action, onChange }: { action: Action; onChange: (a: Action) => void }) {
  const tr = useT();
  const OPENABLE_MODULES = getOpenableModules(tr);
  switch (action.kind) {
    case "copy":
    case "move":
    case "backup":
      return (
        <div className="space-y-2">
          <SelectionField
            label={tr("automations.field.sourceGeneric")}
            selection={action.source}
            onChange={(source) => onChange({ ...action, source })}
          />
          <DestinationField
            label={tr("automations.field.destination")}
            path={action.destination}
            onChange={(destination) => onChange({ ...action, destination })}
          />
        </div>
      );
    case "trash":
      return (
        <SelectionField
          label={tr("automations.field.sourceTrash")}
          selection={action.source}
          onChange={(source) => onChange({ ...action, source })}
        />
      );
    case "rename":
      return (
        <div className="space-y-2">
          <SelectionField
            label={tr("automations.field.sourceRename")}
            selection={action.source}
            onChange={(source) => onChange({ ...action, source })}
          />
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {tr("automations.field.renamePattern", { vars: "{name} {ext} {date} {time}" })}
            </label>
            <TextField
              value={action.pattern}
              onChange={(pattern) => onChange({ ...action, pattern })}
              placeholder="{date}-{name}"
            />
          </div>
        </div>
      );
    case "compress":
      return (
        <div className="space-y-2">
          <SelectionField
            label={tr("automations.field.sourceCompress")}
            selection={action.source}
            onChange={(source) => onChange({ ...action, source })}
          />
          <DestinationField
            label={tr("automations.field.archiveFolder")}
            path={action.destination}
            onChange={(destination) => onChange({ ...action, destination })}
          />
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {tr("automations.field.archiveName")}
            </label>
            <TextField
              value={action.archiveName}
              onChange={(archiveName) => onChange({ ...action, archiveName })}
              placeholder="archive.zip"
            />
          </div>
        </div>
      );
    case "extract":
      return (
        <div className="space-y-2">
          <SelectionField
            label={tr("automations.field.archiveToExtract")}
            selection={action.archive}
            onChange={(archive) => onChange({ ...action, archive })}
            singleFileOnly
          />
          <DestinationField
            label={tr("automations.field.destination")}
            path={action.destination}
            onChange={(destination) => onChange({ ...action, destination })}
          />
        </div>
      );
    case "mkdir":
      return (
        <div className="space-y-2">
          <DestinationField
            label={tr("automations.field.createIn")}
            path={action.parent}
            onChange={(parent) => onChange({ ...action, parent })}
          />
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {tr("automations.field.folderName")}
            </label>
            <TextField
              value={action.name}
              onChange={(name) => onChange({ ...action, name })}
              placeholder={tr("action.newFolder")}
            />
          </div>
        </div>
      );
    case "organize":
      return (
        <div className="space-y-2">
          <DestinationField
            label={tr("automations.field.folderToOrganize")}
            path={action.folder}
            onChange={(folder) => onChange({ ...action, folder })}
          />
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {tr("automations.field.rule")}
            </label>
            <select
              value={action.rule}
              onChange={(e) =>
                onChange({ ...action, rule: e.target.value as "type" | "date" | "name" })
              }
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground"
            >
              <option value="type">{tr("automations.field.rule.type")}</option>
              <option value="date">{tr("automations.field.rule.date")}</option>
              <option value="name">{tr("automations.field.rule.name")}</option>
            </select>
          </div>
        </div>
      );
    case "cleaner_scan":
      return (
        <p className="text-[11px] text-muted-foreground">{tr("automations.field.cleanerHint")}</p>
      );
    case "notify":
      return (
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
            {tr("automations.field.notifyMessage")}
          </label>
          <TextField
            value={action.message}
            onChange={(message) => onChange({ ...action, message })}
            placeholder={tr("automations.field.notifyPlaceholder")}
          />
        </div>
      );
    case "open_module":
      return (
        <select
          value={action.route}
          onChange={(e) => onChange({ ...action, route: e.target.value })}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground"
        >
          {OPENABLE_MODULES.map((m) => (
            <option key={m.route} value={m.route}>
              {m.label}
            </option>
          ))}
        </select>
      );
  }
}

function defaultAction(kind: ActionKind): Action {
  switch (kind) {
    case "copy":
    case "move":
    case "backup":
      return { kind };
    case "rename":
      return { kind, pattern: "{date}-{name}" };
    case "trash":
      return { kind };
    case "compress":
      return { kind, archiveName: "archive.zip" };
    case "extract":
      return { kind };
    case "mkdir":
      return { kind, name: "" };
    case "organize":
      return { kind, rule: "type" };
    case "cleaner_scan":
      return { kind };
    case "notify":
      return { kind, message: "" };
    case "open_module":
      return { kind, route: "/" };
  }
}

function validateAction(a: Action): string | undefined {
  switch (a.kind) {
    case "copy":
    case "move":
    case "backup":
      if (!a.source || a.source.entries.length === 0)
        return translateNow("automations.action.err.selectItem");
      if (!a.destination) return translateNow("automations.action.err.selectDestination");
      return undefined;
    case "trash":
      if (!a.source || a.source.entries.length === 0)
        return translateNow("automations.action.err.selectItem");
      return undefined;
    case "rename":
      if (!a.source || a.source.entries.length === 0)
        return translateNow("automations.action.err.selectFile");
      if (!a.pattern.trim()) return translateNow("automations.action.err.pattern");
      return undefined;
    case "compress":
      if (!a.source || a.source.entries.length === 0)
        return translateNow("automations.action.err.selectFile");
      if (!a.destination) return translateNow("automations.action.err.archiveFolder");
      if (!a.archiveName.trim()) return translateNow("automations.action.err.archiveName");
      return undefined;
    case "extract":
      if (!a.archive || a.archive.entries.length === 0)
        return translateNow("automations.action.err.selectArchive");
      if (!a.destination) return translateNow("automations.action.err.selectDestination");
      return undefined;
    case "mkdir":
      if (!a.parent) return translateNow("automations.action.err.location");
      if (!a.name.trim()) return translateNow("automations.action.err.folderName");
      return undefined;
    case "organize":
      if (!a.folder) return translateNow("automations.action.err.folderToOrganize");
      return undefined;
    case "notify":
      if (!a.message.trim()) return translateNow("automations.action.err.notifyMessage");
      return undefined;
    default:
      return undefined;
  }
}

function validateActions(actions: Action[]): string | undefined {
  if (!actions.length) return translateNow("automations.actions.err.needOne");
  for (let i = 0; i < actions.length; i++) {
    const err = validateAction(actions[i]);
    if (err) return translateNow("automations.actions.err.numbered", { index: i + 1, error: err });
  }
  return undefined;
}

/* ─────────────────────── Selection + destination controls ─────────────────────── */

function SelectionField({
  label,
  selection,
  onChange,
  singleFileOnly,
}: {
  label: string;
  selection?: FileSelection;
  onChange: (s: FileSelection) => void;
  singleFileOnly?: boolean;
}) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-[12px] text-foreground hover:bg-accent"
      >
        <span className="flex-1 truncate">
          {selection && selection.entries.length ? (
            selection.entries.length === 1 ? (
              selection.entries[0].name
            ) : (
              tr("automations.selection.itemsSelected", { count: selection.entries.length })
            )
          ) : (
            <span className="text-muted-foreground">{tr("automations.selection.choose")}</span>
          )}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
      {selection && selection.entries.length ? (
        <ul className="mt-1 space-y-0.5">
          {selection.entries.slice(0, 3).map((e) => (
            <li
              key={e.name}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <FileIcon kind={e.kind} path={e.path} />
              <span className="truncate">{e.name}</span>
            </li>
          ))}
          {selection.entries.length > 3 ? (
            <li className="text-[11px] text-muted-foreground">
              {tr("automations.selection.more", { count: selection.entries.length - 3 })}
            </li>
          ) : null}
        </ul>
      ) : null}
      <SelectionPicker
        open={open}
        onCancel={() => setOpen(false)}
        multi={!singleFileOnly}
        onConfirm={(sel) => {
          onChange(sel);
          setOpen(false);
        }}
      />
    </div>
  );
}

function DestinationField({
  label,
  path,
  onChange,
}: {
  label: string;
  path?: PathRef;
  onChange: (p: PathRef) => void;
}) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-[12px] text-foreground hover:bg-accent"
      >
        <span className="flex-1 truncate">
          {path ? (
            toAbsolutePath(path)
          ) : (
            <span className="text-muted-foreground">{tr("automations.selection.choose")}</span>
          )}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
      <DestinationPicker
        open={open}
        title={label}
        initial={path ?? null}
        onCancel={() => setOpen(false)}
        onConfirm={(p) => {
          onChange(p);
          setOpen(false);
        }}
      />
    </div>
  );
}

/**
 * Sélection des éléments d'une automatisation.
 *
 * Ouvre le MODE SÉLECTION de GeniusFiles (stockages, catégories,
 * dossiers, récents, recherche, tri) et récupère le dossier réel de
 * chaque élément — plus aucune déduction de préfixe commun.
 * `FileSelection` ne porte qu'un dossier : les éléments d'un autre
 * dossier sont signalés puis écartés.
 */
function SelectionPicker({
  open,
  multi,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  multi: boolean;
  onCancel: () => void;
  onConfirm: (s: FileSelection) => void;
}) {
  const tr = useT();
  return (
    <FileSourcePicker
      open={open}
      accept="both"
      extensions={[]}
      multi={multi}
      onCancel={onCancel}
      onConfirm={(_paths, _entries, details) => {
        const first = details.find((d) => d.parent);
        if (!first?.parent) return onCancel();
        const parent = first.parent;
        const same = details.filter(
          (d) =>
            d.parent &&
            d.parent.rootId === parent.rootId &&
            d.parent.segments.join("/") === parent.segments.join("/"),
        );
        if (same.length < details.length) {
          toast.warning(tr("automations.selection.singleFolderWarning.title"), {
            description: tr("automations.selection.singleFolderWarning.desc", {
              count: details.length - same.length,
            }),
          });
        }
        onConfirm({ parent, entries: same.map((d) => d.entry) });
      }}
    />
  );
}

/* ─────────────────────── Step 3 — conditions ─────────────────────── */

function ConditionsStep({
  conditions,
  onChange,
}: {
  conditions: Condition[];
  onChange: (c: Condition[]) => void;
}) {
  const tr = useT();
  const CONDITION_CATALOG = getConditionCatalog(tr);
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {tr("automations.conditions.title")}
        </p>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          {tr("automations.conditions.add")}
        </button>
      </div>
      {conditions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface px-3 py-3 text-center text-[11px] text-muted-foreground">
          {tr("automations.conditions.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {conditions.map((c, i) => (
            <li key={i} className="card-surface p-2.5">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[12px] font-medium text-foreground">
                  {CONDITION_CATALOG.find((entry) => entry.kind === c.kind)?.label}
                </p>
                <button
                  type="button"
                  onClick={() => onChange(conditions.filter((_, j) => j !== i))}
                  className="text-[11px] text-red-500 hover:brightness-110"
                >
                  {tr("automations.conditions.remove")}
                </button>
              </div>
              <ConditionParams
                condition={c}
                onChange={(next) => onChange(conditions.map((cc, j) => (j === i ? next : cc)))}
              />
            </li>
          ))}
        </ul>
      )}
      <BottomSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={tr("automations.conditions.pickTitle")}
      >
        <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
          {CONDITION_CATALOG.map((entry) => (
            <li key={entry.kind}>
              <button
                type="button"
                onClick={() => {
                  onChange([...conditions, defaultCondition(entry.kind)]);
                  setPickerOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent"
              >
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-foreground">{entry.label}</p>
                  <p className="text-[11px] text-muted-foreground">{entry.description}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}

function ConditionParams({
  condition,
  onChange,
}: {
  condition: Condition;
  onChange: (c: Condition) => void;
}) {
  const tr = useT();
  switch (condition.kind) {
    case "file_type":
      return (
        <TextField
          value={condition.types.join(", ")}
          onChange={(v) =>
            onChange({
              ...condition,
              types: v
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder={tr("automations.condition.fileTypePlaceholder")}
        />
      );
    case "size_min":
    case "size_max":
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={condition.bytes}
            onChange={(e) => onChange({ ...condition, bytes: Number(e.target.value) || 0 })}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground"
          />
          <span className="text-[11px] text-muted-foreground">
            {tr("automations.conditions.bytesLabel")}
          </span>
        </div>
      );
    case "name_contains":
      return (
        <TextField
          value={condition.text}
          onChange={(text) => onChange({ ...condition, text })}
          placeholder={tr("automations.condition.nameContainsPlaceholder")}
        />
      );
    case "location":
      return (
        <TextField
          value={condition.folder}
          onChange={(folder) => onChange({ ...condition, folder })}
          placeholder={tr("automations.condition.locationPlaceholder")}
        />
      );
    case "created_after":
    case "modified_after":
      return (
        <input
          type="date"
          value={condition.date}
          onChange={(e) => onChange({ ...condition, date: e.target.value })}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground"
        />
      );
    case "storage_available":
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={condition.minBytes}
            onChange={(e) => onChange({ ...condition, minBytes: Number(e.target.value) || 0 })}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground"
          />
          <span className="text-[11px] text-muted-foreground">
            {tr("automations.conditions.bytesFreeLabel")}
          </span>
        </div>
      );
  }
}

function defaultCondition(kind: ConditionKind): Condition {
  switch (kind) {
    case "file_type":
      return { kind, types: [] };
    case "size_min":
      return { kind, bytes: 1024 * 1024 };
    case "size_max":
      return { kind, bytes: 100 * 1024 * 1024 };
    case "name_contains":
      return { kind, text: "" };
    case "location":
      return { kind, folder: "" };
    case "created_after":
    case "modified_after":
      return { kind, date: new Date().toISOString().slice(0, 10) };
    case "storage_available":
      return { kind, minBytes: 1024 * 1024 * 1024 };
  }
}

function validateCondition(c: Condition): string | undefined {
  switch (c.kind) {
    case "file_type":
      return c.types.length ? undefined : translateNow("automations.conditions.err.types");
    case "name_contains":
      return c.text.trim() ? undefined : translateNow("automations.conditions.err.keyword");
    case "location":
      return c.folder.trim() ? undefined : translateNow("automations.conditions.err.folder");
    default:
      return undefined;
  }
}

/* ─────────────────────── Step 4 — summary ─────────────────────── */

function SummaryStep({
  draft,
  onName,
  onDescription,
  onEnabled,
}: {
  draft: Draft;
  onName: (v: string) => void;
  onDescription: (v: string) => void;
  onEnabled: (v: boolean) => void;
}) {
  const tr = useT();
  const CONDITION_CATALOG = getConditionCatalog(tr);
  const preview: ActionPreview[] = useMemo(
    () =>
      buildPreview({
        id: draft.id ?? "draft",
        name: draft.name || tr("automations.summaryStep.unnamed"),
        description: draft.description,
        enabled: draft.enabled,
        trigger: draft.trigger,
        conditions: draft.conditions,
        actions: draft.actions,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        runCount: 0,
        source: "manual",
      }),
    [draft, tr],
  );

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
          {tr("automations.summaryStep.name")}
        </label>
        <TextField
          value={draft.name}
          onChange={onName}
          placeholder={tr("automations.summaryStep.namePlaceholder")}
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
          {tr("automations.summaryStep.description")}
        </label>
        <TextField
          value={draft.description}
          onChange={onDescription}
          placeholder={tr("automations.summaryStep.descriptionPlaceholder")}
        />
      </div>

      <div className="card-surface p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {tr("automations.summaryStep.trigger")}
        </p>
        <p className="mt-1 flex items-center gap-2 text-[13px] font-medium text-foreground">
          <CalendarClock className="h-4 w-4 text-primary" />
          {triggerSummary(draft.trigger)}
        </p>
      </div>

      <div className="card-surface p-3">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {tr("automations.summaryStep.actionsPlanned", { count: preview.length })}
        </p>
        <ol className="flex flex-col gap-1.5">
          {preview.map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="text-[12px] font-medium text-foreground">{step.label}</p>
                <p className="text-[11px] text-muted-foreground">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {draft.conditions.length ? (
        <div className="card-surface p-3">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {tr("automations.summaryStep.conditions")}
          </p>
          <ul className="flex flex-col gap-0.5 text-[12px] text-foreground">
            {draft.conditions.map((c, i) => (
              <li key={i}>{CONDITION_CATALOG.find((e) => e.kind === c.kind)?.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] text-foreground">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => onEnabled(e.target.checked)}
          className="h-4 w-4 accent-[color:var(--primary)]"
        />
        {tr("automations.summaryStep.enableNow")}
      </label>
    </div>
  );
}
