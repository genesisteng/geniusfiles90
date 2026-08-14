/**
 * Panneau de progression des analyses — intégré à la page Outils.
 *
 * Rend rien lorsque la file est vide (aucun bruit visuel). Sinon affiche
 * un résumé compact avec pause/reprise/annulation, en s'appuyant sur le
 * moteur d'arrière-plan (`subscribeQueue`).
 */
import { useEffect, useState } from "react";
import { Pause, Play, X, Sparkles } from "lucide-react";
import {
  subscribeQueue,
  pauseQueue,
  resumeQueue,
  cancelAll,
  clearFinished,
} from "@/lib/analysis/queue";
import type { QueueSnapshot } from "@/lib/analysis/types";
import { countLabel, formatCount } from "@/lib/copy";
import { useT } from "@/lib/i18n";

export function AnalysisProgressPanel() {
  const t = useT();
  const [snap, setSnap] = useState<QueueSnapshot | null>(null);

  useEffect(() => subscribeQueue(setSnap), []);

  if (!snap) return null;
  const active = snap.queued + snap.running;
  const finished = snap.done + snap.skipped + snap.failed + snap.cancelled;
  if (active === 0 && finished === 0) return null;

  const total = active + finished;
  const pct = total === 0 ? 0 : Math.round((finished / total) * 100);

  return (
    <div className="card-surface mt-2 flex flex-col gap-2 p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("home.analysis.title")}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {active > 0
              ? snap.currentLabel
                ? t("home.analysis.analyzingNamed", {
                    name: snap.currentLabel,
                    count: countLabel(active, "file"),
                  })
                : t("home.analysis.analyzingQueue", { count: countLabel(active, "file") })
              : t("home.analysis.done", { count: countLabel(finished, "file") })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {active > 0 &&
            (snap.paused ? (
              <button
                type="button"
                aria-label={t("home.resume.resume")}
                onClick={resumeQueue}
                className="rounded-lg bg-secondary p-1.5 text-foreground hover:bg-accent"
              >
                <Play className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                aria-label={t("home.analysis.pause")}
                onClick={pauseQueue}
                className="rounded-lg bg-secondary p-1.5 text-foreground hover:bg-accent"
              >
                <Pause className="h-4 w-4" />
              </button>
            ))}
          {active > 0 && (
            <button
              type="button"
              aria-label={t("action.cancel")}
              onClick={cancelAll}
              className="rounded-lg bg-secondary p-1.5 text-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {active === 0 && finished > 0 && (
            <button
              type="button"
              onClick={clearFinished}
              className="rounded-lg bg-secondary px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
            >
              {t("home.analysis.clear")}
            </button>
          )}
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{t("home.analysis.running", { count: formatCount(snap.running) })}</span>
        <span>{t("home.analysis.queued", { count: formatCount(snap.queued) })}</span>
        <span>{t("home.analysis.analyzed", { count: formatCount(snap.done) })}</span>
        {snap.skipped > 0 && (
          <span>{t("home.analysis.skipped", { count: formatCount(snap.skipped) })}</span>
        )}
        {snap.failed > 0 && (
          <span className="text-destructive">
            {t("home.analysis.failed", { count: formatCount(snap.failed) })}
          </span>
        )}
        {snap.paused && <span className="text-primary">{t("home.analysis.paused")}</span>}
      </div>
    </div>
  );
}
