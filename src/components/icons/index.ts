/**
 * Point d'entrée unique du système d'icônes GeniusFiles.
 *
 * Toute l'application importe ses icônes ici : c'est ce qui garantit qu'une
 * même signification garde partout la même forme, la même graisse et la
 * même couleur.
 */
export { Accent, GfIconBase, createGfIcon } from "./GfIcon";
export type { GfIconProps, GfIconComponent } from "./GfIcon";
export * from "./gf-icons";
export * from "./gf-actions";

import type { ReactNode } from "react";

/**
 * Type d'icône accepté par les composants d'interface : couvre aussi bien
 * les icônes GeniusFiles que les icônes de bibliothèque encore utilisées
 * pour la chrome neutre (chevrons, croix). Permet de migrer écran par
 * écran sans casser le typage.
 */
export type AppIcon = (props: {
  className?: string;
  strokeWidth?: number;
  size?: number | string;
}) => ReactNode;

import type { GfIconComponent } from "./GfIcon";
import {
  GfApk,
  GfArchive,
  GfAudio,
  GfCode,
  GfDocument,
  GfExternalStorage,
  GfFile,
  GfFolder,
  GfFont,
  GfImage,
  GfInternalStorage,
  GfNetworkStorage,
  GfPdf,
  GfSdCard,
  GfText,
  GfUsbDrive,
  GfVideo,
} from "./gf-icons";

/** Catégories de fichiers : une silhouette propre par famille, jamais une couleur seule. */
export const FILE_KIND_ICON = {
  folder: GfFolder,
  image: GfImage,
  video: GfVideo,
  audio: GfAudio,
  document: GfDocument,
  pdf: GfPdf,
  archive: GfArchive,
  code: GfCode,
  apk: GfApk,
  text: GfText,
  font: GfFont,
  other: GfFile,
} satisfies Record<string, GfIconComponent>;

/** Stockages : même bloc de base, détail distinctif par support. */
export const STORAGE_ICON = {
  internal: GfInternalStorage,
  sd: GfSdCard,
  usb: GfUsbDrive,
  external: GfExternalStorage,
  network: GfNetworkStorage,
} satisfies Record<string, GfIconComponent>;
