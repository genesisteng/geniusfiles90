/**
 * Gestes du lecteur vidéo — portrait *et* paysage.
 *
 * Un seul point d'entrée pour éviter les conflits :
 *  - tap simple            → affiche/masque les contrôles
 *  - double tap gauche     → recul (chaîne cumulative 5 s, 10 s, 15 s…)
 *  - double tap droite     → avance
 *  - glissement horizontal → recherche fluide via le SeekController
 *  - glissement vertical G → luminosité réelle de la fenêtre
 *  - glissement vertical D → volume multimédia système
 *
 * Les zones sont calculées à partir du rectangle réel de la surface, donc
 * identiques quelle que soit l'orientation.
 */
import { useCallback, useRef } from "react";
import type { SeekController } from "@/lib/player/seek-controller";

export type GestureOverlay =
  | { kind: "seek"; delta: number; preview: number }
  | { kind: "volume" | "brightness"; value: number }
  | { kind: "skip"; side: "left" | "right"; amount: number }
  | null;

const DOUBLE_TAP_MS = 300;
const CHAIN_MS = 700;
const DRAG_THRESHOLD = 14;

export function useVideoGestures(opts: {
  locked: boolean;
  skipSeconds: number;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  seek: SeekController;
  duration: number;
  getVolume: () => number;
  setVolume: (v: number) => void;
  getBrightness: () => number;
  setBrightness: (v: number) => void;
  setOverlay: (o: GestureOverlay) => void;
  bumpChrome: () => void;
  hideChrome: () => void;
  chromeVisibleRef: React.MutableRefObject<boolean>;
  onScrubStart: () => void;
  onScrubEnd: () => void;
}) {
  const {
    locked,
    skipSeconds,
    videoRef,
    seek,
    duration,
    getVolume,
    setVolume,
    getBrightness,
    setBrightness,
    setOverlay,
    bumpChrome,
    hideChrome,
    chromeVisibleRef,
    onScrubStart,
    onScrubEnd,
  } = opts;

  const gesture = useRef<
    | { kind: "pending"; x: number; y: number; localX: number; width: number; t: number }
    | { kind: "seek"; startTime: number; startX: number }
    | { kind: "volume"; startY: number; startV: number }
    | { kind: "brightness"; startY: number; startV: number }
    | null
  >(null);
  const lastTap = useRef<{ t: number } | null>(null);
  const tapChain = useRef<{ side: "left" | "right"; amount: number; t: number } | null>(null);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSkip = useCallback(
    (side: "left" | "right", amount: number) => {
      setOverlay({ kind: "skip", side, amount });
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      overlayTimer.current = setTimeout(() => setOverlay(null), 620);
    },
    [setOverlay],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (locked) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      gesture.current = {
        kind: "pending",
        x: e.clientX,
        y: e.clientY,
        localX: e.clientX - rect.left,
        width: rect.width,
        t: performance.now(),
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [locked],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const g = gesture.current;
      const v = videoRef.current;
      if (!g || !v || locked) return;

      if (g.kind === "pending") {
        const dx = e.clientX - g.x;
        const dy = e.clientY - g.y;
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          gesture.current = { kind: "seek", startTime: v.currentTime, startX: e.clientX };
          onScrubStart();
        } else if (g.localX < g.width / 2) {
          gesture.current = { kind: "brightness", startY: e.clientY, startV: getBrightness() };
        } else {
          gesture.current = { kind: "volume", startY: e.clientY, startV: getVolume() };
        }
        return;
      }

      const cur = g;
      if (cur.kind === "seek") {
        // Sensibilité proportionnelle à la durée : précis sur un clip court,
        // efficace sur un film de 3 h.
        const scale = Math.max(0.15, Math.min(1, (duration || 60) / 240));
        const delta = (e.clientX - cur.startX) * scale;
        const target = Math.max(0, Math.min(duration || 0, cur.startTime + delta));
        seek.seek(target, "fast");
        setOverlay({ kind: "seek", delta, preview: target });
      } else if (cur.kind === "volume") {
        const dy = cur.startY - e.clientY;
        const next = Math.max(0, Math.min(1, cur.startV + dy / 220));
        setVolume(next);
        setOverlay({ kind: "volume", value: next });
      } else if (cur.kind === "brightness") {
        const dy = cur.startY - e.clientY;
        const next = Math.max(0.02, Math.min(1, cur.startV + dy / 220));
        setBrightness(next);
        setOverlay({ kind: "brightness", value: next });
      }
    },
    [
      locked,
      videoRef,
      duration,
      seek,
      getVolume,
      getBrightness,
      setVolume,
      setBrightness,
      setOverlay,
      onScrubStart,
    ],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const g = gesture.current;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const wasSeek = g?.kind === "seek";
      const isTap =
        !!g &&
        g.kind === "pending" &&
        performance.now() - g.t < 300 &&
        Math.abs(e.clientX - g.x) < 10 &&
        Math.abs(e.clientY - g.y) < 10;
      gesture.current = null;

      if (wasSeek) {
        seek.commit();
        onScrubEnd();
      }
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      overlayTimer.current = setTimeout(() => setOverlay(null), 400);

      if (locked) {
        if (isTap) bumpChrome();
        return;
      }
      if (!isTap) {
        bumpChrome();
        return;
      }

      const now = performance.now();
      const x = e.clientX - rect.left;
      const side: "left" | "right" = x < rect.width / 2 ? "left" : "right";

      const chain = tapChain.current;
      if (chain && chain.side === side && now - chain.t < CHAIN_MS) {
        chain.amount += skipSeconds;
        chain.t = now;
        seek.seekBy(side === "left" ? -skipSeconds : skipSeconds, "fast");
        flashSkip(side, chain.amount);
        lastTap.current = null;
        return;
      }
      if (lastTap.current && now - lastTap.current.t < DOUBLE_TAP_MS) {
        tapChain.current = { side, amount: skipSeconds, t: now };
        seek.seekBy(side === "left" ? -skipSeconds : skipSeconds, "fast");
        flashSkip(side, skipSeconds);
        lastTap.current = null;
        return;
      }
      tapChain.current = null;
      lastTap.current = { t: now };
      if (chromeVisibleRef.current) hideChrome();
      else bumpChrome();
    },
    [
      locked,
      seek,
      skipSeconds,
      flashSkip,
      setOverlay,
      bumpChrome,
      hideChrome,
      chromeVisibleRef,
      onScrubEnd,
    ],
  );

  return { onPointerDown, onPointerMove, onPointerUp };
}
