/**
 * Types de fichiers acceptés par les éditeurs intégrés de GeniusFiles.
 *
 * Ces listes servent de filtre à la session de sélection officielle
 * (`requestPick`) lorsque l'utilisateur lance « Éditeur d'images » ou
 * « Éditeur audio » depuis la section Outils de l'accueil : seuls les
 * fichiers réellement exploitables par l'éditeur peuvent être validés.
 */

/** Extensions décodables par l'éditeur d'images (rendu <img> / canvas). */
export const IMAGE_EDITOR_EXTS = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "avif"] as const;

/** Extensions décodables par l'éditeur audio (Web Audio). */
export const AUDIO_EDITOR_EXTS = ["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus"] as const;
