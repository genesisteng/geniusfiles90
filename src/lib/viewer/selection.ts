/**
 * Sélection de texte dans les lecteurs de documents.
 *
 * Fournit des actions cohérentes (tout sélectionner, copier, partager)
 * pour tous les lecteurs, en complément de la sélection système Android
 * (appui long → poignées + menu natif).
 */

/** Sélectionne l'intégralité du texte contenu dans `el`. */
export function selectAllIn(el: HTMLElement | null): void {
  if (!el || typeof window === "undefined") return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Texte actuellement sélectionné, ou tout le contenu si rien n'est sélectionné. */
export function selectedTextOr(el: HTMLElement | null): string {
  const sel = typeof window !== "undefined" ? window.getSelection()?.toString() : "";
  if (sel && sel.trim()) return sel;
  return el?.innerText ?? "";
}

export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fallback ci-dessous */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function shareText(text: string, title?: string): Promise<void> {
  if (!text) return;
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (typeof nav.share === "function") {
    try {
      await nav.share({ text, title });
      return;
    } catch {
      /* annulé ou indisponible → copie */
    }
  }
  await copyText(text);
}

/* ------------------------------------------------------------------ */
/*                 Sélection du mot sous le doigt                      */
/* ------------------------------------------------------------------ */

type CaretDoc = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
};

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  if (typeof document === "undefined") return null;
  const doc = document as CaretDoc;
  const range = doc.caretRangeFromPoint?.(x, y);
  if (range) return { node: range.startContainer, offset: range.startOffset };
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (pos) return { node: pos.offsetNode, offset: pos.offset };
  return null;
}

const isWordChar = (c: string | undefined) => !!c && !/[\s\u00a0]/.test(c);

/**
 * Sélectionne le mot situé exactement sous le point écran (x, y).
 * Retourne vrai si une sélection réelle a été posée (poignées système).
 */
export function selectWordAtPoint(x: number, y: number): boolean {
  const caret = caretAt(x, y);
  if (!caret) return false;
  const { node } = caret;
  if (node.nodeType !== Node.TEXT_NODE) return false;
  const text = node.textContent ?? "";
  if (!text.trim()) return false;

  let start = Math.min(caret.offset, Math.max(0, text.length - 1));
  if (!isWordChar(text[start])) {
    if (start > 0 && isWordChar(text[start - 1])) start -= 1;
    else return false;
  }
  let end = start;
  while (start > 0 && isWordChar(text[start - 1])) start -= 1;
  while (end < text.length && isWordChar(text[end])) end += 1;
  if (end <= start) return false;

  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}
