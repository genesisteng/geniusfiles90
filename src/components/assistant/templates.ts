/**
 * Suggestions de requêtes affichées dans le bandeau Genius AI.
 *
 * Isolé du composant `TemplateMarquee` pour que le rechargement à chaud
 * ne concerne qu'un fichier de composants (règle react-refresh).
 * Le texte réel vient du dictionnaire `assistant.templates.*` (FR/EN) ;
 * ce fichier ne fournit que la liste des clés, dans l'ordre d'affichage.
 */
export const TEMPLATE_KEYS = [
  "classifyPhotos",
  "moveLargeVideos",
  "findRecentPdfs",
  "biggestFolders",
  "weekVideos",
  "sortDownloads",
  "renamePhotosByDate",
  "archiveWorkDocs",
  "findUnusedFiles",
  "analyzeStorage",
  "listShortAudio",
  "todayScreenshots",
  "compressDocuments",
  "countPdfs",
] as const;
