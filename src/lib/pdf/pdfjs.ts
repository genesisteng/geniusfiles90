/**
 * pdf.js loader shared by the PDF tools (text extraction, search, raster)
 * and the on-device PDF viewer.
 *
 * Loaded dynamically so the SSR bundle stays lean.
 */
type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy?: () => Promise<void>;
};
type PdfViewport = { width: number; height: number };
type PdfPage = {
  getTextContent: () => Promise<{
    items: { str: string; transform: number[]; width: number; height: number }[];
  }>;
  getViewport: (opts: { scale: number; rotation?: number }) => PdfViewport;
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => {
    promise: Promise<void>;
    cancel?: () => void;
  };
  cleanup?: () => void;
};
type PdfLoadOpts = {
  data?: ArrayBuffer | Uint8Array;
  url?: string;
  disableAutoFetch?: boolean;
  disableStream?: boolean;
};
type PdfJsLib = {
  getDocument: (opts: PdfLoadOpts) => { promise: Promise<PdfDoc>; destroy?: () => void };
  GlobalWorkerOptions?: { workerSrc?: string };
};

let cache: Promise<PdfJsLib | null> | null = null;

export async function loadPdfJs(): Promise<PdfJsLib | null> {
  if (typeof window === "undefined") return null;
  if (!cache) {
    // Static specifiers so Vite bundles both pdf.js and its worker into
    // the client build. In the Capacitor WebView (APK/AAB) there is no
    // import map / no CDN, and pdf.js v4+ refuses to boot without a
    // real workerSrc ("No GlobalWorkerOptions.workerSrc specified").
    // Vite's `?url` suffix emits the worker as a hashed asset and gives
    // us a URL that works both in dev and in the bundled shell.
    cache = (async () => {
      try {
        const [mod, workerUrlMod] = await Promise.all([
          import("pdfjs-dist/legacy/build/pdf.mjs"),
          import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
        ]);
        const lib = mod as PdfJsLib;
        const workerUrl = (workerUrlMod as { default: string }).default;
        try {
          if (lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc = workerUrl;
        } catch {
          /* ignore */
        }
        return lib;
      } catch {
        return null;
      }
    })();
  }
  return await cache;
}

export type { PdfDoc, PdfPage, PdfViewport };
