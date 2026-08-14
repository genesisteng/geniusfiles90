/**
 * Shared visual editor for the "Annoter et signer" tool group.
 *
 * Responsibilities:
 *   - Render the currently-selected PDF page via pdf.js on a <canvas>.
 *   - Show a thumbnail strip so the user can jump between pages.
 *   - Overlay interactive elements (text, image, signature, watermark)
 *     positioned in fractional page coordinates (0..1) so what the user
 *     sees maps 1:1 to the final PDF produced by the api.ts helpers.
 *   - Support drag / resize / rotate, per-element property editing,
 *     undo/redo, duplicate & delete.
 *
 * The parent owns:
 *   - the source PDF path (read-only here);
 *   - the current element list (via `elements` + `onChange`);
 *   - the "add" toolbar buttons (via `toolbar`).
 *
 * This component never mutates the source PDF — it only produces the
 * final overlay list that the parent hands to addTextToPdf /
 * addImageToPdf / watermarkPdf.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Copy as CopyIcon, RotateCw, Undo2, Redo2 } from "lucide-react";
import { loadPdfJs } from "@/lib/pdf/pdfjs";
import { readBytes } from "@/lib/pdf/native-io";
import {
  newId,
  type AnnotElement,
  type ImageElement,
  type PageInfo,
  type TextElement,
} from "./annot";
import { useT } from "@/lib/i18n";

export type { TextElement, ImageElement, AnnotElement, PageInfo } from "./annot";

/* ------------------------------------------------------------------ */
/* Page renderer (pdf.js)                                              */
/* ------------------------------------------------------------------ */

function usePdfPages(source: string | null) {
  const t = useT();
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const docRef = useRef<Awaited<
    ReturnType<NonNullable<Awaited<ReturnType<typeof loadPdfJs>>>["getDocument"]>["promise"]
  > | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setThumbs({});
    setError(null);
    setReady(false);
    if (!source) return;
    (async () => {
      try {
        const lib = await loadPdfJs();
        if (!lib) throw new Error("Moteur PDF indisponible");
        const bytes = await readBytes(source);
        const doc = await lib.getDocument({ data: bytes }).promise;
        if (cancelled) {
          await doc.destroy?.();
          return;
        }
        docRef.current = doc;
        const infos: PageInfo[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const p = await doc.getPage(i);
          const v = p.getViewport({ scale: 1 });
          infos.push({ page: i, wPt: v.width, hPt: v.height });
        }
        if (cancelled) return;
        setPages(infos);
        setReady(true);
        // Progressive thumbnails.
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const p = await doc.getPage(i);
          const scale = Math.min(180 / p.getViewport({ scale: 1 }).width, 0.6);
          const v = p.getViewport({ scale });
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.ceil(v.width));
          c.height = Math.max(1, Math.ceil(v.height));
          const ctx = c.getContext("2d");
          if (!ctx) continue;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, c.width, c.height);
          await p.render({ canvasContext: ctx, viewport: v }).promise;
          if (cancelled) return;
          setThumbs((prev) => ({ ...prev, [i]: c.toDataURL("image/jpeg", 0.7) }));
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Rendu impossible");
      }
    })();
    return () => {
      cancelled = true;
      docRef.current?.destroy?.();
      docRef.current = null;
    };
  }, [source]);

  const renderPage = useCallback(
    async (page: number, canvas: HTMLCanvasElement, cssWidth: number) => {
      const doc = docRef.current;
      if (!doc) return;
      const p = await doc.getPage(page);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const base = p.getViewport({ scale: 1 });
      const scale = (cssWidth / base.width) * dpr;
      const v = p.getViewport({ scale });
      canvas.width = Math.max(1, Math.ceil(v.width));
      canvas.height = Math.max(1, Math.ceil(v.height));
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${(v.height / dpr).toFixed(1)}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await p.render({ canvasContext: ctx, viewport: v }).promise;
    },
    [],
  );

  return { pages, thumbs, error, ready, renderPage };
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export type AnnotToolbarItem = {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export function PdfAnnotator({
  source,
  elements,
  onChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  toolbar,
  cssStyle,
  onSelectionChange,
  selectedId,
  onPagesLoaded,
  onCurrentPageChange,
}: {
  source: string;
  elements: AnnotElement[];
  onChange: (next: AnnotElement[] | ((prev: AnnotElement[]) => AnnotElement[])) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** "Add element" buttons rendered above the page. */
  toolbar?: AnnotToolbarItem[];
  /** How element sizing behaves. "auto" = default drag-resize. */
  cssStyle?: "auto";
  onSelectionChange?: (id: string | null) => void;
  selectedId?: string | null;
  onPagesLoaded?: (pages: PageInfo[]) => void;
  onCurrentPageChange?: (page: number) => void;
}) {
  const { pages, thumbs, error, ready, renderPage } = usePdfPages(source);
  const t = useT();
  const [currentPage, setCurrentPageRaw] = useState(1);
  const setCurrentPage = useCallback(
    (p: number) => {
      setCurrentPageRaw(p);
      onCurrentPageChange?.(p);
    },
    [onCurrentPageChange],
  );
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selected = selectedId !== undefined ? selectedId : internalSelected;
  const setSelected = (id: string | null) => {
    setInternalSelected(id);
    onSelectionChange?.(id);
  };

  useEffect(() => {
    if (ready) onPagesLoaded?.(pages);
  }, [ready, pages, onPagesLoaded]);

  useEffect(() => {
    if (!ready || !canvasRef.current || !holderRef.current) return;
    const info = pages.find((p) => p.page === currentPage);
    if (!info) return;
    const holderWidth = holderRef.current.clientWidth;
    const cssWidth = Math.max(120, holderWidth * zoom);
    const cssHeight = cssWidth * (info.hPt / info.wPt);
    renderPage(currentPage, canvasRef.current, cssWidth).then(() => {
      setPageSize({ w: cssWidth, h: cssHeight });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, currentPage, zoom, pages.length]);

  const pageElements = elements.filter((e) => e.page === currentPage);

  /* ---------------- pointer interactions ---------------- */

  type Drag =
    | { mode: "move"; id: string; startX: number; startY: number; origX: number; origY: number }
    | {
        mode: "resize";
        id: string;
        startX: number;
        startY: number;
        origW: number;
        origH: number;
        aspect: number;
      }
    | { mode: "rotate"; id: string; cx: number; cy: number; startAngle: number; origRot: number };
  const dragRef = useRef<Drag | null>(null);

  const beginMove = (e: React.PointerEvent, el: AnnotElement) => {
    e.stopPropagation();
    e.preventDefault();
    setSelected(el.id);
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode: "move",
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
    };
  };
  const beginResize = (e: React.PointerEvent, el: AnnotElement) => {
    e.stopPropagation();
    e.preventDefault();
    setSelected(el.id);
    (e.target as Element).setPointerCapture(e.pointerId);
    const wFrac = el.wFrac;
    const hFrac = el.kind === "text" ? 0 : (el as ImageElement).hFrac;
    const aspect = el.kind === "text" ? 0 : (el as ImageElement).aspect;
    dragRef.current = {
      mode: "resize",
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      origW: wFrac,
      origH: hFrac,
      aspect,
    };
  };
  const beginRotate = (e: React.PointerEvent, el: AnnotElement) => {
    e.stopPropagation();
    e.preventDefault();
    setSelected(el.id);
    (e.target as Element).setPointerCapture(e.pointerId);
    const holder = holderRef.current!.getBoundingClientRect();
    const canvas = canvasRef.current!.getBoundingClientRect();
    const wPx = pageSize.w;
    const hPx = pageSize.h;
    const elW = el.kind === "text" ? el.wFrac * wPx : (el as ImageElement).wFrac * wPx;
    const elH =
      el.kind === "text"
        ? (el as TextElement).fontSize * 1.2 * (1 + (el.text.split(/\n/).length - 1))
        : (el as ImageElement).hFrac * hPx;
    const cx = canvas.left - holder.left + el.x * wPx + elW / 2;
    const cy = canvas.top - holder.top + el.y * hPx + elH / 2;
    const startAngle = Math.atan2(
      e.clientY - (canvas.top + el.y * hPx + elH / 2),
      e.clientX - (canvas.left + el.x * wPx + elW / 2),
    );
    dragRef.current = {
      mode: "rotate",
      id: el.id,
      cx,
      cy,
      startAngle,
      origRot: el.rotate,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === "move") {
      const dx = (e.clientX - d.startX) / pageSize.w;
      const dy = (e.clientY - d.startY) / pageSize.h;
      onChange((prev) =>
        prev.map((el) =>
          el.id === d.id ? { ...el, x: clamp01(d.origX + dx), y: clamp01(d.origY + dy) } : el,
        ),
      );
    } else if (d.mode === "resize") {
      const dx = (e.clientX - d.startX) / pageSize.w;
      onChange((prev) =>
        prev.map((el) => {
          if (el.id !== d.id) return el;
          if (el.kind === "text") {
            return { ...el, wFrac: Math.max(0.05, Math.min(1, d.origW + dx)) };
          }
          const nw = Math.max(0.03, Math.min(1, d.origW + dx));
          const nh = d.aspect > 0 ? (nw / d.aspect) * (pageSize.w / pageSize.h) : d.origH;
          return { ...el, wFrac: nw, hFrac: Math.max(0.03, Math.min(1, nh)) };
        }),
      );
    } else if (d.mode === "rotate") {
      const holder = holderRef.current!.getBoundingClientRect();
      const canvas = canvasRef.current!.getBoundingClientRect();
      const cxAbs = canvas.left + (d.cx - (canvas.left - holder.left));
      const cyAbs = canvas.top + (d.cy - (canvas.top - holder.top));
      const ang = Math.atan2(e.clientY - cyAbs, e.clientX - cxAbs);
      const deg = ((ang - d.startAngle) * 180) / Math.PI;
      onChange((prev) =>
        prev.map((el) => (el.id === d.id ? { ...el, rotate: Math.round(d.origRot + deg) } : el)),
      );
    }
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  /* ---------------- render ---------------- */

  const selectedEl = elements.find((e) => e.id === selected) ?? null;

  return (
    <div className="flex flex-col gap-2">
      {toolbar?.length ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface p-1.5">
          {toolbar.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={t.onClick}
              disabled={t.disabled}
              className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent disabled:opacity-50"
            >
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
              className="rounded-md border border-border p-1 disabled:opacity-40"
              title={t("action.cancel")}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={onRedo}
              className="rounded-md border border-border p-1 disabled:opacity-40"
              title={t("media.editor.aria.redo")}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
            <span className="ml-2 text-[10px] text-muted-foreground">
              Zoom {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              className="rounded-md border border-border px-1.5 text-[11px]"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
              className="rounded-md border border-border px-1.5 text-[11px]"
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
          {error}
        </p>
      ) : null}

      {/* Page holder */}
      <div
        ref={holderRef}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => setSelected(null)}
        className="relative max-h-[55vh] overflow-auto rounded-lg border border-border bg-neutral-200 p-2 dark:bg-neutral-800"
        style={{ touchAction: "none" }}
      >
        <div className="relative mx-auto" style={{ width: pageSize.w || "auto" }}>
          <canvas ref={canvasRef} className="block shadow-md" />
          {/* Overlay layer sized to canvas CSS size */}
          <div className="absolute inset-0" style={{ width: pageSize.w, height: pageSize.h }}>
            {pageElements.map((el) => (
              <ElementView
                key={el.id}
                el={el}
                pageW={pageSize.w}
                pageH={pageSize.h}
                selected={selected === el.id}
                onBeginMove={(e) => beginMove(e, el)}
                onBeginResize={(e) => beginResize(e, el)}
                onBeginRotate={(e) => beginRotate(e, el)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Element inspector */}
      {selectedEl ? (
        <ElementInspector
          el={selectedEl}
          onChange={(patch) =>
            onChange((prev) =>
              prev.map((x) => (x.id === selectedEl.id ? ({ ...x, ...patch } as AnnotElement) : x)),
            )
          }
          onDelete={() => {
            onChange((prev) => prev.filter((x) => x.id !== selectedEl.id));
            setSelected(null);
          }}
          onDuplicate={() => {
            const copy = {
              ...selectedEl,
              id: newId(selectedEl.kind),
              x: Math.min(0.95, selectedEl.x + 0.03),
              y: Math.min(0.95, selectedEl.y + 0.03),
            } as AnnotElement;
            onChange((prev) => [...prev, copy]);
            setSelected(copy.id);
          }}
        />
      ) : null}

      {/* Thumbnail strip */}
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        {pages.map((p) => {
          const t = thumbs[p.page];
          const active = p.page === currentPage;
          const overlayCount = elements.filter((e) => e.page === p.page).length;
          return (
            <button
              key={p.page}
              type="button"
              onClick={() => setCurrentPage(p.page)}
              className={`relative shrink-0 snap-start overflow-hidden rounded border ${
                active ? "border-primary ring-2 ring-primary/40" : "border-border"
              } bg-white`}
              style={{ width: 72, height: 96 }}
            >
              {t ? (
                <img src={t} alt="" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                  …
                </div>
              )}
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-center text-[10px] text-white">
                {p.page}
                {overlayCount ? ` · ${overlayCount}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/* ------------------------------------------------------------------ */
/* Element view + handles                                              */
/* ------------------------------------------------------------------ */

function ElementView({
  el,
  pageW,
  pageH,
  selected,
  onBeginMove,
  onBeginResize,
  onBeginRotate,
}: {
  el: AnnotElement;
  pageW: number;
  pageH: number;
  selected: boolean;
  onBeginMove: (e: React.PointerEvent) => void;
  onBeginResize: (e: React.PointerEvent) => void;
  onBeginRotate: (e: React.PointerEvent) => void;
}) {
  const left = el.x * pageW;
  const top = el.y * pageH;
  const isText = el.kind === "text";
  const width = el.wFrac * pageW;
  const height = isText ? undefined : (el as ImageElement).hFrac * pageH;

  const commonStyle: React.CSSProperties = {
    position: "absolute",
    left,
    top,
    width,
    height,
    transform: `rotate(${el.rotate}deg)`,
    transformOrigin: "center center",
    opacity: el.opacity,
    cursor: "move",
    touchAction: "none",
  };

  return (
    <div
      style={commonStyle}
      onPointerDown={onBeginMove}
      className={`select-none ${selected ? "outline-2 outline-dashed outline-primary" : ""}`}
    >
      {isText ? (
        <div
          style={{
            fontSize: (el as TextElement).fontSize * (pageW / 595), // A4 ≈ 595pt wide
            fontFamily:
              (el as TextElement).family === "times"
                ? "Times, serif"
                : (el as TextElement).family === "courier"
                  ? "Courier, monospace"
                  : "Helvetica, Arial, sans-serif",
            fontWeight: (el as TextElement).bold ? 700 : 400,
            fontStyle: (el as TextElement).italic ? "italic" : "normal",
            textDecoration: (el as TextElement).underline ? "underline" : "none",
            textAlign: (el as TextElement).align,
            color: (el as TextElement).color,
            lineHeight: 1.2,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            pointerEvents: "none",
          }}
        >
          {(el as TextElement).text || "Texte"}
        </div>
      ) : (
        <img
          src={(el as ImageElement).dataUrl}
          alt=""
          style={{ width: "100%", height: "100%", pointerEvents: "none", objectFit: "fill" }}
        />
      )}

      {selected ? (
        <>
          {/* Resize handle (bottom-right) */}
          <div
            onPointerDown={onBeginResize}
            className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-se-resize rounded-sm border border-primary bg-white"
          />
          {/* Rotate handle (top-center) */}
          <div
            onPointerDown={onBeginRotate}
            className="absolute -top-6 left-1/2 flex h-4 w-4 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-primary bg-white"
          >
            <RotateCw className="h-2.5 w-2.5 text-primary" />
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Element inspector                                                   */
/* ------------------------------------------------------------------ */

function ElementInspector({
  el,
  onChange,
  onDelete,
  onDuplicate,
}: {
  el: AnnotElement;
  onChange: (patch: Partial<AnnotElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const t = useT();
  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium">
          {el.kind === "text"
            ? t("pdf.tool.text.label")
            : el.kind === "signature"
              ? t("pdf.signature")
              : t("pdf.image")}
        </span>
        <div className="flex gap-1">
          <button
            onClick={onDuplicate}
            className="rounded border border-border p-1 text-[11px]"
            title={t("pdf.tool.duplicate.label")}
          >
            <CopyIcon className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            className="rounded border border-destructive/40 p-1 text-destructive"
            title={t("automations.card.delete")}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {el.kind === "text" ? (
        <div className="space-y-2">
          <textarea
            value={(el as TextElement).text}
            onChange={(e) => onChange({ text: e.target.value } as Partial<TextElement>)}
            rows={2}
            className="w-full rounded border border-border bg-background px-2 py-1 text-[12px]"
          />
          <div className="grid grid-cols-4 gap-1.5 text-[11px]">
            <label className="col-span-2 flex items-center gap-1">
              <span className="text-muted-foreground">{t("pdf.annotator.field.font")}</span>
              <select
                value={(el as TextElement).family}
                onChange={(e) => onChange({ family: e.target.value } as Partial<TextElement>)}
                className="flex-1 rounded border border-border bg-background px-1 py-0.5"
              >
                <option value="helvetica">Helvetica</option>
                <option value="times">Times</option>
                <option value="courier">Courier</option>
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="text-muted-foreground">{t("pdf.annotator.field.size")}</span>
              <input
                type="number"
                min={6}
                max={144}
                value={(el as TextElement).fontSize}
                onChange={(e) =>
                  onChange({
                    fontSize: Math.max(6, Number(e.target.value) || 12),
                  } as Partial<TextElement>)
                }
                className="w-14 rounded border border-border bg-background px-1 py-0.5"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-muted-foreground">{t("pdf.annotator.field.color")}</span>
              <input
                type="color"
                value={(el as TextElement).color}
                onChange={(e) => onChange({ color: e.target.value } as Partial<TextElement>)}
                className="h-6 w-8 rounded border border-border"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1 text-[11px]">
            <ToggleBtn
              active={(el as TextElement).bold}
              onClick={() => onChange({ bold: !(el as TextElement).bold } as Partial<TextElement>)}
            >
              G
            </ToggleBtn>
            <ToggleBtn
              active={(el as TextElement).italic}
              onClick={() =>
                onChange({ italic: !(el as TextElement).italic } as Partial<TextElement>)
              }
            >
              <i>I</i>
            </ToggleBtn>
            <ToggleBtn
              active={(el as TextElement).underline}
              onClick={() =>
                onChange({ underline: !(el as TextElement).underline } as Partial<TextElement>)
              }
            >
              <u>S</u>
            </ToggleBtn>
            <div className="mx-1 border-l border-border" />
            {(["left", "center", "right"] as const).map((a) => (
              <ToggleBtn
                key={a}
                active={(el as TextElement).align === a}
                onClick={() => onChange({ align: a } as Partial<TextElement>)}
              >
                {a === "left" ? "⯇" : a === "center" ? "⯀" : "⯈"}
              </ToggleBtn>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">{t("pdf.annotator.field.opacity")}</span>
            <input
              type="range"
              min={5}
              max={100}
              value={Math.round(el.opacity * 100)}
              onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
              className="flex-1"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">{t("pdf.annotator.field.rotation")}</span>
            <input
              type="range"
              min={-180}
              max={180}
              value={el.rotate}
              onChange={(e) => onChange({ rotate: Number(e.target.value) })}
              className="flex-1"
            />
          </label>
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <label className="flex items-center gap-1">
          <span className="text-muted-foreground">{t("pdf.annotator.field.opacity")}</span>
          <input
            type="range"
            min={5}
            max={100}
            value={Math.round(el.opacity * 100)}
            onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
            className="flex-1"
          />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-muted-foreground">{t("pdf.annotator.field.rotation")}</span>
          <input
            type="number"
            min={-180}
            max={180}
            value={el.rotate}
            onChange={(e) => onChange({ rotate: Number(e.target.value) || 0 })}
            className="w-16 rounded border border-border bg-background px-1 py-0.5"
          />
        </label>
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-0.5 ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Signature pad (canvas)                                              */
/* ------------------------------------------------------------------ */

export function SignaturePad({
  onReady,
  height = 200,
}: {
  onReady: (canvas: HTMLCanvasElement) => void;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const t = useT();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    let drawing = false;
    let last: { x: number; y: number } | null = null;
    const pos = (ev: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return {
        x: (ev.clientX - r.left) * (c.width / r.width),
        y: (ev.clientY - r.top) * (c.height / r.height),
      };
    };
    const down = (e: PointerEvent) => {
      drawing = true;
      last = pos(e);
      c.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drawing || !last) return;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
    };
    const up = () => {
      drawing = false;
      last = null;
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointerleave", up);
    onReady(c);
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointerleave", up);
    };
  }, [onReady]);
  return (
    <canvas
      ref={ref}
      width={600}
      height={height}
      className="w-full touch-none rounded-lg border border-border bg-white"
    />
  );
}
