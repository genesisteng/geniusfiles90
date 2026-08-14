import { useState } from "react";
import type { FileKind } from "@/lib/files/types";
import { useThumbnail } from "@/hooks/use-thumbnail";
import { isAndroidNative } from "@/lib/native/geniusfiles-native";
import { canThumbnail } from "@/lib/native/thumbnails";
import { FILE_KIND_ICON, type GfIconComponent } from "@/components/icons";

/**
 * Chaque catégorie possède sa propre silhouette dessinée (jamais la même
 * icône recolorée) ; la teinte ne fait que renforcer une forme déjà
 * distinctive, et reste lisible en thème clair comme en thème sombre.
 */
const MAP: Record<FileKind, { Icon: GfIconComponent; tone: string }> = {
  folder: { Icon: FILE_KIND_ICON.folder, tone: "bg-primary/12 text-primary" },
  image: {
    Icon: FILE_KIND_ICON.image,
    tone: "bg-[oklch(0.72_0.16_305/0.14)] text-[oklch(0.62_0.16_305)] dark:text-[oklch(0.82_0.16_305)]",
  },
  video: {
    Icon: FILE_KIND_ICON.video,
    tone: "bg-[oklch(0.72_0.18_25/0.14)] text-[oklch(0.58_0.18_25)] dark:text-[oklch(0.82_0.18_25)]",
  },
  audio: {
    Icon: FILE_KIND_ICON.audio,
    tone: "bg-[oklch(0.72_0.16_155/0.14)] text-[oklch(0.55_0.16_155)] dark:text-[oklch(0.82_0.16_155)]",
  },
  document: {
    Icon: FILE_KIND_ICON.document,
    tone: "bg-[oklch(0.72_0.16_235/0.14)] text-[oklch(0.55_0.14_235)] dark:text-[oklch(0.85_0.14_235)]",
  },
  pdf: {
    Icon: FILE_KIND_ICON.pdf,
    tone: "bg-[oklch(0.65_0.22_25/0.16)] text-[oklch(0.55_0.2_25)] dark:text-[oklch(0.82_0.18_25)]",
  },
  archive: {
    Icon: FILE_KIND_ICON.archive,
    tone: "bg-[oklch(0.78_0.16_75/0.14)] text-[oklch(0.58_0.14_75)] dark:text-[oklch(0.85_0.14_75)]",
  },
  code: {
    Icon: FILE_KIND_ICON.code,
    tone: "bg-[oklch(0.72_0.16_190/0.14)] text-[oklch(0.55_0.12_190)] dark:text-[oklch(0.85_0.14_190)]",
  },
  apk: {
    Icon: FILE_KIND_ICON.apk,
    tone: "bg-[oklch(0.72_0.17_155/0.14)] text-[oklch(0.55_0.16_155)] dark:text-[oklch(0.82_0.16_155)]",
  },
  text: { Icon: FILE_KIND_ICON.text, tone: "bg-secondary text-foreground/80" },
  font: { Icon: FILE_KIND_ICON.font, tone: "bg-secondary text-foreground/80" },
  other: { Icon: FILE_KIND_ICON.other, tone: "bg-secondary text-muted-foreground" },
};

/**
 * Miniatures légèrement agrandies, coins quasi droits : la vignette occupe
 * toute sa zone d'affichage pour un rendu de gestionnaire de fichiers natif.
 */
const DIMS = {
  sm: { box: "h-11 w-11", icon: "h-5 w-5", radius: "rounded-[4px]", px: 88 },
  md: { box: "h-13 w-13", icon: "h-6 w-6", radius: "rounded-[5px]", px: 104 },
  lg: { box: "h-[68px] w-[68px]", icon: "h-7 w-7", radius: "rounded-[6px]", px: 144 },
} as const;

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Aperçu déterministe pour la prévisualisation web (aucun fichier réel). */
function webPreviewUrl(path: string, px: number): string {
  return `https://picsum.photos/seed/gf-${hash(path) % 1000}/${px}/${px}`;
}

export function FileIcon({
  kind,
  size = "md",
  className = "",
  path,
}: {
  kind: FileKind;
  size?: "sm" | "md" | "lg";
  className?: string;
  /**
   * Chemin absolu du fichier. Fourni pour les images/vidéos, il déclenche
   * la génération (et la mise en cache disque) de la vraie miniature.
   */
  path?: string | null;
}) {
  const { box, icon, radius, px } = DIMS[size];
  const media = (kind === "image" || kind === "video") && !!path && canThumbnail(path, kind);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const thumb = useThumbnail(media ? (path as string) : null, px);
  const candidate = media
    ? (thumb ?? (isAndroidNative() ? null : webPreviewUrl(path as string, px)))
    : null;
  const src = candidate && candidate !== failedSrc ? candidate : null;
  const { Icon, tone } = MAP[kind];

  if (src) {
    // Placeholder = l'icône typée du fichier (jamais de plaque sombre) ;
    // la miniature se superpose en fondu une fois décodée.
    const ready = loadedSrc === src;
    return (
      <span
        className={`relative flex shrink-0 overflow-hidden ${box} items-center justify-center ${radius} ${tone} ${className}`}
      >
        {ready ? null : <Icon className={`${icon} opacity-70`} strokeWidth={2} />}
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 ${box} items-center justify-center ${radius} ${tone} ${className}`}
    >
      <Icon className={icon} strokeWidth={2} />
    </span>
  );
}
