/**
 * Section « Fichiers récents » de la page d'accueil.
 *
 * Affiche les fichiers réellement ajoutés au stockage (téléchargement
 * terminé, photo prise, réception Bluetooth / Quick Share, copie,
 * extraction, document créé…), du plus récent au plus ancien.
 * L'ouverture d'un fichier dans GeniusFiles n'influence jamais cette
 * liste : seule la date réelle d'ajout compte.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Clock3 } from "lucide-react";
import { FileIcon } from "@/components/files/FileIcon";
import { UniversalViewer } from "@/components/viewer/UniversalViewer";
import { canPreview } from "@/lib/viewer/kinds";
import { openWithSystem } from "@/lib/viewer/openWith";
import type { PathRef } from "@/lib/files/types";
import {
  addedAbsPath,
  addedId,
  addedLocationLabel,
  loadAddedFiles,
  subscribeAdded,
  watchAddedFiles,
  type AddedFile,
} from "@/lib/recents/added";
import { formatRecentTime } from "@/lib/recents/store";
import { useT } from "@/lib/i18n";

const MAX_ITEMS = 2;

function parentOf(f: AddedFile): PathRef {
  return { rootId: f.rootId, segments: f.folderSegments };
}

export function RecentFilesSection() {
  const t = useT();
  const navigate = useNavigate();
  const [files, setFiles] = useState<AddedFile[]>([]);
  const [viewerName, setViewerName] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setFiles(loadAddedFiles().slice(0, MAX_ITEMS));
    refresh();
    const unsubscribe = subscribeAdded(refresh);
    const stop = watchAddedFiles();
    return () => {
      unsubscribe();
      stop();
    };
  }, []);

  const previewable = useMemo(() => files.filter((f) => canPreview(f)), [files]);
  const viewerIndex = useMemo(
    () => (viewerName ? previewable.findIndex((f) => f.name === viewerName) : -1),
    [previewable, viewerName],
  );

  const open = useCallback(async (f: AddedFile) => {
    if (canPreview(f)) setViewerName(f.name);
    else await openWithSystem(parentOf(f), f);
  }, []);

  return (
    <section aria-label={t("home.recent.aria")}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {t("home.recent.title")}
        </h2>
        <button
          type="button"
          onClick={() => navigate({ to: "/fichiers-recents" })}
          className="inline-flex min-h-7 items-center gap-1 rounded-full px-2 text-[12px] font-medium text-primary transition-colors active:bg-primary/10"
        >
          {t("home.recent.viewMore")} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {files.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/60 px-3.5 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Clock3 className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </span>
          <p className="min-w-0 text-[12.5px] leading-snug text-muted-foreground">
            {t("home.recent.empty")}
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
          {files.map((f, i) => (
            <li key={addedId(f)} className={i > 0 ? "border-t border-border/70" : ""}>
              <button
                type="button"
                onClick={() => open(f)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-transform duration-100 ease-out active:scale-[0.99]"
              >
                <FileIcon kind={f.kind} size="sm" path={addedAbsPath(f)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium leading-tight">
                    {f.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {addedLocationLabel(f)}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatRecentTime(f.at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <UniversalViewer
        open={viewerIndex >= 0}
        entries={previewable}
        parent={
          previewable[viewerIndex >= 0 ? viewerIndex : 0]
            ? parentOf(previewable[viewerIndex >= 0 ? viewerIndex : 0])
            : null
        }
        index={viewerIndex >= 0 ? viewerIndex : 0}
        onIndexChange={(i) => {
          const next = previewable[i];
          if (next) setViewerName(next.name);
        }}
        onClose={() => setViewerName(null)}
        parentOf={(e) => parentOf(e as never)}
        onAction={async (entry, action) => {
          const f = entry as AddedFile;
          if (action === "openWith") await openWithSystem(parentOf(f), f);
          else navigate({ to: "/fichiers-recents" });
        }}
      />
    </section>
  );
}
