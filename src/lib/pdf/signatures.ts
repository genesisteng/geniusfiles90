/**
 * Persistent store for user signatures.
 *
 * Signatures live in localStorage (works both on web and inside the
 * Capacitor WebView) as PNG data-URLs. Kept small (< 100 KB each after
 * trim) so the whole list stays cheap to load.
 */
const KEY = "gf.pdf.signatures.v1";

export type StoredSignature = {
  id: string;
  name: string;
  dataUrl: string; // image/png
  createdAt: number;
};

function safeParse(raw: string | null): StoredSignature[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as StoredSignature[]) : [];
  } catch {
    return [];
  }
}

export function listSignatures(): StoredSignature[] {
  if (typeof localStorage === "undefined") return [];
  return safeParse(localStorage.getItem(KEY)).sort((a, b) => b.createdAt - a.createdAt);
}

function persist(list: StoredSignature[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function saveSignature(name: string, dataUrl: string): StoredSignature {
  const list = listSignatures();
  const entry: StoredSignature = {
    id: `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || "Signature",
    dataUrl,
    createdAt: Date.now(),
  };
  persist([entry, ...list]);
  return entry;
}

export function renameSignature(id: string, name: string) {
  const list = listSignatures().map((s) =>
    s.id === id ? { ...s, name: name.trim() || s.name } : s,
  );
  persist(list);
}

export function deleteSignature(id: string) {
  persist(listSignatures().filter((s) => s.id !== id));
}

/** Trim transparent margins from a canvas and return a compact PNG data-URL. */
export async function trimSignatureCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = img.data[i + 3];
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      // Treat near-white as background when the canvas was filled opaque.
      const isInk = a > 20 && !(r > 240 && g > 240 && b > 240);
      if (isInk) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }
  if (!found) return canvas.toDataURL("image/png");
  const pad = 6;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const w = Math.min(width, maxX + pad) - x0;
  const h = Math.min(height, maxY + pad) - y0;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d");
  if (!octx) return canvas.toDataURL("image/png");
  // Transparent background — replaces the opaque white the pad drew.
  octx.putImageData(ctx.getImageData(x0, y0, w, h), 0, 0);
  // Whiten background => transparent, keep ink.
  const data = octx.getImageData(0, 0, w, h);
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i];
    const g = data.data[i + 1];
    const b = data.data[i + 2];
    if (r > 235 && g > 235 && b > 235) data.data[i + 3] = 0;
  }
  octx.putImageData(data, 0, 0);
  return out.toDataURL("image/png");
}

export function isSignatureCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3];
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    if (a > 20 && !(r > 240 && g > 240 && b > 240)) return false;
  }
  return true;
}
