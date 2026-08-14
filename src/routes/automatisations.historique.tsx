/**
 * Historique complet des exécutions d'automatisations.
 *
 * Route dédiée (SEO + partage) qui reprend le journal `gf.automations.history`
 * et le compteur `runCount` de chaque règle. La page reste synchronisée avec
 * le reste de l'app grâce aux évènements `gf:automations-history-changed` et
 * `gf:automations-changed` — pas de rafraîchissement manuel nécessaire.
 */
import { useListScrollMemory } from "@/lib/files/use-list-scroll";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  History as HistoryIcon,
  Trash2,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { formatDateValue, useT, type TFunction, t, t as translate } from "@/lib/i18n";
import { BackButton } from "@/components/navigation/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useConfirm } from "@/components/common/useConfirm";
import { countLabel } from "@/lib/copy";
import {
  clearExecutionHistory,
  loadExecutionHistory,
  subscribeExecutionHistory,
} from "@/lib/automations/history";
import { listAutomations, subscribeAutomations } from "@/lib/automations/store";
import type { Automation, ExecutionRecord, ExecutionStatus } from "@/lib/automations/types";

export const Route = createFileRoute("/automatisations/historique")({
  head: () => ({
    meta: [
      { title: translate("meta.automationHistory.title") },
      {
        name: "description",
        content: translate("meta.automationHistory.description"),
      },
      { property: "og:title", content: translate("meta.automationHistory.title") },
      {
        property: "og:description",
        content: translate("meta.automationHistory.ogDescription"),
      },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  /* Position de la liste restituée au retour depuis un aperçu. */
  useListScrollMemory("automations-history", true);

  const tr = useT();
  const [history, setHistory] = useState<ExecutionRecord[]>([]);
  const [rules, setRules] = useState<Automation[]>([]);
  const confirm = useConfirm();

  useEffect(() => {
    const refresh = () => {
      setHistory(loadExecutionHistory());
      setRules(listAutomations());
    };
    refresh();
    const u1 = subscribeExecutionHistory(refresh);
    const u2 = subscribeAutomations(refresh);
    return () => {
      u1();
      u2();
    };
  }, []);

  const totals = useMemo(() => {
    const byRule = new Map<string, number>();
    for (const r of rules) byRule.set(r.id, r.runCount);
    return byRule;
  }, [rules]);

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <BackButton className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground hover:text-foreground" />
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-foreground">
            {tr("automations.history.page.title")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {tr("automations.history.page.retained", { count: history.length })}
          </p>
        </div>
        {history.length ? (
          <button
            type="button"
            onClick={() =>
              confirm.ask(
                {
                  title: tr("automations.history.page.clearConfirm.title"),
                  description: tr("automations.history.page.clearConfirm.desc", {
                    count: history.length,
                  }),
                  confirmLabel: tr("automations.history.page.clearConfirm.confirm"),
                  tone: "danger",
                },
                () => clearExecutionHistory(),
              )
            }
            className="flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {tr("automations.history.page.clear")}
          </button>
        ) : null}
      </div>

      <SectionHeader
        title={tr("automations.history.page.rulesSection")}
        hint={rules.length ? undefined : tr("automations.history.page.noRules")}
      />
      {rules.length === 0 ? null : (
        <ul className="grid grid-cols-1 gap-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="card-surface flex items-center justify-between gap-3 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-foreground">{r.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.lastRunAt
                    ? tr("automations.history.page.lastRun", {
                        when: formatDateValue(r.lastRunAt, {
                          dateStyle: "short",
                          timeStyle: "short",
                        }),
                      })
                    : tr("automations.history.page.neverRun")}
                </p>
              </div>
              <span className="rounded-lg bg-accent px-2 py-1 text-[11px] font-semibold text-foreground">
                {totals.get(r.id) ?? 0}×
              </span>
            </li>
          ))}
        </ul>
      )}

      <SectionHeader title={tr("automations.history.page.runsSection")} />
      {history.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title={tr("automations.history.page.emptyTitle")}
          description={tr("automations.history.page.emptyDesc")}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((h) => (
            <HistoryRow key={h.id} record={h} tr={tr} />
          ))}
        </ul>
      )}
      {confirm.dialog}
    </AppShell>
  );
}

function StatusIcon({ status, tr }: { status: ExecutionStatus; tr: TFunction }) {
  if (status === "ok")
    return (
      <CheckCircle2
        className="h-4 w-4 text-emerald-500"
        aria-label={tr("automations.history.page.status.okAria")}
      />
    );
  if (status === "partial")
    return (
      <AlertTriangle
        className="h-4 w-4 text-amber-500"
        aria-label={tr("automations.history.page.status.partialAria")}
      />
    );
  if (status === "failed")
    return (
      <XCircle
        className="h-4 w-4 text-red-500"
        aria-label={tr("automations.history.page.status.failedAria")}
      />
    );
  return (
    <Loader2
      className="h-4 w-4 text-primary"
      aria-label={tr("automations.history.page.status.simulatedAria")}
    />
  );
}

function statusLabel(s: ExecutionStatus, tr: TFunction): string {
  switch (s) {
    case "ok":
      return tr("automations.history.page.status.ok");
    case "partial":
      return tr("automations.history.page.status.partial");
    case "failed":
      return tr("automations.history.page.status.failed");
    case "simulated":
      return tr("automations.history.page.status.simulated");
  }
}

function HistoryRow({ record, tr }: { record: ExecutionRecord; tr: TFunction }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="card-surface flex flex-col gap-2 p-3.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-start gap-3 text-left"
      >
        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
          <StatusIcon status={record.status} tr={tr} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">
            {record.automationName}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDateValue(record.startedAt, {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
            <span>· {statusLabel(record.status, tr)}</span>
            <span>· {countLabel(record.actions.length, "action")}</span>
            {record.filesProcessed ? (
              <span>· {countLabel(record.filesProcessed, "file")}</span>
            ) : null}
          </p>
        </div>
      </button>
      {open ? (
        <div className="ml-12 flex flex-col gap-1">
          {record.actions.map((a, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px]"
            >
              <span className="text-foreground">{a.label}</span>
              <span
                className={
                  a.status === "failed"
                    ? "text-red-500"
                    : a.status === "skipped"
                      ? "text-muted-foreground"
                      : "text-emerald-500"
                }
              >
                {a.status === "failed"
                  ? tr("automations.history.page.actionFailed")
                  : a.status === "skipped"
                    ? tr("automations.history.page.actionSkipped")
                    : tr("automations.history.page.actionOk")}
              </span>
            </div>
          ))}
          {record.errors.length ? (
            <ul className="mt-1 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-[11px] text-red-500">
              {record.errors.map((e, i) => (
                <li key={i}>· {e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
