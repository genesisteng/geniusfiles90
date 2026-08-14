/**
 * Forme d'onde interactive de l'éditeur audio GeniusFiles.
 *
 * Architecture :
 *  - tracé 100 % canvas, une seule frame par changement (aucun DOM par
 *    colonne, aucun clignotement) ;
 *  - crêtes servies par une pyramide multi-résolution ({@link PeakStore}) :
 *    un pan ou un zoom ne relit jamais le signal complet ;
 *  - la fenêtre visible vit dans une ref : les gestes et le défilement de
 *    lecture redessinent immédiatement, l'état React est synchronisé de
 *    façon amortie pour ne pas re-rendre l'éditeur à 60 Hz ;
 *  - la tête de lecture est lue dans une ref alimentée par le moteur audio,
 *    donc parfaitement synchrone avec le son.
 */
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { acquirePeakStore, PeakStore } from "@/lib/audio/peaks";
import type { AudioClip, TimeRange } from "@/lib/audio/types";
import { confirmTick } from "@/lib/audio/haptics";
import { useT } from "@/lib/i18n";

export type WaveView = { from: number; to: number };

/** Piste secondaire affichée sous la piste principale. */
export type WaveSecondary = {
  clip: AudioClip;
  token: string;
  offset: number;
  muted: boolean;
  label: string;
};

type Props = {
  clip: AudioClip;
  /** Change dès que le rendu audio change : reconstruit les crêtes. */
  renderToken: string;
  view: WaveView;
  /**
   * Fenêtre « vivante » partagée avec le parent : mise à jour à chaque
   * geste et à chaque frame de défilement, sans provoquer de rendu React.
   */
  liveViewRef?: MutableRefObject<WaveView>;
  selection: TimeRange | null;
  /** Position de repli (lecture arrêtée). */
  position: number;
  /** Position vivante, alimentée par le moteur audio. */
  positionRef: MutableRefObject<number>;
  /**
   * Horloge du moteur audio : renvoie la position réelle en cours de
   * lecture, `null` à l'arrêt. C'est l'unique référence temporelle.
   */
  getTime?: (lead?: number) => number | null;
  playing: boolean;
  /** Défilement automatique pendant la lecture. */
  follow: boolean;
  onViewChange: (v: WaveView) => void;
  onSelectionChange: (r: TimeRange | null) => void;
  onSeek: (t: number) => void;
  /** Double appui : se placer puis lire depuis ce point. */
  onSeekPlay?: (t: number) => void;
  /** Hauteur totale du composant, en pixels. */
  height?: number;
  secondary?: WaveSecondary | null;
};

const RULER_H = 22;
const TRACK_GAP = 8;
const HANDLE_HIT = 44;
const LONG_PRESS_MS = 320;
const MIN_SPAN = 0.02;

/** Pas de graduation candidats, en secondes. */
const STEPS = [
  0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600,
];

function pickStep(span: number, width: number): number {
  const target = Math.max(1, width / 90); // ~90 px entre deux libellés
  const ideal = span / target;
  for (const s of STEPS) if (s >= ideal) return s;
  return STEPS[STEPS.length - 1];
}

function labelOf(t: number, step: number): string {
  const total = Math.max(0, t);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const head = `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
  if (step >= 1) return head;
  const frac = total - Math.floor(total);
  return step >= 0.1
    ? `${head}.${Math.round(frac * 10)}`
    : `${head}.${String(Math.round(frac * 100)).padStart(2, "0")}`;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Palette = {
  bg: string;
  lane: string;
  body: string;
  bodyDim: string;
  bodySel: string;
  axis: string;
  selFill: string;
  selEdge: string;
  playhead: string;
  grid: string;
  gridStrong: string;
  label: string;
};

function readPalette(): Palette {
  return {
    bg: cssVar("--wave-bg", "#1c1f24"),
    lane: cssVar("--wave-lane", "#22262c"),
    body: cssVar("--wave-body", "#6fd3b8"),
    bodyDim: cssVar("--wave-body-dim", "#4b6b6a"),
    bodySel: cssVar("--wave-body-sel", "#8fe3ff"),
    axis: cssVar("--wave-axis", "rgba(255,255,255,0.14)"),
    selFill: cssVar("--wave-sel-fill", "rgba(77,163,255,0.14)"),
    selEdge: cssVar("--wave-sel-edge", "#4da3ff"),
    playhead: cssVar("--wave-playhead", "#ffc861"),
    grid: cssVar("--wave-grid", "rgba(255,255,255,0.08)"),
    gridStrong: cssVar("--wave-grid-strong", "rgba(255,255,255,0.2)"),
    label: cssVar("--wave-label", "#9aa2ad"),
  };
}

export function Waveform({
  clip,
  renderToken,
  view,
  liveViewRef,
  selection,
  position,
  positionRef,
  getTime,
  playing,
  follow,
  onViewChange,
  onSelectionChange,
  onSeek,
  onSeekPlay,
  height,
  secondary,
}: Props) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const storeRef = useRef<PeakStore | null>(null);
  const store2Ref = useRef<PeakStore | null>(null);
  const secondaryRef = useRef<WaveSecondary | null>(secondary ?? null);
  secondaryRef.current = secondary ?? null;
  const colsRef = useRef<Float32Array>(new Float32Array(0));
  const mergeRef = useRef<Float32Array>(new Float32Array(0));
  const grabbedRef = useRef<"a" | "b" | null>(null);
  const paletteRef = useRef<Palette | null>(null);
  const rafRef = useRef(0);
  const dirtyRef = useRef(true);

  const tRef = useRef(t);
  tRef.current = t;
  const clipRef = useRef(clip);
  clipRef.current = clip;
  const duration = clip.length / clip.sampleRate;
  const durationRef = useRef(duration);
  durationRef.current = duration;

  const viewRef = useRef<WaveView>(view);
  const emitRef = useRef<WaveView>(view);
  const selRef = useRef<TimeRange | null>(selection);
  const staticPosRef = useRef(position);
  staticPosRef.current = position;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const followRef = useRef(follow);
  followRef.current = follow;
  const getTimeRef = useRef<((lead?: number) => number | null) | undefined>(getTime);
  getTimeRef.current = getTime;
  /**
   * Durée moyenne d'une frame : le tracé est anticipé d'exactement ce
   * délai, car un pixel dessiné maintenant n'est visible qu'à la frame
   * suivante. C'est ce qui supprime le retard visuel sur le son.
   */
  const frameLeadRef = useRef(1 / 60);
  const interactingRef = useRef(false);
  const lastTouchRef = useRef(0);
  const lastEmitAtRef = useRef(0);
  // Rappels du parent gardés dans des refs : les écouteurs de gestes sont
  // montés UNE seule fois. C'était la cause réelle des poignées « bloquées »
  // après quelques pixels : chaque re-rendu du parent recréait l'effet et
  // réinitialisait l'état du glissement en cours.
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const onSeekPlayRef = useRef(onSeekPlay);
  onSeekPlayRef.current = onSeekPlay;
  const liveViewRefRef = useRef(liveViewRef);
  liveViewRefRef.current = liveViewRef;

  const requestDraw = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  /** Position à afficher : l'horloge audio prime toujours. */
  const readPos = useCallback((): number => {
    const live = getTimeRef.current?.(playingRef.current ? frameLeadRef.current : 0) ?? null;
    if (live != null) return live;
    return playingRef.current ? positionRef.current : staticPosRef.current;
  }, [positionRef]);

  /* -------- synchronisation descendante (état React -> refs) -------- */
  useEffect(() => {
    const e = emitRef.current;
    if (Math.abs(view.from - e.from) > 1e-4 || Math.abs(view.to - e.to) > 1e-4) {
      viewRef.current = view;
      emitRef.current = view;
      if (liveViewRef) liveViewRef.current = view;
      requestDraw();
    }
  }, [view, liveViewRef, requestDraw]);

  useEffect(() => {
    if (!interactingRef.current) {
      selRef.current = selection;
      requestDraw();
    }
  }, [selection, requestDraw]);

  useEffect(() => {
    requestDraw();
  }, [position, requestDraw]);

  /**
   * `silent` : la fenêtre bouge sans prévenir React (défilement de lecture).
   * Le parent reste synchronisé par `liveViewRef`, donc aucun rendu inutile
   * n'est déclenché pendant la lecture — c'est ce qui garantit que le tracé
   * ne prend jamais de retard sur le son.
   */
  const emitView = useCallback(
    (v: WaveView, force = false, silent = false) => {
      viewRef.current = v;
      const live = liveViewRefRef.current;
      if (live) live.current = v;
      requestDraw();
      if (silent) return;
      const now = performance.now();
      if (!force && now - lastEmitAtRef.current < 150) return;
      lastEmitAtRef.current = now;
      emitRef.current = v;
      onViewChangeRef.current(v);
    },
    [requestDraw],
  );

  // À l'arrêt de la lecture, la fenêtre réellement affichée est renvoyée au
  // parent : son état et le tracé restent cohérents pour la suite.
  useEffect(() => {
    if (!playing) emitView(viewRef.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  /* --------------------------- crêtes --------------------------- */
  useEffect(() => {
    // Les anciennes crêtes restent affichées jusqu'à ce que la première
    // tranche des nouvelles soit prête : pas de forme d'onde vide, pas de
    // clignotement, et zéro temps mort après une édition. Le cache rend
    // instantanés les états déjà vus (annuler/rétablir, retour d'aperçu).
    const previous = storeRef.current;
    const store = acquirePeakStore(renderToken || "base", clip);
    let swapped = false;
    const swap = () => {
      if (!swapped) {
        swapped = true;
        storeRef.current = store;
        if (previous && previous !== store && !previous.cached) previous.dispose();
      }
      requestDraw();
    };
    if (!previous || store.ready) swap();
    requestDraw();
    void store.ensure(swap).catch(() => {});
    return () => {
      store.off(swap);
      if (!store.cached && storeRef.current !== store) store.dispose();
    };
  }, [clip, renderToken, requestDraw]);

  useEffect(() => {
    if (!secondary) {
      store2Ref.current = null;
      requestDraw();
      return;
    }
    const store = acquirePeakStore(`sec_${secondary.token}`, secondary.clip);
    store2Ref.current = store;
    const onChunk = () => requestDraw();
    void store.ensure(onChunk).catch(() => {});
    return () => {
      store.off(onChunk);
      if (store2Ref.current === store) store2Ref.current = null;
      if (!store.cached) store.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondary?.clip, secondary?.token, requestDraw]);

  /* ---------------------------- tracé ---------------------------- */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!paletteRef.current) paletteRef.current = readPalette();
    const c = paletteRef.current;
    const store = storeRef.current;
    const clipNow = clipRef.current;
    const dur = durationRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);

    const v = viewRef.current;
    const span = Math.max(MIN_SPAN, v.to - v.from);
    const xOf = (t: number) => ((t - v.from) / span) * w;

    // Une seule forme d'onde par audio : les canaux sont fusionnés en une
    // enveloppe min/max commune. Plus aucun couloir L/R séparé.
    const chans = Math.max(1, Math.min(2, clipNow.channels.length));
    const sec = secondaryRef.current;
    const lanesTop = RULER_H;
    const totalH = Math.max(24, h - RULER_H);
    const secH = sec ? Math.max(48, Math.round(totalH * 0.32)) : 0;
    const lanesH = sec ? totalH - secH - TRACK_GAP : totalH;
    const laneH = lanesH;
    const secTop = lanesTop + lanesH + TRACK_GAP;

    /* --- couloir principal --- */
    ctx.fillStyle = c.lane;
    ctx.beginPath();
    ctx.roundRect(0, lanesTop, w, lanesH, 12);
    ctx.fill();
    if (sec) {
      ctx.fillStyle = c.lane;
      ctx.beginPath();
      ctx.roundRect(0, secTop, w, secH, 10);
      ctx.fill();
    }

    /* --- graduations --- */
    const major = pickStep(span, w);
    const minor = major / 5;
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 1;
    const firstMinor = Math.floor(v.from / minor) * minor;
    for (let t = firstMinor; t <= v.to + minor; t += minor) {
      if (t < 0 || t > dur) continue;
      const x = Math.round(xOf(t)) + 0.5;
      const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
      ctx.strokeStyle = isMajor ? c.gridStrong : c.grid;
      ctx.beginPath();
      ctx.moveTo(x, isMajor ? RULER_H - 9 : RULER_H - 5);
      ctx.lineTo(x, isMajor ? h : RULER_H);
      ctx.stroke();
      if (isMajor) {
        ctx.fillStyle = c.label;
        ctx.textAlign = x > w - 30 ? "right" : "left";
        ctx.fillText(labelOf(Math.round(t / minor) * minor, major), x + (x > w - 30 ? -3 : 3), 8);
      }
    }

    /* --- sélection (fond) --- */
    const sel = selRef.current;
    const selA = sel ? Math.min(sel.start, sel.end) : 0;
    const selB = sel ? Math.max(sel.start, sel.end) : 0;
    const hasSel = sel != null && selB - selA > 0.0005;
    if (hasSel) {
      const x1 = xOf(selA);
      const x2 = xOf(selB);
      ctx.fillStyle = c.selFill;
      ctx.fillRect(Math.min(x1, x2), lanesTop, Math.max(1, Math.abs(x2 - x1)), lanesH);
    }

    /* --- crêtes : une seule forme d'onde --- */
    const cols = Math.max(1, Math.floor(w));
    if (colsRef.current.length < cols * 2) colsRef.current = new Float32Array(cols * 2);
    if (mergeRef.current.length < cols * 2) mergeRef.current = new Float32Array(cols * 2);
    const buf = colsRef.current;
    const merged = mergeRef.current;
    const fromSample = v.from * clipNow.sampleRate;
    const toSample = v.to * clipNow.sampleRate;
    {
      const mid = lanesTop + laneH / 2;
      const half = laneH / 2 - 6;

      // Axe médian
      ctx.strokeStyle = c.axis;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(mid) + 0.5);
      ctx.lineTo(w, Math.round(mid) + 0.5);
      ctx.stroke();

      if (store) {
        store.fill(0, fromSample, toSample, cols, merged);
        if (chans > 1) {
          store.fill(1, fromSample, toSample, cols, buf);
          for (let x = 0; x < cols * 2; x += 2) {
            if (buf[x] < merged[x]) merged[x] = buf[x];
            if (buf[x + 1] > merged[x + 1]) merged[x + 1] = buf[x + 1];
          }
        }
        const dimmed = hasSel;
        for (let x = 0; x < cols; x++) {
          const min = merged[x * 2];
          const max = merged[x * 2 + 1];
          let inSel = false;
          if (hasSel) {
            const t = v.from + ((x + 0.5) / cols) * span;
            inSel = t >= selA && t <= selB;
          }
          ctx.fillStyle = inSel ? c.bodySel : dimmed ? c.bodyDim : c.body;
          const y1 = mid - max * half;
          const y2 = mid - min * half;
          ctx.fillRect(x, y1, 1, Math.max(1.5, y2 - y1));
        }
      }
    }

    /* --- piste secondaire --- */
    if (sec) {
      const store2 = store2Ref.current;
      const mid = secTop + secH / 2;
      const half = secH / 2 - 4;
      ctx.strokeStyle = c.axis;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(mid) + 0.5);
      ctx.lineTo(w, Math.round(mid) + 0.5);
      ctx.stroke();
      if (store2) {
        const sr2 = sec.clip.sampleRate;
        const f2 = (v.from - sec.offset) * sr2;
        const t2 = (v.to - sec.offset) * sr2;
        store2.fill(0, f2, t2, cols, buf);
        const len2 = sec.clip.length;
        for (let x = 0; x < cols; x++) {
          const sample = f2 + ((x + 0.5) / cols) * (t2 - f2);
          if (sample < 0 || sample > len2) continue;
          const min = buf[x * 2];
          const max = buf[x * 2 + 1];
          ctx.fillStyle = sec.muted ? c.bodyDim : c.bodySel;
          const y1 = mid - max * half;
          const y2 = mid - min * half;
          ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
        }
      }
      ctx.font = "9px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = c.label;
      ctx.fillText(
        sec.muted ? `${sec.label} (${tRef.current("media.editor.muted")})` : sec.label,
        4,
        secTop + 9,
      );
    }

    /* --- bords + poignées de sélection --- */
    if (hasSel) {
      const x1 = xOf(selA);
      const x2 = xOf(selB);
      const grabbed = grabbedRef.current;
      ctx.lineWidth = 2;
      const edges: [number, "a" | "b"][] = [
        [x1, "a"],
        [x2, "b"],
      ];
      for (const [x, side] of edges) {
        if (x < -16 || x > w + 16) continue;
        const active = grabbed === side;
        ctx.strokeStyle = c.selEdge;
        ctx.beginPath();
        ctx.moveTo(x, lanesTop);
        ctx.lineTo(x, lanesTop + lanesH);
        ctx.stroke();
        // Poignée large : facile à saisir au doigt, discrète à l'œil.
        const gy = lanesTop + lanesH / 2;
        const hw = active ? 9 : 7;
        const hh = active ? 34 : 30;
        ctx.fillStyle = c.selEdge;
        ctx.beginPath();
        ctx.roundRect(x - hw, gy - hh, hw * 2, hh * 2, hw);
        ctx.fill();
        ctx.fillStyle = c.bg;
        for (const dy of [-8, 0, 8]) ctx.fillRect(x - 3, gy + dy - 1, 6, 2);
      }
    }

    /* --- tête de lecture --- */
    // Position lue sur l'horloge audio à l'instant même du tracé : ce que
    // l'on voit correspond exactement à ce que l'on entend.
    const pos = readPos();
    const px = xOf(pos);
    if (px >= -3 && px <= w + 3) {
      const x = Math.round(px) + 0.5;
      ctx.strokeStyle = c.playhead;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, RULER_H - 8);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.fillStyle = c.playhead;
      ctx.beginPath();
      ctx.moveTo(x - 5, RULER_H - 12);
      ctx.lineTo(x + 5, RULER_H - 12);
      ctx.lineTo(x, RULER_H - 4);
      ctx.closePath();
      ctx.fill();
    }
  }, [readPos]);

  /* ------------------- boucle d'animation unique ------------------- */
  useEffect(() => {
    let prev = 0;
    const loop = (ts: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (prev) {
        const dt = (ts - prev) / 1000;
        if (dt > 0.004 && dt < 0.1) {
          // Moyenne glissante : suit 60 Hz, 90 Hz ou 120 Hz sans à-coups.
          frameLeadRef.current = frameLeadRef.current * 0.85 + dt * 0.15;
        }
      }
      prev = ts;
      const dur = durationRef.current;

      // Défilement automatique pendant la lecture.
      if (playingRef.current && followRef.current && !interactingRef.current) {
        const sinceTouch = performance.now() - lastTouchRef.current;
        if (sinceTouch > 250) {
          const v = viewRef.current;
          const span = v.to - v.from;
          const pos = readPos();
          if (span < dur - 1e-6) {
            // Défilement « rail » : la tête reste au tiers de l'écran et la
            // fenêtre glisse en continu, sans saut de page.
            let target = pos - span * 0.33;
            if (target < 0) target = 0;
            if (target > dur - span) target = Math.max(0, dur - span);
            const delta = target - v.from;
            if (Math.abs(delta) > 1e-5) {
              // Rattrapage doux quand l'écart est grand, suivi exact ensuite.
              const step = Math.abs(delta) > span * 0.5 ? delta * 0.2 : delta;
              const from = v.from + step;
              // `silent` : la fenêtre glisse sans rendu React pendant la
              // lecture, donc le tracé ne peut pas prendre de retard.
              emitView({ from, to: from + span }, false, true);
            }
          }
        }
        dirtyRef.current = true;
      }

      if (dirtyRef.current) {
        dirtyRef.current = false;
        draw();
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, emitView, readPos]);

  /* --------- redimensionnement + changement de thème --------- */
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => requestDraw());
    ro.observe(host);
    return () => ro.disconnect();
  }, [requestDraw]);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const mo = new MutationObserver(() => {
      paletteRef.current = null;
      requestDraw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => mo.disconnect();
  }, [requestDraw]);

  /* -------------------------- gestes -------------------------- */
  /**
   * Règle unique : le doigt commande. Aucun accrochage, aucun pas
   * imposé — les repères ne produisent qu'un retour haptique.
   */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const pointers = new Map<number, number>();
    let mode: "none" | "pan" | "tap" | "sel" | "edge-a" | "edge-b" | "move" | "pinch" = "none";
    let longTimer = 0;
    let lastTapAt = 0;
    let lastTapX = 0;
    let moved = false;
    let anchorTime = 0;
    let anchorX = 0;
    let fixedEdge = 0;
    let panFrom = 0;
    let selAtStart: TimeRange | null = null;
    let pinch: { dist: number; from: number; to: number; center: number } | null = null;
    let pendingSel: TimeRange | null = null;
    let selEmitPending = false;
    // Inertie du glissement horizontal.
    let velocity = 0;
    let lastMoveX = 0;
    let lastMoveAt = 0;
    let glide = 0;
    // Position réelle du doigt (écran) pendant un glissement de poignée :
    // c'est elle qui est reconvertie en temps à CHAQUE frame, y compris
    // quand la fenêtre visible défile toute seule.
    let dragX = 0;
    let autoRaf = 0;
    let autoAt = 0;

    const rect = () => host.getBoundingClientRect();
    const timeAt = (clientX: number) => {
      const r = rect();
      const v = viewRef.current;
      // Aucune limite ici : la valeur suit le doigt, on borne seulement
      // au moment de l'application.
      return v.from + ((clientX - r.left) / Math.max(1, r.width)) * (v.to - v.from);
    };
    const xOfTime = (t: number) => {
      const v = viewRef.current;
      return ((t - v.from) / Math.max(MIN_SPAN, v.to - v.from)) * rect().width;
    };
    const pxPerSec = () => {
      const v = viewRef.current;
      return rect().width / Math.max(MIN_SPAN, v.to - v.from);
    };
    const clampView = (from: number, to: number): WaveView => {
      const dur = durationRef.current;
      let span = Math.max(MIN_SPAN, Math.min(dur, to - from));
      if (span > dur) span = dur;
      let f = from;
      if (f < 0) f = 0;
      let t = f + span;
      if (t > dur) {
        t = dur;
        f = Math.max(0, dur - span);
      }
      return { from: f, to: t };
    };
    const stopGlide = () => {
      if (glide) cancelAnimationFrame(glide);
      glide = 0;
    };
    /**
     * La sélection vit d'abord dans la ref (tracé immédiat, 60 fps) ;
     * React n'est prévenu qu'une fois par frame au plus, ce qui évite tout
     * à-coup pendant le geste.
     */
    const setSel = (r: TimeRange | null, force = false) => {
      selRef.current = r;
      pendingSel = r;
      requestDraw();
      if (force) {
        selEmitPending = false;
        onSelectionChangeRef.current(r);
        return;
      }
      if (selEmitPending) return;
      selEmitPending = true;
      requestAnimationFrame(() => {
        if (!selEmitPending) return;
        selEmitPending = false;
        onSelectionChangeRef.current(pendingSel);
      });
    };
    const onDown = (e: PointerEvent) => {
      stopGlide();
      stopAuto();
      pointers.set(e.pointerId, e.clientX);
      dragX = e.clientX;
      host.setPointerCapture?.(e.pointerId);
      interactingRef.current = true;
      lastTouchRef.current = performance.now();
      velocity = 0;
      lastMoveX = e.clientX;
      lastMoveAt = performance.now();
      if (pointers.size === 2) {
        window.clearTimeout(longTimer);
        const [x1, x2] = [...pointers.values()];
        const v = viewRef.current;
        pinch = {
          dist: Math.max(1, Math.abs(x2 - x1)),
          from: v.from,
          to: v.to,
          center: timeAt((x1 + x2) / 2),
        };
        mode = "pinch";
        return;
      }
      moved = false;
      const t = timeAt(e.clientX);
      const localY = e.clientY - rect().top;
      if (localY < RULER_H) {
        mode = "pan";
        anchorX = e.clientX;
        panFrom = viewRef.current.from;
        return;
      }
      const sel = selRef.current;
      if (sel && Math.abs(sel.end - sel.start) > 0.0005) {
        const a = Math.min(sel.start, sel.end);
        const b = Math.max(sel.start, sel.end);
        const xa = xOfTime(a);
        const xb = xOfTime(b);
        const dA = Math.abs(e.clientX - rect().left - xa);
        const dB = Math.abs(e.clientX - rect().left - xb);
        // La poignée la plus proche gagne, avec une zone tactile large.
        if (dA <= HANDLE_HIT || dB <= HANDLE_HIT) {
          const takeA = dA <= dB;
          mode = takeA ? "edge-a" : "edge-b";
          grabbedRef.current = takeA ? "a" : "b";
          fixedEdge = takeA ? b : a;
          // Décalage doigt/poignée conservé : aucun saut au moment de la prise.
          anchorTime = t - (takeA ? a : b);
          selAtStart = { start: a, end: b };
          confirmTick();
          requestDraw();
          return;
        }
        if (t > a && t < b) {
          mode = "move";
          anchorTime = t;
          selAtStart = { start: a, end: b };
          return;
        }
      }
      mode = "tap";
      anchorTime = t;
      anchorX = e.clientX;
      panFrom = viewRef.current.from;
      window.clearTimeout(longTimer);
      longTimer = window.setTimeout(() => {
        if (mode !== "tap") return;
        // Appui long : cadre de sélection immédiatement manipulable.
        const dur = durationRef.current;
        const span = viewRef.current.to - viewRef.current.from;
        const half = Math.min(span * 0.08, dur / 2);
        const start = Math.max(0, Math.min(dur - 2 * half, anchorTime - half));
        mode = "edge-b";
        grabbedRef.current = "b";
        fixedEdge = start;
        anchorTime = 0;
        selAtStart = { start, end: start + 2 * half };
        confirmTick();
        setSel({ start, end: start + 2 * half }, true);
      }, LONG_PRESS_MS);
    };

    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, e.clientX);
      dragX = e.clientX;
      lastTouchRef.current = performance.now();
      const dur = durationRef.current;
      const now = performance.now();
      const dt = now - lastMoveAt;
      if (dt > 0) {
        const inst = (e.clientX - lastMoveX) / dt; // px/ms
        velocity = velocity * 0.7 + inst * 0.3;
        lastMoveX = e.clientX;
        lastMoveAt = now;
      }

      if (mode === "pinch" && pinch && pointers.size >= 2) {
        stopAuto();
        const [x1, x2] = [...pointers.values()];
        const dist = Math.max(1, Math.abs(x2 - x1));
        const factor = pinch.dist / dist;
        const span = Math.max(MIN_SPAN, Math.min(dur, (pinch.to - pinch.from) * factor));
        const ratio = (pinch.center - pinch.from) / Math.max(1e-4, pinch.to - pinch.from);
        emitView(clampView(pinch.center - span * ratio, pinch.center - span * ratio + span));
        return;
      }

      if (mode === "tap") {
        if (Math.abs(e.clientX - anchorX) > 6) {
          window.clearTimeout(longTimer);
          mode = "pan";
        } else return;
      }

      if (mode === "pan") {
        stopAuto();
        const v = viewRef.current;
        const span = v.to - v.from;
        const dx = e.clientX - anchorX;
        const from = panFrom - dx / pxPerSec();
        const next = clampView(from, from + span);
        emitView(next);
        moved = true;
        return;
      }

      if ((mode === "edge-a" || mode === "edge-b" || mode === "move") && selAtStart) {
        moved = true;
        applyFromPointer();
        startAuto();
      }
    };

    /**
     * Convertit la position du doigt en temps global, dans la fenêtre
     * visible *courante*. Appelée à chaque `pointermove` ET à chaque frame
     * d'auto-défilement : la poignée reste donc collée au doigt même
     * pendant que la timeline glisse.
     */
    const applyFromPointer = () => {
      if (!selAtStart) return;
      const dur = durationRef.current;
      const raw = timeAt(dragX);
      if (mode === "edge-a" || mode === "edge-b") {
        const t = Math.max(0, Math.min(dur, raw - anchorTime));
        setSel({ start: Math.min(fixedEdge, t), end: Math.max(fixedEdge, t) });
        return;
      }
      if (mode === "move") {
        const width = selAtStart.end - selAtStart.start;
        let start = selAtStart.start + (raw - anchorTime);
        start = Math.max(0, Math.min(Math.max(0, dur - width), start));
        setSel({ start, end: start + width });
      }
    };

    /**
     * Auto-défilement de la timeline quand le doigt approche d'un bord.
     * La vitesse croît avec la proximité du bord ; le glissement n'est
     * jamais interrompu et la sélection continue au-delà de la portion
     * visible, sur toute la durée du fichier.
     */
    const autoStep = (ts: number) => {
      autoRaf = requestAnimationFrame(autoStep);
      const dt = Math.min(0.05, autoAt ? (ts - autoAt) / 1000 : 0.016);
      autoAt = ts;
      const r = rect();
      const zone = Math.max(24, Math.min(72, r.width * 0.18));
      let dir = 0;
      let k = 0;
      const dLeft = dragX - r.left;
      const dRight = r.right - dragX;
      if (dLeft < zone) {
        dir = -1;
        k = Math.min(1, (zone - dLeft) / zone);
      } else if (dRight < zone) {
        dir = 1;
        k = Math.min(1, (zone - dRight) / zone);
      }
      if (dir === 0) return;
      const v = viewRef.current;
      const span = v.to - v.from;
      // Progressif : de ~12 % à ~110 % de la fenêtre visible par seconde.
      const speed = dir * span * (0.12 + 1.0 * k * k);
      const from = v.from + speed * dt;
      const next = clampView(from, from + span);
      if (Math.abs(next.from - v.from) < 1e-9) return; // début/fin atteint
      emitView(next, false, true);
      applyFromPointer();
    };
    const startAuto = () => {
      if (autoRaf) return;
      autoAt = 0;
      autoRaf = requestAnimationFrame(autoStep);
    };
    function stopAuto() {
      if (autoRaf) cancelAnimationFrame(autoRaf);
      autoRaf = 0;
      autoAt = 0;
    }

    /** Inertie : la fenêtre continue de glisser puis s'éteint doucement. */
    const startGlide = () => {
      let v0 = velocity; // px/ms
      if (Math.abs(v0) < 0.25) return;
      if (Math.abs(v0) > 4) v0 = Math.sign(v0) * 4;
      let last = performance.now();
      const step = () => {
        const now = performance.now();
        const dt = Math.min(48, now - last);
        last = now;
        const view = viewRef.current;
        const span = view.to - view.from;
        const from = view.from - (v0 * dt) / pxPerSec();
        const next = clampView(from, from + span);
        emitView(next, false, true);
        v0 *= Math.pow(0.9975, dt);
        if (Math.abs(v0) < 0.03 || next.from <= 0 || next.to >= durationRef.current - 1e-6) {
          glide = 0;
          emitView(viewRef.current, true);
          return;
        }
        glide = requestAnimationFrame(step);
      };
      glide = requestAnimationFrame(step);
    };

    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2 && mode === "pinch") {
        pinch = null;
        if (pointers.size === 0) {
          mode = "none";
          interactingRef.current = false;
          emitView(viewRef.current, true);
        }
        return;
      }
      if (pointers.size > 0) return;
      interactingRef.current = false;
      stopAuto();
      lastTouchRef.current = performance.now();
      window.clearTimeout(longTimer);
      grabbedRef.current = null;
      if (mode === "tap") {
        const dur = durationRef.current;
        const t = Math.max(0, Math.min(dur, anchorTime));
        const now = performance.now();
        const isDouble = now - lastTapAt < 320 && Math.abs(e.clientX - lastTapX) < 32;
        lastTapAt = now;
        lastTapX = e.clientX;
        if (isDouble) {
          // Double appui : on se place ici et un cadre modifiable apparaît.
          const span = viewRef.current.to - viewRef.current.from;
          const half = Math.min(span * 0.08, dur / 2);
          const start = Math.max(0, Math.min(Math.max(0, dur - 2 * half), t - half));
          setSel({ start, end: start + 2 * half }, true);
          confirmTick();
          (onSeekPlayRef.current ?? onSeekRef.current)(t);
        } else {
          setSel(null, true);
          onSeekRef.current(t);
        }
      } else if (mode === "pan") {
        startGlide();
        emitView(viewRef.current, true);
      } else if (moved) {
        setSel(pendingSel, true);
        emitView(viewRef.current, true);
        confirmTick();
      }
      mode = "none";
      selAtStart = null;
      pendingSel = null;
      requestDraw();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopGlide();
      stopAuto();
      const dur = durationRef.current;
      const v = viewRef.current;
      const span0 = v.to - v.from;
      if (e.shiftKey && !e.ctrlKey) {
        const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        emitView(clampView(v.from + (dx / rect().width) * span0, v.from + span0));
        return;
      }
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const focus = timeAt(e.clientX);
      const span = Math.max(MIN_SPAN, Math.min(dur, span0 * Math.exp(dy * 0.0015)));
      const ratio = (focus - v.from) / Math.max(1e-4, span0);
      emitView(clampView(focus - span * ratio, focus - span * ratio + span), true);
    };

    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.clearTimeout(longTimer);
      stopGlide();
      stopAuto();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      host.removeEventListener("wheel", onWheel);
    };
    // Aucune dépendance : les écouteurs restent en place pour toute la vie
    // du composant, donc un glissement n'est jamais interrompu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={hostRef}
      className="relative w-full touch-none select-none overflow-hidden rounded-2xl"
      style={{ height: height ?? 200 }}
      role="img"
      aria-label={t("media.editor.waveformAria", { duration: duration.toFixed(1) })}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
