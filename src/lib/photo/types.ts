/**
 * GeniusFiles Photo Editor — state contracts.
 *
 * The whole editor is a pure function of this state: every tool only
 * produces a new `EditState`, and the render pipeline (see pipeline.ts)
 * turns `source image + EditState` into pixels. That makes undo / redo,
 * before-after and full-resolution export trivially correct.
 */

export type AdjustKey =
  | "exposure"
  | "brightness"
  | "contrast"
  | "highlights"
  | "shadows"
  | "whites"
  | "blacks"
  | "gamma"
  | "saturation"
  | "vibrance"
  | "temperature"
  | "tint"
  | "sharpness"
  | "clarity"
  | "structure"
  | "denoise"
  | "vignette"
  | "grain"
  | "fade";

export type Adjustments = Record<AdjustKey, number>;

export const ZERO_ADJUST: Adjustments = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  gamma: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  sharpness: 0,
  clarity: 0,
  structure: 0,
  denoise: 0,
  vignette: 0,
  grain: 0,
  fade: 0,
};

/** Normalised crop rectangle, expressed in the straightened image space. */
export type CropRect = { x: number; y: number; w: number; h: number };

export type Geometry = {
  /** Quarter turns clockwise (0..3). */
  rot: 0 | 1 | 2 | 3;
  flipH: boolean;
  flipV: boolean;
  /** Free rotation / straightening, in degrees (-45..45). */
  straighten: number;
  /** Horizontal perspective correction (-1..1). */
  perspectiveX: number;
  /** Vertical perspective correction (-1..1). */
  perspectiveY: number;
  crop: CropRect;
};

export const ZERO_GEOMETRY: Geometry = {
  rot: 0,
  flipH: false,
  flipV: false,
  straighten: 0,
  perspectiveX: 0,
  perspectiveY: 0,
  crop: { x: 0, y: 0, w: 1, h: 1 },
};

export type Point = { x: number; y: number };

/** Free-hand stroke — brush, highlighter, or a masked effect. */
export type StrokeLayer = {
  id: string;
  type: "stroke";
  tool: "brush" | "marker" | "blur" | "pixelate" | "mosaic";
  color: string;
  /** Stroke width, as a fraction of the image's largest side. */
  size: number;
  opacity: number;
  points: Point[];
};

export type TextLayer = {
  id: string;
  type: "text";
  text: string;
  /** Normalised centre position inside the cropped image. */
  x: number;
  y: number;
  /** Font size as a fraction of image height. */
  size: number;
  font: string;
  color: string;
  align: CanvasTextAlign;
  rotation: number;
  opacity: number;
  bold: boolean;
  italic: boolean;
  shadow: boolean;
  outline: boolean;
  outlineColor: string;
};

export type StickerLayer = {
  id: string;
  type: "sticker";
  /** Emoji glyph, or a vector shape id. */
  glyph: string;
  shape?: "arrow" | "circle" | "rect" | "star" | "bubble";
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
  opacity: number;
  filled: boolean;
};

/** Radial or linear focus blur applied over the whole frame. */
export type FocusBlur = {
  mode: "off" | "radial" | "linear" | "background";
  x: number;
  y: number;
  radius: number;
  angle: number;
  strength: number;
};

export type Layer = StrokeLayer | TextLayer | StickerLayer;

export type EditState = {
  geometry: Geometry;
  adjust: Adjustments;
  /** Id of the applied look preset (see presets.ts), or null. */
  filter: string | null;
  filterStrength: number;
  focus: FocusBlur;
  layers: Layer[];
  /**
   * Histogram analysis of the source image, computed once when it loads.
   * The "Auto" look is built from this, so it is a real correction of this
   * very photo instead of a canned set of values.
   */
  auto?: Partial<Adjustments> | null;
};

export const INITIAL_STATE: EditState = {
  geometry: ZERO_GEOMETRY,
  adjust: ZERO_ADJUST,
  filter: null,
  filterStrength: 1,
  focus: { mode: "off", x: 0.5, y: 0.5, radius: 0.38, angle: 0, strength: 0.6 },
  layers: [],
  auto: null,
};

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
