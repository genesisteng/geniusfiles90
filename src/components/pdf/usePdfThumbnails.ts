/**
 * Rendu progressif des vignettes de pages PDF (pdf.js).
 *
 * Séparé de `PageThumbGrid` pour que ce fichier de composants n'exporte
 * que des composants (rechargement à chaud).
 */
import { useEffect, useRef, useState } from "react";
import { renderPdfThumbnails } from "@/lib/pdf/api";

export type ThumbEntry = { page: number; url: string; w: number; h: number };

export function usePdfThumbnails(source: string | null) {
  const [thumbs, setThumbs] = useState<ThumbEntry[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setThumbs([]);
    setPageCount(0);
    setError(null);
    if (!source) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    renderPdfThumbnails(
      source,
      (page, url, w, h) => {
        if (ctrl.signal.aborted) return;
        setThumbs((prev) => [...prev, { page, url, w, h }]);
        setPageCount((c) => Math.max(c, page));
      },
      { signal: ctrl.signal, scale: 0.5, quality: 0.72 },
    )
      .then((res) => {
        if (!ctrl.signal.aborted) setPageCount(res.pageCount);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError((e as Error).message || "Rendu impossible");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [source]);

  return { thumbs, pageCount, loading, error };
}
