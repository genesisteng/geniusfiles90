import { useListScrollMemory } from "@/lib/files/use-list-scroll";
import { createFileRoute } from "@tanstack/react-router";
import { useAppNavigate } from "@/lib/navigation/pick-nav";
import { confirmPick, usePickRequest } from "@/lib/files/pick-session";
import { toggleSelection as toggleGlobalSelection } from "@/lib/files/selection-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Clock,
  Sparkles,
  X,
  SlidersHorizontal,
  Loader2,
  FolderOpen,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BACK_PRIORITY, useBackHandler } from "@/lib/navigation/back-stack";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IllustratedEmptyState } from "@/components/ui/IllustratedEmptyState";
import { FileIcon } from "@/components/files/FileIcon";
import { BottomSheet } from "@/components/files/BottomSheet";
import { fileMetaLine, kindLabel } from "@/lib/files/format";
import { toAbsolutePath } from "@/lib/files/fs";
import { useRoots } from "@/lib/fs/useRoots";
import type { PathRef, StorageRootId } from "@/lib/files/types";
import { runSearch, sortResults } from "@/lib/search/engine";
import {
  DEFAULT_FILTERS,
  filtersActive,
  type DateBand,
  type KindFilter,
  type SearchFilters,
  type SearchResult,
  type SizeBand,
} from "@/lib/search/types";
import {
  clearSearchHistory,
  loadSearchHistory,
  pushSearchHistory,
  removeSearchHistoryItem,
  type SearchHistoryItem,
} from "@/lib/search/history";
import { loadSearchFilters, saveSearchFilters } from "@/lib/search/preferences";
import { takeSearchScope, type SearchScope } from "@/lib/search/scope";
import { getCachedSearch, keyFor, setCachedSearch } from "@/lib/search/cache";
// Effet de bord : enregistre le provider de recherche par contenu (index
// inversé + OCR + PDF). Aucune modif d'UI n'est nécessaire — le provider
// se branche via le point d'extension prévu par le moteur.
import "@/lib/analysis";
import { useT, t as translate } from "@/lib/i18n";
import type { TransValues } from "@/lib/i18n";

type TFn = (key: string, values?: TransValues) => string;

export const Route = createFileRoute("/recherche")({
  head: () => ({
    meta: [
      { title: "Recherche — GeniusFiles" },
      {
        name: "description",
        content: translate("meta.search.description"),
      },
    ],
  }),
  component: SearchPage,
});

const kindChips = (t: TFn): { id: KindFilter; label: string }[] => [
  { id: "any", label: t("home.scopePicker.all") },
  { id: "image", label: t("search.chip.images") },
  { id: "video", label: t("home.category.videos") },
  { id: "audio", label: t("search.chip.audio") },
  { id: "document", label: t("search.chip.documents") },
  { id: "archive", label: t("search.chip.archives") },
  { id: "folder", label: t("files.archive.info.folders") },
];

const sizeOptions = (t: TFn): { id: SizeBand; label: string }[] => [
  { id: "any", label: t("files.toutesTailles") },
  { id: "lt1", label: t("search.size.lt1") },
  { id: "1to10", label: t("search.size.1to10") },
  { id: "10to100", label: t("search.size.10to100") },
  { id: "100to1000", label: t("search.size.100to1000") },
  { id: "gt1000", label: t("search.size.gt1000") },
];

const dateOptions = (t: TFn): { id: DateBand; label: string }[] => [
  { id: "any", label: t("search.date.any") },
  { id: "today", label: t("search.date.today") },
  { id: "week", label: t("search.date.week") },
  { id: "month", label: t("search.date.month") },
  { id: "year", label: t("files.cetteAnnee") },
];

const SUGGESTIONS_DEFAULT = (t: TFn) => [
  t("search.suggestion.recentlyModified"),
  t("search.suggestion.duplicateImages"),
  t("search.suggestion.largeVideos"),
];

const RESULTS_LIMIT = 500;

export function SearchPage() {
  /* Position de la liste restituée au retour depuis un aperçu. */
  useListScrollMemory("search", true);

  const t = useT();
  const navigate = useAppNavigate();
  const pick = usePickRequest();
  const { available: roots } = useRoots();

  const [query, setQuery] = useState("");
  const [filters, setFiltersState] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  /* Portée contextuelle posée par l'écran appelant (stockage/dossier
     ouvert). Absente depuis l'accueil → recherche globale. */
  const [scope, setScope] = useState<SearchScope | null>(null);
  useEffect(() => {
    setScope(takeSearchScope());
  }, []);

  /* Retour Android : panneau de filtres → recherche en cours → écran
     précédent. La page n'est jamais quittée tant qu'un état est ouvert. */
  useBackHandler(
    showFilters,
    () => {
      setShowFilters(false);
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

  // Les filtres survivent à la navigation et au redémarrage de l'app.
  const setFilters = useCallback((next: SearchFilters) => {
    setFiltersState(next);
    saveSearchFilters(next);
  }, []);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  const runRef = useRef<{ abort: () => void } | null>(null);
  const historyTimer = useRef<number | null>(null);

  useEffect(() => {
    setHistory(loadSearchHistory());
    setFiltersState(loadSearchFilters());
  }, []);

  /* ---------- streaming search ---------- */

  useEffect(() => {
    // Debounce: cancel previous, wait 140ms before firing.
    runRef.current?.abort();

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setScanned(0);
      setScanning(false);
      return;
    }

    // LRU cache — instant paint on back-navigation / repeated queries.
    const cacheKey = keyFor(trimmed, filters);
    const cached = getCachedSearch(cacheKey);
    if (cached) {
      setResults(cached.results);
      setScanned(cached.scanned);
      setScanning(false);
    } else {
      // Pas de purge ici : les résultats précédents restent affichés pendant
      // le nouveau scan et sont remplacés à l'arrivée du premier lot.
      setScanned(0);
    }

    const targetRoots = scope
      ? [{ rootId: scope.path.rootId, path: scope.path }]
      : filters.rootId === "all"
        ? roots.map((r) => ({ rootId: r.id, path: { rootId: r.id, segments: [] } as PathRef }))
        : [
            {
              rootId: filters.rootId as StorageRootId,
              path: { rootId: filters.rootId as StorageRootId, segments: [] } as PathRef,
            },
          ];

    if (targetRoots.length === 0) {
      setScanning(false);
      return;
    }

    setScanning(true);
    let latestScanned = 0;
    let firstBatch = !cached;
    let latestResults: SearchResult[] = cached?.results ?? [];
    const t = window.setTimeout(() => {
      const ctrl = runSearch({
        query: trimmed,
        filters,
        roots: targetRoots,
        onBatch: (batch) => {
          setResults((prev) => {
            const base = firstBatch ? [] : prev;
            firstBatch = false;
            const merged = sortResults([...base, ...batch]).slice(0, RESULTS_LIMIT);
            latestResults = merged;
            return merged;
          });
        },
        onProgress: (n) => {
          latestScanned = n;
          setScanned(n);
        },
        onDone: ({ failedProviders }) => {
          setScanning(false);
          // Aucun lot reçu : la requête n'a réellement rien donné, on retire
          // les résultats de la requête précédente encore affichés.
          if (firstBatch) {
            firstBatch = false;
            latestResults = [];
            setResults([]);
          }
          setCachedSearch(cacheKey, latestResults, latestScanned);
          if (failedProviders.length > 0) {
            toast.warning(translate("search.toast.partial.title"), {
              description: translate("search.toast.partial.desc"),
            });
          }
        },
      });
      runRef.current = ctrl;
    }, 140);

    // Persist to history after a short pause (avoids logging every keystroke).
    if (historyTimer.current != null) window.clearTimeout(historyTimer.current);
    historyTimer.current = window.setTimeout(() => {
      setHistory(pushSearchHistory(trimmed));
    }, 900);

    return () => {
      window.clearTimeout(t);
      runRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters.kind, filters.size, filters.date, filters.rootId, scope]);

  useEffect(() => {
    return () => {
      runRef.current?.abort();
      if (historyTimer.current != null) window.clearTimeout(historyTimer.current);
    };
  }, []);

  /* ---------- actions ---------- */

  const openFolder = useCallback(
    (parentPath: PathRef) => {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("gf.files.jumpTo", JSON.stringify(parentPath));
      }
      navigate({ to: "/" });
    },
    [navigate],
  );

  const openResult = useCallback(
    (r: SearchResult) => {
      const parentPath: PathRef = r.isDirectory
        ? { rootId: r.rootId, segments: r.segments }
        : { rootId: r.rootId, segments: r.parentSegments };
      /* Session de sélection : un résultat est sélectionné (ou validé
         directement en sélection unique) au lieu d'être ouvert. */
      if (pick) {
        if (r.isDirectory && pick.accept === "files") {
          openFolder(parentPath);
          return;
        }
        if (!r.isDirectory && pick.accept === "folders") return;
        const parent: PathRef = { rootId: r.rootId, segments: r.parentSegments };
        if (!pick.multi) {
          confirmPick({ parent, entry: r });
          return;
        }
        toggleGlobalSelection(parent, r);
        return;
      }
      // Open the containing folder for files; open the folder itself for directories.
      openFolder(parentPath);
    },
    [openFolder, pick],
  );

  const activeFilterCount = filtersActive(filters);
  const showRecents = query.trim().length === 0;
  const suggestions = useMemo(() => buildSuggestions(query, history), [query, history]);

  return (
    <AppShell>
      <div className="mt-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              scope
                ? t("search.input.placeholderScoped", { scope: scope.label })
                : t("search.input.placeholderGlobal")
            }
            aria-label={t("search.input.aria")}
            className="h-13 w-full rounded-3xl border border-border bg-surface-elevated pl-11 pr-20 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("cleaner.trash.clearSearch.aria")}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              aria-label={t("search.filters.aria")}
              className={`relative rounded-lg p-1.5 transition-colors ${
                activeFilterCount > 0
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>
        </label>
      </div>

      {/* Quick kind chips — always visible for one-tap filtering. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {kindChips(t).map((c) => {
          const active = filters.kind === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilters({ ...filters, kind: c.id })}
              className={`gf-press rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors ${
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-surface text-foreground hover:border-primary/40 hover:bg-accent"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Content: recents/suggestions OR results */}
      {showRecents ? (
        <RecentsAndSuggestions
          history={history}
          onPick={(q) => setQuery(q)}
          onRemove={(q) => setHistory(removeSearchHistoryItem(q))}
          onClear={() => {
            clearSearchHistory();
            setHistory([]);
          }}
        />
      ) : (
        <ResultsSection
          query={query}
          results={results}
          scanning={scanning}
          scanned={scanned}
          suggestions={suggestions}
          onOpen={openResult}
          onOpenFolder={openFolder}
          onPickSuggestion={(q) => setQuery(q)}
          roots={roots}
        />
      )}

      <FiltersSheet
        open={showFilters}
        filters={filters}
        onClose={() => setShowFilters(false)}
        onChange={setFilters}
        roots={roots}
      />
    </AppShell>
  );
}

/* ---------- recents & suggestions (empty query) ---------- */

function RecentsAndSuggestions({
  history,
  onPick,
  onRemove,
  onClear,
}: {
  history: SearchHistoryItem[];
  onPick: (q: string) => void;
  onRemove: (q: string) => void;
  onClear: () => void;
}) {
  const t = useT();
  return (
    <>
      <SectionHeader
        title={t("files.recherchesRecentes")}
        action={
          history.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("search.recents.clearAll")}
            </button>
          ) : undefined
        }
      />
      {history.length === 0 ? (
        <p className="gf-card px-4 py-7 text-center text-[12.5px] text-muted-foreground">
          {t("files.vosRecherchesRecentesApparaitrontIci")}
        </p>
      ) : (
        <div className="gf-card divide-y divide-border/60">
          {history.slice(0, 10).map((h) => (
            <div
              key={h.query}
              className="flex items-center gap-2 pr-2 transition-colors hover:bg-secondary/40"
            >
              <button
                type="button"
                onClick={() => onPick(h.query)}
                className="flex flex-1 items-center gap-3 px-4 py-3 text-left"
              >
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{h.query}</span>
              </button>
              <button
                type="button"
                aria-label={t("search.recents.remove.aria", { query: h.query })}
                onClick={() => onRemove(h.query)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <SectionHeader title={t("search.suggestions.title")} />
      <div className="space-y-2">
        {SUGGESTIONS_DEFAULT(t).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="gf-card gf-press flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40"
          >
            <span className="gf-icon-tile bg-primary-softer text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="flex-1 text-sm">{s}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ---------- results ---------- */

function ResultsSection({
  query,
  results,
  scanning,
  scanned,
  suggestions,
  onOpen,
  onOpenFolder,
  onPickSuggestion,
  roots,
}: {
  query: string;
  results: SearchResult[];
  scanning: boolean;
  scanned: number;
  suggestions: string[];
  onOpen: (r: SearchResult) => void;
  onOpenFolder: (p: PathRef) => void;
  onPickSuggestion: (q: string) => void;
  roots: { id: StorageRootId; label: string }[];
}) {
  const t = useT();
  const rootLabel = (id: StorageRootId) => roots.find((r) => r.id === id)?.label ?? id;

  // Progressive autosuggest — when there's no result yet and we're still scanning,
  // show a light "en cours" hint alongside suggestions from history.
  const showEmpty = !scanning && results.length === 0;

  return (
    <>
      <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {results.length > 0
            ? `${t("search.results.found", { count: results.length })}${
                results.length >= RESULTS_LIMIT ? "+" : ""
              }`
            : scanning
              ? t("search.results.searching")
              : t("state.noResults")}
        </span>
        {scanning ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {scanned > 0
              ? t("search.results.scanned", { count: scanned })
              : t("search.results.starting")}
          </span>
        ) : null}
      </div>

      {suggestions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPickSuggestion(s)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Sparkles className="h-3 w-3 text-primary" />
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="gf-card mt-3 divide-y divide-border/60">
          {results.map((r) => (
            <ResultRow
              key={`${r.rootId}::${r.segments.join("/")}`}
              result={r}
              rootLabel={rootLabel(r.rootId)}
              onOpen={() => onOpen(r)}
              onOpenFolder={() => onOpenFolder({ rootId: r.rootId, segments: r.parentSegments })}
              query={query}
            />
          ))}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="mt-4">
          <IllustratedEmptyState
            id="search"
            description={t("search.empty.description", { query })}
          />
        </div>
      ) : null}
    </>
  );
}

function ResultRow({
  result,
  rootLabel,
  onOpen,
  onOpenFolder,
  query,
}: {
  result: SearchResult;
  rootLabel: string;
  onOpen: () => void;
  onOpenFolder: () => void;
  query: string;
}) {
  const t = useT();
  const pathLabel = useMemo(() => {
    const segs = result.parentSegments.length ? " / " + result.parentSegments.join(" / ") : "";
    return rootLabel + segs;
  }, [rootLabel, result.parentSegments]);

  return (
    <div className="flex items-center gap-1 pr-2 transition-colors hover:bg-secondary/40">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-[64px] flex-1 items-center gap-3 px-3 py-2.5 text-left"
      >
        <FileIcon
          kind={result.kind}
          path={toAbsolutePath({ rootId: result.rootId, segments: result.segments })}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-semibold leading-tight">
            {highlight(result.name, query)}
          </p>
          <p className="mt-1 truncate text-[12.5px] text-muted-foreground">
            {result.isDirectory
              ? kindLabel(result.kind)
              : `${kindLabel(result.kind, result.ext)} · ${fileMetaLine(result)}`}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-muted-foreground/80">
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span className="truncate">{pathLabel}</span>
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
      </button>
      {!result.isDirectory ? (
        <button
          type="button"
          onClick={onOpenFolder}
          aria-label={t("organize.rec.cta.openFolder")}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <FolderOpen className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Highlight the matched substring (accent- & case-insensitive).
 * Falls back gracefully if the query has no direct substring match (fuzzy).
 */
function highlight(name: string, query: string) {
  const q = query.trim();
  if (!q) return name;
  const normName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const normQ = q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const idx = normName.indexOf(normQ);
  if (idx < 0) return name;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="rounded bg-primary/20 px-0.5 text-primary">
        {name.slice(idx, idx + normQ.length)}
      </mark>
      {name.slice(idx + normQ.length)}
    </>
  );
}

/**
 * Autosuggest: recent queries that start with what the user is typing,
 * newest first, deduped against the exact current query.
 */
function buildSuggestions(query: string, history: SearchHistoryItem[]): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return history
    .map((h) => h.query)
    .filter((h) => h.toLowerCase() !== q && h.toLowerCase().includes(q))
    .slice(0, 4);
}

/* ---------- filters sheet ---------- */

function FiltersSheet({
  open,
  filters,
  onChange,
  onClose,
  roots,
}: {
  open: boolean;
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
  onClose: () => void;
  roots: { id: StorageRootId; label: string }[];
}) {
  const t = useT();
  return (
    <BottomSheet open={open} onClose={onClose} title={t("search.filters.title")}>
      <div className="space-y-5 pb-2">
        <FilterGroup title={t("search.filters.location")}>
          <FilterChip
            active={filters.rootId === "all"}
            onClick={() => onChange({ ...filters, rootId: "all" })}
          >
            {t("files.tousLesEmplacements")}
          </FilterChip>
          {roots.map((r) => (
            <FilterChip
              key={r.id}
              active={filters.rootId === r.id}
              onClick={() => onChange({ ...filters, rootId: r.id })}
            >
              {r.label}
            </FilterChip>
          ))}
        </FilterGroup>

        <FilterGroup title={t("files.details.size")}>
          {sizeOptions(t).map((o) => (
            <FilterChip
              key={o.id}
              active={filters.size === o.id}
              onClick={() => onChange({ ...filters, size: o.id })}
            >
              {o.label}
            </FilterChip>
          ))}
        </FilterGroup>

        <FilterGroup title={t("search.filters.dateModified")}>
          {dateOptions(t).map((o) => (
            <FilterChip
              key={o.id}
              active={filters.date === o.id}
              onClick={() => onChange({ ...filters, date: o.id })}
            >
              {o.label}
            </FilterChip>
          ))}
        </FilterGroup>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("action.reset")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="gf-press rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft"
          >
            {t("search.filters.apply")}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
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
      className={`gf-press rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors ${
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-surface text-foreground hover:border-primary/40 hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}
