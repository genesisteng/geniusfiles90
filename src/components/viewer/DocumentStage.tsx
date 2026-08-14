/**
 * DocumentStage — offline renderer for Office/Ebook documents.
 *
 * Extracts a normalized block structure from DOCX / XLSX / PPTX / ODT /
 * ODS / ODP / RTF / EPUB (via src/lib/pdf/office.ts) and paints it inside
 * the Universal Viewer with a modern, thumb-friendly bottom toolbar
 * (zoom, search, page jump). No dependency on external viewers.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, ZoomIn, ZoomOut, Type, ChevronUp, ChevronDown, X, SquarePen } from "lucide-react";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { extOf } from "@/lib/files/format";
import { absolutePathOf } from "@/lib/viewer/source";
import { readBytes } from "@/lib/pdf/native-io";
import type { ReaderTool } from "@/lib/viewer/reader-tools";
import {
  docxToBlocks,
  epubToBlocks,
  pptxToBlocks,
  rtfToBlocks,
  xlsxToBlocks,
  type OfficeBlock,
  type OfficeDocument,
} from "@/lib/pdf/office";
import { SelectionToolbar } from "@/components/viewer/SelectionToolbar";
import { selectAllIn } from "@/lib/viewer/selection";
import { QuickScrollFab } from "@/components/common/QuickScrollFab";
import { useT } from "@/lib/i18n";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; doc: OfficeDocument }
  | { status: "error"; message: string };

export function DocumentStage({
  parent,
  entry,
  onTools,
  onEdit,
}: {
  parent: PathRef;
  entry: FileEntry;
  onTools?: (tools: ReaderTool[]) => void;
  /** Fourni pour les formats modifiables (.docx) : ouvre l'éditeur Word. */
  onEdit?: () => void;
}) {
  const t = useT();
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [zoom, setZoom] = useState(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const ext = (extOf(entry.name) ?? "").toLowerCase();

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        const abs = absolutePathOf(parent, entry);
        const bytes = await readBytes(abs);
        let doc: OfficeDocument;
        if (ext === "docx" || ext === "odt") doc = await docxToBlocks(bytes);
        else if (ext === "xlsx" || ext === "xls" || ext === "ods") doc = await xlsxToBlocks(bytes);
        else if (ext === "pptx" || ext === "odp" || ext === "ppt") doc = await pptxToBlocks(bytes);
        else if (ext === "rtf") doc = rtfToBlocks(bytes);
        else if (ext === "epub") doc = await epubToBlocks(bytes);
        else throw new Error(t("viewer.document.unsupportedFormat", { ext }));
        if (!cancelled) setState({ status: "ready", doc });
      } catch (e) {
        if (!cancelled)
          setState({
            status: "error",
            message: (e as Error)?.message ?? t("viewer.text.error.readFailed"),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parent, entry, ext, t]);

  const matches = useMemo(() => {
    if (!query || state.status !== "ready") return [] as number[];
    const q = query.toLowerCase();
    const out: number[] = [];
    state.doc.blocks.forEach((b, i) => {
      const text = blockText(b).toLowerCase();
      if (text.includes(q)) out.push(i);
    });
    return out;
  }, [query, state]);

  useEffect(() => {
    if (!matches.length) return;
    setMatchIndex((v) => Math.min(v, matches.length - 1));
    const el = scrollRef.current?.querySelector(
      `[data-block-index="${matches[Math.min(matchIndex, matches.length - 1)]}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [matches, matchIndex]);

  const nextMatch = useCallback(
    () => setMatchIndex((v) => (matches.length ? (v + 1) % matches.length : 0)),
    [matches.length],
  );
  const prevMatch = useCallback(
    () => setMatchIndex((v) => (matches.length ? (v - 1 + matches.length) % matches.length : 0)),
    [matches.length],
  );

  /* Les commandes sont exposées au menu du lecteur : plus aucune barre
     flottante ne recouvre le document. */

  useEffect(() => {
    if (!onTools) return;
    onTools([
      {
        id: "zoom-in",
        label: t("viewer.document.zoomIn"),
        icon: ZoomIn,
        onSelect: () => setZoom((z) => Math.min(2, z + 0.1)),
        value: `${Math.round(zoom * 100)} %`,
        disabled: zoom >= 1.99,
        keepOpen: true,
      },
      {
        id: "zoom-out",
        label: t("viewer.document.zoomOut"),
        icon: ZoomOut,
        onSelect: () => setZoom((z) => Math.max(0.7, z - 0.1)),
        disabled: zoom <= 0.71,
        keepOpen: true,
      },
      {
        id: "zoom-reset",
        label: t("viewer.document.zoomReset"),
        icon: Type,
        onSelect: () => setZoom(1),
      },
      {
        id: "search",
        label: t("viewer.document.search"),
        icon: Search,
        onSelect: () => setSearchOpen(true),
      },
      ...(onEdit
        ? [
            {
              id: "edit-word",
              label: t("viewer.document.editWord"),
              icon: SquarePen,
              onSelect: onEdit,
            } satisfies ReaderTool,
          ]
        : []),
    ]);
  }, [onTools, zoom, onEdit, t]);

  return (
    <div className="relative flex h-full w-full flex-col">
      {searchOpen ? (
        <div className="flex shrink-0 select-none items-center gap-2 border-b border-border bg-reader-header px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-reader-header-foreground/70" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMatchIndex(0);
            }}
            placeholder={t("viewer.document.search")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-reader-header-foreground outline-none placeholder:text-reader-header-foreground/40"
          />
          <span className="shrink-0 text-[11px] text-reader-header-foreground/60">
            {matches.length ? `${matchIndex + 1}/${matches.length}` : "0"}
          </span>
          <button
            type="button"
            onClick={prevMatch}
            className="rounded-full p-1 text-reader-header-foreground/80 active:scale-95"
            aria-label={t("viewer.document.previous")}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={nextMatch}
            className="rounded-full p-1 text-reader-header-foreground/80 active:scale-95"
            aria-label={t("viewer.document.next")}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            className="rounded-full p-1 text-reader-header-foreground/80 active:scale-95"
            aria-label={t("viewer.document.closeSearch")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        data-gf-reader="true"
        className="flex-1 overflow-y-auto overscroll-contain bg-reader-surface text-reader-ink"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {state.status === "loading" ? (
          <div className="p-6 text-center text-[13px] text-reader-muted">
            {t("viewer.document.loading")}
          </div>
        ) : state.status === "error" ? (
          <div className="p-6 text-center text-[13px] text-red-600">
            {t("viewer.document.error", { message: state.message })}
          </div>
        ) : state.status === "ready" ? (
          <div
            data-gf-selectable="true"
            className="mx-auto max-w-[720px] px-5 pb-28 pt-6 sm:px-8"
            style={{ fontSize: `${zoom}rem`, lineHeight: 1.65 }}
          >
            {state.doc.title ? (
              <h1 className="mb-4 text-2xl font-bold">{state.doc.title}</h1>
            ) : null}
            {state.doc.blocks.map((b, i) => (
              <BlockView
                key={i}
                block={b}
                query={query}
                index={i}
                isActive={matches[matchIndex] === i}
              />
            ))}
          </div>
        ) : null}
      </div>
      {/* Barre contextuelle : uniquement quand du texte est sélectionné. */}
      <SelectionToolbar
        containerRef={scrollRef}
        title={entry.name}
        onSelectAll={() =>
          selectAllIn(scrollRef.current?.querySelector("[data-gf-selectable]") ?? scrollRef.current)
        }
      />
      {/* Navigation rapide : pilote uniquement le contenu, jamais le header. */}
      <QuickScrollFab targetRef={scrollRef} topInset={16} bottomInset={24} />
    </div>
  );
}

function blockText(b: OfficeBlock): string {
  switch (b.kind) {
    case "heading":
    case "paragraph":
      return b.text;
    case "list":
      return b.items.join(" ");
    case "table":
      return b.rows.flat().join(" ");
    default:
      return "";
  }
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(q);
  while (idx !== -1) {
    if (idx > i) out.push(text.slice(i, idx));
    out.push(
      <mark key={idx} className="rounded bg-yellow-300/70 px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>,
    );
    i = idx + query.length;
    idx = lower.indexOf(q, i);
  }
  if (i < text.length) out.push(text.slice(i));
  return <>{out}</>;
}

function BlockView({
  block,
  query,
  index,
  isActive,
}: {
  block: OfficeBlock;
  query: string;
  index: number;
  isActive: boolean;
}) {
  const ringCls = isActive ? "ring-2 ring-primary/60 rounded" : "";
  switch (block.kind) {
    case "heading": {
      const cls =
        block.level === 1
          ? "text-2xl font-bold mt-6 mb-3"
          : block.level === 2
            ? "text-xl font-semibold mt-5 mb-2"
            : "text-lg font-semibold mt-4 mb-2";
      return (
        <div data-block-index={index} className={ringCls}>
          <p className={cls}>
            <Highlight text={block.text} query={query} />
          </p>
        </div>
      );
    }
    case "paragraph":
      return (
        <p data-block-index={index} className={`my-2 ${ringCls}`}>
          <Highlight text={block.text} query={query} />
        </p>
      );
    case "list":
      return (
        <div data-block-index={index} className={ringCls}>
          {block.ordered ? (
            <ol className="my-2 list-decimal space-y-1 pl-6">
              {block.items.map((it, i) => (
                <li key={i}>
                  <Highlight text={it} query={query} />
                </li>
              ))}
            </ol>
          ) : (
            <ul className="my-2 list-disc space-y-1 pl-6">
              {block.items.map((it, i) => (
                <li key={i}>
                  <Highlight text={it} query={query} />
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "table":
      return (
        <div data-block-index={index} className={`my-3 overflow-x-auto ${ringCls}`}>
          <table className="min-w-full border-collapse text-[0.9em]">
            <tbody>
              {block.rows.map((row, r) => (
                <tr
                  key={r}
                  className={
                    r === 0 ? "bg-reader-backdrop font-semibold" : "border-t border-border"
                  }
                >
                  {row.map((cell, c) => (
                    <td key={c} className="border border-border px-2 py-1 align-top">
                      <Highlight text={cell} query={query} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "pageBreak":
      return <hr data-block-index={index} className="my-6 border-border-strong" />;
    default:
      return null;
  }
}
