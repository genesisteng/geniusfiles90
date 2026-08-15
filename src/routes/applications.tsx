/**
 * Gestionnaire d'applications — module GeniusFiles.
 *
 * Analyse en direct les applications installées via le plugin natif :
 * icône officielle, tailles réelles (StorageStatsManager quand
 * disponible), dates d'installation / mise à jour, permissions,
 * dernière utilisation. Toutes les actions destructives (désinstaller)
 * passent par les intents Android natifs — jamais silencieusement.
 *
 * Points d'extension déjà en place, prêts à recevoir sans toucher au
 * design :
 *  - AI Insights  → carte "Analyse intelligente" (bouton disabled)
 *  - Backups      → utilise déjà backupApk()
 *  - Update check → colonne dédiée dans la fiche (updateAvailable)
 *  - Duplicates   → détection préparée via isDuplicate
 */
import { useListScrollMemory } from "@/lib/files/use-list-scroll";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppWindow,
  ArrowUpDown,
  Ban,
  BrainCircuit,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  Eye,
  ExternalLink,
  Grid3x3,
  Info,
  KeyRound,
  LayoutList,
  Package,
  RefreshCw,
  Search,
  Share2,
  Shield,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { usePullToRefresh } from "@/lib/gestures/pull-refresh";
import { BackButton } from "@/components/navigation/BackButton";
import { BACK_PRIORITY, useBackHandler } from "@/lib/navigation/back-stack";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/common/useConfirm";
import { errorMessage } from "@/lib/errors/humanize";

import { BottomSheet, PrimaryButton } from "@/components/files/BottomSheet";
import { formatSize, formatDate } from "@/lib/files/format";
import { isAndroidNative } from "@/lib/native/geniusfiles-native";
import {
  backupApk,
  checkUsageAccess,
  getAppPermissions,
  getAppStorage,
  listInstalledApps,
  openApp,
  openAppSettings,
  requestUsageAccess,
  shareAppInfo,
  uninstallApp,
} from "@/lib/apps/api";
import { computeStats, filterApps, sortApps } from "@/lib/apps/sort";
import type {
  AppFilter,
  AppLayout,
  AppPermissions,
  AppSort,
  AppStorageBreakdown,
  InstalledApp,
} from "@/lib/apps/types";
import { useT, t as translate } from "@/lib/i18n";
import type { TransValues } from "@/lib/i18n";

type TFn = (key: string, values?: TransValues) => string;

export const Route = createFileRoute("/applications")({
  head: () => ({
    meta: [
      { title: "Gestionnaire d'applications — GeniusFiles" },
      {
        name: "description",
        content: translate("meta.apps.description"),
      },
    ],
  }),
  component: AppsPage,
});

const sortLabel = (t: TFn): Record<AppSort, string> => ({
  name: t("automations.summaryStep.name"),
  size: t("organize.apps.sort.size"),
  installed: t("organize.apps.sort.installed"),
  updated: t("organize.apps.sort.updated"),
  used: t("organize.apps.sort.used"),
});

function AppsPage() {
  /* Position de la liste restituée au retour depuis un aperçu. */
  useListScrollMemory("apps", true);

  const t = useT();
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsSupported, setStatsSupported] = useState(false);
  const [usageAvailable, setUsageAvailable] = useState(false);
  const [usable, setUsable] = useState(true);
  const [requestingUsage, setRequestingUsage] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AppFilter>("user");
  const [sort, setSort] = useState<AppSort>("size");
  const [layout, setLayout] = useState<AppLayout>("list");
  const [sortSheet, setSortSheet] = useState(false);
  const [selected, setSelected] = useState<InstalledApp | null>(null);

  /* Retour Android : on ferme d'abord ce qui est superposé, puis la
     recherche, avant de quitter l'écran. */
  useBackHandler(
    selected != null,
    () => {
      setSelected(null);
      return true;
    },
    BACK_PRIORITY.overlay,
  );
  useBackHandler(
    sortSheet,
    () => {
      setSortSheet(false);
      return true;
    },
    BACK_PRIORITY.overlay,
  );
  useBackHandler(
    query.length > 0,
    () => {
      setQuery("");
      return true;
    },
    BACK_PRIORITY.mode,
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listInstalledApps({ includeIcons: true });
    setApps(res.apps);
    setStatsSupported(res.statsSupported);
    setUsageAvailable(res.usageAvailable);
    setUsable(res.usable);
    setLoading(false);
  }, []);

  /* Tirer pour actualiser : relit la liste des applications. */
  usePullToRefresh(load);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh when the user returns to the app — typically after granting
  // "Usage access" or uninstalling something from Android Settings. We
  // re-check the special permission first, then reload the list so newly
  // available sizes / last-used data appear without a manual refresh.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void (async () => {
          const granted = await checkUsageAccess();
          setUsageAvailable(granted);
          setRequestingUsage(false);
          await load();
        })();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // Capacitor fires this earlier than the DOM visibility event on Android;
    // combining both makes the auto-refresh reliable on every OEM ROM.
    let unsub: (() => void) | null = null;
    let cancelled = false;
    if (isAndroidNative()) {
      import("@capacitor/app")
        .then(({ App }) => {
          if (cancelled) return;
          const handle = App.addListener("appStateChange", (state) => {
            if (!state.isActive) return;
            void (async () => {
              const granted = await checkUsageAccess();
              setUsageAvailable(granted);
              setRequestingUsage(false);
              await load();
            })();
          });
          unsub = () => {
            Promise.resolve(handle).then((h) => h?.remove?.());
          };
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      unsub?.();
    };
  }, [load]);

  const filtered = useMemo(
    () => sortApps(filterApps(apps, filter, query), sort),
    [apps, filter, query, sort],
  );

  const stats = useMemo(() => computeStats(apps), [apps]);

  const requestUsage = useCallback(async () => {
    setRequestingUsage(true);
    await requestUsageAccess();
    toast.info(t("organize.apps.usage.toast"));
    // Belt-and-suspenders: the appStateChange listener above catches the
    // return from Settings, but poll for a few seconds in case that event
    // is throttled on the current OEM ROM.
    for (const delay of [800, 2000, 4000]) {
      window.setTimeout(async () => {
        const granted = await checkUsageAccess();
        setUsageAvailable(granted);
        if (granted) {
          setRequestingUsage(false);
          void load();
        }
      }, delay);
    }
  }, [load, t]);

  const recheckUsage = useCallback(async () => {
    const granted = await checkUsageAccess();
    setUsageAvailable(granted);
    setRequestingUsage(false);
    if (granted) void load();
  }, [load]);

  const showUsageGate = isAndroidNative() && !usageAvailable;
  const showPluginError = !usable && isAndroidNative();

  return (
    <AppShell>
      <PageHeader
        title={t("organize.apps.title")}
        subtitle={
          loading
            ? t("organize.apps.subtitleLoading")
            : `${t("organize.apps.count", { count: stats.total })} · ${formatSize(stats.totalBytes)}`
        }
        leading={
          <BackButton className="gf-press flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground hover:text-foreground" />
        }
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="gf-press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground hover:text-foreground"
            aria-label={t("organize.apps.refreshAria")}
          >
            <RefreshCw className={`h-[18px] w-[18px] ${loading ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <StatsBlock stats={stats} usageAvailable={usageAvailable} />

      {showUsageGate ? (
        <UsageAccessGate
          requesting={requestingUsage}
          onGrant={() => void requestUsage()}
          onRecheck={() => void recheckUsage()}
          partial={apps.length > 0}
        />
      ) : null}

      <SectionHeader title={t("organize.apps.sectionAll")} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("organize.apps.searchPlaceholder")}
          className="h-12 w-full rounded-2xl bg-surface-2 pl-11 pr-11 text-[14px] outline-none ring-1 ring-inset ring-border/60 focus:ring-primary/50"
        />
        {query ? (
          <button
            type="button"
            aria-label={t("cleaner.trash.clearSearch.aria")}
            onClick={() => setQuery("")}
            className="gf-press absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 gap-1.5 overflow-x-auto scrollbar-hidden">
          <Chip active={filter === "user"} onClick={() => setFilter("user")}>
            <User className="h-4 w-4" /> Utilisateur
          </Chip>
          <Chip active={filter === "system"} onClick={() => setFilter("system")}>
            <Cpu className="h-4 w-4" /> Système
          </Chip>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            {t("organize.apps.filter.all")}
          </Chip>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSortSheet(true)}
            className="gf-press flex h-10 items-center gap-1.5 rounded-2xl bg-surface-2 px-3 text-[12.5px] font-medium text-muted-foreground"
            aria-label={`Trier : ${sortLabel(t)[sort]}`}
          >
            <ArrowUpDown className="h-4 w-4" />
            <span className="hidden xs:inline">{sortLabel(t)[sort]}</span>
          </button>
          <button
            type="button"
            onClick={() => setLayout((l) => (l === "list" ? "grid" : "list"))}
            className="gf-press flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground"
            aria-label={layout === "list" ? "Affichage en grille" : "Affichage en liste"}
          >
            {layout === "list" ? (
              <Grid3x3 className="h-4 w-4" />
            ) : (
              <LayoutList className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-3">
        {loading && apps.length === 0 ? (
          <div className="grid gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        ) : showPluginError && apps.length === 0 ? (
          <EmptyState
            icon={Ban}
            title={t("organize.apps.pluginError.title")}
            description={t("organize.apps.pluginError.desc")}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={AppWindow}
            title={
              query ? t("organize.apps.emptySearch.title") : t("organize.apps.emptyNone.title")
            }
            description={
              query ? t("organize.apps.emptySearch.desc") : t("organize.apps.emptyNone.desc")
            }
          />
        ) : layout === "list" ? (
          <ul className="space-y-2">
            {filtered.map((a) => (
              <li key={a.packageName}>
                <AppRow app={a} onOpen={() => setSelected(a)} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-3 gap-2 xs:grid-cols-4">
            {filtered.map((a) => (
              <AppTile key={a.packageName} app={a} onOpen={() => setSelected(a)} />
            ))}
          </div>
        )}
      </div>

      <SectionHeader
        title={t("organize.apps.sectionRecommendations")}
        hint={t("organize.apps.sectionRecommendationsHint")}
      />
      <RecommendationsBlock stats={stats} onSelect={setSelected} />

      <SortSheet
        open={sortSheet}
        current={sort}
        onSelect={(s) => {
          setSort(s);
          setSortSheet(false);
        }}
        onClose={() => setSortSheet(false)}
      />

      <AppDetailsSheet
        app={selected}
        onClose={() => setSelected(null)}
        onChanged={() => void load()}
        statsSupported={statsSupported}
      />
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Reusable presentational bits                                        */
/* ------------------------------------------------------------------ */

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`gf-press flex h-10 shrink-0 items-center gap-1.5 rounded-2xl px-3.5 text-[12.5px] font-medium transition-colors ${
        active ? "bg-primary-softer text-primary" : "bg-surface-2 text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function UsageAccessGate({
  requesting,
  onGrant,
  onRecheck,
  partial,
}: {
  requesting: boolean;
  onGrant: () => void;
  onRecheck: () => void;
  partial: boolean;
}) {
  const t = useT();
  return (
    <div className="gf-card mt-3 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-softer text-primary">
          <Shield className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug">
            {t("organize.apps.usage.grantTitle")}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {partial ? t("organize.apps.usage.descPartial") : t("organize.apps.usage.descFull")}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onGrant}
        disabled={requesting}
        className="gf-press mt-3 h-12 w-full rounded-2xl bg-primary text-[14px] font-semibold text-primary-foreground shadow-elevated disabled:opacity-60"
      >
        {requesting ? t("organize.apps.usage.opening") : t("organize.apps.usage.openSettings")}
      </button>
      <button
        type="button"
        onClick={onRecheck}
        className="gf-press mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className="h-4 w-4" /> {t("organize.apps.usage.recheck")}
      </button>
    </div>
  );
}

function AppIconEl({ app, size = 40 }: { app: InstalledApp; size?: number }) {
  if (app.iconBase64) {
    return (
      <img
        src={`data:image/png;base64,${app.iconBase64}`}
        alt=""
        width={size}
        height={size}
        className="rounded-xl"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-xl bg-accent text-primary"
      style={{ width: size, height: size }}
    >
      <AppWindow className="h-5 w-5" />
    </span>
  );
}

function AppRow({ app, onOpen }: { app: InstalledApp; onOpen: () => void }) {
  const t = useT();
  const size = app.totalBytes || app.apkSize;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="gf-card gf-press flex w-full items-center gap-3 p-3 text-left"
    >
      <AppIconEl app={app} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[14.5px] font-semibold">{app.label}</p>
          {app.isSystem ? (
            <span className="shrink-0 rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
              {t("organize.apps.filter.system")}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
          {formatSize(size)}
          {app.versionName ? ` · v${app.versionName}` : ""}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function AppTile({ app, onOpen }: { app: InstalledApp; onOpen: () => void }) {
  const size = app.totalBytes || app.apkSize;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card-surface flex flex-col items-center gap-1.5 p-2.5 text-center active:scale-[0.97]"
    >
      <AppIconEl app={app} size={44} />
      <p className="line-clamp-1 w-full text-[11px] font-medium">{app.label}</p>
      <p className="text-[10px] text-muted-foreground">{formatSize(size)}</p>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Stats + recommendations                                             */
/* ------------------------------------------------------------------ */

function StatsBlock({
  stats,
  usageAvailable,
}: {
  stats: ReturnType<typeof computeStats>;
  usageAvailable: boolean;
}) {
  const total = Math.max(1, stats.totalBytes);
  const t = useT();
  const userPct = Math.min(100, Math.round((stats.userBytes / total) * 100));
  return (
    <div className="gf-card mt-3 p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {t("organize.apps.stats.totalLabel")}
          </p>
          <p className="mt-1.5 truncate font-display text-[32px] font-bold leading-none text-primary">
            {formatSize(stats.totalBytes)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary-softer px-2.5 py-1 text-[11px] font-semibold text-primary">
          {t("organize.apps.stats.totalCount", { count: stats.total })}
        </span>
      </div>

      <div className="mt-3.5 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
        <span className="h-full bg-primary" style={{ width: `${userPct}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          <span className="truncate">
            {t("organize.apps.stats.userCount", { count: stats.user })}
          </span>
          <span className="shrink-0 font-semibold text-foreground">
            {formatSize(stats.userBytes)}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-surface-3" />
          <span className="truncate">
            {t("organize.apps.stats.systemCount", { count: stats.system })}
          </span>
          <span className="shrink-0 font-semibold text-foreground">
            {formatSize(Math.max(0, stats.totalBytes - stats.userBytes))}
          </span>
        </span>
      </div>

      <div className="mt-3.5 flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-[12px] leading-snug text-muted-foreground">
        <Shield
          className={`h-4 w-4 shrink-0 ${usageAvailable ? "text-primary" : "text-muted-foreground"}`}
        />
        <span className="min-w-0">
          {usageAvailable
            ? t("organize.apps.usage.available")
            : t("organize.apps.usage.unavailable")}
        </span>
      </div>
    </div>
  );
}

function RecommendationsBlock({
  stats,
  onSelect,
}: {
  stats: ReturnType<typeof computeStats>;
  onSelect: (a: InstalledApp) => void;
}) {
  const t = useT();
  if (stats.unused.length === 0 && stats.heavy.length === 0) {
    return <p className="text-[11px] text-muted-foreground">{t("organize.apps.reco.empty")}</p>;
  }
  return (
    <div className="space-y-4">
      {stats.reclaimableBytes > 0 ? (
        <div className="card-surface flex items-start gap-2 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium">
              {t("organize.apps.reco.reclaimable", { size: formatSize(stats.reclaimableBytes) })}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("organize.apps.reco.reclaimableHint")}
            </p>
          </div>
        </div>
      ) : null}

      {stats.unused.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("organize.apps.unusedTitle")}
          </p>
          <ul className="space-y-2">
            {stats.unused.slice(0, 3).map((a) => (
              <li key={a.packageName}>
                <AppRow app={a} onOpen={() => onSelect(a)} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {stats.heavy.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Applications volumineuses
          </p>
          <ul className="space-y-2">
            {stats.heavy.slice(0, 3).map((a) => (
              <li key={a.packageName}>
                <AppRow app={a} onOpen={() => onSelect(a)} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sort sheet + details sheet                                          */
/* ------------------------------------------------------------------ */

function SortSheet({
  open,
  current,
  onSelect,
  onClose,
}: {
  open: boolean;
  current: AppSort;
  onSelect: (s: AppSort) => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <BottomSheet open={open} onClose={onClose} title={t("cleaner.trash.sortBy")}>
      <ul className="space-y-1">
        {(Object.keys(sortLabel(t)) as AppSort[]).map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onSelect(s)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${
                current === s ? "bg-primary/15 text-primary" : "hover:bg-accent"
              }`}
            >
              <span>{sortLabel(t)[s]}</span>
              {current === s ? <span className="text-[11px]">{t("state.active")}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

function AppDetailsSheet({
  app,
  onClose,
  onChanged,
  statsSupported,
}: {
  app: InstalledApp | null;
  onClose: () => void;
  onChanged: () => void;
  statsSupported: boolean;
}) {
  const [permissions, setPermissions] = useState<AppPermissions | null>(null);
  const t = useT();
  const [storage, setStorage] = useState<AppStorageBreakdown | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    setPermissions(null);
    setStorage(null);
    setShowPermissions(false);
    setShowStorage(false);
  }, [app?.packageName]);

  if (!app) return null;

  const loadPermissions = async () => {
    setShowPermissions((v) => !v);
    if (permissions) return;
    const p = await getAppPermissions(app.packageName);
    setPermissions(p);
  };

  const loadStorage = async () => {
    setShowStorage((v) => !v);
    if (storage) return;
    const s = await getAppStorage(app.packageName);
    setStorage(s);
  };

  const handleOpen = async () => {
    const ok = await openApp(app.packageName);
    if (!ok)
      toast.error(t("organize.apps.toast.openFailed.title"), {
        description: t("organize.apps.toast.openFailed.desc"),
      });
  };

  const handleSettings = async () => {
    const ok = await openAppSettings(app.packageName);
    if (!ok)
      toast.error(t("organize.apps.toast.settingsFailed.title"), {
        description: t("organize.apps.toast.settingsFailed.desc"),
      });
  };

  const handleShare = async () => {
    const text =
      `${app.label}\n` +
      `Version : ${app.versionName} (${app.versionCode})\n` +
      `Taille : ${formatSize(app.totalBytes || app.apkSize)}\n` +
      `Installée le : ${formatDate(app.firstInstallTime)}\n` +
      `Mise à jour le : ${formatDate(app.lastUpdateTime)}`;
    const ok = await shareAppInfo(text);
    if (!ok)
      toast.error(t("organize.apps.toast.shareFailed.title"), {
        description: t("organize.apps.toast.shareFailed.desc"),
      });
  };

  const runBackup = async () => {
    setBusy(true);
    const res = await backupApk(app.packageName);
    setBusy(false);
    if (res.ok) {
      toast.success(t("organize.apps.toast.backupDone.title"), {
        description: t("organize.apps.toast.backupDone.desc", {
          name: app.label,
          size: formatSize(res.size ?? 0),
        }),
      });
    } else {
      toast.error(t("organize.apps.toast.backupFailed.title"), {
        description: res.error
          ? errorMessage(res.error, t("organize.apps.toast.backupFailed.title"))
          : t("organize.apps.toast.backupFailed.desc"),
      });
    }
  };

  const handleBackup = () =>
    confirm.ask(
      {
        title: t("organize.apps.confirm.backupTitle", { name: app.label }),
        description: t("organize.apps.confirm.backupDesc"),
        confirmLabel: t("organize.apps.confirm.backupConfirm"),
      },
      runBackup,
    );

  const handleUninstall = () => {
    if (app.isSystem) {
      toast.info(t("organize.apps.systemUninstall.title"), {
        description: t("organize.apps.systemUninstall.desc"),
      });
      return;
    }
    confirm.ask(
      {
        title: t("organize.apps.confirm.uninstallTitle", { name: app.label }),
        description: t("organize.apps.confirm.uninstallDesc"),
        confirmLabel: t("organize.apps.confirm.uninstallConfirm"),
        tone: "danger",
      },
      async () => {
        const ok = await uninstallApp(app.packageName);
        if (!ok)
          toast.error(t("organize.apps.toast.uninstallFailed.title"), {
            description: t("organize.apps.toast.uninstallFailed.desc"),
          });
        // Android affichera sa boîte de dialogue ; on rafraîchit au retour.
        setTimeout(onChanged, 1200);
      },
    );
  };

  const size = app.totalBytes || app.apkSize;

  return (
    <BottomSheet open={!!app} onClose={onClose} title={app.label}>
      <div className="mb-3 flex items-center gap-3">
        <AppIconEl app={app} size={56} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{app.label}</p>
          <p className="truncate text-[11px] text-muted-foreground">{app.packageName}</p>
          <p className="text-[11px] text-muted-foreground">
            v{app.versionName || "—"} · code {app.versionCode}
          </p>
        </div>
      </div>

      <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <MetaRow
          label={t("organize.apps.detail.type")}
          value={
            app.isSystem ? t("organize.apps.detail.typeSystem") : t("organize.apps.detail.typeUser")
          }
        />
        <MetaRow
          label={t("organize.apps.detail.state")}
          value={
            app.enabled ? t("organize.apps.detail.enabled") : t("organize.apps.detail.disabled")
          }
        />
        <MetaRow
          label={t("organize.apps.detail.installed")}
          value={formatDate(app.firstInstallTime)}
        />
        <MetaRow label={t("organize.apps.sort.updated")} value={formatDate(app.lastUpdateTime)} />
        <MetaRow label={t("organize.apps.detail.totalSize")} value={formatSize(size)} />
        <MetaRow label={t("organize.apps.detail.apk")} value={formatSize(app.apkSize)} />
        {statsSupported ? (
          <>
            <MetaRow label={t("organize.apps.detail.data")} value={formatSize(app.dataBytes)} />
            <MetaRow label={t("organize.apps.detail.cache")} value={formatSize(app.cacheBytes)} />
          </>
        ) : null}
        <MetaRow label={t("organize.apps.detail.targetSdk")} value={String(app.targetSdk || "—")} />
        <MetaRow
          label={t("organize.apps.detail.lastUsed")}
          value={app.usageAvailable && app.lastUsed > 0 ? formatDate(app.lastUsed) : "—"}
        />
        <MetaRow label={t("organize.apps.detail.location")} value={app.sourceDir || "—"} full />
      </dl>

      <div className="grid grid-cols-2 gap-2">
        <ActionBtn icon={ExternalLink} label={t("action.open")} onClick={handleOpen} />
        <ActionBtn
          icon={Info}
          label={t("organize.apps.action.systemInfo")}
          onClick={handleSettings}
        />
        <ActionBtn icon={Share2} label={t("action.share")} onClick={handleShare} />
        <ActionBtn
          icon={Download}
          label={busy ? t("organize.apps.action.backingUp") : t("organize.apps.action.backup")}
          onClick={handleBackup}
          disabled={busy}
        />
        <ActionBtn
          icon={KeyRound}
          label={t("organize.apps.action.permissions")}
          onClick={loadPermissions}
        />
        <ActionBtn icon={Package} label={t("organize.apps.action.storage")} onClick={loadStorage} />
      </div>

      {showPermissions ? (
        <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Shield className="h-3.5 w-3.5" /> {t("organize.apps.permissions.title")}
          </div>
          {permissions === null ? (
            <p className="text-[11px] text-muted-foreground">
              {t("organize.apps.permissions.loading")}
            </p>
          ) : permissions.granted.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {t("organize.apps.permissions.none")}
            </p>
          ) : (
            <ul className="space-y-0.5 text-[11px]">
              {permissions.granted.map((p) => (
                <li key={p} className="truncate">
                  <Eye className="mr-1 inline h-3 w-3 text-primary" />
                  {p.replace("android.permission.", "")}
                </li>
              ))}
            </ul>
          )}
          {permissions && permissions.declared.length > permissions.granted.length ? (
            <p className="mt-2 text-[10px] text-muted-foreground">
              {t("organize.apps.permissions.moreDeclared", {
                count: permissions.declared.length - permissions.granted.length,
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {showStorage ? (
        <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> {t("organize.apps.storage.title")}
          </div>
          {storage === null ? (
            <p className="text-[11px] text-muted-foreground">
              {t("organize.apps.storage.loading")}
            </p>
          ) : !storage.available ? (
            <p className="text-[11px] text-muted-foreground">
              {t("organize.apps.storage.unavailable")}
            </p>
          ) : (
            <div className="space-y-1 text-[11px]">
              <StorageLine label={t("organize.apps.storage.app")} bytes={storage.codeBytes ?? 0} />
              <StorageLine label={t("organize.apps.storage.data")} bytes={storage.dataBytes ?? 0} />
              <StorageLine
                label={t("organize.apps.storage.cache")}
                bytes={storage.cacheBytes ?? 0}
              />
              <StorageLine
                label={t("organize.apps.storage.total")}
                bytes={storage.totalBytes ?? 0}
                bold
              />
            </div>
          )}
        </div>
      ) : null}

      {!app.isSystem ? (
        <div className="mt-3">
          <PrimaryButton variant="danger" onClick={handleUninstall}>
            <span className="inline-flex items-center gap-1.5">
              <Trash2 className="h-4 w-4" />
              {t("organize.apps.uninstall")}
            </span>
          </PrimaryButton>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
          <Ban className="h-3.5 w-3.5" />
          {t("organize.apps.systemNotice")}
        </div>
      )}
      {confirm.dialog}
    </BottomSheet>
  );
}

function MetaRow({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof ExternalLink;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-[12px] font-medium disabled:opacity-50"
    >
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </button>
  );
}

function StorageLine({ label, bytes, bold }: { label: string; bytes: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-medium" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{formatSize(bytes)}</span>
    </div>
  );
}
