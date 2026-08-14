import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  GfDocument,
  GfDownload,
  GfEmptyFiles,
  GfFavorite,
  GfFolder,
  GfImage,
  GfInternalStorage,
  GfLowSpace,
  GfNoResults,
  GfNotFound,
  GfOffline,
  GfOpenFailed,
  GfPermission,
  GfAudio,
  GfTrash,
  GfVideo,
  GfWarning,
  GfError,
  type GfIconComponent,
} from "@/components/icons";
import { emptyIllustrationCopy, type EmptyIllustrationId } from "@/lib/copy/empty-illustrations";

/**
 * État vide de GeniusFiles.
 *
 * Une seule famille d'icônes — celle dessinée pour l'application — posée
 * dans un halo doux qui donne à l'écran une intention visuelle sans
 * illustration lourde. Rendu identique et parfaitement contrasté en thème
 * clair comme en thème sombre, coût mémoire nul.
 */
const ICONS: Record<EmptyIllustrationId, GfIconComponent> = {
  files: GfEmptyFiles,
  documents: GfDocument,
  images: GfImage,
  videos: GfVideo,
  audio: GfAudio,
  downloads: GfDownload,
  favorites: GfFavorite,
  trash: GfTrash,
  search: GfNoResults,
  folder: GfFolder,
  storage: GfInternalStorage,
  permission: GfPermission,
  network: GfOffline,
  notFound: GfNotFound,
  openFailed: GfOpenFailed,
  lowSpace: GfLowSpace,
  unknownError: GfWarning,
  operationFailed: GfError,
};

export function IllustratedEmptyState({
  id,
  title,
  description,
  action,
  tone = "default",
  className = "",
}: {
  id: EmptyIllustrationId;
  /** Surcharge facultative (chaînes déjà localisées). */
  title?: string;
  description?: string;
  action?: ReactNode;
  /** « inverted » : posé sur un fond sombre de lecteur (contraste inversé). */
  tone?: "default" | "inverted";
  className?: string;
}) {
  const copy = useMemo(() => emptyIllustrationCopy(id), [id]);
  const Icon = ICONS[id];

  return (
    <div
      className={`flex min-h-[42vh] w-full flex-col items-center justify-center px-6 pb-[8vh] pt-6 text-center sm:min-h-[58vh] sm:pb-[12vh] ${className}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] ${
          tone === "inverted"
            ? "bg-reader-backdrop-foreground/10 text-reader-backdrop-foreground/80"
            : "bg-secondary/50 text-muted-foreground"
        }`}
      >
        <Icon size={44} strokeWidth={1.5} />
      </span>
      <div className="gf-empty-copy mt-4 flex max-w-[320px] shrink-0 flex-col items-center gap-1.5">
        <p
          className={`text-[17px] font-semibold leading-snug ${
            tone === "inverted" ? "text-reader-backdrop-foreground" : "text-foreground"
          }`}
        >
          {title ?? copy.title}
        </p>
        <p
          className={`text-[13.5px] leading-relaxed ${
            tone === "inverted" ? "text-reader-backdrop-foreground/70" : "text-muted-foreground"
          }`}
        >
          {description ?? copy.description}
        </p>
        {action ? <div className="pt-3">{action}</div> : null}
      </div>
    </div>
  );
}
