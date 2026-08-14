/**
 * Lightweight PDF-operation history, sharing the same storage semantics as
 * `src/lib/files/history.ts`. Stored under its own key so the future
 * "Operations" screen can present PDF actions in a dedicated section.
 */
export type PdfOpKind =
  | "merge"
  | "split"
  | "extract"
  | "delete-pages"
  | "rotate"
  | "reorder"
  | "compress"
  | "images-to-pdf"
  | "scan"
  | "duplicate"
  | "rename";

export type PdfOpRecord = {
  id: string;
  at: number;
  kind: PdfOpKind;
  summary: string;
  sources: string[];
  outputs: string[];
};

const KEY = "gf.pdf.history";
const MAX = 100;

function read(): PdfOpRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(items: PdfOpRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function recordPdfOp(op: Omit<PdfOpRecord, "id" | "at">): PdfOpRecord {
  const rec: PdfOpRecord = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    ...op,
  };
  write([rec, ...read()]);
  return rec;
}

export function loadPdfHistory(): PdfOpRecord[] {
  return read();
}
