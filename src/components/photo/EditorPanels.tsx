/**
 * Photo editor — shared panel primitives and tool panels.
 *
 * Presentation only: every control reports a new state upward, the editor
 * shell owns history and rendering.
 */
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { CommitContext } from "./panel-runtime";
import { RotateCcw, Wand2 } from "lucide-react";

import {
  CROP_RATIOS,
  EMOJIS,
  fonts,
  presetCategories,
  presets,
  shapes,
  SWATCHES,
  type Preset,
  type PresetCategory,
} from "@/lib/photo/presets";
import { render } from "@/lib/photo/pipeline";
import { tick } from "@/lib/photo/haptics";
import { useT } from "@/lib/i18n/react";
import type {
  Adjustments,
  AdjustKey,
  EditState,
  FocusBlur,
  Geometry,
  StickerLayer,
  TextLayer,
} from "@/lib/photo/types";

/* ------------------------------ primitives ------------------------------ */

export function Slider({
  label,
  value,
  min = -1,
  max = 1,
  step = 0.01,
  neutral,
  format,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Value marked as the neutral / starting point on the track. */
  neutral?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  onReset?: () => void;
}) {
  const commit = useContext(CommitContext);
  const span = max - min;
  const zero = neutral ?? (min < 0 ? 0 : undefined);
  const lastStep = useRef(Math.round(value / step));

  const display = format
    ? format(value)
    : `${zero !== undefined && value > zero ? "+" : ""}${Math.round(value * 100)}`;
  const pct = ((value - min) / span) * 100;
  const zeroPct = zero === undefined ? null : ((zero - min) / span) * 100;
  const atZero = zero !== undefined && Math.abs(value - zero) < step / 2;

  const handle = (raw: number) => {
    let v = raw;
    // Magnetic neutral: makes coming back to the starting value effortless.
    if (zero !== undefined && Math.abs(v - zero) < span * 0.018) v = zero;
    const idx = Math.round(v / step);
    if (idx !== lastStep.current) {
      lastStep.current = idx;
      tick(zero !== undefined && v === zero ? "medium" : "light");
    }
    onChange(v);
  };

  return (
    <div className="px-1 py-1.5">
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="font-medium text-foreground/90">{label}</span>
        <button
          type="button"
          onClick={() => {
            if (!onReset) return;
            tick("medium");
            onReset();
            commit();
          }}
          className={`min-w-[46px] rounded-full px-2 py-0.5 text-right text-[12px] tabular-nums transition-colors ${
            atZero ? "text-muted-foreground" : "bg-primary/12 font-semibold text-primary"
          }`}
        >
          {display}
        </button>
      </div>
      <div className="relative flex h-7 items-center">
        {zeroPct !== null ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/30"
            style={{ left: `${zeroPct}%` }}
          />
        ) : null}
        {zeroPct !== null ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-primary/70"
            style={{
              left: `${Math.min(zeroPct, pct)}%`,
              width: `${Math.abs(pct - zeroPct)}%`,
            }}
          />
        ) : null}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => handle(Number(e.target.value))}
          onPointerUp={commit}
          onPointerCancel={commit}
          onKeyUp={commit}
          onBlur={commit}
          className="gf-photo-range relative w-full"
          aria-label={label}
        />
      </div>
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tick();
        onClick();
      }}
      data-active={active ? "true" : undefined}
      className={`shrink-0 snap-start scroll-ml-2 rounded-full px-3.5 py-2 text-[12px] font-medium transition-all duration-200 active:scale-95 ${
        active
          ? "bg-primary text-primary-foreground shadow-[0_6px_18px_-8px_var(--primary)]"
          : "bg-secondary/70 text-foreground/80"
      }`}
    >
      {children}
    </button>
  );
}

export function IconChip({
  label,
  icon: Icon,
  onClick,
  active,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tick();
        onClick();
      }}
      aria-label={label}
      data-active={active ? "true" : undefined}
      className={`flex shrink-0 snap-start flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[10px] font-medium transition-transform active:scale-95 ${
        active ? "bg-primary/15 text-primary" : "bg-secondary/60 text-foreground/80"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

export function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <ScrollRow>
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Couleur ${c}`}
          onClick={() => {
            tick();
            onChange(c);
          }}
          data-active={value.toLowerCase() === c.toLowerCase() ? "true" : undefined}
          style={{ background: c }}
          className={`h-8 w-8 shrink-0 snap-start rounded-full border transition-transform active:scale-90 ${
            value.toLowerCase() === c.toLowerCase()
              ? "border-primary ring-2 ring-primary/50"
              : "border-border/60"
          }`}
        />
      ))}
    </ScrollRow>
  );
}

export function PanelRow({ children }: { children: React.ReactNode }) {
  return <ScrollRow>{children}</ScrollRow>;
}

/**
 * Horizontal scroller with hidden scrollbar, proximity snapping (so an option
 * is never left half-cut) and automatic reveal of the active option.
 */
export function ScrollRow({
  children,
  className = "",
  gap = "gap-2",
}: {
  children: React.ReactNode;
  className?: string;
  gap?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastActive = useRef<Element | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const active = el.querySelector('[data-active="true"]');
    if (!active) {
      lastActive.current = null;
      return;
    }
    const er = el.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    const clipped = ar.left < er.left + 4 || ar.right > er.right - 4;
    if (!clipped && lastActive.current === active) return;
    lastActive.current = active;
    if (!clipped) return;
    // Reveal the active option, plus a hint of what comes next.
    const delta = ar.left - er.left - (er.width - ar.width) / 2;
    el.scrollTo({ left: el.scrollLeft + delta, behavior: "smooth" });
  });

  return (
    <div
      ref={ref}
      className={`gf-photo-scroll flex snap-x snap-proximity ${gap} overflow-x-auto scroll-px-2 pb-1 ${className}`}
    >
      {children}
    </div>
  );
}

/* -------------------------------- filters ------------------------------- */

export function FilterPanel({
  source,
  state,
  onSelect,
  onStrength,
}: {
  source: HTMLCanvasElement | null;
  state: EditState;
  onSelect: (id: string) => void;
  onStrength: (v: number) => void;
}) {
  const t = useT();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const active = state.filter ?? "none";
  const activePreset = presets().find((p) => p.id === active) ?? presets()[0];
  const [category, setCategory] = useState<PresetCategory>(activePreset.category);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    const build = async () => {
      // Thumbnails are generated progressively so the panel stays responsive.
      for (const preset of presets()) {
        if (cancelled) return;
        const c = render(
          source,
          {
            ...state,
            filter: preset.id === "none" ? null : preset.id,
            filterStrength: 1,
            layers: [],
            focus: { ...state.focus, mode: "off" },
          },
          { maxSize: 104 },
        );
        const url = c.toDataURL("image/jpeg", 0.7);
        if (cancelled) return;
        setThumbs((prev) => ({ ...prev, [preset.id]: url }));
        await new Promise((r) => setTimeout(r, 0));
      }
    };
    void build();
    return () => {
      cancelled = true;
    };
    // Thumbnails only need to follow the source + geometry, not every slider.
  }, [source, state.auto]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = presets().filter((p) => p.category === category || p.id === "none");

  return (
    <div className="space-y-2">
      <ScrollRow>
        {presetCategories().map((c) => (
          <Chip key={c.id} active={c.id === category} onClick={() => setCategory(c.id)}>
            {t(`photo.filter.category.${c.id}`)}
          </Chip>
        ))}
      </ScrollRow>
      <ScrollRow gap="gap-3">
        {visible.map((p: Preset) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className="flex shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95"
          >
            <span
              className={`block h-[62px] w-[62px] overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
                active === p.id
                  ? "border-primary shadow-[0_8px_20px_-10px_var(--primary)]"
                  : "border-transparent"
              }`}
            >
              {thumbs[p.id] ? (
                <img src={thumbs[p.id]} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="block h-full w-full animate-pulse bg-secondary/70" />
              )}
            </span>
            <span
              className={`text-[11px] ${active === p.id ? "font-medium text-primary" : "text-muted-foreground"}`}
            >
              {t(`photo.preset.${p.id}`)}
            </span>
          </button>
        ))}
      </ScrollRow>
      {active !== "none" ? (
        <Slider
          label={t("photo.filter.intensity")}
          min={0}
          max={1}
          neutral={1}
          value={state.filterStrength}
          onChange={onStrength}
          onReset={() => onStrength(1)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------ adjustments ----------------------------- */

type AdjustDef = { key: AdjustKey; label: string; short: string; positiveOnly?: boolean };

const ADJUST_GROUPS: { title: string; keys: AdjustDef[] }[] = [
  {
    title: "Light",
    keys: [
      { key: "exposure", label: "Exposure", short: "Expo." },
      { key: "brightness", label: "Brightness", short: "Bright." },
      { key: "contrast", label: "Contrast", short: "Contr." },
      { key: "highlights", label: "Highlights", short: "High." },
      { key: "shadows", label: "Shadows", short: "Shad." },
      { key: "whites", label: "Whites", short: "Whites" },
      { key: "blacks", label: "Blacks", short: "Blacks" },
      { key: "gamma", label: "Gamma", short: "Gamma" },
    ],
  },
  {
    title: "Color",
    keys: [
      { key: "saturation", label: "Saturation", short: "Sat." },
      { key: "vibrance", label: "Vibrance", short: "Vibr." },
      { key: "temperature", label: "Temperature", short: "Temp." },
      { key: "tint", label: "Tint", short: "Tint" },
    ],
  },
  {
    title: "Detail",
    keys: [
      { key: "sharpness", label: "Sharpness", short: "Sharp." },
      { key: "clarity", label: "Clarity", short: "Clarity" },
      { key: "structure", label: "Structure", short: "Struct." },
      { key: "denoise", label: "Noise reduction", short: "Noise", positiveOnly: true },
    ],
  },
  {
    title: "Effects",
    keys: [
      { key: "fade", label: "Fade", short: "Fade", positiveOnly: true },
      { key: "grain", label: "Grain", short: "Grain", positiveOnly: true },
      { key: "vignette", label: "Vignette", short: "Vignette" },
    ],
  },
];

export function AdjustPanel({
  adjust,
  onChange,
  onAuto,
  onReset,
}: {
  adjust: Adjustments;
  onChange: (key: AdjustKey, value: number) => void;
  onAuto: () => void;
  onReset: () => void;
}) {
  const t = useT();
  const [group, setGroup] = useState(0);
  const [selected, setSelected] = useState<AdjustKey>("exposure");
  const current = ADJUST_GROUPS[group];
  const def = current.keys.find((k) => k.key === selected) ?? current.keys[0];

  const pickGroup = (i: number) => {
    setGroup(i);
    setSelected(ADJUST_GROUPS[i].keys[0].key);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ScrollRow className="flex-1">
          {ADJUST_GROUPS.map((g, i) => (
            <Chip key={g.title} active={i === group} onClick={() => pickGroup(i)}>
              {t(
                `photo.adjust.group.${ADJUST_GROUPS[i].keys[0].key === "exposure" ? "light" : ADJUST_GROUPS[i].keys[0].key === "saturation" ? "color" : ADJUST_GROUPS[i].keys[0].key === "sharpness" ? "detail" : "effects"}`,
              )}
            </Chip>
          ))}
        </ScrollRow>
        <IconChip label={t("photo.adjust.auto")} icon={Wand2} onClick={onAuto} />
        <IconChip label={t("photo.adjust.reset")} icon={RotateCcw} onClick={onReset} />
      </div>

      {/* One slider at a time keeps the photo visible on small screens. */}
      <ScrollRow>
        {current.keys.map((k) => {
          const touched = Math.abs(adjust[k.key]) > 0.005;
          return (
            <button
              key={k.key}
              type="button"
              onClick={() => setSelected(k.key)}
              className={`relative shrink-0 rounded-full px-3 py-1.5 text-[12px] transition-all duration-200 active:scale-95 ${
                def.key === k.key
                  ? "bg-foreground/10 font-medium text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {t(`photo.adjust.short.${k.key}`)}
              {touched ? (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
              ) : null}
            </button>
          );
        })}
      </ScrollRow>

      <Slider
        label={t(`photo.adjust.${def.key}`)}
        value={adjust[def.key]}
        min={def.positiveOnly ? 0 : -1}
        max={1}
        onChange={(v) => onChange(def.key, v)}
        onReset={() => onChange(def.key, 0)}
      />
    </div>
  );
}

/* --------------------------------- crop --------------------------------- */

export function CropPanel({
  geometry,
  ratio,
  onRatio,
  onGeometry,
}: {
  geometry: Geometry;
  ratio: string;
  onRatio: (id: string) => void;
  onGeometry: (patch: Partial<Geometry>) => void;
}) {
  const t = useT();
  const [axis, setAxis] = useState<"straighten" | "perspectiveX" | "perspectiveY">("straighten");
  const AXES = [
    { id: "straighten", label: t("photo.crop.straighten") },
    { id: "perspectiveX", label: t("photo.crop.perspectiveH") },
    { id: "perspectiveY", label: t("photo.crop.perspectiveV") },
  ] as const;

  return (
    <div className="space-y-1">
      <ScrollRow>
        {CROP_RATIOS.map((r) => (
          <Chip key={r.id} active={ratio === r.id} onClick={() => onRatio(r.id)}>
            {t(`photo.crop.ratio.${r.id}`)}
          </Chip>
        ))}
      </ScrollRow>
      <ScrollRow>
        <Chip onClick={() => onGeometry({ rot: ((geometry.rot + 3) % 4) as 0 | 1 | 2 | 3 })}>
          t("photo.crop.rotateLeft")
        </Chip>
        <Chip onClick={() => onGeometry({ rot: ((geometry.rot + 1) % 4) as 0 | 1 | 2 | 3 })}>
          t("photo.crop.rotateRight")
        </Chip>
        <Chip active={geometry.flipH} onClick={() => onGeometry({ flipH: !geometry.flipH })}>
          t("photo.crop.mirror")
        </Chip>
        <Chip active={geometry.flipV} onClick={() => onGeometry({ flipV: !geometry.flipV })}>
          t("photo.crop.vertical")
        </Chip>
        <span className="mx-1 my-1 w-px shrink-0 bg-border/70" />
        {AXES.map((a) => {
          const touched = Math.abs(geometry[a.id]) > 0.005;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAxis(a.id)}
              data-active={axis === a.id ? "true" : undefined}
              className={`relative shrink-0 snap-start rounded-full px-3 py-2 text-[12px] transition-all active:scale-95 ${
                axis === a.id
                  ? "bg-foreground/10 font-medium text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {a.label}
              {touched ? (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
              ) : null}
            </button>
          );
        })}
      </ScrollRow>
      {axis === "straighten" ? (
        <Slider
          label={t("photo.crop.straightenLabel")}
          min={-45}
          max={45}
          step={0.5}
          neutral={0}
          value={geometry.straighten}
          format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}°`}
          onChange={(v) => onGeometry({ straighten: v })}
          onReset={() => onGeometry({ straighten: 0 })}
        />
      ) : (
        <Slider
          label={
            axis === "perspectiveX"
              ? t("photo.crop.perspectiveHorizontal")
              : t("photo.crop.perspectiveVertical")
          }
          neutral={0}
          value={geometry[axis]}
          onChange={(v) => onGeometry({ [axis]: v } as Partial<Geometry>)}
          onReset={() => onGeometry({ [axis]: 0 } as Partial<Geometry>)}
        />
      )}
    </div>
  );
}

/* --------------------------------- draw --------------------------------- */

export type BrushConfig = {
  tool: "brush" | "marker" | "blur" | "pixelate" | "mosaic";
  color: string;
  size: number;
  opacity: number;
};

export function DrawPanel({
  brush,
  onBrush,
  onUndoStroke,
  onClear,
}: {
  brush: BrushConfig;
  onBrush: (patch: Partial<BrushConfig>) => void;
  onUndoStroke: () => void;
  onClear: () => void;
}) {
  const t = useT();
  const BRUSH_IDS: BrushConfig["tool"][] = ["brush", "marker", "blur", "pixelate", "mosaic"];
  return (
    <div>
      <PanelRow>
        {BRUSH_IDS.map((id) => (
          <Chip key={id} active={brush.tool === id} onClick={() => onBrush({ tool: id })}>
            {t(`photo.draw.${id}`)}
          </Chip>
        ))}
        <Chip onClick={onUndoStroke}>{t("photo.draw.undoLast")}</Chip>
        <Chip onClick={onClear}>{t("photo.draw.clearAll")}</Chip>
      </PanelRow>
      {brush.tool === "brush" || brush.tool === "marker" ? (
        <div className="mt-2">
          <Swatches value={brush.color} onChange={(color) => onBrush({ color })} />
        </div>
      ) : null}
      <Slider
        label={t("photo.draw.thickness")}
        min={0.005}
        max={0.16}
        step={0.002}
        value={brush.size}
        format={(v) => `${Math.round(v * 1000)}`}
        onChange={(size) => onBrush({ size })}
      />
      <Slider
        label={t("photo.draw.opacity")}
        min={0.1}
        max={1}
        neutral={1}
        value={brush.opacity}
        onChange={(opacity) => onBrush({ opacity })}
      />
    </div>
  );
}

/* --------------------------------- text --------------------------------- */

export function TextPanel({
  layer,
  onChange,
  onAdd,
  onDelete,
}: {
  layer: TextLayer | null;
  onChange: (patch: Partial<TextLayer>) => void;
  onAdd: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  if (!layer) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <p className="text-[12px] text-muted-foreground">{t("photo.text.noneSelected")}</p>
        <Chip active onClick={onAdd}>
          {t("photo.text.add")}
        </Chip>
      </div>
    );
  }
  return (
    <div className="max-h-[40vh] overflow-y-auto pr-1">
      <textarea
        value={layer.text}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={2}
        placeholder={t("photo.text.placeholder")}
        className="mb-2 w-full resize-none rounded-2xl bg-secondary/70 px-3 py-2 text-[13px] text-foreground outline-none ring-primary/50 focus:ring-2"
      />
      <PanelRow>
        {fonts().map((f) => (
          <Chip key={f.id} active={layer.font === f.css} onClick={() => onChange({ font: f.css })}>
            <span style={{ fontFamily: f.css }}>{t(`photo.text.font.${f.id}`)}</span>
          </Chip>
        ))}
      </PanelRow>
      <ScrollRow className="mt-2">
        <Chip active={layer.bold} onClick={() => onChange({ bold: !layer.bold })}>
          Gras
        </Chip>
        <Chip active={layer.italic} onClick={() => onChange({ italic: !layer.italic })}>
          Italique
        </Chip>
        <Chip active={layer.shadow} onClick={() => onChange({ shadow: !layer.shadow })}>
          Ombre
        </Chip>
        <Chip active={layer.outline} onClick={() => onChange({ outline: !layer.outline })}>
          Contour
        </Chip>
        {(["left", "center", "right"] as CanvasTextAlign[]).map((a) => (
          <Chip key={a} active={layer.align === a} onClick={() => onChange({ align: a })}>
            {a === "left"
              ? t("photo.text.align.left")
              : a === "center"
                ? t("photo.text.align.center")
                : t("photo.text.align.right")}
          </Chip>
        ))}
        <Chip onClick={onDelete}>{t("photo.text.delete")}</Chip>
        <Chip onClick={onAdd}>{t("photo.text.addAnother")}</Chip>
      </ScrollRow>
      <div className="mt-2">
        <Swatches value={layer.color} onChange={(color) => onChange({ color })} />
      </div>
      {layer.outline ? (
        <div className="mt-2">
          <p className="mb-1 text-[11px] text-muted-foreground">{t("photo.text.outlineColor")}</p>
          <Swatches value={layer.outlineColor} onChange={(c) => onChange({ outlineColor: c })} />
        </div>
      ) : null}
      <Slider
        label={t("photo.text.size")}
        min={0.02}
        max={0.4}
        step={0.005}
        value={layer.size}
        format={(v) => `${Math.round(v * 100)}`}
        onChange={(size) => onChange({ size })}
      />
      <Slider
        label={t("photo.text.rotation")}
        min={-180}
        max={180}
        step={1}
        value={layer.rotation}
        format={(v) => `${Math.round(v)}°`}
        onChange={(rotation) => onChange({ rotation })}
        onReset={() => onChange({ rotation: 0 })}
      />
      <Slider
        label={t("photo.draw.opacity")}
        min={0.1}
        max={1}
        neutral={1}
        value={layer.opacity}
        onChange={(opacity) => onChange({ opacity })}
      />
    </div>
  );
}

/* ------------------------------- stickers ------------------------------- */

export function StickerPanel({
  layer,
  onAdd,
  onChange,
  onDelete,
}: {
  layer: StickerLayer | null;
  onAdd: (glyph: string, shape?: StickerLayer["shape"]) => void;
  onChange: (patch: Partial<StickerLayer>) => void;
  onDelete: () => void;
}) {
  const t = useT();
  return (
    <div className="max-h-[40vh] overflow-y-auto pr-1">
      <PanelRow>
        {shapes().map((s) => (
          <Chip key={s.id} onClick={() => onAdd("", s.id)}>
            {t(`photo.sticker.shape.${s.id}`)}
          </Chip>
        ))}
      </PanelRow>
      <div className="mt-2 grid grid-cols-8 gap-1.5">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onAdd(e)}
            className="rounded-xl bg-secondary/50 py-1.5 text-[20px] transition-transform active:scale-90"
          >
            {e}
          </button>
        ))}
      </div>
      {layer ? (
        <>
          {layer.shape ? (
            <>
              <div className="mt-3">
                <Swatches value={layer.color} onChange={(color) => onChange({ color })} />
              </div>
              <div className="mt-2 flex gap-2">
                <Chip active={layer.filled} onClick={() => onChange({ filled: !layer.filled })}>
                  {t("photo.sticker.filled")}
                </Chip>
                <Chip onClick={onDelete}>{t("photo.sticker.delete")}</Chip>
              </div>
            </>
          ) : (
            <div className="mt-3 flex gap-2">
              <Chip onClick={onDelete}>{t("photo.sticker.delete")}</Chip>
            </div>
          )}
          <Slider
            label={t("photo.sticker.size")}
            min={0.04}
            max={0.7}
            step={0.005}
            value={layer.size}
            format={(v) => `${Math.round(v * 100)}`}
            onChange={(size) => onChange({ size })}
          />
          <Slider
            label={t("photo.sticker.rotation")}
            min={-180}
            max={180}
            step={1}
            value={layer.rotation}
            format={(v) => `${Math.round(v)}°`}
            onChange={(rotation) => onChange({ rotation })}
            onReset={() => onChange({ rotation: 0 })}
          />
          <Slider
            label={t("photo.draw.opacity")}
            min={0.1}
            max={1}
            neutral={1}
            value={layer.opacity}
            onChange={(opacity) => onChange({ opacity })}
          />
        </>
      ) : (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          t("photo.sticker.hint")
        </p>
      )}
    </div>
  );
}

/* --------------------------------- focus -------------------------------- */

export function FocusPanel({
  focus,
  onChange,
}: {
  focus: FocusBlur;
  onChange: (patch: Partial<FocusBlur>) => void;
}) {
  const t = useT();
  const modes: { id: FocusBlur["mode"]; label: string }[] = [
    { id: "off", label: t("photo.focus.mode.off") },
    { id: "radial", label: t("photo.focus.mode.radial") },
    { id: "linear", label: t("photo.focus.mode.linear") },
    { id: "background", label: t("photo.focus.mode.background") },
  ];
  return (
    <div>
      <PanelRow>
        {modes.map((m) => (
          <Chip key={m.id} active={focus.mode === m.id} onClick={() => onChange({ mode: m.id })}>
            {t(`photo.focus.mode.${m.id}`)}
          </Chip>
        ))}
      </PanelRow>
      {focus.mode !== "off" ? (
        <>
          <Slider
            label={t("photo.focus.sharpZone")}
            min={0.08}
            max={0.9}
            value={focus.radius}
            format={(v) => `${Math.round(v * 100)}`}
            onChange={(radius) => onChange({ radius })}
          />
          <Slider
            label={t("photo.focus.blurStrength")}
            min={0.05}
            max={1}
            value={focus.strength}
            onChange={(strength) => onChange({ strength })}
          />
          {focus.mode === "linear" ? (
            <Slider
              label={t("photo.focus.angle")}
              min={-90}
              max={90}
              step={1}
              value={focus.angle}
              format={(v) => `${Math.round(v)}°`}
              onChange={(angle) => onChange({ angle })}
              onReset={() => onChange({ angle: 0 })}
            />
          ) : null}
          <p className="px-1 text-[11px] text-muted-foreground">t("photo.focus.hint")</p>
        </>
      ) : null}
    </div>
  );
}

/* -------------------------------- palette ------------------------------- */

export function PalettePanel({
  colors,
  onCopy,
}: {
  colors: string[];
  onCopy: (hex: string) => void;
}) {
  const shown = useMemo(() => colors.slice(0, 8), [colors]);
  return (
    <div className="py-1">
      <p className="mb-2 px-1 text-[12px] font-medium">Palette dominante</p>
      <ScrollRow>
        {shown.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onCopy(c)}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <span
              style={{ background: c }}
              className="h-12 w-12 rounded-2xl border border-border/60"
            />
            <span className="text-[10px] uppercase text-muted-foreground">{c}</span>
          </button>
        ))}
      </ScrollRow>
    </div>
  );
}
