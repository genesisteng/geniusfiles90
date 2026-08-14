import type { FileEntry, PathRef } from "@/lib/files/types";

/**
 * Paramètres de recherche pour la route `/editeur-audio`.
 * Permet d'ouvrir un fichier audio depuis n'importe quel point d'entrée
 * (menu fichier, lecteur, catégories, fichiers récents…) de façon cohérente.
 */
export function audioEditorSearch(parent: PathRef, entry: FileEntry) {
  return {
    root: parent.rootId,
    dir: parent.segments.join("/"),
    name: entry.name,
  };
}
