/**
 * Vocabulaire commun de GeniusFiles.
 *
 * Un seul endroit décide de la façon dont on parle à l'utilisateur :
 * même ton, même vocabulaire, même niveau de simplicité sur chaque écran.
 *
 * Toutes les fonctions résolvent leurs textes AU MOMENT DE L'APPEL via la
 * langue active (`getLocale()`), afin de rester justes si l'utilisateur
 * change de langue en cours de session.
 *
 * Règles appliquées partout :
 *  - phrases courtes, sans terme technique ;
 *  - on dit ce qui se passe, sur quoi, et ce que l'utilisateur peut faire ;
 *  - jamais de code d'erreur, de nom interne ni de message développeur.
 */
import { formatBytes, formatNumber, getLocale, pluralCategory, t } from "@/lib/i18n";

/** Accord au pluriel : `plural(3, "fichier")` → « fichiers ». */
export function plural(count: number, singular: string, pluralForm?: string): string {
  if (pluralCategory(getLocale(), count) === "one") return singular;
  return pluralForm ?? `${singular}s`;
}

/** Jetons d'unité comptable traduisibles (les anciens libellés français restent acceptés). */
export const UNIT_TOKENS = [
  "file",
  "folder",
  "item",
  "video",
  "photo",
  "song",
  "action",
  "page",
  "result",
  "app",
] as const;

export type UnitToken = (typeof UNIT_TOKENS)[number];

const UNIT_ALIASES: Record<string, UnitToken> = {
  fichier: "file",
  dossier: "folder",
  élément: "item",
  element: "item",
  vidéo: "video",
  chanson: "song",
  résultat: "result",
  application: "app",
};

function unitToken(unit: string): UnitToken | undefined {
  const raw = unit.trim().toLowerCase();
  if ((UNIT_TOKENS as readonly string[]).includes(raw)) return raw as UnitToken;
  return UNIT_ALIASES[raw];
}

/** Nom d'une unité accordé au nombre : « fichiers » / “files”. */
export function unitLabel(count: number, unit: string): string {
  const token = unitToken(unit);
  if (token) return t(`copy.unit.${token}`, { count });
  return plural(count, unit);
}

/** Nombre lisible : 1250 → « 1 250 » (ou « 1,250 » en anglais). */
export function formatCount(count: number): string {
  return formatNumber(count);
}

/** « 1 250 fichiers », « 1 fichier ». */
export function countLabel(count: number, singular: string, pluralForm?: string): string {
  if (!pluralForm) return `${formatCount(count)} ${unitLabel(count, singular)}`;
  return `${formatCount(count)} ${plural(count, singular, pluralForm)}`;
}

/** Liste lisible : « A, B et C ». */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${t("copy.joinList.and")} ${items[items.length - 1]}`;
}

/**
 * Étiquette d'une opération en cours.
 * Toujours accompagnée d'un contenu concret : on n'affiche jamais une
 * simple animation de chargement sans dire ce qui se passe.
 *
 * `progressLabel("Déplacement", 12, 45)` → « Déplacement de 12 sur 45 fichiers… »
 */
export function progressLabel(
  action: string,
  done?: number,
  total?: number,
  unit = "file",
): string {
  if (typeof total === "number" && total > 0 && typeof done === "number") {
    return t("copy.progress.withDone", {
      action,
      done: formatCount(done),
      total: countLabel(total, unit),
    });
  }
  if (typeof total === "number" && total > 0) {
    return t("copy.progress.total", { action, total: countLabel(total, unit) });
  }
  return t("copy.progress.ongoing", { action });
}

/**
 * Résumé affiché après une action terminée : un titre court et une ligne
 * de détail qui répond à « qu'est-ce qui a été fait, sur quoi ? ».
 */
export type ActionSummary = { title: string; detail?: string };

export function summarize(
  title: string,
  count: number,
  unit: string,
  destination?: string,
): ActionSummary {
  const base = countLabel(count, unit);
  return {
    title,
    detail: destination
      ? t("copy.summary.detailTo", { base, destination })
      : t("copy.summary.detail", { base }),
  };
}

/** Espace disque lisible pour un résumé : « 2,4 Go libérés ». */
export function freedLabel(bytes: number): string {
  return formatBytes(bytes);
}

/**
 * Textes d'une confirmation avant action sensible.
 * On indique toujours : l'action, les éléments concernés, la conséquence.
 */
export type ConfirmCopy = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "danger";
};

export const confirmCopy = {
  moveToTrash(count: number): ConfirmCopy {
    return {
      title: t("copy.confirm.moveToTrash.title", { count }),
      description: t("copy.confirm.moveToTrash.description", { count }),
      confirmLabel: t("copy.confirm.moveToTrash.confirmLabel"),
      tone: "danger",
    };
  },
  deleteForever(count: number): ConfirmCopy {
    return {
      title: t("copy.confirm.deleteForever.title", { count }),
      description: t("copy.confirm.deleteForever.description"),
      confirmLabel: t("copy.confirm.deleteForever.confirmLabel"),
      tone: "danger",
    };
  },
  emptyTrash(count: number): ConfirmCopy {
    return {
      title: t("copy.confirm.emptyTrash.title"),
      description: t("copy.confirm.emptyTrash.description", { count }),
      confirmLabel: t("copy.confirm.emptyTrash.confirmLabel"),
      tone: "danger",
    };
  },
  move(count: number, destination: string): ConfirmCopy {
    return {
      title: t("copy.confirm.move.title", { count }),
      description: t("copy.confirm.move.description", { count, destination }),
      confirmLabel: t("copy.confirm.move.confirmLabel"),
    };
  },
  encrypt(count: number): ConfirmCopy {
    return {
      title: t("copy.confirm.encrypt.title", { count }),
      description: t("copy.confirm.encrypt.description"),
      confirmLabel: t("copy.confirm.encrypt.confirmLabel"),
    };
  },
  restore(count: number): ConfirmCopy {
    return {
      title: t("copy.confirm.restore.title", { count }),
      description: t("copy.confirm.restore.description"),
      confirmLabel: t("copy.confirm.restore.confirmLabel"),
    };
  },
  clean(freedBytes: number, count: number): ConfirmCopy {
    return {
      title: t("copy.confirm.clean.title"),
      description: t("copy.confirm.clean.description", {
        count,
        freed: freedLabel(freedBytes),
      }),
      confirmLabel: t("copy.confirm.clean.confirmLabel"),
      tone: "danger",
    };
  },
  overwriteFile(name: string): ConfirmCopy {
    return {
      title: t("copy.confirm.overwriteFile.title", { name }),
      description: t("copy.confirm.overwriteFile.description"),
      confirmLabel: t("copy.confirm.overwriteFile.confirmLabel"),
      tone: "danger",
    };
  },
  deletePages(count: number): ConfirmCopy {
    return {
      title: t("copy.confirm.deletePages.title", { count }),
      description: t("copy.confirm.deletePages.description", { count }),
      confirmLabel: t("copy.confirm.deletePages.confirmLabel"),
      tone: "danger",
    };
  },
  runAutomation(name: string): ConfirmCopy {
    return {
      title: t("copy.confirm.runAutomation.title", { name }),
      description: t("copy.confirm.runAutomation.description"),
      confirmLabel: t("copy.confirm.runAutomation.confirmLabel"),
    };
  },
} as const;
