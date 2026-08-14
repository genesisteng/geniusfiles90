/**
 * Nettoyeur intelligent — main route.
 *
 * Runs a non-blocking BFS scan of the selected storage roots,
 * classifies items into 8 clean-up categories, and lets the user
 * review every proposed item — miniature, chemin, date, motif — before
 * confirming any deletion.
 *
 * L'état affiché est TOUJOURS l'état réel du moteur : phase d'analyse,
 * dossiers/fichiers réellement parcourus, emplacements illisibles. Aucun
 * compteur figé à zéro, aucune catégorie « vide » tant que l'analyse
 * n'est pas terminée.
 *
 * Deletions are soft (move to Trash on Android) and go through the
 * shared operations pipeline, so history/undo and the dashboard event
 * bus stay consistent. Nothing is removed automatically.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, MessageCircle } from "lucide-react";
import {
  GfWarning as AlertTriangle,
  GfStaleFile as CalendarClock,
  GfDuplicates as Copy,
  GfArchive as FileArchive,
  GfJunkFile as FileWarning,
  GfEmptyFolderClean as FolderX,
  GfApk as Package,
  GfPlay as Play,
  GfRefreshCycle as RefreshCw,
  GfCleaner as Sparkles,
  GfTrash as Trash2,
  type AppIcon,
} from "@/components/icons";

import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { usePullToRefresh } from "@/lib/gestures/pull-refresh";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BottomSheet } from "@/components/files/BottomSheet";
import { ConfirmDialog as SharedConfirmDialog } from "@/components/common/ConfirmDialog";
import { confirmCopy, freedLabel } from "@/lib/copy";
import { errorMessage } from "@/lib/errors/humanize";
import { formatSize } from "@/lib/files/format";
import { CategorySheet } from "@/components/cleaner/CategorySheet";
import { scanCleanup } from "@/lib/cleaner/scanner";
import { runCleanup, type CleanupProgress } from "@/lib/cleaner/deleter";
import type {
  CleanCategory,
  CleanCategoryKey,
  CleanItem,
  CleanScanResult,
} from "@/lib/cleaner/types";
import { checkStoragePermission } from "@/lib/native/storage-permission";
import { useRoots } from "@/lib/fs/useRoots";
import { StorageScopePicker, type StorageScope } from "@/components/common/StorageScopePicker";
import { resolveScope } from "@/components/common/storage-scope";
import { useT, t as translate } from "@/lib/i18n";
import { BACK_PRIORITY, useBackHandler } from "@/lib/navigation/back-stack";

export const Route = createFileRoute("/nettoyeur")({
  head: () => ({
    meta: [
      { title: "Nettoyeur intelligent — GeniusFiles" },
      {
        name: "description",
        content: translate("meta.cleaner.description"),
      },
      { property: "og:title", content: "Nettoyeur intelligent — GeniusFiles" },
      {
        property: "og:description",
        content: translate("meta.cleaner.ogDescription"),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CleanerPage,
});

const CATEGORY_ORDER: CleanCategoryKey[] = [
  "duplicates",
  "large",
  "old_downloads",
  "apk",
  "messaging_media",
  "extracted_archives",
  "temp",
  "empty_folders",
];

const CATEGORY_ICONS: Record<CleanCategoryKey, AppIcon> = {
  duplicates: Copy,
  large: FileWarning,
  old_downloads: CalendarClock,
  empty_folders: FolderX,
  temp: Trash2,
  extracted_archives: FileArchive,
  apk: Package,
  messaging_media: MessageCircle,
};

function categoryLabels(t: ReturnType<typeof useT>): Record<CleanCategoryKey, string> {
  return {
    duplicates: t("cleaner.category.duplicates.label"),
    large: t("cleaner.category.large.label"),
    old_downloads: t("cleaner.category.old_downloads.label"),
    empty_folders: t("cleaner.category.empty_folders.label"),
    temp: t("cleaner.category.temp.label"),
    extracted_archives: t("cleaner.category.extracted_archives.label"),
    apk: t("cleaner.category.apk.label"),
    messaging_media: t("cleaner.category.messaging_media.label"),
  };
}

function phaseLabels(t: ReturnType<typeof useT>): Record<CleanScanResult["phase"], string> {
  return {
    starting: t("cleaner.phase.starting"),
    walking: t("cleaner.phase.walking"),
    matching: t("cleaner.phase.matching"),
    done: t("cleaner.phase.done"),
  };
}

function CleanerPage() {
  const t = useT();
  const CATEGORY_LABELS = useMemo(() => categoryLabels(t), [t]);
  const PHASE_LABEL = useMemo(() => phaseLabels(t), [t]);
  const [scan, setScan] = useState<CleanScanResult | null>(null);
  const [scanning, setScanning] = useState(true);
  const [tick, setTick] = useState(0);
  const [permission, setPermission] = useState<"granted" | "denied" | "unavailable">("unavailable");
  const [openCategory, setOpenCategory] = useState<CleanCategoryKey | null>(null);
  const [selection, setSelection] = useState<Record<string, Set<string>>>({});
  const [confirming, setConfirming] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [progress, setProgress] = useState<CleanupProgress | null>(null);
  const { roots } = useRoots();
  const [scope, setScope] = useState<StorageScope>("internal");

  /* Retour Android : une catégorie ouverte revient à la liste d'analyse. */
  useBackHandler(
    openCategory !== null,
    () => {
      setOpenCategory(null);
      return true;
    },
    BACK_PRIORITY.page,
  );

  useEffect(() => {
    let mounted = true;
    checkStoragePermission().then((p) => mounted && setPermission(p));
    return () => {
      mounted = false;
    };
  }, [tick]);

  /* Tirer pour actualiser : relance l'analyse de nettoyage. */
  usePullToRefresh(
    useCallback(() => {
      setTick((n) => n + 1);
    }, []),
  );

  // Kick off scan.
  useEffect(() => {
    setScanning(true);
    // On conserve le dernier résultat affiché pendant la nouvelle analyse :
    // la page reste lisible au lieu de se vider puis se reconstruire.
    setSelection({});
    const targets = resolveScope(scope, roots).map((rootId) => ({
      rootId,
      segments: [] as string[],
    }));
    const handle = scanCleanup(
      targets,
      (partial) => setScan(partial),
      (result) => {
        setScan(result);
        setScanning(false);
      },
    );
    return () => handle.cancel();
  }, [tick, scope, roots]);

  const totalReclaimable = scan?.totalBytes ?? 0;
  const totalItems = scan?.totalItems ?? 0;

  const selectedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const set of Object.values(selection)) for (const id of set) ids.add(id);
    return ids;
  }, [selection]);

  const selectedItems = useMemo(() => {
    if (!scan) return [] as CleanItem[];
    const out: CleanItem[] = [];
    for (const c of Object.values(scan.categories)) {
      for (const it of c.items) if (!it.keeper && selectedIds.has(it.id)) out.push(it);
    }
    return out;
  }, [scan, selectedIds]);

  const selectedBytes = useMemo(
    () => selectedItems.reduce((s, i) => s + (i.entry.size ?? 0), 0),
    [selectedItems],
  );

  const toggleItem = useCallback((catKey: CleanCategoryKey, id: string) => {
    setSelection((prev) => {
      const cur = new Set(prev[catKey] ?? []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...prev, [catKey]: cur };
    });
  }, []);

  /** « Tout sélectionner » ignore toujours les copies conservées. */
  const toggleCategoryAll = useCallback((cat: CleanCategory, selectAll: boolean) => {
    setSelection((prev) => {
      const next = new Set<string>();
      if (selectAll) for (const it of cat.items) if (!it.keeper) next.add(it.id);
      return { ...prev, [cat.key]: next };
    });
  }, []);

  const doCleanup = useCallback(async () => {
    if (!selectedItems.length) return;
    setConfirming(false);
    setCleaning(true);
    setProgress({ processed: 0, total: selectedItems.length, bytes: 0, totalBytes: selectedBytes });
    try {
      const res = await runCleanup(selectedItems, (p) => setProgress(p));
      const detail = res.failures
        .slice(0, 3)
        .map((f) => `${f.name} — ${f.reason}`)
        .join(" · ");
      if (res.failed > 0) {
        toast.warning(t("cleaner.toast.partial.title"), {
          description: t("cleaner.toast.partial.desc", {
            removed: t("cleaner.category.count", { count: res.removed }),
            failed: t("cleaner.category.count", { count: res.failed }),
            detail,
          }),
        });
      } else if (res.removed === 0) {
        toast.info(t("cleaner.toast.nothing.title"), {
          description:
            res.missing > 0
              ? t("cleaner.toast.nothing.missing", {
                  missing: t("cleaner.category.count", { count: res.missing }),
                })
              : t("cleaner.toast.nothing.none"),
        });
      } else {
        toast.success(t("cleaner.toast.done.title"), {
          description: t("cleaner.toast.done.desc", {
            freed: freedLabel(res.reclaimedBytes),
            removed: t("cleaner.category.count", { count: res.removed }),
          }),
        });
      }
      setSelection({});
      setOpenCategory(null);
      setTick((t) => t + 1);
    } catch (err) {
      toast.error(t("cleaner.toast.failed.title"), {
        description: errorMessage(err, t("cleaner.toast.failed.desc")),
      });
    } finally {
      setCleaning(false);
      setProgress(null);
    }
  }, [selectedItems, selectedBytes, t]);

  const activeCategory = openCategory && scan ? scan.categories[openCategory] : null;

  /* Répartition de l'espace récupérable par catégorie — visualisation
     immédiate de « où » se trouve le gain, avant toute action. */
  const shares = useMemo(() => {
    if (!scan || totalReclaimable <= 0) return [];
    return CATEGORY_ORDER.map((key) => scan.categories[key])
      .filter((c) => c.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes)
      .map((c) => ({
        key: c.key,
        label: c.label,
        bytes: c.bytes,
        pct: Math.max(2, Math.round((c.bytes / totalReclaimable) * 100)),
      }));
  }, [scan, totalReclaimable]);

  const issues = scan?.issues ?? [];
  const visibleCategories = CATEGORY_ORDER.filter(
    (key) => scanning || (scan?.categories[key].items.length ?? 0) > 0,
  );

  return (
    <AppShell>
      <PageHeader
        title={t("cleaner.title")}
        subtitle={t("cleaner.subtitle")}
        action={
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            aria-label={t("cleaner.refresh.aria")}
            className="gf-press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-[18px] w-[18px] ${scanning ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <div className="pt-3">
        <StorageScopePicker roots={roots} value={scope} onChange={setScope} />
      </div>

      {/* Statistiques principales — gain de stockage mis en avant */}
      <div className="gf-card mt-3 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t("cleaner.stats.reclaimable")}
            </p>
            <p className="mt-1.5 truncate font-display text-[36px] font-bold leading-none text-primary">
              {formatSize(totalReclaimable)}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-primary-softer px-2.5 py-1 text-[11px] font-semibold text-primary">
            {scanning ? t("cleaner.stats.scanning") : t("cleaner.stats.ready")}
          </span>
        </div>

        {/* Barre de répartition par catégorie */}
        {shares.length > 0 ? (
          <>
            <div className="mt-3.5 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
              {shares.map((s, i) => (
                <span
                  key={s.key}
                  className="h-full"
                  style={{
                    width: `${s.pct}%`,
                    opacity: 1 - Math.min(0.6, i * 0.12),
                    background: "var(--color-primary, hsl(var(--primary)))",
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {shares.slice(0, 4).map((s) => (
                <span
                  key={s.key}
                  className="inline-flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <span className="truncate">{s.label}</span>
                  <span className="shrink-0 font-semibold text-foreground">
                    {formatSize(s.bytes)}
                  </span>
                </span>
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-3.5 grid grid-cols-3 gap-2">
          <Stat value={totalItems} label={t("cleaner.stats.proposed", { count: totalItems })} />
          <Stat value={scan?.scannedFolders ?? 0} label={t("cleaner.stats.foldersRead")} />
          <Stat value={scan?.scannedFiles ?? 0} label={t("cleaner.stats.filesRead")} />
        </div>

        {scanning ? (
          <div className="mt-3.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
            </div>
            <p className="mt-2 truncate text-[12px] text-muted-foreground">
              {PHASE_LABEL[scan?.phase ?? "starting"]}
              {scan?.currentPath ? ` · ${scan.currentPath}` : ""}
            </p>
          </div>
        ) : null}
      </div>

      {permission === "denied" ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-[12.5px] leading-relaxed text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>{t("cleaner.permission.denied")}</span>
        </div>
      ) : null}

      {!scanning && issues.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-border-strong bg-surface-2 p-3 text-[12px] leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">
            {t("cleaner.issues.count", { count: issues.length })}
          </p>
          <ul className="mt-1 space-y-0.5">
            {issues.slice(0, 3).map((i) => (
              <li key={i.path} className="truncate">
                {i.path} — {i.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SectionHeader title={t("cleaner.categories.title")} hint={t("cleaner.categories.hint")} />

      {!scanning && totalItems === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={t("cleaner.empty.title")}
          description={t("cleaner.empty.description")}
        />
      ) : (
        <div className="gf-card divide-y divide-border/60">
          {visibleCategories.map((key) => {
            const cat = scan?.categories[key] ?? null;
            const Icon = CATEGORY_ICONS[key];
            const selectedCount = selection[key]?.size ?? 0;
            const pending = !cat || cat.status !== "ready";
            const count = cat?.items.filter((i) => !i.keeper).length ?? 0;
            const empty = count === 0;
            return (
              <button
                key={key}
                type="button"
                disabled={empty}
                onClick={() => setOpenCategory(key)}
                className="gf-row hover:bg-secondary/40 disabled:cursor-default"
              >
                <span className="gf-icon-tile bg-primary-softer text-primary">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="gf-row-title truncate">{cat?.label ?? CATEGORY_LABELS[key]}</p>
                    {selectedCount > 0 ? (
                      <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {selectedCount}
                      </span>
                    ) : null}
                  </div>
                  {pending ? (
                    <span className="mt-1.5 block h-3 w-24 animate-pulse rounded-full bg-surface-3" />
                  ) : (
                    <p className="gf-row-meta truncate">
                      {t("cleaner.category.count", { count })}
                      {" · "}
                      {cat?.safety === "safe"
                        ? t("cleaner.category.safe")
                        : t("cleaner.category.review")}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-right">
                  {pending ? (
                    <span className="block h-4 w-14 animate-pulse rounded-full bg-surface-3" />
                  ) : (
                    <>
                      <span className="block text-[14px] font-semibold text-primary">
                        {formatSize(cat?.bytes ?? 0)}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {t("cleaner.category.toFree")}
                      </span>
                    </>
                  )}
                </span>
                <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground/60" />
              </button>
            );
          })}
        </div>
      )}

      {/* Category review sheet */}
      <CategorySheet
        open={!!activeCategory}
        category={activeCategory}
        selection={activeCategory ? (selection[activeCategory.key] ?? new Set()) : new Set()}
        onToggle={(id) => activeCategory && toggleItem(activeCategory.key, id)}
        onSelectAll={(all) => activeCategory && toggleCategoryAll(activeCategory, all)}
        onClose={() => setOpenCategory(null)}
      />

      {/* Barre d'action collante — disposition en grille : les libellés
          ne peuvent plus déborder sur les écrans étroits. */}
      {selectedItems.length > 0 && !cleaning ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-40 mx-auto flex max-w-[520px] justify-center px-3">
          <div className="glass-panel animate-in-up pointer-events-auto w-full rounded-3xl border border-border-strong p-2.5 shadow-soft">
            <div className="mb-2 min-w-0 px-1">
              <p className="truncate text-[13.5px] font-semibold leading-tight">
                {t("cleaner.selection.count", { count: selectedItems.length })}
              </p>
              <p className="truncate text-[12px] text-muted-foreground">
                {t("cleaner.selection.toFree", { amount: freedLabel(selectedBytes) })}
              </p>
            </div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
              <button
                type="button"
                onClick={() => setSelection({})}
                className="gf-press h-11 rounded-2xl bg-surface-2 px-3.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
              >
                {t("cleaner.selection.deselect")}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="gf-press flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground shadow-soft"
              >
                <Play className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {t("cleaner.selection.clean", { amount: freedLabel(selectedBytes) })}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SharedConfirmDialog
        open={confirming}
        copy={confirmCopy.clean(selectedBytes, selectedItems.length)}
        busy={cleaning}
        onCancel={() => setConfirming(false)}
        onConfirm={doCleanup}
      />

      {/* Progress sheet during cleanup */}
      <BottomSheet open={cleaning} onClose={() => {}} title={t("cleaner.progress.title")}>
        <div className="mb-2 flex items-center justify-between text-[12px] text-muted-foreground">
          <span className="truncate pr-2">
            {progress?.currentName ?? t("cleaner.progress.preparing")}
          </span>
          <span className="shrink-0 font-mono text-[11px]">
            {progress
              ? Math.min(
                  100,
                  Math.round(progress.total > 0 ? (progress.processed / progress.total) * 100 : 0),
                )
              : 0}
            %
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{
              width: `${progress ? Math.min(100, (progress.processed / Math.max(1, progress.total)) * 100) : 0}%`,
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {progress
              ? t("cleaner.progress.processed", {
                  count: progress.processed,
                  total: progress.total,
                })
              : t("cleaner.progress.preparingShort")}
          </span>
          <span>
            {progress ? `${formatSize(progress.bytes)} / ${formatSize(progress.totalBytes)}` : ""}
          </span>
        </div>
      </BottomSheet>
    </AppShell>
  );
}

/* --------- Sub-components --------- */

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2 px-3 py-2.5">
      <p className="truncate text-[17px] font-semibold leading-none">
        {value.toLocaleString("fr-FR")}
      </p>
      <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{label}</p>
    </div>
  );
}
