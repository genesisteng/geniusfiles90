/**
 * SelectionToolbar — barre d'actions contextuelle affichée uniquement
 * lorsqu'un texte est sélectionné dans une zone de lecture.
 *
 * Elle suit la zone sélectionnée (au-dessus si la place le permet, sinon
 * en dessous), se repositionne pour rester à l'écran, et disparaît dès que
 * la sélection est vide. Les actions de sélection ne sont jamais mélangées
 * aux actions générales du lecteur.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Copy, Share2, TextSelect, X } from "lucide-react";
import { copyText, selectAllIn, shareText } from "@/lib/viewer/selection";
import { useT } from "@/lib/i18n";

type Anchor = { left: number; top: number; below: boolean; text: string };

const BAR_HEIGHT = 44;
const GAP = 12; // distance aux poignées de sélection

function readAnchor(container: HTMLElement | null): Anchor | null {
  if (!container || typeof window === "undefined") return null;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.startContainer) && !container.contains(range.endContainer))
    return null;
  const text = sel.toString();
  if (!text.trim()) return null;
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  if (!rects.length) return null;
  const top = Math.min(...rects.map((r) => r.top));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const center = (left + right) / 2;
  const above = top - GAP - BAR_HEIGHT;
  const below = above < 8;
  return {
    left: center,
    top: below ? Math.min(window.innerHeight - BAR_HEIGHT - 8, bottom + GAP) : above,
    below,
    text,
  };
}

export function SelectionToolbar({
  containerRef,
  title,
  onSelectAll,
}: {
  containerRef: RefObject<HTMLElement | null>;
  title?: string;
  onSelectAll?: () => void;
}) {
  const t = useT();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  const sync = useCallback(() => {
    setAnchor(readAnchor(containerRef.current));
  }, [containerRef]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const schedule = () => window.requestAnimationFrame(sync);
    document.addEventListener("selectionchange", schedule);
    window.addEventListener("resize", schedule);
    const scroller = containerRef.current;
    scroller?.addEventListener("scroll", schedule, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("resize", schedule);
      scroller?.removeEventListener("scroll", schedule);
    };
  }, [sync, containerRef]);

  if (!anchor) return null;

  const half = 118; // demi-largeur estimée, recentrée par clamp
  const left = Math.min(Math.max(anchor.left, half + 8), window.innerWidth - half - 8);

  const clear = () => window.getSelection()?.removeAllRanges();

  return (
    <div
      ref={barRef}
      role="toolbar"
      className="fixed z-[75] -translate-x-1/2 animate-scale-in"
      style={{ left, top: anchor.top }}
      onPointerDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5 rounded-2xl bg-popover/98 p-1 text-popover-foreground shadow-elevated backdrop-blur">
        <Action
          icon={Copy}
          label={t("viewer.selection.copy")}
          onClick={() => {
            void copyText(anchor.text);
            clear();
          }}
        />
        <Action
          icon={TextSelect}
          label={t("viewer.selection.selectAll")}
          onClick={() => {
            if (onSelectAll) onSelectAll();
            else selectAllIn(containerRef.current);
            window.requestAnimationFrame(sync);
          }}
        />
        <Action
          icon={Share2}
          label={t("viewer.selection.share")}
          onClick={() => {
            void shareText(anchor.text, title);
          }}
        />
        <button
          type="button"
          aria-label={t("viewer.selection.close")}
          onClick={clear}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-popover-foreground/60 active:bg-foreground/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-medium active:bg-foreground/10"
    >
      <Icon className="h-4 w-4" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
