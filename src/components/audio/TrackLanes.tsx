/**
 * Pistes de l'éditeur audio — une seule forme d'onde par piste.
 *
 * Toutes les pistes partagent la même timeline (0 → durée totale). Chaque
 * ligne permet de sélectionner la piste, de la déplacer au doigt, de la
 * couper/supprimer et de régler son écoute. La tête de lecture et la
 * sélection sont dessinées au-dessus de l'ensemble, ce qui rend le montage
 * lisible d'un coup d'œil.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Trash2,
  Volume2,
  VolumeX,
  Headphones,
  Scissors,
  Eraser,
  Crown,
  RefreshCw,
  Loader2,
} from "lucide-react";

import type { AudioClip, TimeRange } from "@/lib/audio/types";
import { computePeaksSync } from "@/lib/audio/peaks";
import { DEFAULT_BPM, MAX_BPM, MIN_BPM } from "@/lib/audio/sync";
import { durationOf } from "@/lib/audio/dsp";
import type { ExtraTrack } from "@/lib/audio/tracks";
import { tick } from "@/lib/photo/haptics";
import { useT } from "@/lib/i18n";

const LANE_H = 46;

export type LaneId = "main" | string;

function drawLane(
  canvas: HTMLCanvasElement,
  clip: AudioClip,
  offset: number,
  total: number,
  color: string,
  dim: boolean,
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(canvas.clientWidth));
  const h = Math.max(1, Math.round(canvas.clientHeight));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const dur = durationOf(clip);
  if (dur <= 0 || total <= 0) return;
  const x0 = Math.round((offset / total) * w);
  const x1 = Math.round(((offset + dur) / total) * w);
  const span = Math.max(1, x1 - x0);
  const peaks = computePeaksSync(clip, span);
  ctx.globalAlpha = dim ? 0.35 : 1;
  ctx.fillStyle = color;
  const mid = h / 2;
  for (let i = 0; i < span; i++) {
    const min = peaks.data[i * 2];
    const max = peaks.data[i * 2 + 1];
    const top = mid - max * (h / 2 - 2);
    const bottom = mid - min * (h / 2 - 2);
    ctx.fillRect(x0 + i, top, 1, Math.max(1, bottom - top));
  }
  ctx.globalAlpha = 1;
}

function Lane({
  clip,
  offset,
  total,
  active,
  dim,
  token,
}: {
  clip: AudioClip;
  offset: number;
  total: number;
  active: boolean;
  dim: boolean;
  token: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const color = getComputedStyle(c).color || "#888";
    let raf = requestAnimationFrame(() => drawLane(c, clip, offset, total, color, dim));
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => drawLane(c, clip, offset, total, color, dim));
          })
        : null;
    ro?.observe(c);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [clip, offset, total, dim, token]);
  return (
    <canvas
      ref={ref}
      className={`h-full w-full ${active ? "text-primary" : "text-muted-foreground"}`}
      style={{ height: LANE_H }}
    />
  );
}

export function TrackLanes({
  mainClip,
  mainName,
  mainToken,
  mainMuted,
  tracks,
  total,
  selection,
  selected,
  positionRef,
  getTime,
  playing,
  onSelect,
  onSeek,
  onMoveTrack,
  onMoveCommit,
  onToggleMute,
  onToggleSolo,
  onRemove,
  onEditTrack,
  onAdd,
  onGain,
  onGainCommit,
  canUndo,
  onUndo,
  master,
  onMaster,
  syncTargets,
  onToggleSyncTarget,
  onSync,
  onClearSync,
  syncing,
  bpm,
  onBpm,
  syncedCount,
}: {
  mainClip: AudioClip;
  mainName: string;
  mainToken: string;
  mainMuted: boolean;
  tracks: ExtraTrack[];
  total: number;
  selection: TimeRange | null;
  selected: LaneId;
  positionRef: React.MutableRefObject<number>;
  getTime: (lead?: number) => number | null;
  playing: boolean;
  onSelect: (id: LaneId) => void;
  onSeek: (t: number) => void;
  onMoveTrack: (id: string, offset: number) => void;
  onMoveCommit: () => void;
  onToggleMute: (id: LaneId) => void;
  onToggleSolo: (id: string) => void;
  onRemove: (id: string) => void;
  onEditTrack: (id: LaneId, edit: "delete" | "silence" | "keep") => void;
  onAdd: () => void;
  onGain: (id: string, gain: number) => void;
  onGainCommit: () => void;
  canUndo: boolean;
  onUndo: () => void;
  /** Piste de référence (« maître ») de la synchronisation. */
  master: LaneId;
  onMaster: (id: LaneId) => void;
  /** Pistes cochées, seules concernées par la synchronisation. */
  syncTargets: LaneId[];
  onToggleSyncTarget: (id: LaneId) => void;
  onSync: () => void;
  onClearSync: () => void;
  syncing: boolean;
  /** BPM saisi manuellement par piste (aucune détection automatique). */
  bpm: Record<string, number>;
  onBpm: (id: LaneId, bpm: number) => void;
  syncedCount: number;
}) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  /* Tête de lecture : animée hors React, donc sans coût de rendu. */
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = headRef.current;
      const box = boxRef.current;
      if (!el || !box || total <= 0) return;
      const t = getTime() ?? positionRef.current;
      el.style.transform = `translateX(${(Math.max(0, Math.min(total, t)) / total) * box.clientWidth}px)`;
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [getTime, positionRef, total, playing]);

  const pxPerSec = width > 0 && total > 0 ? width / total : 0;

  const dragRef = useRef<{ id: string; startX: number; base: number; moved: boolean } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, id: LaneId, offset: number) => {
      onSelect(id);
      if (id === "main") {
        const box = boxRef.current;
        if (box && total > 0) {
          const r = box.getBoundingClientRect();
          onSeek(Math.max(0, Math.min(total, ((e.clientX - r.left) / r.width) * total)));
        }
        return;
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { id, startX: e.clientX, base: offset, moved: false };
    },
    [onSeek, onSelect, total],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || pxPerSec <= 0) return;
      const dx = e.clientX - d.startX;
      if (!d.moved) {
        if (Math.abs(dx) < 4) return;
        d.moved = true;
        onMoveCommit();
        tick();
      }
      onMoveTrack(d.id, Math.max(0, d.base + dx / pxPerSec));
    },
    [onMoveTrack, onMoveCommit, pxPerSec],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const selRect = useMemo(() => {
    if (!selection || total <= 0) return null;
    const a = Math.max(0, Math.min(selection.start, selection.end));
    const b = Math.min(total, Math.max(selection.start, selection.end));
    if (b - a <= 0.001) return null;
    return { left: `${(a / total) * 100}%`, width: `${((b - a) / total) * 100}%` };
  }, [selection, total]);

  const rows: {
    id: LaneId;
    name: string;
    clip: AudioClip;
    offset: number;
    muted: boolean;
    solo: boolean;
    main: boolean;
  }[] = [
    {
      id: "main",
      name: mainName,
      clip: mainClip,
      offset: 0,
      muted: mainMuted,
      solo: false,
      main: true,
    },
    ...tracks.map((t) => ({
      id: t.id as LaneId,
      name: t.name,
      clip: t.clip,
      offset: t.offset,
      muted: t.muted,
      solo: t.solo,
      main: false,
    })),
  ];

  return (
    <section className="mx-3 mb-2 rounded-2xl border border-border bg-surface p-2">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <p className="text-[12px] font-semibold text-foreground">
          {t("media.editor.tracks.title")}{" "}
          <span className="text-muted-foreground">({rows.length})</span>
        </p>
        <div className="flex items-center gap-1.5">
          {canUndo ? (
            <button
              type="button"
              onClick={onUndo}
              className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground active:scale-95"
            >
              {t("media.editor.tracks.undo")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              tick();
              onAdd();
            }}
            className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground active:scale-95"
          >
            {t("media.editor.tracks.addTrack")}
          </button>
        </div>
      </div>

      <div ref={boxRef} className="relative">
        {/* Sélection commune à toutes les pistes */}
        {selRect ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-10 rounded-[3px] bg-primary/15 ring-1 ring-primary/40"
            style={selRect}
          />
        ) : null}
        {/* Tête de lecture */}
        <div
          ref={headRef}
          className="pointer-events-none absolute inset-y-0 z-20 w-px bg-primary"
          style={{ left: 0 }}
        />

        <div className="max-h-[38vh] space-y-1 overflow-y-auto">
          {rows.map((r) => {
            const active = selected === r.id;
            return (
              <div
                key={r.id}
                className={`rounded-xl border px-2 py-1 transition-colors ${
                  active ? "border-primary bg-primary-softer/40" : "border-border/70 bg-background"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      tick();
                      onSelect(r.id);
                    }}
                    className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-foreground"
                  >
                    {r.main ? "① " : ""}
                    {r.name}
                    {r.offset > 0.01 ? (
                      <span className="ml-1 text-muted-foreground">+{r.offset.toFixed(2)}s</span>
                    ) : null}
                  </button>
                  <LaneBtn
                    label={
                      r.muted ? t("media.editor.reactivate") : t("media.editor.tracks.muteLabel")
                    }
                    on={r.muted}
                    onClick={() => onToggleMute(r.id)}
                    icon={r.muted ? VolumeX : Volume2}
                  />
                  {!r.main ? (
                    <>
                      <LaneBtn
                        label={t("media.editor.tracks.solo")}
                        on={r.solo}
                        onClick={() => onToggleSolo(r.id as string)}
                        icon={Headphones}
                      />
                      <LaneBtn
                        label={t("media.editor.tracks.removeTrack")}
                        onClick={() => onRemove(r.id as string)}
                        icon={Trash2}
                      />
                    </>
                  ) : null}
                </div>

                <div
                  className="touch-none"
                  onPointerDown={(e) => onPointerDown(e, r.id, r.offset)}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  style={{ height: LANE_H }}
                >
                  <Lane
                    clip={r.clip}
                    offset={r.offset}
                    total={total}
                    active={active}
                    dim={r.muted}
                    token={r.main ? mainToken : `${r.id}_${r.clip.length}`}
                  />
                </div>

                {active && !r.main ? (
                  <label className="flex items-center gap-2 pt-1 text-[10px] text-muted-foreground">
                    {t("media.editor.tool.volume")}
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={tracks.find((t) => t.id === r.id)?.gain ?? 1}
                      onPointerDown={onGainCommit}
                      onChange={(e) => onGain(r.id as string, Number(e.target.value))}
                      className="h-1 flex-1 accent-primary"
                      aria-label={t("media.editor.tracks.volumeOf", { name: r.name })}
                    />
                    <span className="w-8 text-right font-mono">
                      {(tracks.find((t) => t.id === r.id)?.gain ?? 1).toFixed(2)}×
                    </span>
                  </label>
                ) : null}

                {active && selRect ? (
                  <div className="flex gap-1.5 pb-0.5 pt-1">
                    <SmallAction
                      icon={Scissors}
                      label={t("media.editor.tracks.keep")}
                      onClick={() => onEditTrack(r.id, "keep")}
                    />
                    <SmallAction
                      icon={Trash2}
                      label={t("action.delete")}
                      onClick={() => onEditTrack(r.id, "delete")}
                    />
                    <SmallAction
                      icon={Eraser}
                      label={t("media.effect.silence")}
                      onClick={() => onEditTrack(r.id, "silence")}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Synchronisation multipiste */}
      <div className="mt-2 rounded-xl border border-border/70 bg-background p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-foreground">
            {t("media.editor.sync.title")}
            {syncedCount > 0 ? (
              <span className="ml-1.5 rounded-md bg-primary-softer px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {t("media.editor.sync.count", { count: syncedCount })}
              </span>
            ) : null}
          </p>
          {syncedCount > 0 ? (
            <button
              type="button"
              onClick={onClearSync}
              className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground active:scale-95"
            >
              {t("media.editor.sync.desync")}
            </button>
          ) : null}
        </div>

        <p className="mb-1.5 text-[10px] leading-tight text-muted-foreground">
          {t("media.editor.sync.bpmHint")}
        </p>

        {rows.length < 2 ? (
          <p className="text-[10px] leading-tight text-muted-foreground">
            {t("media.editor.sync.needTwoTracksHint")}
          </p>
        ) : (
          <>
            <div className="space-y-1">
              {rows.map((r) => {
                const isMaster = master === r.id;
                const value = bpm[r.id] ?? DEFAULT_BPM;
                return (
                  <div key={`sync_${r.id}`} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={t("media.editor.sync.setMaster", { name: r.name })}
                      aria-pressed={isMaster}
                      onClick={() => {
                        tick();
                        onMaster(r.id);
                      }}
                      className={`rounded-md border p-1 active:scale-95 ${
                        isMaster
                          ? "border-primary bg-primary-softer text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      <Crown className="h-3 w-3" />
                    </button>
                    <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-foreground">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={!isMaster && syncTargets.includes(r.id)}
                        disabled={isMaster}
                        onChange={() => onToggleSyncTarget(r.id)}
                        aria-label={t("media.editor.sync.syncCheckbox", { name: r.name })}
                      />
                      <span className="truncate">{r.name}</span>
                    </label>
                    <div className="flex shrink-0 items-center gap-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={MIN_BPM}
                        max={MAX_BPM}
                        step={0.5}
                        value={String(value)}
                        aria-label={t("media.editor.sync.bpmOf", { name: r.name })}
                        onChange={(e) => {
                          const n = Number.parseFloat(e.target.value);
                          if (Number.isFinite(n)) onBpm(r.id, n);
                        }}
                        className="w-14 rounded-md border border-border bg-background px-1.5 py-1 text-center font-mono text-[10px] text-foreground"
                      />
                      <span className="text-[10px] text-muted-foreground">BPM</span>
                    </div>
                    {isMaster ? (
                      <span className="shrink-0 text-[10px] font-medium text-primary">
                        {t("media.editor.sync.master")}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                tick();
                onSync();
              }}
              disabled={syncing}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground active:scale-95 disabled:opacity-60"
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {syncing
                ? t("media.editor.syncing")
                : syncedCount > 0
                  ? t("media.editor.sync.resync")
                  : t("media.editor.sync.sync")}
            </button>
          </>
        )}
      </div>

      <p className="px-1 pt-1.5 text-[10px] leading-tight text-muted-foreground">
        {t("media.editor.tracks.dragHint")}
      </p>
    </section>
  );
}

function LaneBtn({
  label,
  icon: Icon,
  on,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  on?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={() => {
        tick();
        onClick();
      }}
      className={`rounded-lg border p-1.5 active:scale-95 ${
        on ? "border-primary bg-primary-softer text-primary" : "border-border text-muted-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function SmallAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tick();
        onClick();
      }}
      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-foreground active:scale-95"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
