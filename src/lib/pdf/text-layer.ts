/**
 * Couche de texte sélectionnable pour les PDF.
 *
 * - PDF « texte » : on utilise la vraie TextLayer de pdf.js, qui place des
 *   <span> transparents exactement au-dessus des glyphes. La sélection est
 *   donc celle du système (poignées Android, menu Copier / Partager /
 *   Rechercher / Traduire), mot par mot et multi-lignes.
 * - PDF « image » (scan) : aucun texte extractible → OCR automatique du
 *   rendu canvas, puis génération de spans positionnés à partir des boîtes
 *   de mots. L'utilisateur n'a rien à déclencher.
 *
 * Précision de la sélection : comme dans le viewer officiel de pdf.js, on
 * ajoute un élément `.endOfContent` et on marque la couche active pendant
 * le geste (`.selecting`). Sans cela, un appui long qui « dépasse » du
 * texte fait sauter la sélection sur toute la page (voire les pages
 * suivantes) au lieu de rester sur le mot touché.
 *
 * Tout est paresseux : aucun coût pour les PDF texte, et l'OCR n'est chargé
 * (import dynamique) que si une page en a réellement besoin.
 */
import type { PdfPage, PdfViewport } from "@/lib/pdf/pdfjs";

type TextLayerCtor = new (opts: {
  textContentSource: unknown;
  container: HTMLElement;
  viewport: PdfViewport;
}) => { render: () => Promise<void>; cancel?: () => void };

let ocrWorker: Promise<{
  recognize: (
    img: HTMLCanvasElement,
  ) => Promise<{ data: { words?: { text: string; bbox: OcrBox }[] } }>;
  terminate: () => Promise<unknown>;
}> | null = null;

type OcrBox = { x0: number; y0: number; x1: number; y1: number };

async function getOcrWorker() {
  if (!ocrWorker) {
    ocrWorker = (async () => {
      const { createWorker } = await import("tesseract.js");
      return (await createWorker(["fra", "eng"])) as unknown as Awaited<
        NonNullable<typeof ocrWorker>
      >;
    })();
  }
  return ocrWorker;
}

/** Libère le worker OCR (appelé à la fermeture du lecteur). */
export async function releaseOcr(): Promise<void> {
  const w = ocrWorker;
  ocrWorker = null;
  try {
    await (await w)?.terminate();
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/*        Gestion globale du geste de sélection (précision)            */
/* ------------------------------------------------------------------ */

let gestureBound = false;

/** Vrai si la sélection courante vit à l'intérieur de `el`. */
export function hasSelectionInside(el: HTMLElement | null): boolean {
  if (!el || typeof window === "undefined") return false;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  return el.contains(range.startContainer) || el.contains(range.endContainer);
}

/** Numéro de page (`[data-page]`) contenant la sélection courante, sinon null. */
export function selectedPageNumber(): number | null {
  if (typeof window === "undefined") return null;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const node = sel.getRangeAt(0).startContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  const page = el?.closest?.("[data-page]") as HTMLElement | null;
  const n = Number(page?.dataset.page);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function clearSelecting() {
  document.querySelectorAll(".textLayer.selecting").forEach((el) => {
    el.classList.remove("selecting");
  });
}

function bindSelectionGesture() {
  if (gestureBound || typeof document === "undefined") return;
  gestureBound = true;

  document.addEventListener(
    "pointerdown",
    (e) => {
      const target = e.target as HTMLElement | null;
      const layer = target?.closest?.(".textLayer") as HTMLElement | null;
      clearSelecting();
      // Seule la couche réellement touchée devient « active » : la
      // sélection ne peut donc pas déborder sur les pages voisines.
      layer?.classList.add("selecting");
    },
    { capture: true, passive: true },
  );

  const end = () => {
    // On garde la classe le temps que le système finalise la sélection,
    // sinon les poignées repositionnent la fin sur toute la page.
    window.setTimeout(clearSelecting, 0);
  };
  document.addEventListener("pointerup", end, { capture: true, passive: true });
  document.addEventListener("pointercancel", end, { capture: true, passive: true });
}

/**
 * Peuple `container` avec une couche de texte sélectionnable pour `page`.
 * Retourne une fonction d'annulation.
 */
export function renderSelectableText(opts: {
  page: PdfPage;
  viewport: PdfViewport;
  container: HTMLElement;
  canvas: HTMLCanvasElement | null;
  cssWidth: number;
  cssHeight: number;
}): () => void {
  const { page, viewport, container, canvas, cssWidth, cssHeight } = opts;
  let cancelled = false;

  bindSelectionGesture();

  // Si une sélection vit déjà dans cette couche (re-render transitoire lié
  // au zoom ou à la fenêtre de rendu), on ne la détruit pas : la sélection
  // système — et donc son menu — reste vivante.
  const keepSelection = hasSelectionInside(container);
  if (!keepSelection) container.textContent = "";
  const scaleFactor = String((viewport as { scale?: number }).scale ?? 1);
  container.style.setProperty("--total-scale-factor", scaleFactor);
  container.style.setProperty("--scale-factor", scaleFactor);
  container.style.width = `${cssWidth}px`;
  container.style.height = `${cssHeight}px`;

  const appendEndOfContent = () => {
    if (cancelled) return;
    if (container.querySelector(":scope > .endOfContent")) return;
    const end = document.createElement("div");
    end.className = "endOfContent";
    container.append(end);
  };

  (async () => {
    const textContent = await page.getTextContent();
    if (cancelled) return;
    const hasText = textContent.items.some((it) => it.str && it.str.trim().length > 0);

    if (hasText) {
      if (keepSelection) {
        appendEndOfContent();
        return;
      }
      const mod = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
        TextLayer?: TextLayerCtor;
      };
      if (cancelled || !mod.TextLayer) return;
      const layer = new mod.TextLayer({
        textContentSource: textContent,
        container,
        viewport,
      });
      await layer.render();
      appendEndOfContent();
      return;
    }

    // ---- PDF scanné : OCR automatique ----
    if (!canvas || keepSelection) return;
    try {
      const worker = await getOcrWorker();
      if (cancelled) return;
      const { data } = await worker.recognize(canvas);
      if (cancelled || !data.words?.length) return;
      const sx = cssWidth / canvas.width;
      const sy = cssHeight / canvas.height;

      // Ordre naturel de lecture : lignes de haut en bas, mots de gauche
      // à droite. Sans ce tri, la sélection « saute » d'un mot à l'autre.
      const words = data.words
        .filter((w) => w.text?.trim())
        .map((w) => ({
          text: w.text,
          left: w.bbox.x0 * sx,
          top: w.bbox.y0 * sy,
          width: Math.max(2, (w.bbox.x1 - w.bbox.x0) * sx),
          height: Math.max(6, (w.bbox.y1 - w.bbox.y0) * sy),
        }))
        .sort((a, b) => {
          const line = a.top + a.height / 2 - (b.top + b.height / 2);
          if (Math.abs(line) > Math.min(a.height, b.height) * 0.6) return line;
          return a.left - b.left;
        });

      const frag = document.createDocumentFragment();
      for (const w of words) {
        const span = document.createElement("span");
        span.textContent = `${w.text} `;
        span.style.cssText =
          `position:absolute;left:${w.left}px;top:${w.top}px;` +
          `height:${w.height}px;font-size:${w.height}px;line-height:${w.height}px;` +
          `color:transparent;white-space:pre;transform-origin:0 0;`;
        frag.appendChild(span);
      }
      if (cancelled) return;
      container.appendChild(frag);

      // Ajustement de la largeur réelle de chaque mot : les poignées de
      // sélection collent alors exactement aux bords du mot rendu.
      const spans = Array.from(container.querySelectorAll("span"));
      spans.forEach((span, i) => {
        const target = words[i];
        if (!target) return;
        const natural = (span as HTMLElement).getBoundingClientRect().width;
        if (natural > 0) {
          (span as HTMLElement).style.transform = `scaleX(${target.width / natural})`;
        }
      });
      appendEndOfContent();
    } catch {
      /* OCR indisponible (hors-ligne / modèle absent) — silencieux */
    }
  })().catch(() => {
    /* annulation ou erreur transitoire */
  });

  return () => {
    cancelled = true;
    // Ne jamais détruire la couche pendant que l'utilisateur sélectionne :
    // un simple re-render (zoom, fenêtre de rendu, effet remonté) effaçait
    // la sélection et faisait disparaître le menu système.
    if (!hasSelectionInside(container)) container.textContent = "";
  };
}
