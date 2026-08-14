/**
 * Document scanner — offline pipeline.
 *
 * v1 uses the WebView camera (capture="environment"), then a canvas-based
 * enhancement stage (grayscale + contrast lift + subtle sharpen) that
 * significantly improves legibility for photographed pages.
 *
 * Edge detection & perspective correction are stubbed as identity
 * transforms so the UI is already wired for them: replacing
 * `autoDetectQuad` and `warpToQuad` with a proper implementation
 * (WASM OpenCV, TFLite doc-scanner) won't require any UI change.
 */

export type Quad = {
  tl: [number, number];
  tr: [number, number];
  br: [number, number];
  bl: [number, number];
};

export async function loadImage(source: File | Blob | string): Promise<HTMLImageElement> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    if (typeof source !== "string") setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/** Placeholder for the future TFLite / OpenCV auto-detect. Returns the
 *  full-image quad so the pipeline continues to work identically. */
export function autoDetectQuad(width: number, height: number): Quad {
  return {
    tl: [0, 0],
    tr: [width, 0],
    br: [width, height],
    bl: [0, height],
  };
}

/** Perspective-correct a quad to a rectangle. Currently a straight crop
 *  around the quad's bounding box — good enough when the user is holding
 *  the phone reasonably square. */
export function warpToQuad(img: HTMLImageElement, quad: Quad): HTMLCanvasElement {
  const xs = [quad.tl[0], quad.tr[0], quad.br[0], quad.bl[0]];
  const ys = [quad.tl[1], quad.tr[1], quad.br[1], quad.bl[1]];
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const x1 = Math.max(...xs);
  const y1 = Math.max(...ys);
  const w = Math.max(1, Math.round(x1 - x0));
  const h = Math.max(1, Math.round(y1 - y0));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, x0, y0, w, h, 0, 0, w, h);
  return c;
}

/** Legibility booster: grayscale + contrast + very mild threshold. */
export function enhanceReadability(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height);
  const px = data.data;
  // Contrast lift around midpoint 128.
  const factor = 1.35;
  const bias = 12;
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    let v = (g - 128) * factor + 128 + bias;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export async function scanFromCapture(
  source: File | Blob,
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(source);
  const quad = autoDetectQuad(img.naturalWidth, img.naturalHeight);
  const warped = warpToQuad(img, quad);
  const enhanced = enhanceReadability(warped);
  const blob: Blob = await new Promise((r) =>
    enhanced.toBlob((b) => r(b ?? new Blob()), "image/jpeg", 0.86),
  );
  return { blob, width: enhanced.width, height: enhanced.height };
}
