/**
 * Organisation intelligente — page principale.
 *
 * - Lance un scan à l'arrivée (ou réutilise le cache) ;
 * - présente les recommandations avec explication « Pourquoi ? » ;
 * - propose Aperçu, Renommage, Collections dynamiques ;
 * - exécute exclusivement des actions confirmées, via le pipeline
 *   d'opérations partagé (donc historique + Corbeille assurent
 *   l'annulation).
 *
 * 100 % local et hors connexion.
 */
import { useListScrollMemory } from "@/lib/files/use-list-scroll";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Info,
  Layers,
  ListTree,
  Loader2,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BottomSheet, PrimaryButton } from "@/components/files/BottomSheet";
import { ConfirmDialog as SharedConfirmDialog } from "@/components/common/ConfirmDialog";
import { formatCount } from "@/lib/copy";
import { errorMessage } from "@/lib/errors/humanize";
import { useT, t as translate } from "@/lib/i18n";
import { OrganizerPreview } from "@/components/organizer/OrganizerPreview";
import { RenameProposalSheet } from "@/components/organizer/RenameProposalSheet";
import { formatSize } from "@/lib/files/format";
import {
  buildPreview,
  categoryOf,
  evalCollection,
  executePlan,
  getCachedRecommendations,
  getCachedReport,
  listCollections,
  proposeBatchRename,
  refreshOrganization,
  subscribeOrganizer,
  summarizeActions,
} from "@/lib/organizer";
import type {
  CollectionMatch,
  OrgPlan,
  OrgPreview,
  OrgRecommendation,
  OrgReport,
  RenameProposal,
  SmartCollection,
} from "@/lib/organizer";
import { BACK_PRIORITY, useBackHandler } from "@/lib/navigation/back-stack";

export const Route = createFileRoute("/organisation")({
  head: () => ({
    meta: [
      { title: "Organisation intelligente — GeniusFiles" },
      {
        name: "description",
        content: translate("meta.organize.description"),
      },
      { property: "og:title", content: "Organisation intelligente — GeniusFiles" },
      {
        property: "og:description",
        content: translate("meta.organize.ogDescription"),
      },
    ],
  }),
  component: OrganizationPage,
});

const ROOT = [{ rootId: "internal" as const, segments: [] }];

function OrganizationPage() {
  /* Position de la liste restituée au retour depuis un aperçu. */
  useListScrollMemory("organization", true);

  const t = useT();
  const [report, setReport] = useState<OrgReport | null>(() => getCachedReport());
  const [recs, setRecs] = useState<OrgRecommendation[] | null>(() => getCachedRecommendations());
  const [scanning, setScanning] = useState(false);
  const [tick, setTick] = useState(0);

  const [previewFor, setPreviewFor] = useState<{
    plan: OrgPlan;
    preview: OrgPreview | null;
    loading: boolean;
    reason: string;
  } | null>(null);
  const [renaming, setRenaming] = useState<{ proposals: RenameProposal[] } | null>(null);
  const [applyingRenames, setApplyingRenames] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState<OrgPlan | null>(null);
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
    label?: string;
  } | null>(null);
  const [openCollection, setOpenCollection] = useState<SmartCollection | null>(null);
  const [collectionMatch, setCollectionMatch] = useState<CollectionMatch | null>(null);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const collectionCtrl = useRef<AbortController | null>(null);
  const scanCtrl = useRef<AbortController | null>(null);

  /* Retour Android : une collection ouverte revient à la liste. */
  useBackHandler(
    openCollection !== null,
    () => {
      setOpenCollection(null);
      return true;
    },
    BACK_PRIORITY.page,
  );

  useEffect(() => subscribeOrganizer(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    setReport(getCachedReport());
    setRecs(getCachedRecommendations());
  }, [tick]);

  const runScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    scanCtrl.current?.abort();
    scanCtrl.current = new AbortController();
    try {
      const { report, recommendations } = await refreshOrganization(ROOT, scanCtrl.current.signal);
      setReport(report);
      setRecs(recommendations);
    } catch (err) {
      toast.error(t("organize.toast.scanFailed.title"), {
        description: errorMessage(err, t("organize.toast.scanFailed.desc")),
      });
    } finally {
      setScanning(false);
    }
  }, [scanning, t]);

  // Premier scan à l'arrivée si aucun cache.
  useEffect(() => {
    if (!getCachedReport()) void runScan();
    return () => scanCtrl.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const collections = useMemo(() => listCollections(), []);

  const openPreview = useCallback(
    async (rec: OrgRecommendation) => {
      if (rec.plan.actions.length === 0) {
        toast.message(rec.title, { description: rec.why });
        return;
      }
      setPreviewFor({ plan: rec.plan, preview: null, loading: true, reason: rec.why });
      try {
        const preview = await buildPreview(rec.plan);
        setPreviewFor({ plan: rec.plan, preview, loading: false, reason: rec.why });
      } catch (err) {
        setPreviewFor(null);
        toast.error(t("organize.toast.previewFailed.title"), {
          description: errorMessage(err, t("organize.toast.previewFailed.desc")),
        });
      }
    },
    [t],
  );

  const runApplyPlan = useCallback(
    async (plan: OrgPlan) => {
      setConfirmPlan(null);
      setPreviewFor(null);
      setProgress({ processed: 0, total: plan.actions.length });
      const ctrl = new AbortController();
      try {
        const res = await executePlan(plan, {
          signal: ctrl,
          onProgress: (p) =>
            setProgress({ processed: p.processed, total: p.total, label: p.currentLabel }),
        });
        if (res.cancelled) {
          toast.info(t("organize.toast.interrupted.title"), {
            description: t("organize.toast.interrupted.desc"),
          });
        } else if (res.failed.length === 0) {
          toast.success(t("organize.toast.done.title"), {
            description: t("organize.toast.done.desc", { count: res.applied }),
          });
        } else {
          toast.warning(t("organize.toast.partial.title"), {
            description: `${t("organize.toast.partial.applied", { count: res.applied })}, ${t("organize.toast.partial.failed", { count: res.failed.length })} — ${res.failed[0].reason}`,
          });
        }
        await runScan();
      } catch (err) {
        toast.error(t("organize.toast.applyFailed.title"), {
          description: errorMessage(err, t("organize.toast.applyFailed.desc")),
        });
      } finally {
        setProgress(null);
      }
    },
    [runScan, t],
  );

  const openRenamer = useCallback(() => {
    if (!report) return;
    const entries = report.issues
      .filter((i) => i.kind === "unclear_name" && i.entries)
      .flatMap((i) => (i.entries ?? []).map((e) => ({ entry: e, parent: i.path })));
    const proposals = proposeBatchRename(entries);
    if (proposals.length === 0) {
      toast.message(t("organize.toast.noRename.title"), {
        description: t("organize.toast.noRename.desc"),
      });
      return;
    }
    setRenaming({ proposals });
  }, [report, t]);

  const applyRenames = useCallback(
    async (accepted: RenameProposal[]) => {
      setRenaming(null);
      setApplyingRenames(true);
      const plan: OrgPlan = {
        id: `plan_rename_${Date.now()}`,
        title: t("organize.rename.planTitle"),
        description: t("organize.rename.planDesc", { count: accepted.length }),
        destructive: true,
        actions: accepted.map((p) => ({
          kind: "rename",
          parent: p.parent,
          from: p.entryName,
          to: p.proposed,
          reason: p.reason,
        })),
      };
      await runApplyPlan(plan);
      setApplyingRenames(false);
    },
    [runApplyPlan, t],
  );

  const openCollectionSheet = useCallback(async (col: SmartCollection) => {
    setOpenCollection(col);
    setCollectionMatch(null);
    setCollectionLoading(true);
    collectionCtrl.current?.abort();
    const ctrl = new AbortController();
    collectionCtrl.current = ctrl;
    try {
      const m = await evalCollection(col.id, ROOT, ctrl.signal);
      if (!ctrl.signal.aborted) setCollectionMatch(m);
    } finally {
      if (!ctrl.signal.aborted) setCollectionLoading(false);
    }
  }, []);

  const distribution = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.distribution)
      .map(([id, v]) => ({ id, ...v!, label: categoryOf(id as never).label }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 6);
  }, [report]);

  return (
    <AppShell>
      <PageHeader
        title={t("organize.title")}
        subtitle={t("organize.subtitle")}
        action={
          <button
            type="button"
            onClick={runScan}
            aria-label={t("organize.action.rescan")}
            className="gf-press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-[18px] w-[18px] ${scanning ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <section className="gf-card mt-4 p-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label={t("organize.stat.reorganizable")}
            value={formatSize(report?.reorganizableBytes ?? 0)}
            highlight
          />
          <Stat label={t("organize.stat.recommendations")} value={String(recs?.length ?? 0)} />
          <Stat
            label={t("organize.stat.scannedFiles")}
            value={(report?.scannedFiles ?? 0).toLocaleString("fr-FR")}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openRenamer}
            disabled={!report}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] font-medium disabled:opacity-50"
          >
            <PencilLine className="h-3.5 w-3.5" /> {t("organize.action.smartRename")}
          </button>
        </div>
      </section>

      {/* Recommandations */}
      <SectionHeader
        title={t("organize.section.recommendations")}
        hint={t("organize.section.recommendationsHint")}
      />
      {scanning && !recs ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3 text-[12px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("organize.scanning")}
        </div>
      ) : recs && recs.length > 0 ? (
        <div className="space-y-2">
          {recs.map((r) => (
            <RecommendationCard key={r.id} rec={r} onOpen={openPreview} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title={t("organize.empty.title")}
          description={t("organize.empty.desc")}
          action={
            <button type="button" onClick={runScan} className="btn-secondary gf-press">
              {t("organize.action.rescan")}
            </button>
          }
        />
      )}

      {/* Distribution */}
      {distribution.length > 0 ? (
        <>
          <SectionHeader
            title={t("organize.section.distribution")}
            hint={t("organize.section.distributionHint")}
          />
          <div className="grid grid-cols-2 gap-2">
            {distribution.map((d) => (
              <div key={d.id} className="card-surface flex items-center gap-2 p-3">
                <Layers className="h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium">{d.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {d.count} · {formatSize(d.bytes)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* Collections dynamiques */}
      <SectionHeader
        title={t("organize.section.collections")}
        hint={t("organize.section.collectionsHint")}
      />
      <div className="grid grid-cols-2 gap-2">
        {collections.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => openCollectionSheet(c)}
            className="card-surface flex items-center gap-2 p-3 text-left transition-transform active:scale-[0.97]"
          >
            <ListTree className="h-4 w-4 text-primary" />
            <span className="flex-1 text-[12px] font-medium">{c.label}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Aperçu du plan */}
      <BottomSheet
        open={!!previewFor}
        onClose={() => setPreviewFor(null)}
        title={previewFor?.plan.title ?? t("organize.preview.defaultTitle")}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={() => setPreviewFor(null)}>
              {t("action.close")}
            </PrimaryButton>
            {previewFor && previewFor.plan.actions.length > 0 ? (
              <PrimaryButton onClick={() => setConfirmPlan(previewFor.plan)}>
                {t("action.apply")}
              </PrimaryButton>
            ) : null}
          </>
        }
      >
        {previewFor ? (
          <>
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-[12px]">
              <Info className="h-4 w-4 shrink-0 text-primary" />
              <span>{previewFor.reason}</span>
            </div>
            <PlanSummary plan={previewFor.plan} />
            {previewFor.loading ? (
              <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("organize.preview.computing")}
              </div>
            ) : previewFor.preview ? (
              <div className="mt-3">
                <OrganizerPreview preview={previewFor.preview} />
              </div>
            ) : null}
          </>
        ) : null}
      </BottomSheet>

      {/* Renommage */}
      <RenameProposalSheet
        open={!!renaming}
        proposals={renaming?.proposals ?? []}
        onClose={() => setRenaming(null)}
        onApply={applyRenames}
      />

      {/* Confirmation d'application */}
      <SharedConfirmDialog
        open={!!confirmPlan}
        copy={{
          title: t("organize.confirm.title"),
          description: confirmPlan
            ? t("organize.confirm.desc", { summary: summaryText(confirmPlan, t) })
            : "",
          confirmLabel: t("action.apply"),
        }}
        onCancel={() => setConfirmPlan(null)}
        onConfirm={() => {
          if (confirmPlan) void runApplyPlan(confirmPlan);
        }}
      />

      {/* Progression */}
      <BottomSheet
        open={!!progress || applyingRenames}
        onClose={() => {}}
        title={t("organize.progress.title")}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <span className="truncate">{progress?.label ?? t("organize.progress.preparing")}</span>
            <span>{progress ? `${progress.processed}/${progress.total}` : ""}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{
                width:
                  progress && progress.total > 0
                    ? `${Math.round((progress.processed / progress.total) * 100)}%`
                    : "0%",
              }}
            />
          </div>
        </div>
      </BottomSheet>

      {/* Collection viewer */}
      <BottomSheet
        open={!!openCollection}
        onClose={() => {
          collectionCtrl.current?.abort();
          setOpenCollection(null);
          setCollectionMatch(null);
        }}
        title={openCollection?.label ?? t("organize.collection.defaultTitle")}
      >
        {collectionLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("organize.collection.searching")}
          </div>
        ) : collectionMatch ? (
          collectionMatch.entries.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">{t("organize.collection.empty")}</p>
          ) : (
            <>
              <p className="mb-2 text-[12px] text-muted-foreground">
                {t("count.files", { count: collectionMatch.entries.length })} —{" "}
                {formatSize(collectionMatch.totalBytes)}
              </p>
              <ul className="max-h-[52vh] space-y-1 overflow-y-auto">
                {collectionMatch.entries.slice(0, 200).map(({ entry, parent }) => (
                  <li
                    key={`${parent.rootId}:${parent.segments.join("/")}/${entry.name}`}
                    className="rounded-lg border border-border bg-surface p-2"
                  >
                    <p className="truncate text-[12px] font-medium">{entry.name}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      /{parent.segments.join("/")}
                    </p>
                  </li>
                ))}
              </ul>
              {collectionMatch.entries.length > 200 ? (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  {t("organize.collection.limited", {
                    total: formatCount(collectionMatch.entries.length),
                  })}
                </p>
              ) : null}
            </>
          )
        ) : null}
      </BottomSheet>
    </AppShell>
  );
}

function RecommendationCard({
  rec,
  onOpen,
}: {
  rec: OrgRecommendation;
  onOpen: (r: OrgRecommendation) => void;
}) {
  const t = useT();
  const Icon =
    rec.severity === "danger" ? AlertTriangle : rec.severity === "warn" ? AlertTriangle : Sparkles;
  const tone =
    rec.severity === "danger"
      ? "bg-red-500/12 text-red-400"
      : rec.severity === "warn"
        ? "bg-amber-500/12 text-amber-400"
        : "bg-primary/12 text-primary";
  return (
    <button
      type="button"
      onClick={() => onOpen(rec)}
      className="card-surface flex w-full items-start gap-3 p-3 text-left transition-transform active:scale-[0.99]"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{rec.title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          <span className="font-medium">{t("organize.rec.why")}</span> {rec.why}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
        {rec.cta}
      </span>
    </button>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-2 ${
        highlight ? "border-primary/40 bg-primary/8" : "border-border bg-surface"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold">{value}</p>
    </div>
  );
}

function PlanSummary({ plan }: { plan: OrgPlan }) {
  const t = useT();
  const s = summarizeActions(plan.actions);
  const parts = [
    s.renames > 0 ? t("organize.count.renames", { count: s.renames }) : null,
    s.moves > 0 ? t("organize.count.moves", { count: s.moves }) : null,
    s.groups > 0 ? t("organize.count.groups", { count: s.groups }) : null,
    s.archives > 0 ? t("organize.count.archives", { count: s.archives }) : null,
  ].filter(Boolean);
  return (
    <p className="text-[12px] text-muted-foreground">
      {parts.length ? parts.join(" · ") : t("organize.plan.noActions")}
    </p>
  );
}

function summaryText(plan: OrgPlan, t: ReturnType<typeof useT>): string {
  const s = summarizeActions(plan.actions);
  const total = s.renames + s.moves + s.groups + s.archives;
  if (total === 0) return t("organize.plan.none");
  return t("organize.plan.summary", { count: total });
}
