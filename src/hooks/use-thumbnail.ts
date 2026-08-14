import { useEffect, useState } from "react";

import {
  peekThumbnail,
  releaseThumbnail,
  resolveThumbnail,
  retainThumbnail,
  scaleForDisplay,
} from "@/lib/native/thumbnails";

/**
 * React hook wrapper around {@link resolveThumbnail}. Reads the sync LRU
 * synchronously on first render (no flicker when scrolling back through
 * previously-loaded rows) and only kicks off an async resolve when the
 * URL is not yet in memory.
 *
 * The consumer receives {@code null} until the native thumbnail is ready
 * (or forever on the web preview), which is the signal to fall back to a
 * mock URL / icon.
 */
export function useThumbnail(absolutePath: string | null, size = 320): string | null {
  const px = scaleForDisplay(size);
  const initial = absolutePath ? peekThumbnail(absolutePath, px) : null;
  const [url, setUrl] = useState<string | null>(initial);

  useEffect(() => {
    if (!absolutePath) {
      setUrl(null);
      return;
    }
    const cached = peekThumbnail(absolutePath, px);
    if (cached) {
      setUrl(cached);
      return;
    }
    let cancelled = false;
    retainThumbnail(absolutePath, px);
    resolveThumbnail(absolutePath, px).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
      releaseThumbnail(absolutePath, px);
    };
  }, [absolutePath, px]);

  return url;
}
