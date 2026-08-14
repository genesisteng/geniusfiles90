import { t } from "@/lib/i18n";
/**
 * Étape d'exécution en cours du moteur — canal minimal et unidirectionnel.
 *
 * Le pont IA→moteur publie un libellé humain (jamais de chemin, jamais de
 * nom de fichier, jamais de vocabulaire technique) que l'interface affiche
 * dans sa ligne d'activité. Aucune donnée de fichier ne transite ici : ce
 * n'est qu'un texte d'état, remis à `null` dès la fin de la commande.
 */

type Listener = () => void;

let current: string | null = null;
const listeners = new Set<Listener>();

export function setEngineStage(label: string | null): void {
  if (current === label) return;
  current = label;
  for (const l of listeners) l();
}

export function getEngineStage(): string | null {
  return current;
}

export function subscribeEngineStage(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Clés de message par type de commande moteur. */
const ENGINE_STAGE_KEYS: Record<string, string> = {
  list_storage_roots: "assistant.stage.list_storage_roots",
  list: "assistant.stage.list",
  search: "assistant.stage.search",
  analyze: "assistant.stage.analyze",
  properties: "assistant.stage.properties",
  create: "assistant.stage.create",
  rename: "assistant.stage.rename",
  delete: "assistant.stage.delete",
  copy: "assistant.stage.copy",
  move: "assistant.stage.move",
  organize: "assistant.stage.organize",
  compress: "assistant.stage.compress",
  extract: "assistant.stage.extract",
  share: "assistant.stage.share",
  sort: "assistant.stage.sort",
  filter: "assistant.stage.filter",
};

/** Libellé de démarrage (langue active), calculé à l'appel — jamais figé. */
export function engineStageLabel(type: string): string {
  const key = ENGINE_STAGE_KEYS[type];
  return key ? t(key) : t("assistant.stage.default");
}

/**
 * Étape enrichie de la progression réelle du moteur. On n'expose qu'un
 * compteur : ni nom de fichier, ni dossier parcouru.
 */
export function engineProgressLabel(type: string, processed: number, total: number): string {
  const base = engineStageLabel(type);
  if (!Number.isFinite(processed) || processed <= 0) return base;
  switch (type) {
    case "search":
      return t("assistant.stage.searchProgress", { count: processed });
    case "analyze":
      return t("assistant.stage.analyzeProgress", { count: processed });
    case "copy":
    case "move":
    case "organize":
    case "delete":
    case "compress":
    case "extract": {
      const cleanBase = base.replace(/…$/u, "");
      return total > 0
        ? t("assistant.stage.batchProgressTotal", { base: cleanBase, processed, total })
        : t("assistant.stage.batchProgressCount", { base: cleanBase, processed });
    }
    default:
      return base;
  }
}
