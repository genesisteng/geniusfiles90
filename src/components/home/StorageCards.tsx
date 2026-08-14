/**
 * Section « Stockages » de l'accueil.
 *
 * Objectif : ouvrir le gestionnaire de fichiers à la racine d'un stockage
 * en un seul appui, sans étape intermédiaire.
 *
 * Performance : aucune analyse n'est relancée ici. Les capacités viennent
 * du bridge natif (StatFs, quasi instantané) et le nombre de fichiers de
 * l'index local déjà maintenu par GeniusFiles. Tout rafraîchissement se
 * fait discrètement en arrière-plan.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { STORAGE_ICON, type GfIconComponent } from "@/components/icons";

import { getExternalVolumes, subscribeRoots, refreshStorageVolumes } from "@/lib/files/fs";
import type { StorageRootId } from "@/lib/files/types";
import { formatSize } from "@/lib/files/format";
import { getStorageStats, isAndroidNative } from "@/lib/native/geniusfiles-native";
import { indexCountsByRoot, isIndexReady, restoreIndexFromDisk } from "@/lib/search/index-store";
import { useT } from "@/lib/i18n";

type StorageCard = {
  id: StorageRootId;
  label: string;
  icon: GfIconComponent;
  total: number;
  free: number;
  used: number;
  files?: number;
};

/** Sous-ensemble de racines rattachées au stockage interne. */
const INTERNAL_ROOTS: StorageRootId[] = [
  "internal",
  "documents",
  "downloads",
  "pictures",
  "movies",
  "music",
];

export function StorageCards({
  onOpenRoot,
  internalFilesFallback,
}: {
  onOpenRoot: (id: StorageRootId) => void;
  /** Nombre de fichiers déjà connu pour le stockage interne (analyse d'accueil). */
  internalFilesFallback?: number;
}) {
  const t = useT();
  const [internal, setInternal] = useState<{ total: number; free: number; used: number } | null>(
    null,
  );
  const [externals, setExternals] = useState(() => getExternalVolumes());
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    isIndexReady() ? indexCountsByRoot() : {},
  );

  // Capacité du stockage interne (StatFs natif) — non bloquant.
  const loadInternal = useCallback(() => {
    void getStorageStats().then((s) => {
      if (s) setInternal({ total: s.total, free: s.free, used: s.used });
    });
  }, []);

  useEffect(() => {
    loadInternal();
    const unsub = subscribeRoots(() => setExternals(getExternalVolumes()));
    // Détection des volumes amovibles en tâche de fond.
    void refreshStorageVolumes().then(() => setExternals(getExternalVolumes()));
    return unsub;
  }, [loadInternal]);

  // Nombre de fichiers : lecture de l'index local, restauré depuis le disque
  // si besoin. Jamais de nouvelle analyse complète.
  useEffect(() => {
    let cancelled = false;
    if (isIndexReady()) {
      setCounts(indexCountsByRoot());
      return;
    }
    void restoreIndexFromDisk().then((ok) => {
      if (!cancelled && ok) setCounts(indexCountsByRoot());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Rafraîchissement discret au retour au premier plan.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      loadInternal();
      void refreshStorageVolumes().then(() => setExternals(getExternalVolumes()));
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadInternal]);

  const cards: StorageCard[] = useMemo(() => {
    const internalFiles =
      INTERNAL_ROOTS.reduce((acc, id) => acc + (counts[id] ?? 0), 0) || internalFilesFallback || 0;
    const list: StorageCard[] = [
      {
        id: "internal",
        label: t("home.storage.internal"),
        icon: STORAGE_ICON.internal,
        total: internal?.total ?? 0,
        free: internal?.free ?? 0,
        used: internal?.used ?? 0,
        files: internalFiles || undefined,
      },
    ];
    for (const v of externals) {
      list.push({
        id: v.id,
        label: v.label || (v.kind === "usb" ? t("home.storage.usb") : t("home.storage.sd")),
        icon: v.kind === "usb" ? STORAGE_ICON.usb : STORAGE_ICON.sd,
        total: v.total,
        free: v.free,
        used: v.used,
        files: counts[v.id],
      });
    }
    return list;
  }, [internal, externals, counts, internalFilesFallback, t]);

  return (
    <section aria-label={t("home.storage.aria")}>
      <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {t("home.storage.title")}
      </h2>
      {/* Toujours vertical : chaque stockage occupe une ligne pleine largeur,
          quel que soit leur nombre — aucun débordement horizontal. */}
      <div className="flex w-full flex-col gap-2.5">
        {cards.map((c) => (
          <StorageTile key={c.id} card={c} onOpen={() => onOpenRoot(c.id)} />
        ))}
      </div>
    </section>
  );
}

function StorageTile({ card, onOpen }: { card: StorageCard; onOpen: () => void }) {
  const t = useT();
  const Icon = card.icon;
  const known = card.total > 0;
  const pct = known ? Math.round((card.used / card.total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("home.storage.open", { label: card.label })}
      className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5 text-left transition-transform duration-100 ease-out active:scale-[0.98] hover:border-primary/30"
    >

      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <Icon className="h-[19px] w-[19px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-tight">
            {card.label}
          </span>
          {known && (
            <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-primary">
              {pct} %
            </span>
          )}
        </span>
        <span
          className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-secondary"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${known ? Math.max(pct, 2) : 0}%` }}
          />
        </span>
        <span className="mt-1.5 block truncate text-[11px] leading-none text-muted-foreground tabular-nums">
          {known
            ? t("home.storage.usage", {
                used: formatSize(card.used),
                total: formatSize(card.total),
                free: formatSize(card.free),
              })
            : t("home.storage.readingSpace")}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" />
    </button>
  );
}
