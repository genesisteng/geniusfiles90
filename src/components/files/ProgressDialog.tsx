import { useEffect, useState } from "react";
import type { ProgressEvent } from "@/lib/files/operations";
import { formatSize } from "@/lib/files/format";
import { BottomSheet, PrimaryButton } from "./BottomSheet";
import { useT } from "@/lib/i18n";

function formatDuration(ms?: number) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}min ${rest}s` : `${m}min`;
}

export function ProgressDialog({
  open,
  title,
  subtitle,
  progress,
  onCancel,
  onHide,
  speedBps,
}: {
  open: boolean;
  title: string;
  /** Contexte de l'opération : « 12 fichiers → Documents/Factures ». */
  subtitle?: string;
  progress: ProgressEvent | null;
  onCancel: () => void;
  /**
   * Ferme uniquement la fenêtre : la tâche continue en arrière-plan,
   * au même rythme, et reste supervisable depuis la barre des tâches.
   */
  onHide?: () => void;
  /** Débit instantané en octets/s (affiché quand disponible). */
  speedBps?: number;
}) {
  const t = useT();
  const [cancelling, setCancelling] = useState(false);
  useEffect(() => {
    if (open) setCancelling(false);
  }, [open]);

  /* Opérations éclair : aucune fenêtre ne doit clignoter à l'écran.
     La progression n'apparaît qu'au-delà d'un court délai, ou tout de
     suite quand l'opération est visiblement longue (nombreux éléments
     ou gros volume). */
  const heavy =
    (progress?.total ?? 0) > 20 || (progress?.totalBytes ?? 0) > 24 * 1024 * 1024 || cancelling;
  const [ripened, setRipened] = useState(false);
  useEffect(() => {
    if (!open) {
      setRipened(false);
      return;
    }
    const timer = window.setTimeout(() => setRipened(true), 420);
    return () => window.clearTimeout(timer);
  }, [open]);
  const visible = open && (ripened || heavy);

  const pct = progress
    ? Math.min(
        100,
        Math.round(
          progress.totalBytes > 0
            ? (progress.bytes / progress.totalBytes) * 100
            : progress.total > 0
              ? (progress.completed / progress.total) * 100
              : 0,
        ),
      )
    : 0;

  // Phase explicite : l'utilisateur n'est jamais laissé sans indication.
  const phase = cancelling
    ? t("ops.progress.phase.cancelling")
    : !progress
      ? t("ops.progress.phase.preparing")
      : pct >= 100
        ? t("ops.progress.phase.finalizing")
        : t("ops.progress.phase.running");

  return (
    <BottomSheet
      open={visible}
      onClose={() => onHide?.()}
      title={title}
      footer={
        <div className="flex w-full items-center gap-2">
          {onHide ? (
            <PrimaryButton variant="ghost" onClick={onHide}>
              {t("ops.progress.hide")}
            </PrimaryButton>
          ) : null}
          <PrimaryButton
            variant="ghost"
            disabled={cancelling}
            onClick={() => {
              setCancelling(true);
              onCancel();
            }}
          >
            {cancelling ? t("ops.progress.cancelling") : t("ops.progress.cancel")}
          </PrimaryButton>
        </div>
      }
    >
      {subtitle ? (
        <p className="mb-2 truncate text-[12.5px] text-foreground/80">{subtitle}</p>
      ) : null}
      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-primary">
        <span>{phase}</span>
        <span className="font-mono">{pct}%</span>
      </div>
      <div className="mb-2 truncate text-[12px] text-muted-foreground">
        {progress?.currentName ?? t("ops.progress.analyzing")}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {progress
            ? t("ops.progress.items", { count: progress.completed, total: progress.total || "?" })
            : "…"}
        </span>
        <span>
          {progress && progress.totalBytes > 0
            ? `${formatSize(progress.bytes)} / ${formatSize(progress.totalBytes)}`
            : ""}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{speedBps && speedBps > 0 ? `${formatSize(speedBps)}/s` : ""}</span>
        <span>
          {progress?.etaMs != null
            ? t("ops.progress.remaining", { time: formatDuration(progress.etaMs) })
            : ""}
        </span>
      </div>
      {onHide ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{t("ops.progress.hideHint")}</p>
      ) : null}
    </BottomSheet>
  );
}
