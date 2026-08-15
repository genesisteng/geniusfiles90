/**
 * Visual page grid shared by every "Modifier un PDF" tool.
 *
 * Responsibilities :
 *   - Progressively render page thumbnails via pdf.js so very large PDFs
 *     stay responsive (yields per page — the UI updates as they arrive).
 *   - Show page numbers, an optional rotation overlay and a selection
 *     checkbox. Multi-selection is exposed via `selected` / `onToggle`.
 *   - Optional drag-and-drop reordering (`reorderable`) with a live
 *     `order` prop that owns the state.
 *
 * The component owns rendering only. Parents decide what selection or
 * order means for their operation, and read back through the callbacks.
 */
import { useState } from "react";
import type { Rotation } from "@/lib/pdf/api";
import type { ThumbEntry } from "./usePdfThumbnails";

export type { ThumbEntry } from "./usePdfThumbnails";

export function PageThumbGrid({
  thumbs,
  order,
  onReorder,
  rotations,
  selected,
  onToggleSelect,
  onPreview,
}: {
  thumbs: ThumbEntry[];
  /** Sequence of source page numbers in the current logical order. */
  order?: number[];
  onReorder?: (next: number[]) => void;
  rotations?: Record<number, Rotation>;
  /** Selected source page numbers (1-based). */
  selected?: Set<number>;
  onToggleSelect?: (page: number) => void;
  onPreview?: (page: number) => void;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const byPage = new Map(thumbs.map((t) => [t.page, t]));
  const sequence = order ?? thumbs.map((t) => t.page);

  const move = (from: number, to: number) => {
    if (!order || !onReorder) return;
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onReorder(next);
  };

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {sequence.map((page, idx) => {
        const t = byPage.get(page);
        const rot = rotations?.[page] ?? 0;
        const isSel = selected?.has(page);
        return (
          <div
            key={`${page}-${idx}`}
            draggable={!!onReorder}
            onDragStart={() => setDragFrom(idx)}
            onDragOver={(e) => onReorder && e.preventDefault()}
            onDrop={() => {
              if (dragFrom != null) move(dragFrom, idx);
              setDragFrom(null);
            }}
            className={`group relative overflow-hidden rounded-lg border transition ${
              isSel ? "border-primary ring-2 ring-primary/30" : "border-border"
            } ${dragFrom === idx ? "opacity-40" : ""} bg-surface`}
          >
            <button
              type="button"
              onClick={() => (onToggleSelect ? onToggleSelect(page) : onPreview?.(page))}
              className="block aspect-[3/4] w-full"
              aria-label={`Page ${page}`}
            >
              {t ? (
                <img
                  src={t.url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-contain transition-transform"
                  style={{ transform: `rotate(${rot}deg)` }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                  …
                </div>
              )}
            </button>

            {/* Page number + logical position when reordered */}
            <span className="absolute left-1 top-1 rounded bg-scrim/60 px-1.5 py-0.5 text-[10px] font-medium text-media-foreground">
              {order ? `${idx + 1} · p.${page}` : page}
            </span>

            {/* Rotation badge */}
            {rot ? (
              <span className="absolute right-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                {rot}°
              </span>
            ) : null}

            {/* Selection dot */}
            {onToggleSelect ? (
              <span
                className={`absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                  isSel
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-scrim/40 text-media-foreground"
                }`}
              >
                {isSel ? "✓" : ""}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function PageCountBadge({
  loading,
  loaded,
  total,
}: {
  loading: boolean;
  loaded: number;
  total: number;
}) {
  if (!loading && loaded === total)
    return <span className="text-[11px] text-muted-foreground">{total} page(s)</span>;
  return (
    <span className="text-[11px] text-muted-foreground">
      Rendu {loaded}/{total || "?"}…
    </span>
  );
}
