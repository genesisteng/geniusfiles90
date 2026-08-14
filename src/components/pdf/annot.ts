/**
 * Types et utilitaires partagés de l'éditeur d'annotations PDF.
 *
 * Séparés de `PdfAnnotator.tsx` pour que ce fichier n'exporte que des
 * composants (rechargement à chaud). Aucun changement de comportement :
 * le code est identique, seul son emplacement change.
 */
import { useCallback, useRef, useState } from "react";

export type TextElement = {
  id: string;
  kind: "text";
  page: number;
  x: number; // 0..1 from left, anchor = element top-left
  y: number; // 0..1 from top
  wFrac: number; // width fraction (for wrapping)
  text: string;
  fontSize: number; // in pt
  color: string; // hex #RRGGBB
  family: "helvetica" | "times" | "courier";
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: "left" | "center" | "right";
  rotate: number;
  opacity: number;
};

export type ImageElement = {
  id: string;
  kind: "image" | "signature";
  page: number;
  x: number;
  y: number;
  wFrac: number;
  hFrac: number;
  rotate: number;
  opacity: number;
  dataUrl: string; // preview + payload
  mime: "image/png" | "image/jpeg";
  /** Original pixel aspect ratio (w / h) — used to preserve ratio on resize. */
  aspect: number;
};

export type AnnotElement = TextElement | ImageElement;

export type PageInfo = { page: number; wPt: number; hPt: number };

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/* ------------------------------------------------------------------ */
/* Undo / redo hook                                                    */
/* ------------------------------------------------------------------ */

export function useUndoableElements(initial: AnnotElement[] = []) {
  const [state, setState] = useState<AnnotElement[]>(initial);
  const past = useRef<AnnotElement[][]>([]);
  const future = useRef<AnnotElement[][]>([]);

  const commit = useCallback(
    (next: AnnotElement[] | ((prev: AnnotElement[]) => AnnotElement[])) => {
      setState((prev) => {
        const value =
          typeof next === "function" ? (next as (p: AnnotElement[]) => AnnotElement[])(prev) : next;
        past.current.push(prev);
        if (past.current.length > 80) past.current.shift();
        future.current = [];
        return value;
      });
    },
    [],
  );

  const undo = useCallback(() => {
    setState((prev) => {
      const p = past.current.pop();
      if (!p) return prev;
      future.current.push(prev);
      return p;
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      const n = future.current.pop();
      if (!n) return prev;
      past.current.push(prev);
      return n;
    });
  }, []);

  const reset = useCallback((v: AnnotElement[]) => {
    past.current = [];
    future.current = [];
    setState(v);
  }, []);

  return {
    elements: state,
    setElements: commit,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/* File → data-URL helper                                              */
/* ------------------------------------------------------------------ */

export async function imageFileToElementPayload(file: File): Promise<{
  dataUrl: string;
  mime: "image/png" | "image/jpeg";
  aspect: number;
}> {
  const buf = await file.arrayBuffer();
  const mime: "image/png" | "image/jpeg" = file.type === "image/png" ? "image/png" : "image/jpeg";
  // Re-encode non-jpeg/png (e.g. webp/heic) as JPEG so pdf-lib can embed it.
  if (file.type !== "image/png" && file.type !== "image/jpeg") {
    const blob = new Blob([buf]);
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = url;
      });
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d")?.drawImage(img, 0, 0);
      const jpeg = c.toDataURL("image/jpeg", 0.9);
      return { dataUrl: jpeg, mime: "image/jpeg", aspect: img.naturalWidth / img.naturalHeight };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const blob = new Blob([buf], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    const reader = new FileReader();
    const dataUrl: string = await new Promise((res, rej) => {
      reader.onload = () => res(String(reader.result));
      reader.onerror = () => rej(reader.error);
      reader.readAsDataURL(new Blob([buf], { type: mime }));
    });
    return { dataUrl, mime, aspect: img.naturalWidth / img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const [, b64] = dataUrl.split(",");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 };
}
