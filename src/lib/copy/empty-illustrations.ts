import { t } from "@/lib/i18n";
/**
 * Écrans vides de GeniusFiles.
 *
 * Un seul endroit décrit les titres et descriptions des états vides et
 * d'erreur. Rien n'est écrit en dur dans les composants : la couche UI
 * reçoit uniquement un identifiant d'état et les chaînes sont résolues
 * ici, dans la langue active de l'application (`@/lib/i18n`).
 */

/** États vides disponibles. */
export type EmptyIllustrationId =
  | "files"
  | "documents"
  | "images"
  | "videos"
  | "audio"
  | "downloads"
  | "favorites"
  | "trash"
  | "search"
  | "folder"
  | "storage"
  | "permission"
  | "network"
  | "notFound"
  | "openFailed"
  | "lowSpace"
  | "unknownError"
  | "operationFailed";

type Entry = { title: string; description: string };

/** Titre et description d'un état vide. */
export function emptyIllustrationCopy(id: EmptyIllustrationId): Entry {
  return {
    title: t(`copy.empty.${id}.title`),
    description: t(`copy.empty.${id}.description`),
  };
}

/** Libellés des actions proposées sous un état illustré. */
export type EmptyActionId = "retry" | "allow" | "back" | "openWith" | "freeSpace";

/** Libellé localisé d'une action d'état illustré. */
export function emptyActionLabel(id: EmptyActionId): string {
  return t(`copy.emptyAction.${id}`);
}

/**
 * État « hors connexion » du module de chat.
 */
export type ChatOfflineCopy = { title: string; description: string; retry: string };

/** Chaînes localisées de l'état hors connexion du chat. */
export function chatOfflineCopy(): ChatOfflineCopy {
  return {
    title: t("copy.chatOffline.title"),
    description: t("copy.chatOffline.description"),
    retry: t("copy.chatOffline.retry"),
  };
}
