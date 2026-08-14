/**
 * Coffre-fort — inline previewer for protected items.
 *
 * Renders directly inside the vault route, without going through the
 * public UniversalViewer, so protected files are never displayed via
 * routes that could leak into recents / gallery. Uses `Capacitor.convertFileSrc`
 * on native to build a WebView-safe URL for the vault path; on web preview
 * it degrades to a friendly placeholder.
 */
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  GfDocument as FileText,
  GfFavorite as Star,
  GfTrash as Trash2,
  GfRestore as Undo2,
} from "@/components/icons";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { formatSize } from "@/lib/files/format";
import { isAndroidNative, nativePlugin } from "@/lib/native/geniusfiles-native";
import { toPreviewTarget } from "@/lib/vault/api";
import type { VaultItem } from "@/lib/vault/types";

function convertFileSrc(absolute: string): string {
  if (typeof window === "undefined") return absolute;
  const cap = (window as unknown as { Capacitor?: { convertFileSrc?: (p: string) => string } })
    .Capacitor;
  if (cap?.convertFileSrc) return cap.convertFileSrc(absolute);
  return absolute;
}

export function VaultPreview({
  open,
  item,
  onClose,
  onRestore,
  onDelete,
  onToggleFavorite,
}: {
  open: boolean;
  item: VaultItem | null;
  onClose: () => void;
  onRestore: (item: VaultItem) => void;
  onDelete: (item: VaultItem) => void;
  onToggleFavorite: (item: VaultItem) => void;
}) {
  const t = useT();
  if (!open || !item) return null;
  const { absolute } = toPreviewTarget(item);
  const url = isAndroidNative() && absolute ? convertFileSrc(absolute) : "";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      <header className="glass-panel flex items-center gap-2 border-b border-border px-3 pb-2 pl-safe pr-safe pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
        <button
          type="button"
          aria-label={t("action.close")}
          onClick={onClose}
          className="rounded-full border border-border bg-surface p-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{item.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {t("vault.preview.subtitle", { size: formatSize(item.size) })}
          </p>
        </div>
        <button
          type="button"
          aria-label={t("vault.item.favoriteAria")}
          onClick={() => onToggleFavorite(item)}
          className={`rounded-full border border-border bg-surface p-1.5 ${
            item.favorite ? "text-amber-400" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Star className="h-4 w-4" fill={item.favorite ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          aria-label={t("action.restore")}
          onClick={() => onRestore(item)}
          className="rounded-full border border-border bg-surface p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={t("action.deleteForever")}
          onClick={() => onDelete(item)}
          className="rounded-full border border-red-500/30 bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-hidden bg-black/40 p-2">
        <PreviewBody item={item} url={url} />
      </div>
    </div>
  );
}

function PreviewBody({ item, url }: { item: VaultItem; url: string }) {
  const t = useT();
  if (item.isDirectory) return <Placeholder label={t("vault.preview.noDirPreview")} />;
  if (!isAndroidNative()) return <Placeholder label={t("vault.preview.webOnly")} />;

  switch (item.kind) {
    case "image":
      return (
        <img src={url} alt={item.name} className="max-h-full max-w-full rounded object-contain" />
      );
    case "video":
      return (
        <video
          src={url}
          controls
          playsInline
          className="max-h-full max-w-full rounded"
          preload="metadata"
        />
      );
    case "audio":
      return (
        <div className="flex w-full max-w-md flex-col items-center gap-3 px-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <FileText className="h-10 w-10" />
          </div>
          <audio src={url} controls className="w-full" preload="metadata" />
        </div>
      );
    case "pdf":
      return <iframe src={url} title={item.name} className="h-full w-full rounded bg-white" />;
    case "text":
    case "code":
      return <TextPreview absolute={item.vaultAbsolutePath ?? ""} />;
    default:
      return <Placeholder label={t("vault.preview.unsupported")} />;
  }
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="max-w-sm px-6 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
        <FileText className="h-6 w-6" />
      </div>
      <p className="text-[13px] text-muted-foreground">{label}</p>
    </div>
  );
}

function TextPreview({ absolute }: { absolute: string }) {
  const t = useT();
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const p = nativePlugin();
    if (!p) {
      setError(t("vault.preview.unavailable"));
      return;
    }
    p.readFileBase64({ path: absolute })
      .then((res) => {
        if (cancelled) return;
        try {
          const bin = atob(res.data);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
          setContent(text.slice(0, 200_000));
        } catch {
          setError(t("vault.preview.unreadable"));
        }
      })
      .catch(() => {
        if (!cancelled) setError(t("vault.preview.unreadable"));
      });
    return () => {
      cancelled = true;
    };
  }, [absolute, t]);
  if (error) return <Placeholder label={error} />;
  if (content == null)
    return (
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("vault.loading")}
      </div>
    );
  return (
    <pre className="h-full w-full overflow-auto rounded bg-surface p-3 text-[11px] leading-snug text-foreground">
      {content}
    </pre>
  );
}
