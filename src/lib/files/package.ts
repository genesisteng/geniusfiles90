/**
 * Classification centrale des paquets Android.
 *
 * Un APK, un AAB et un XAPK sont *techniquement* des conteneurs ZIP, mais
 * fonctionnellement ce sont des paquets : GeniusFiles ne doit jamais les
 * router automatiquement vers le gestionnaire d'archives. Ce module est la
 * source de vérité unique utilisée par tous les points d'entrée (accueil,
 * dossiers, catégories, récents, recherche, coffre-fort…).
 *
 * La classification est purement lexicale (extension) : elle ne lit aucun
 * octet du fichier, donc elle reste instantanée même sur des paquets de
 * plusieurs gigaoctets.
 */
import type { FileEntry } from "./types";
import { extOf } from "./format";

export type PackageKind = "apk" | "aab" | "xapk";

const PACKAGE_EXTS: Record<string, PackageKind> = {
  apk: "apk",
  aab: "aab",
  xapk: "xapk",
  apks: "xapk", // conteneur multi-APK (bundletool) : même traitement que XAPK
  apkm: "xapk",
};

/** Le type de paquet d'un nom de fichier, ou null si ce n'en est pas un. */
export function packageKindOfName(name: string): PackageKind | null {
  const ext = extOf(name); // déjà normalisé en minuscules (.APK, .Zip…)
  if (!ext) return null;
  return PACKAGE_EXTS[ext] ?? null;
}

/** Le type de paquet d'une entrée du gestionnaire, ou null. */
export function packageKindOf(entry: FileEntry): PackageKind | null {
  if (entry.isDirectory) return null;
  return packageKindOfName(entry.name);
}

/** True quand l'ouverture doit passer par la fiche « paquet ». */
export function isPackageEntry(entry: FileEntry): boolean {
  return packageKindOf(entry) !== null;
}

/** Seul l'APK est installable par le mécanisme standard d'Android. */
export function isInstallablePackage(entry: FileEntry): boolean {
  return packageKindOf(entry) === "apk";
}

const LABELS: Record<PackageKind, string> = {
  apk: "APK",
  aab: "AAB",
  xapk: "XAPK",
};

const LONG_LABELS: Record<PackageKind, string> = {
  apk: "Application Android (APK)",
  aab: "Android App Bundle (AAB)",
  xapk: "Paquet XAPK",
};

export function packageLabel(kind: PackageKind): string {
  return LABELS[kind];
}

export function packageLongLabel(kind: PackageKind): string {
  return LONG_LABELS[kind];
}

/**
 * Le libellé de format à afficher dans le gestionnaire d'archives.
 * Le format réel signalé par le moteur natif est « zip » pour un APK/AAB :
 * on rétablit ici le type fonctionnel attendu par l'utilisateur.
 */
export function archiveFormatLabel(name: string, rawFormat?: string): string {
  const pkg = packageKindOfName(name);
  if (pkg) return LABELS[pkg];
  const ext = extOf(name);
  return (rawFormat || ext || "archive").toUpperCase();
}
