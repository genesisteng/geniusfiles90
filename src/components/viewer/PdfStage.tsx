import { IllustratedEmptyState } from "@/components/ui/IllustratedEmptyState";
/**
 * On-device PDF viewer used inside the Universal Viewer.
 *
 * Renders pages with pdf.js on a per-page canvas as they enter the
 * viewport, with a *real* selectable text layer on top of each page
 * (pdf.js TextLayer, or automatic OCR for scanned pages) so the Android
 * system selection — handles, Copier / Partager / Rechercher / Traduire —
 * works exactly like in a native reader.
 *
 * There is no floating bottom bar any more: every command (zoom, rotation,
 * search, page jump) is exposed through the reader menu via `onTools`.
 *
 * Robustness notes
 * ----------------
 * - Document bytes are fetched into an ArrayBuffer before hand-off to
 *   pdf.js — avoids WebView quirks with range requests.
 * - Only a small window (±2 pages) is rendered; the rest are placeholders,
 *   bounding memory on very large PDFs.
 * - Pinch-zoom uses a two-pointer geometric solve so the focal point stays
 *   pinned; scrolling is delegated to the browser for maximum smoothness.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, RotateCw, Search, SkipForward, X } from "lucide-react";
import { loadPdfJs, type PdfDoc, type PdfPage, type PdfViewport } from "@/lib/pdf/pdfjs";
import { getResume, setResume } from "@/lib/viewer/resume";
import { renderSelectableText, releaseOcr, selectedPageNumber } from "@/lib/pdf/text-layer";
import { selectAllIn, selectWordAtPoint } from "@/lib/viewer/selection";
import { SelectionToolbar } from "@/components/viewer/SelectionToolbar";
import type { ReaderTool } from "@/lib/viewer/reader-tools";
import { QuickScrollFab } from "@/components/common/QuickScrollFab";
import { useT } from "@/lib/i18n";

type DocStatus =
  | { kind: "loading" }
  | { kind: "ready"; doc: PdfDoc; sizes: PageSize[] }
  | { kind: "error"; message: string };

type PageSize = { width: number; height: number };

const RENDER_WINDOW = 2; // pages kept rendered on each side of the visible page.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;

export function PdfStage({
  src,
  resumeKey,
  onTools,
}: {
  src: string;
  resumeKey: string;
  onTools?: (tools: ReaderTool[]) => void;
}) {
  const t = useT();
  const [status, setStatus] = useState<DocStatus>({ kind: "loading" });
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1); // user zoom multiplier over fit-width.
  const [containerWidth, setContainerWidth] = useState(0);
  const [visiblePage, setVisiblePage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [panelOpen, setPanelOpen] = useState<null | "search" | "page">(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  /**
   * Page portant la sélection en cours. Elle reste rendue même si le
   * défilement la fait sortir de la fenêtre de rendu : sans cela, le
   * démontage de la page effaçait la sélection et son menu système.
   */
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onSelectionChange = () => setSelectedPage(selectedPageNumber());
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const savedRef = useRef(false);

  // ---- Load the document ----
  useEffect(() => {
    if (!src) {
      setStatus({ kind: "error", message: t("viewer.text.error.unavailable") });
      return;
    }
    let cancelled = false;
    let live: PdfDoc | null = null;

    (async () => {
      setStatus({ kind: "loading" });
      try {
        const lib = await loadPdfJs();
        if (!lib) throw new Error("pdf.js indisponible");
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        if (cancelled) return;
        const doc = await lib.getDocument({
          data: new Uint8Array(buffer),
          disableAutoFetch: true,
          disableStream: true,
        }).promise;
        if (cancelled) {
          void doc.destroy?.();
          return;
        }
        // Measure natural page sizes for layout.
        const sizes: PageSize[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          sizes.push({ width: vp.width, height: vp.height });
          page.cleanup?.();
          if (cancelled) return;
        }
        live = doc;
        setStatus({ kind: "ready", doc, sizes });
      } catch (err) {
        if (!cancelled)
          setStatus({
            kind: "error",
            message: err instanceof Error ? err.message : t("viewer.pdf.loadFailed"),
          });
      }
    })();

    return () => {
      cancelled = true;
      void live?.destroy?.();
    };
  }, [src, t]);

  // Le worker OCR (chargé uniquement pour les PDF scannés) est libéré à la
  // fermeture du lecteur : aucune fuite mémoire.
  useEffect(() => () => void releaseOcr(), []);

  // ---- Measure container width for fit-to-width scaling ----
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [status.kind]);

  // ---- Compute base fit-to-width scale and rotated page boxes ----
  const rotated = rotation % 180 !== 0;
  const layout = useMemo(() => {
    if (status.kind !== "ready" || containerWidth === 0) return null;
    const padding = 24; // 12px each side.
    const targetW = Math.max(120, containerWidth - padding);
    const naturalW = Math.max(1, ...status.sizes.map((s) => (rotated ? s.height : s.width)));
    const fit = targetW / naturalW;
    const scale = fit * zoom;
    const pages = status.sizes.map((s) => {
      const w = (rotated ? s.height : s.width) * scale;
      const h = (rotated ? s.width : s.height) * scale;
      return { w, h };
    });
    return { scale, pages };
  }, [status, containerWidth, zoom, rotated]);

  // ---- Navigation helpers ----
  const scrollToPage = useCallback((n: number, behavior: ScrollBehavior = "smooth") => {
    const node = pageRefs.current.get(n);
    const scroller = scrollerRef.current;
    if (!node || !scroller) return;
    const nodeTop = node.offsetTop - 8;
    scroller.scrollTo({ top: Math.max(0, nodeTop), behavior });
  }, []);

  // ---- Restore resume (once, after layout is known) ----
  useEffect(() => {
    if (status.kind !== "ready" || !layout) return;
    if (savedRef.current) return;
    savedRef.current = true;
    const r = getResume(resumeKey);
    const target = r?.pos && r.pos >= 1 && r.pos <= status.doc.numPages ? Math.round(r.pos) : 1;
    requestAnimationFrame(() => scrollToPage(target, "auto"));
  }, [status, layout, resumeKey, scrollToPage]);

  // ---- Track the currently visible page via IntersectionObserver ----
  useEffect(() => {
    if (status.kind !== "ready") return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const io = new IntersectionObserver(
      (entries) => {
        let best: { page: number; ratio: number } | null = null;
        for (const entry of entries) {
          const p = Number((entry.target as HTMLElement).dataset.page || "0");
          if (!p) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { page: p, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio > 0) {
          const found = best.page;
          setVisiblePage((prev) => {
            if (prev !== found) {
              setPageInput(String(found));
              setResume(resumeKey, found);
              return found;
            }
            return prev;
          });
        }
      },
      { root: scroller, threshold: [0.2, 0.5, 0.8] },
    );
    pageRefs.current.forEach((node) => io.observe(node));
    return () => io.disconnect();
  }, [status.kind, resumeKey, layout]);

  // ---- Zoom (buttons + pinch + double-tap) ----
  const zoomBy = useCallback((factor: number, focal?: { x: number; y: number }) => {
    setZoom((prev) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * factor));
      const scroller = scrollerRef.current;
      if (scroller && focal && next !== prev) {
        const ratio = next / prev;
        const contentX = scroller.scrollLeft + focal.x;
        const contentY = scroller.scrollTop + focal.y;
        requestAnimationFrame(() => {
          scroller.scrollLeft = contentX * ratio - focal.x;
          scroller.scrollTop = contentY * ratio - focal.y;
        });
      }
      return next;
    });
  }, []);

  // ---- Text search (jump to next page containing the query) ----
  const runSearch = useCallback(async () => {
    if (status.kind !== "ready" || !query.trim()) return;
    const q = query.trim().toLowerCase();
    setSearching(true);
    try {
      const total = status.doc.numPages;
      for (let i = 0; i < total; i++) {
        const n = ((visiblePage - 1 + i + 1) % total) + 1;
        const page = await status.doc.getPage(n);
        const tc = await page.getTextContent();
        const text = tc.items
          .map((it) => it.str)
          .join(" ")
          .toLowerCase();
        page.cleanup?.();
        if (text.includes(q)) {
          scrollToPage(n);
          break;
        }
      }
    } finally {
      setSearching(false);
    }
  }, [status, query, visiblePage, scrollToPage]);

  // ---- Outils exposés au menu du lecteur ----
  const totalPages = status.kind === "ready" ? status.doc.numPages : 0;
  useEffect(() => {
    if (!onTools) return;
    if (status.kind !== "ready") {
      onTools([]);
      return;
    }
    onTools([
      {
        id: "zoom-in",
        label: t("viewer.pdf.zoomIn"),
        icon: Plus,
        onSelect: () => zoomBy(1.25),
        disabled: zoom >= MAX_ZOOM - 0.01,
        value: `${Math.round(zoom * 100)} %`,
        keepOpen: true,
      },
      {
        id: "zoom-out",
        label: t("viewer.pdf.zoomOut"),
        icon: Minus,
        onSelect: () => zoomBy(1 / 1.25),
        disabled: zoom <= MIN_ZOOM + 0.01,
        keepOpen: true,
      },
      {
        id: "fit",
        label: t("viewer.pdf.fit"),
        icon: Maximize2,
        onSelect: () => setZoom(1),
      },
      {
        id: "rotate",
        label: t("viewer.pdf.rotate"),
        icon: RotateCw,
        onSelect: () => setRotation((r) => (r + 90) % 360),
        keepOpen: true,
      },
      {
        id: "goto",
        label: t("viewer.pdf.goto"),
        icon: SkipForward,
        value: `${visiblePage} / ${totalPages}`,
        onSelect: () => setPanelOpen("page"),
      },
      {
        id: "search",
        label: t("viewer.document.search"),
        icon: Search,
        onSelect: () => setPanelOpen("search"),
      },
    ]);
  }, [onTools, status.kind, zoom, zoomBy, visiblePage, totalPages, t]);

  /* ------------------------------------------------------------------
   * Gestes : pincement, double-tap, appui long (sélection du mot).
   *
   * Le pincement n'est *jamais* appliqué à l'état React pendant le geste :
   * on transforme la colonne de pages en CSS (`scale`, origine ancrée sur
   * le point focal), donc aucun re-render, aucun re-rendu canvas, aucun
   * clignotement. Le zoom réel n'est validé qu'au relâchement, en une
   * seule passe, avec correction du défilement pour garder le point sous
   * les doigts.
   * ------------------------------------------------------------------ */
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{
    distance: number;
    zoom: number;
    origin: { x: number; y: number };
    focal: { x: number; y: number };
    k: number;
  } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const longPress = useRef<number>(0);
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);

  const cancelLongPress = () => {
    if (longPress.current) {
      window.clearTimeout(longPress.current);
      longPress.current = 0;
    }
  };

  // Correction du défilement après validation d'un pincement.
  useLayoutEffect(() => {
    const target = pendingScroll.current;
    const scroller = scrollerRef.current;
    if (!target || !scroller) return;
    pendingScroll.current = null;
    scroller.scrollLeft = Math.max(0, target.left);
    scroller.scrollTop = Math.max(0, target.top);
  }, [zoom]);

  const beginPinch = () => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const [a, b] = Array.from(pointers.current.values());
    const rect = scroller.getBoundingClientRect();
    const focal = {
      x: (a.x + b.x) / 2 - rect.left,
      y: (a.y + b.y) / 2 - rect.top,
    };
    const origin = {
      x: scroller.scrollLeft + focal.x,
      y: scroller.scrollTop + focal.y,
    };
    pinch.current = {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      zoom,
      origin,
      focal,
      k: 1,
    };
    content.style.transformOrigin = `${origin.x}px ${origin.y}px`;
    content.style.willChange = "transform";
    scroller.style.touchAction = "none";
  };

  const endPinch = () => {
    const state = pinch.current;
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    pinch.current = null;
    if (!state || !scroller || !content) return;
    content.style.transform = "";
    content.style.transformOrigin = "";
    content.style.willChange = "";
    scroller.style.touchAction = "";
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom * state.k));
    if (Math.abs(next - zoom) < 0.001) return;
    const r = next / zoom;
    pendingScroll.current = {
      left: state.origin.x * r - state.focal.x,
      top: state.origin.y * r - state.focal.y,
    };
    setZoom(next);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      cancelLongPress();
      beginPinch();
      return;
    }
    if (pointers.current.size === 1 && e.pointerType !== "mouse") {
      const { clientX, clientY } = e;
      cancelLongPress();
      longPress.current = window.setTimeout(() => {
        longPress.current = 0;
        // Sélection du mot réellement situé sous le doigt : la sélection
        // système (poignées) prend ensuite le relais pour l'étendre.
        selectWordAtPoint(clientX, clientY);
      }, 420);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    if (longPress.current && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > 10) {
      cancelLongPress();
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const state = pinch.current;
    if (pointers.current.size === 2 && state && state.distance > 0) {
      const [a, b] = Array.from(pointers.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (state.zoom * d) / state.distance));
      state.k = target / state.zoom;
      const content = contentRef.current;
      if (content) content.style.transform = `scale(${state.k})`;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    cancelLongPress();
    pointers.current.delete(e.pointerId);
    if (pinch.current && pointers.current.size < 2) endPinch();
    // Double-tap detection (touch/pen only, ignore mouse).
    if (e.pointerType !== "mouse" && pointers.current.size === 0) {
      const now = performance.now();
      const last = lastTap.current;
      const pos = { x: e.clientX, y: e.clientY };
      if (last && now - last.t < 300 && Math.hypot(pos.x - last.x, pos.y - last.y) < 24) {
        const scroller = scrollerRef.current;
        const rect = scroller?.getBoundingClientRect();
        const focal = rect ? { x: pos.x - rect.left, y: pos.y - rect.top } : undefined;
        if (zoom > 1.01) setZoom(1);
        else zoomBy(2, focal);
        lastTap.current = null;
      } else {
        lastTap.current = { t: now, ...pos };
      }
    }
  };

  // ---- Render ----
  if (status.kind === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-reader-backdrop">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-[12px] text-reader-backdrop-foreground/60">
            {t("viewer.pdf.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-reader-backdrop px-6">
        <IllustratedEmptyState id="openFailed" tone="inverted" description={status.message} />
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-reader-backdrop">
      {/* Panneau supérieur contextuel (recherche / saut de page) — soudé
          sous l'en-tête, jamais en bas de l'écran. */}
      {panelOpen ? (
        <div className="flex shrink-0 select-none items-center gap-2 border-b border-white/10 bg-reader-header px-2 py-2">
          {panelOpen === "search" ? (
            <>
              <Search className="ml-1 h-4 w-4 shrink-0 text-reader-backdrop-foreground/70" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
                placeholder={t("viewer.document.search")}
                className="min-w-0 flex-1 rounded-full bg-reader-backdrop-foreground/10 px-3 py-1.5 text-[12.5px] text-reader-backdrop-foreground outline-none placeholder:text-reader-backdrop-foreground/40"
              />
              <button
                type="button"
                onClick={() => void runSearch()}
                disabled={searching || !query.trim()}
                className="rounded-full bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground active:scale-95 disabled:opacity-50"
              >
                {searching ? "…" : t("action.ok")}
              </button>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const n = Math.min(totalPages, Math.max(1, parseInt(pageInput || "1", 10) || 1));
                setPageInput(String(n));
                scrollToPage(n);
                setPanelOpen(null);
              }}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <input
                autoFocus
                type="tel"
                inputMode="numeric"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ""))}
                onFocus={(e) => e.currentTarget.select()}
                className="w-16 rounded-full bg-reader-backdrop-foreground/10 px-3 py-1.5 text-center text-[13px] font-semibold text-reader-backdrop-foreground outline-none"
                aria-label={t("viewer.pdf.pageNumber")}
              />
              <span className="text-[12px] text-reader-backdrop-foreground/60">/ {totalPages}</span>
              <button
                type="submit"
                className="ml-auto rounded-full bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground active:scale-95"
              >
                {t("viewer.pdf.go")}
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={() => setPanelOpen(null)}
            aria-label={t("action.close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-reader-backdrop-foreground/10 text-reader-backdrop-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Scrollable page list — occupe toute la hauteur restante */}
      <div
        ref={scrollerRef}
        data-gf-reader="true"
        className="min-h-0 flex-1 overflow-auto overscroll-contain"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: "pan-x pan-y" }}
      >
        <div
          ref={contentRef}
          className="mx-auto flex flex-col items-center gap-2 py-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]"
        >
          {status.sizes.map((_size, idx) => {
            const n = idx + 1;
            const box = layout?.pages[idx];
            const w = box?.w ?? 0;
            const h = box?.h ?? 0;
            const shouldRender =
              layout != null && (Math.abs(n - visiblePage) <= RENDER_WINDOW || n === selectedPage);
            return (
              <div
                key={n}
                ref={(node) => {
                  if (node) pageRefs.current.set(n, node);
                  else pageRefs.current.delete(n);
                }}
                data-page={n}
                className="relative shrink-0 bg-reader-surface shadow-elevated"
                style={{ width: w || undefined, height: h || undefined }}
              >
                {shouldRender && layout ? (
                  <PdfPageCanvas
                    doc={status.doc}
                    pageNumber={n}
                    scale={layout.scale}
                    rotation={rotation}
                    width={w}
                    height={h}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-reader-backdrop-foreground/50">
                    {n}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Navigation rapide dans le PDF : agit sur la liste de pages seule. */}
      {/* Barre d'actions de sélection : visible uniquement en sélection. */}
      <SelectionToolbar
        containerRef={scrollerRef}
        onSelectAll={() => {
          const page = selectedPage ?? visiblePage;
          const layer = pageRefs.current.get(page)?.querySelector(".textLayer");
          selectAllIn((layer as HTMLElement | null) ?? null);
        }}
      />
      <QuickScrollFab targetRef={scrollerRef} topInset={16} bottomInset={24} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                           Page renderer                             */
/* ------------------------------------------------------------------ */

function PdfPageCanvas({
  doc,
  pageNumber,
  scale,
  rotation,
  width,
  height,
}: {
  doc: PdfDoc;
  pageNumber: number;
  scale: number;
  rotation: number;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  /** Vrai dès le premier rendu : les rendus suivants (zoom, rotation) ne
   *  vident jamais l'écran — l'ancienne image reste affichée le temps du
   *  nouveau rendu, ce qui supprime tout clignotement. */
  const painted = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel?: () => void } | null = null;
    let pageObj: PdfPage | null = null;
    let disposeText: (() => void) | null = null;

    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) {
          page.cleanup?.();
          return;
        }
        pageObj = page;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale: scale * dpr, rotation });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const w = Math.round(viewport.width);
        const h = Math.round(viewport.height);
        // Rendu hors écran puis recopie en une seule passe : le canvas
        // visible n'est jamais effacé pendant le rendu.
        const offscreen = document.createElement("canvas");
        offscreen.width = w;
        offscreen.height = h;
        const octx = offscreen.getContext("2d");
        if (!octx) return;
        const render = page.render({ canvasContext: octx, viewport });
        task = render;
        await render.promise;
        if (cancelled) return;
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.getContext("2d")?.drawImage(offscreen, 0, 0);
        painted.current = true;
        setReady(true);

        // Couche de texte sélectionnable (ou OCR si la page est une image).
        const container = textRef.current;
        if (container) {
          const cssViewport = page.getViewport({ scale, rotation }) as PdfViewport;
          disposeText = renderSelectableText({
            page,
            viewport: cssViewport,
            container,
            canvas,
            cssWidth: width,
            cssHeight: height,
          });
        }
      } catch {
        /* cancellation or transient render error — safe to ignore */
      }
    })();

    return () => {
      cancelled = true;
      try {
        disposeText?.();
      } catch {
        /* ignore */
      }
      try {
        task?.cancel?.();
      } catch {
        /* ignore */
      }
      try {
        pageObj?.cleanup?.();
      } catch {
        /* ignore */
      }
    };
  }, [doc, pageNumber, scale, rotation, width, height]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`block transition-opacity duration-150 ${
          ready || painted.current ? "opacity-100" : "opacity-0"
        }`}
        style={{ width, height }}
      />
      {/* Sélection système Android : poignées, Copier, Partager, Traduire… */}
      <div ref={textRef} className="textLayer" data-gf-selectable="true" />
    </>
  );
}
