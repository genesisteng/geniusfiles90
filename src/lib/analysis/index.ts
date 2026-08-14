/**
 * Point d'entrée du moteur d'analyse.
 *
 * L'import de ce module suffit à :
 *  - enregistrer le provider de recherche par contenu ;
 *  - charger le cache et l'index inversé ;
 *  - exposer les API publiques utilisées par la Galerie, la Recherche,
 *    l'Assistant IA, le Gestionnaire de fichiers et le Lecteur universel.
 */
import "./search-provider"; // effet de bord : registerSearchProvider

export * from "./types";
export * from "./store";
export * from "./queue";
export * from "./capabilities";
export * from "./nlu";
export * from "./similarity";
export * as reserved from "./reserved";

import { getRecord } from "./store";
import { enqueueAnalysis } from "./queue";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { keyOf } from "./types";

/**
 * Accès synchrone à l'analyse d'un fichier (retourne `null` s'il n'a pas
 * encore été analysé). N'enfile pas de job — utilisé pour afficher un
 * badge « analysé » dans le gestionnaire de fichiers et la galerie.
 */
export function getAnalysis(parent: PathRef, entry: FileEntry) {
  const key = keyOf({ rootId: parent.rootId, segments: [...parent.segments, entry.name] });
  return getRecord(key);
}

/**
 * Analyse à la demande — utilisée par le Lecteur universel et l'Assistant
 * IA pour garantir qu'un fichier ouvert soit indexé immédiatement.
 */
export function ensureAnalysis(parent: PathRef, entry: FileEntry) {
  return enqueueAnalysis(parent, entry, { priority: "high" });
}
