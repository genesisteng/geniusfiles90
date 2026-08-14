/**
 * Écran « Applications » du mode sélection.
 *
 * Il liste les applications RÉELLEMENT installées sur l'appareil et
 * expose, pour chacune, le véritable fichier APK (`sourceDir`). La
 * sélection passe par le même store que les fichiers : la validation
 * transmet donc un chemin d'APK réel à la fonctionnalité appelante
 * (transfert, partage, sauvegarde…), jamais une simple description.
 */
import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/common/PageHeader";
import { useT } from "@/lib/i18n";
import { FileListView } from "@/components/files/FileList";
import { LoadingState, UnavailableState } from "@/components/files/StateViews";
import { listInstalledApps } from "@/lib/apps/api";
import type { InstalledApp } from "@/lib/apps/types";
import { pickAccepts, popPickScreen, type PickRequest } from "@/lib/files/pick-session";
import {
  isSelected,
  selectionKey,
  toggleSelection,
  useSelection,
} from "@/lib/files/selection-store";
import type { FileEntry, PathRef } from "@/lib/files/types";

/** Dossier réel contenant l'APK (`/data/app/…`), exprimé en racine absolue. */
function parentOf(app: InstalledApp): PathRef {
  const dir = app.sourceDir.slice(0, Math.max(0, app.sourceDir.lastIndexOf("/"))) || "/";
  return { rootId: `abs:${dir}`, segments: [] };
}

function entryOf(app: InstalledApp): FileEntry {
  return {
    name: `${app.label}.apk`,
    path: app.sourceDir,
    isDirectory: false,
    size: app.apkSize || app.codeBytes || 0,
    mtime: app.lastUpdateTime,
    kind: "apk",
    ext: "apk",
  };
}

export function AppsPickScreen({ request }: { request: PickRequest }) {
  const t = useT();
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [usable, setUsable] = useState(true);
  const selection = useSelection();

  useEffect(() => {
    let cancelled = false;
    void listInstalledApps({ includeIcons: true }).then((res) => {
      if (cancelled) return;
      setUsable(res.usable);
      setApps(res.usable ? res.apps.filter((a) => !a.isSystem && a.sourceDir) : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const list = (apps ?? []).map((app) => ({ app, entry: entryOf(app), parent: parentOf(app) }));
    return list
      .filter((r) => pickAccepts(r.entry, request))
      .sort((a, b) => a.entry.name.localeCompare(b.entry.name, "fr"));
  }, [apps, request]);

  const entries = useMemo(() => rows.map((r) => r.entry), [rows]);
  /* Icône RÉELLE de l'application (et non l'icône générique « APK ») :
     indispensable pour reconnaître une application à envoyer. */
  const iconByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if (r.app.iconBase64) map.set(r.entry.name, r.app.iconBase64);
    return map;
  }, [rows]);
  const renderIcon = (entry: FileEntry) => {
    const icon = iconByName.get(entry.name);
    if (!icon) return null;
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary/50">
        <img
          src={icon.startsWith("data:") ? icon : `data:image/png;base64,${icon}`}
          alt=""
          className="h-9 w-9 object-contain"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  };
  const parentByName = useMemo(() => {
    const map = new Map<string, PathRef>();
    for (const r of rows) map.set(r.entry.name, r.parent);
    return map;
  }, [rows]);

  const toggle = (entry: FileEntry) => {
    const parent = parentByName.get(entry.name);
    if (!parent) return;
    if (!request.multi) {
      // Sélection unique : le nouvel élément remplace le précédent.
      for (const item of [...selection.values()]) {
        if (item.key !== selectionKey(parent, entry.name)) {
          toggleSelection(item.parent, item.entry);
        }
      }
    }
    toggleSelection(parent, entry);
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader
        title={t("files.apps.title")}
        subtitle={t("files.apps.subtitle")}
        leading={
          <button
            type="button"
            onClick={() => popPickScreen()}
            aria-label={t("action.back")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors active:bg-secondary/60"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
          </button>
        }
      />
      {apps === null ? (
        <LoadingState />
      ) : !usable ? (
        <UnavailableState />
      ) : rows.length === 0 ? (
        <p className="px-1 py-10 text-center text-[13px] text-muted-foreground">
          {t("files.apps.empty")}
        </p>
      ) : (
        <div className="-mx-4">
          <FileListView
            entries={entries}
            onOpen={toggle}
            onLongPress={toggle}
            onMore={() => {}}
            renderIcon={renderIcon}
            selectionMode
            isSelected={(e) => {
              const parent = parentByName.get(e.name);
              return parent ? isSelected(parent, e.name) : false;
            }}
            onToggleSelect={toggle}
          />
        </div>
      )}
    </div>
  );
}
