/**
 * PhotoEditor — GeniusFiles' own, fully in-app photo editor.
 *
 * No external Android app is ever launched: "Modifier" opens this
 * full-screen surface. The editor is a pure function of an `EditState`
 * (see @/lib/photo/types) which makes undo/redo, before/after and
 * full-resolution export exact.
 *
 * Performance model:
 *  - the live preview renders at most `PREVIEW_MAX` px on the long side,
 *    scheduled on rAF so a slider drag never queues more than one frame;
 *  - the source bitmap is decoded once and reused for every render;
 *  - the export re-runs the very same pipeline at full resolution, off the
 *    interaction path, so quality is never degraded by the preview scale.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Crop,
  Droplets,
  Eye,
  Palette,
  Redo2,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Type as TypeIcon,
  Undo2,
  Wand2,
  X,
  Brush,
} from "lucide-react";
import { toast } from "sonner";

import type { FileEntry, PathRef } from "@/lib/files/types";
import {
  INITIAL_STATE,
  uid,
  ZERO_ADJUST,
  type Adjustments,
  type AdjustKey,
  type EditState,
  type FocusBlur,
  type Geometry,
  type Layer,
  type StickerLayer,
  type StrokeLayer,
  type TextLayer,
} from "@/lib/photo/types";
import { isPristine, render } from "@/lib/photo/pipeline";
import { autoAdjust, CROP_RATIOS, extractPalette } from "@/lib/photo/presets";
import {
  FORMAT_LABEL,
  formatFromName,
  saveEditedImage,
  suggestedName,
  type ExportFormat,
} from "@/lib/photo/save";
import {
  AdjustPanel,
  BrushConfig,
  Chip,
  CropPanel,
  DrawPanel,
  FilterPanel,
  FocusPanel,
  PalettePanel,
  Slider,
  StickerPanel,
  TextPanel,
} from "./EditorPanels";
import { CommitContext } from "./panel-runtime";
import { tick } from "@/lib/photo/haptics";
import { useT } from "@/lib/i18n/react";

const PREVIEW_MAX = 1400;
/** Resolution used while a control is being dragged, for a fluid preview. */
const DRAFT_MAX = 820;
/** Safety cap for the export pass — beyond this, mobile canvases fail. */
const EXPORT_MAX = 6000;
/** Serialised state — the history is parameters only, never pixel copies. */
const serialize = (s: EditState) => JSON.stringify(s);

type ToolId = "crop" | "adjust" | "filters" | "text" | "draw" | "focus" | "stickers" | "extras";

const TOOLS: { id: ToolId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "crop", label: "Crop", icon: Crop },
  { id: "adjust", label: "Adjust", icon: SlidersHorizontal },
  { id: "filters", label: "Filters", icon: Sparkles },
  { id: "text", label: "Text", icon: TypeIcon },
  { id: "draw", label: "Draw", icon: Brush },
  { id: "focus", label: "Blur", icon: Droplets },
  { id: "stickers", label: "Stickers", icon: Shapes },
  { id: "extras", label: "More", icon: Palette },
];

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Keys driven by a slider: those preview live and are turned into a single
 * history step when the finger lifts. Everything else is a discrete step.
 */
const LIVE_KEYS = new Set([
  "size",
  "rotation",
  "opacity",
  "straighten",
  "perspectiveX",
  "perspectiveY",
  "radius",
  "strength",
  "angle",
]);
const isLivePatch = (p: object) => Object.keys(p).every((k) => LIVE_KEYS.has(k));

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Convert a rect expressed in displayed (rotated/flipped) space to image space. */
function displayRectToImage(r: Rect, g: Geometry): Rect {
  let out: Rect;
  switch (g.rot) {
    case 1:
      out = { x: r.y, y: 1 - (r.x + r.w), w: r.h, h: r.w };
      break;
    case 2:
      out = { x: 1 - (r.x + r.w), y: 1 - (r.y + r.h), w: r.w, h: r.h };
      break;
    case 3:
      out = { x: 1 - (r.y + r.h), y: r.x, w: r.h, h: r.w };
      break;
    default:
      out = { ...r };
  }
  if (g.flipH) out = { ...out, x: 1 - (out.x + out.w) };
  if (g.flipV) out = { ...out, y: 1 - (out.y + out.h) };
  return out;
}

function imageRectToDisplay(r: Rect, g: Geometry): Rect {
  let src = { ...r };
  if (g.flipH) src = { ...src, x: 1 - (src.x + src.w) };
  if (g.flipV) src = { ...src, y: 1 - (src.y + src.h) };
  switch (g.rot) {
    case 1:
      return { x: 1 - (src.y + src.h), y: src.x, w: src.h, h: src.w };
    case 2:
      return { x: 1 - (src.x + src.w), y: 1 - (src.y + src.h), w: src.w, h: src.h };
    case 3:
      return { x: src.y, y: 1 - (src.x + src.w), w: src.h, h: src.w };
    default:
      return src;
  }
}

export function PhotoEditor({
  parent,
  entry,
  src,
  onClose,
  onSaved,
}: {
  parent: PathRef;
  entry: FileEntry;
  src: string;
  onClose: () => void;
  onSaved?: (info: { name: string; path: string; replaced: boolean }) => void;
}) {
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [history, setHistory] = useState<EditState[]>([INITIAL_STATE]);
  const [cursor, setCursor] = useState(0);
  /** In-flight value of the control currently being dragged (not yet a step). */
  const [draft, setDraft] = useState<EditState | null>(null);
  const state = draft ?? history[cursor];
  /** Snapshot of the last saved state — drives the clean / dirty indicator. */
  const [savedMark, setSavedMark] = useState(() => serialize(INITIAL_STATE));
  const [exitOpen, setExitOpen] = useState(false);
  const dirty = serialize(state) !== savedMark;

  const [tool, setTool] = useState<ToolId>("adjust");
  const [showOriginal, setShowOriginal] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [palette, setPalette] = useState<string[]>([]);
  const [autoData, setAutoData] = useState<Partial<Adjustments> | null>(null);

  const t = useT();

  const [ratio, setRatio] = useState("free");
  const [cropDraft, setCropDraft] = useState<Rect>({ x: 0, y: 0, w: 1, h: 1 });
  const [brush, setBrush] = useState<BrushConfig>({
    tool: "brush",
    color: "#f97066",
    size: 0.02,
    opacity: 1,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const strokeRef = useRef<StrokeLayer | null>(null);

  /* --------------------------- source decoding --------------------------- */
  useEffect(() => {
    if (!src) {
      setLoadError(t("photo.error.imageUnavailable"));
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (!cancelled) setSource(img);
    };
    img.onerror = () => {
      // Retry without CORS (local file:// / capacitor scheme).
      const plain = new Image();
      plain.decoding = "async";
      plain.onload = () => {
        if (!cancelled) setSource(plain);
      };
      plain.onerror = () => {
        if (!cancelled) setLoadError(t("photo.error.loadFailed"));
      };
      plain.src = src;
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, t]);

  /* ------------------------------- history ------------------------------- */
  /**
   * History is a stack of `EditState` parameter objects — no pixels are ever
   * copied, so 80 steps cost a few kilobytes. A drag writes to `draft` (live,
   * undoable as a whole) and becomes a real step when the finger lifts.
   */
  const commit = useCallback(
    (next: EditState) => {
      setDraft(null);
      setHistory((prev) => {
        const trimmed = prev.slice(0, cursor + 1);
        if (serialize(trimmed[trimmed.length - 1]) === serialize(next)) return trimmed;
        trimmed.push(next);
        const sliced = trimmed.slice(Math.max(0, trimmed.length - 80));
        setCursor(sliced.length - 1);
        return sliced;
      });
    },
    [cursor],
  );

  /** Live edits (slider drags) preview without stacking a history entry. */
  const live = useCallback((next: EditState) => setDraft(next), []);

  const patch = useCallback(
    (partial: Partial<EditState>, asStep = true) => {
      const next = { ...state, ...partial };
      if (asStep) commit(next);
      else live(next);
    },
    [state, commit, live],
  );

  /** Called when a control is released: turns the live draft into one step. */
  const commitDraft = useCallback(() => {
    if (draft !== null) commit(draft);
  }, [draft, commit]);

  const canUndo = cursor > 0 || (draft !== null && serialize(draft) !== serialize(history[cursor]));
  const canRedo = draft === null && cursor < history.length - 1;

  const undo = useCallback(() => {
    tick();
    // An uncommitted drag is itself the most recent change: drop it first.
    if (draft !== null) {
      setDraft(null);
      if (serialize(draft) !== serialize(history[cursor])) return;
    }
    setCursor((c) => Math.max(0, c - 1));
  }, [draft, history, cursor]);

  const redo = useCallback(() => {
    tick();
    setDraft(null);
    setCursor((c) => Math.min(history.length - 1, c + 1));
  }, [history.length]);

  /* ------------------------------ rendering ------------------------------ */
  /** Small base render reused by the filter thumbnails (built once). */
  const filterSource = useMemo(
    () => (source ? render(source, INITIAL_STATE, { maxSize: 220 }) : null),
    [source],
  );

  const renderState = useMemo<EditState>(() => {
    const withAuto = state.auto === autoData ? state : { ...state, auto: autoData };
    if (tool !== "crop") return withAuto;
    // While cropping, the full frame stays visible under the crop overlay.
    return {
      ...withAuto,
      geometry: { ...withAuto.geometry, crop: { x: 0, y: 0, w: 1, h: 1 } },
    };
  }, [state, tool, autoData]);

  /**
   * Adaptive preview: a fast low-resolution pass lands on the next frame so
   * dragging a slider stays fluid, then a full-quality pass replaces it once
   * the interaction settles.
   */
  useEffect(() => {
    if (!source) return;
    const draw = (maxSize: number) => {
      const target = canvasRef.current;
      if (!target) return;
      const out = render(source, showOriginal ? INITIAL_STATE : renderState, { maxSize });
      target.width = out.width;
      target.height = out.height;
      const c = target.getContext("2d");
      c?.drawImage(out, 0, 0);
    };
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => draw(DRAFT_MAX));
    const refine = setTimeout(() => draw(PREVIEW_MAX), 200);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      clearTimeout(refine);
    };
  }, [source, renderState, showOriginal]);

  // Palette + auto-analysis run once the source is ready, off the main path.
  useEffect(() => {
    if (!source) return;
    const t = setTimeout(() => {
      const small = render(source, INITIAL_STATE, { maxSize: 240 });
      setPalette(extractPalette(small));
      // Histogram analysis of this photo powers the "Auto" look and button.
      setAutoData(autoAdjust(small));
    }, 120);
    return () => clearTimeout(t);
  }, [source]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, history.length]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* ------------------------- crop draft management ----------------------- */
  useEffect(() => {
    if (tool !== "crop") return;
    setCropDraft(imageRectToDisplay(state.geometry.crop, state.geometry));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  const applyRatio = (id: string) => {
    setRatio(id);
    const def = CROP_RATIOS.find((r) => r.id === id);
    if (!def || def.value === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frameRatio = canvas.width / canvas.height;
    const target = def.value === 0 ? frameRatio : def.value;
    // Largest centred rect with the requested aspect ratio.
    let w = 1;
    let h = 1;
    if (target > frameRatio) h = frameRatio / target;
    else w = target / frameRatio;
    setCropDraft({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
  };

  const commitCrop = () => {
    const rect = displayRectToImage(cropDraft, state.geometry);
    patch({ geometry: { ...state.geometry, crop: rect } });
    setCropDraft({ x: 0, y: 0, w: 1, h: 1 });
    setTool("adjust");
  };

  /* --------------------------- stage interaction ------------------------- */
  const toNorm = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return { x: clamp01((clientX - r.left) / r.width), y: clamp01((clientY - r.top) / r.height) };
  };

  const dragRef = useRef<
    | { kind: "crop"; handle: string; start: Rect; origin: { x: number; y: number } }
    | { kind: "layer"; id: string; offset: { x: number; y: number } }
    | { kind: "focus" }
    | { kind: "pan"; start: { x: number; y: number }; origin: { x: number; y: number } }
    | null
  >(null);
  const lastTapRef = useRef(0);

  const selectedLayer = state.layers.find((l) => l.id === selectedId) ?? null;
  const selectedText = selectedLayer?.type === "text" ? (selectedLayer as TextLayer) : null;
  const selectedSticker =
    selectedLayer?.type === "sticker" ? (selectedLayer as StickerLayer) : null;

  const updateLayer = (id: string, partial: Partial<Layer>, asStep = true) => {
    const layers = state.layers.map((l) => (l.id === id ? ({ ...l, ...partial } as Layer) : l));
    patch({ layers }, asStep);
  };

  const hitLayer = (p: { x: number; y: number }) => {
    for (let i = state.layers.length - 1; i >= 0; i--) {
      const l = state.layers[i];
      if (l.type === "stroke") continue;
      const size = l.type === "text" ? l.size : l.size;
      const dx = Math.abs(p.x - l.x);
      const dy = Math.abs(p.y - l.y);
      if (dx < Math.max(0.12, size) && dy < Math.max(0.1, size)) return l;
    }
    return null;
  };

  const onStageDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = toNorm(e.clientX, e.clientY);

    if (tool === "draw") {
      const stroke: StrokeLayer = {
        id: uid(),
        type: "stroke",
        tool: brush.tool,
        color: brush.color,
        size: brush.size,
        opacity: brush.tool === "marker" ? Math.min(0.5, brush.opacity) : brush.opacity,
        points: [p],
      };
      strokeRef.current = stroke;
      patch({ layers: [...state.layers, stroke] }, false);
      return;
    }
    if (tool === "focus" && state.focus.mode !== "off") {
      dragRef.current = { kind: "focus" };
      patch({ focus: { ...state.focus, x: p.x, y: p.y } }, false);
      return;
    }
    if (tool === "text" || tool === "stickers") {
      const hit = hitLayer(p);
      if (hit) {
        setSelectedId(hit.id);
        dragRef.current = {
          kind: "layer",
          id: hit.id,
          offset: { x: p.x - (hit as TextLayer).x, y: p.y - (hit as TextLayer).y },
        };
        return;
      }
    }
    if (zoom > 1) {
      dragRef.current = { kind: "pan", start: { x: e.clientX, y: e.clientY }, origin: pan };
      return;
    }
    // Double-tap to zoom.
    const now = performance.now();
    if (now - lastTapRef.current < 280) {
      setZoom((z) => (z > 1 ? 1 : 2.4));
      setPan({ x: 0, y: 0 });
      lastTapRef.current = 0;
    } else lastTapRef.current = now;
  };

  const onStageMove = (e: React.PointerEvent) => {
    if (strokeRef.current) {
      const p = toNorm(e.clientX, e.clientY);
      const stroke = strokeRef.current;
      const last = stroke.points[stroke.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 0.004) return;
      stroke.points.push(p);
      patch({ layers: state.layers.map((l) => (l.id === stroke.id ? { ...stroke } : l)) }, false);
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "focus") {
      const p = toNorm(e.clientX, e.clientY);
      patch({ focus: { ...state.focus, x: p.x, y: p.y } }, false);
    } else if (drag.kind === "layer") {
      const p = toNorm(e.clientX, e.clientY);
      updateLayer(
        drag.id,
        { x: clamp01(p.x - drag.offset.x), y: clamp01(p.y - drag.offset.y) } as
          | Partial<TextLayer>
          | Partial<StickerLayer>,
        false,
      );
    } else if (drag.kind === "pan") {
      setPan({
        x: drag.origin.x + (e.clientX - drag.start.x),
        y: drag.origin.y + (e.clientY - drag.start.y),
      });
    }
  };

  const onStageUp = () => {
    if (strokeRef.current) {
      strokeRef.current = null;
      commit(state);
    } else if (dragRef.current && dragRef.current.kind !== "pan") {
      commit(state);
    }
    dragRef.current = null;
  };

  /* -------------------------------- actions ------------------------------ */
  const runAuto = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Prefer the analysis of the untouched source; fall back to the preview.
    const suggestion = autoData ?? autoAdjust(canvas);
    patch({ adjust: { ...state.adjust, ...suggestion } });
    toast.success(t("photo.toast.autoApplied"));
  };

  const addText = () => {
    const layer: TextLayer = {
      id: uid(),
      type: "text",
      text: t("photo.text.placeholder"),
      x: 0.5,
      y: 0.5,
      size: 0.09,
      font: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      color: "#ffffff",
      align: "center",
      rotation: 0,
      opacity: 1,
      bold: true,
      italic: false,
      shadow: true,
      outline: false,
      outlineColor: "#000000",
    };
    patch({ layers: [...state.layers, layer] });
    setSelectedId(layer.id);
  };

  const addSticker = (glyph: string, shape?: StickerLayer["shape"]) => {
    const layer: StickerLayer = {
      id: uid(),
      type: "sticker",
      glyph,
      shape,
      x: 0.5,
      y: 0.5,
      size: 0.22,
      rotation: 0,
      color: "#f97066",
      opacity: 1,
      filled: false,
    };
    patch({ layers: [...state.layers, layer] });
    setSelectedId(layer.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    patch({ layers: state.layers.filter((l) => l.id !== selectedId) });
    setSelectedId(null);
  };

  const undoStroke = () => {
    const idx = [...state.layers].reverse().findIndex((l) => l.type === "stroke");
    if (idx < 0) return;
    const real = state.layers.length - 1 - idx;
    patch({ layers: state.layers.filter((_, i) => i !== real) });
  };

  /* --------------------------------- save -------------------------------- */
  const [format, setFormat] = useState<ExportFormat>(() => formatFromName(entry.name));
  const [quality, setQuality] = useState(0.92);

  const doSave = async (mode: "new" | "replace") => {
    if (!source) return;
    setBusy(true);
    try {
      // Full-resolution pass, capped so very large photos cannot exhaust
      // memory on mobile devices.
      const full = render(source, { ...state, auto: autoData }, { maxSize: EXPORT_MAX });
      const res = await saveEditedImage({
        parent,
        entry,
        canvas: full,
        format,
        quality,
        mode,
      });
      toast.success(
        mode === "replace"
          ? t("photo.toast.savedReplaced")
          : t("photo.toast.savedAs", { name: res.name }),
      );
      setSavedMark(serialize(state));
      onSaved?.({ name: res.name, path: res.path, replaced: mode === "replace" });
      setSaveOpen(false);
      onClose();
    } catch (e) {
      toast.error((e as Error).message || t("photo.toast.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  /** Has anything at all been edited (used to enable Save / reset). */
  const edited = !isPristine(state);

  /** Closing with unsaved work always asks first — edits are never lost silently. */
  const requestClose = () => {
    if (dirty) {
      tick("medium");
      setExitOpen(true);
      return;
    }
    onClose();
  };

  /* --------------------------------- view -------------------------------- */
  const body = (
    <div className="fixed inset-0 z-[2100] flex animate-fade-in flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center gap-1 px-3 pl-safe pr-safe pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] pb-1.5">
        <HeaderButton label={t("photo.header.close")} onClick={requestClose}>
          <X className="h-5 w-5" />
        </HeaderButton>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-[13px] font-semibold">{entry.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {dirty ? (
              <span className="text-primary">{t("photo.header.title.unsaved")}</span>
            ) : edited ? (
              t("photo.header.title.saved")
            ) : (
              t("photo.header.title.editor")
            )}
          </p>
        </div>
        <HeaderButton label={t("photo.header.undo")} onClick={undo} disabled={!canUndo}>
          <Undo2 className="h-5 w-5" />
        </HeaderButton>
        <HeaderButton label={t("photo.header.redo")} onClick={redo} disabled={!canRedo}>
          <Redo2 className="h-5 w-5" />
        </HeaderButton>
        <HeaderButton
          label={t("photo.header.beforeAfter")}
          onPressStart={() => setShowOriginal(true)}
          onPressEnd={() => setShowOriginal(false)}
          active={showOriginal}
        >
          <Eye className="h-5 w-5" />
        </HeaderButton>
        <button
          type="button"
          onClick={() => setSaveOpen(true)}
          disabled={!dirty || !source}
          className="ml-1 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
        >
          {t("action.save")}
        </button>
      </header>

      {/* Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2">
        <div
          className="relative flex h-full w-full items-center justify-center touch-none select-none"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transition: dragRef.current ? "none" : "transform 220ms cubic-bezier(0.22,0.61,0.36,1)",
          }}
          onPointerDown={onStageDown}
          onPointerMove={onStageMove}
          onPointerUp={onStageUp}
          onPointerCancel={onStageUp}
        >
          <canvas
            ref={canvasRef}
            className="max-h-full max-w-full rounded-xl object-contain shadow-[0_20px_60px_-30px_rgb(0_0_0/0.9)]"
          />
          {tool === "crop" ? (
            <CropOverlay
              canvasRef={canvasRef}
              rect={cropDraft}
              ratio={CROP_RATIOS.find((r) => r.id === ratio)?.value ?? null}
              onChange={setCropDraft}
            />
          ) : null}
        </div>

        {!source && !loadError ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : null}
        {loadError ? (
          <p className="absolute inset-x-0 bottom-6 text-center text-sm text-muted-foreground">
            {loadError}
          </p>
        ) : null}

        {showOriginal ? (
          <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-secondary/80 px-3 py-1 text-[11px] font-medium backdrop-blur">
            Original
          </span>
        ) : null}
      </div>

      {/* Tool panel */}
      <CommitContext.Provider value={commitDraft}>
        <div className="glass-panel rounded-t-3xl border-t border-border/50 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.4rem)] pt-2 pl-safe pr-safe">
          <div className="mb-1.5">
            {tool === "crop" ? (
              <>
                <CropPanel
                  geometry={state.geometry}
                  ratio={ratio}
                  onRatio={applyRatio}
                  onGeometry={(p) =>
                    patch({ geometry: { ...state.geometry, ...p } }, !isLivePatch(p))
                  }
                />
                <div className="mt-2 flex justify-end gap-2">
                  <Chip
                    onClick={() => {
                      setCropDraft({ x: 0, y: 0, w: 1, h: 1 });
                      setRatio("free");
                    }}
                  >
                    {t("action.reset")}
                  </Chip>
                  <Chip active onClick={commitCrop}>
                    <span className="flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> {t("photo.crop.apply")}
                    </span>
                  </Chip>
                </div>
              </>
            ) : null}
            {tool === "adjust" ? (
              <AdjustPanel
                adjust={state.adjust}
                onChange={(key: AdjustKey, value) =>
                  patch({ adjust: { ...state.adjust, [key]: value } }, false)
                }
                onAuto={runAuto}
                onReset={() => patch({ adjust: { ...ZERO_ADJUST } })}
              />
            ) : null}
            {tool === "filters" ? (
              <FilterPanel
                source={filterSource}
                state={renderState}
                onSelect={(id) => patch({ filter: id === "none" ? null : id, filterStrength: 1 })}
                onStrength={(v) => patch({ filterStrength: v }, false)}
              />
            ) : null}
            {tool === "text" ? (
              <TextPanel
                layer={selectedText}
                onAdd={addText}
                onDelete={deleteSelected}
                onChange={(p) => selectedText && updateLayer(selectedText.id, p, !isLivePatch(p))}
              />
            ) : null}
            {tool === "draw" ? (
              <DrawPanel
                brush={brush}
                onBrush={(p) => setBrush((b) => ({ ...b, ...p }))}
                onUndoStroke={undoStroke}
                onClear={() => patch({ layers: state.layers.filter((l) => l.type !== "stroke") })}
              />
            ) : null}
            {tool === "focus" ? (
              <FocusPanel
                focus={state.focus}
                onChange={(p: Partial<FocusBlur>) =>
                  patch({ focus: { ...state.focus, ...p } }, !isLivePatch(p))
                }
              />
            ) : null}
            {tool === "stickers" ? (
              <StickerPanel
                layer={selectedSticker}
                onAdd={addSticker}
                onDelete={deleteSelected}
                onChange={(p) =>
                  selectedSticker && updateLayer(selectedSticker.id, p, !isLivePatch(p))
                }
              />
            ) : null}
            {tool === "extras" ? (
              <div className="max-h-[38vh] overflow-y-auto pr-1">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <Chip onClick={runAuto}>
                    <span className="flex items-center gap-1">
                      <Wand2 className="h-3.5 w-3.5" /> {t("photo.extras.autoEnhance")}
                    </span>
                  </Chip>
                  <Chip
                    onClick={() => {
                      const canvas = canvasRef.current;
                      if (!canvas) return;
                      const s = autoAdjust(canvas);
                      patch({
                        adjust: { ...state.adjust, ...s, clarity: 0.18, sharpness: 0.2 },
                        filter: "portrait",
                        filterStrength: 0.6,
                      });
                    }}
                  >
                    Suggestion « Portrait »
                  </Chip>
                  <Chip
                    onClick={() =>
                      patch({
                        geometry: {
                          ...state.geometry,
                          crop: { x: 0.08, y: 0.08, w: 0.84, h: 0.84 },
                        },
                      })
                    }
                  >
                    Recadrage intelligent
                  </Chip>
                  <Chip onClick={() => patch({ ...INITIAL_STATE })}>
                    {t("photo.extras.resetAll")}
                  </Chip>
                </div>
                <PalettePanel
                  colors={palette}
                  onCopy={(hex) => {
                    void navigator.clipboard?.writeText(hex);
                    toast.success(t("photo.toast.colorCopied", { hex }));
                  }}
                />
                <p className="px-1 pb-2 text-[11px] leading-relaxed text-muted-foreground">
                  {t("photo.export.formatHint")}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {TOOLS.map(({ id, icon: Icon }) => {
              const active = tool === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTool(id)}
                  aria-current={active ? "true" : undefined}
                  className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl px-3.5 py-2 text-[10px] font-medium transition-all duration-200 active:scale-95 ${
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {t(`photo.tool.${id}`)}
                </button>
              );
            })}
          </div>
        </div>
      </CommitContext.Provider>

      {saveOpen ? (
        <SaveDialog
          name={suggestedName(entry.name, format)}
          format={format}
          quality={quality}
          busy={busy}
          onFormat={setFormat}
          onQuality={setQuality}
          onCancel={() => setSaveOpen(false)}
          onSave={doSave}
        />
      ) : null}

      {exitOpen ? (
        <div className="absolute inset-0 z-10 flex items-end bg-background/70 backdrop-blur-sm">
          <div className="glass-panel gf-sheet-in w-full rounded-t-3xl px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4">
            <p className="text-[15px] font-semibold">{t("photo.exit.title")}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{t("photo.exit.desc")}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setExitOpen(false)}
                className="flex-1 rounded-2xl bg-secondary/70 px-4 py-3 text-[13px] font-medium transition-transform active:scale-95"
              >
                {t("photo.exit.continue")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setExitOpen(false);
                  setSaveOpen(true);
                }}
                className="flex-1 rounded-2xl bg-primary px-4 py-3 text-[13px] font-semibold text-primary-foreground transition-transform active:scale-95"
              >
                {t("action.save")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setExitOpen(false);
                onClose();
              }}
              className="mt-2 w-full rounded-2xl px-4 py-3 text-[13px] font-medium text-destructive transition-transform active:scale-95"
            >
              {t("photo.exit.discard")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}

/* ------------------------------- sub views ------------------------------ */

function HeaderButton({
  children,
  label,
  onClick,
  onPressStart,
  onPressEnd,
  disabled,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  onPressStart?: () => void;
  onPressEnd?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPressStart}
      onPointerUp={onPressEnd}
      onPointerCancel={onPressEnd}
      onPointerLeave={onPressEnd}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-30 ${
        active ? "bg-primary/20 text-primary" : "bg-secondary/60 text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function CropOverlay({
  canvasRef,
  rect,
  ratio,
  onChange,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  rect: Rect;
  ratio: number | null;
  onChange: (r: Rect) => void;
}) {
  const drag = useRef<{ handle: string; start: Rect; origin: { x: number; y: number } } | null>(
    null,
  );

  const bounds = () => canvasRef.current?.getBoundingClientRect() ?? null;

  const onDown = (handle: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { handle, start: rect, origin: { x: e.clientX, y: e.clientY } };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const b = bounds();
    if (!d || !b) return;
    e.stopPropagation();
    const dx = (e.clientX - d.origin.x) / b.width;
    const dy = (e.clientY - d.origin.y) / b.height;
    let { x, y, w, h } = d.start;
    const min = 0.08;
    if (d.handle === "move") {
      x = clamp01(Math.min(1 - w, Math.max(0, x + dx)));
      y = clamp01(Math.min(1 - h, Math.max(0, y + dy)));
    } else {
      if (d.handle.includes("w")) {
        const nx = Math.min(x + w - min, Math.max(0, x + dx));
        w += x - nx;
        x = nx;
      }
      if (d.handle.includes("e")) w = Math.min(1 - x, Math.max(min, w + dx));
      if (d.handle.includes("n")) {
        const ny = Math.min(y + h - min, Math.max(0, y + dy));
        h += y - ny;
        y = ny;
      }
      if (d.handle.includes("s")) h = Math.min(1 - y, Math.max(min, h + dy));
      if (ratio && ratio > 0) {
        const frame = b.width / b.height;
        const targetH = (w * frame) / ratio;
        h = Math.min(1 - y, targetH);
      }
    }
    onChange({ x, y, w, h });
  };

  const onUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    drag.current = null;
  };

  const b = bounds();
  const canvas = canvasRef.current;
  if (!canvas) return null;
  const style: React.CSSProperties = {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  };
  const size = b ? { width: b.width, height: b.height } : undefined;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        width: size?.width,
        height: size?.height,
      }}
    >
      <div className="absolute inset-0 overflow-hidden rounded-xl">
        <div className="absolute inset-0 bg-background/60" />
        <div
          className="pointer-events-auto absolute bg-transparent shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]"
          style={style}
          onPointerDown={onDown("move")}
          onPointerMove={onMove}
          onPointerUp={onUp}
        >
          <div className="absolute inset-0 border border-white/80">
            <span className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
            <span className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
            <span className="absolute left-0 top-1/3 h-px w-full bg-white/30" />
            <span className="absolute left-0 top-2/3 h-px w-full bg-white/30" />
          </div>
          {(["nw", "ne", "sw", "se"] as const).map((h) => (
            <span
              key={h}
              onPointerDown={onDown(h)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              className={`absolute h-8 w-8 rounded-md border-2 border-white ${
                h === "nw"
                  ? "-left-1 -top-1 border-b-0 border-r-0"
                  : h === "ne"
                    ? "-right-1 -top-1 border-b-0 border-l-0"
                    : h === "sw"
                      ? "-bottom-1 -left-1 border-r-0 border-t-0"
                      : "-bottom-1 -right-1 border-l-0 border-t-0"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SaveDialog({
  name,
  format,
  quality,
  busy,
  onFormat,
  onQuality,
  onCancel,
  onSave,
}: {
  name: string;
  format: ExportFormat;
  quality: number;
  busy: boolean;
  onFormat: (f: ExportFormat) => void;
  onQuality: (q: number) => void;
  onCancel: () => void;
  onSave: (mode: "new" | "replace") => void;
}) {
  const t = useT();
  const [confirmReplace, setConfirmReplace] = useState(false);
  return (
    <div className="absolute inset-0 z-10 flex items-end bg-background/70 backdrop-blur-sm">
      <div className="glass-panel w-full gf-sheet-in rounded-t-3xl px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <h2 className="text-[15px] font-semibold">{t("photo.save.title")}</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{t("photo.save.subtitle")}</p>

        <div className="mt-3 flex gap-2">
          {(["jpeg", "png", "webp"] as ExportFormat[]).map((f) => (
            <Chip key={f} active={format === f} onClick={() => onFormat(f)}>
              {FORMAT_LABEL[f]}
            </Chip>
          ))}
        </div>
        {format !== "png" ? (
          <Slider
            label={t("photo.save.quality")}
            min={0.5}
            max={1}
            step={0.01}
            value={quality}
            format={(v) => `${Math.round(v * 100)} %`}
            onChange={onQuality}
          />
        ) : null}

        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave("new")}
            className="w-full rounded-2xl bg-primary px-4 py-3 text-[13px] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {t("photo.save.saveAsNew")}
            <span className="mt-0.5 block text-[11px] font-normal opacity-80">{name}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => (confirmReplace ? onSave("replace") : setConfirmReplace(true))}
            className={`w-full rounded-2xl px-4 py-3 text-[13px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-50 ${
              confirmReplace ? "bg-destructive text-white" : "bg-secondary text-foreground"
            }`}
          >
            {confirmReplace ? t("photo.save.confirmReplace") : t("photo.save.replaceOriginal")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="w-full rounded-2xl px-4 py-3 text-[13px] font-medium text-muted-foreground"
          >
            {t("action.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
