import { t } from "@/lib/i18n";
/**
 * Traduction des erreurs techniques en messages compréhensibles.
 *
 * Objectif : plus jamais « Erreur inconnue » ni « Operation failed ».
 * Chaque message explique *ce qui s'est passé* et *ce que l'utilisateur
 * peut faire ensuite*.
 */

export type FriendlyError = {
  /** Titre court, affichable dans un toast. */
  title: string;
  /** Piste de résolution concrète. */
  hint?: string;
};

type Rule = { test: RegExp; error: () => FriendlyError };

const RULES: Rule[] = [
  {
    test: /permission|denied|EACCES|MANAGE_EXTERNAL_STORAGE|SAF/i,
    error: () => ({
      title: t("system.error.accessDenied.title"),
      hint: t("system.error.accessDenied.hint"),
    }),
  },
  {
    test: /ENOSPC|no space|storage full|quota/i,
    error: () => ({
      title: t("system.error.lowSpace.title"),
      hint: t("system.error.lowSpace.hint"),
    }),
  },
  {
    test: /EXISTS|already exists|file exists/i,
    error: () => ({
      title: t("system.error.nameExists.title"),
      hint: t("system.error.nameExists.hint"),
    }),
  },
  {
    test: /NOT_FOUND|ENOENT|no such file/i,
    error: () => ({
      title: t("system.error.fileNotFound.title"),
      hint: t("system.error.fileNotFound.hint"),
    }),
  },
  {
    test: /EBUSY|in use|locked/i,
    error: () => ({
      title: t("system.error.fileInUse.title"),
      hint: t("system.error.fileInUse.hint"),
    }),
  },
  {
    test: /READ_ONLY|EROFS/i,
    error: () => ({
      title: t("system.error.readOnly.title"),
      hint: t("system.error.readOnly.hint"),
    }),
  },
  {
    test: /network|fetch failed|ERR_INTERNET|offline|ENOTFOUND|timeout/i,
    error: () => ({
      title: t("system.error.offline.title"),
      hint: t("system.error.offline.hint"),
    }),
  },
  {
    test: /abort|cancel/i,
    error: () => ({ title: t("system.error.cancelled.title") }),
  },
  {
    test: /plugin|bridge|native/i,
    error: () => ({
      title: t("system.error.nativeOnly.title"),
      hint: t("system.error.nativeOnly.hint"),
    }),
  },
  {
    test: /invalid name|nom invalide/i,
    error: () => ({
      title: t("system.error.invalidName.title"),
      hint: t("system.error.invalidName.hint"),
    }),
  },
  {
    test: /password|mot de passe|encrypted|chiffr/i,
    error: () => ({
      title: t("system.error.passwordProtected.title"),
      hint: t("system.error.passwordProtected.hint"),
    }),
  },
  {
    test: /corrupt|malformed|damaged|invalid pdf|bad xref|unexpected end/i,
    error: () => ({
      title: t("system.error.corrupted.title"),
      hint: t("system.error.corrupted.hint"),
    }),
  },
  {
    test: /unsupported|not supported|unknown format|mime/i,
    error: () => ({
      title: t("system.error.unsupportedFormat.title"),
      hint: t("system.error.unsupportedFormat.hint"),
    }),
  },
  {
    test: /rate.?limit|429|quota exceeded|credit/i,
    error: () => ({
      title: t("system.error.rateLimited.title"),
      hint: t("system.error.rateLimited.hint"),
    }),
  },
  {
    test: /out of memory|allocation|too large|maximum size/i,
    error: () => ({
      title: t("system.error.tooLarge.title"),
      hint: t("system.error.tooLarge.hint"),
    }),
  },
];

/** Convertit n'importe quelle erreur en message clair pour l'utilisateur. */
export function humanizeError(err: unknown, fallbackTitle?: string): FriendlyError {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "";

  for (const rule of RULES) {
    if (rule.test.test(raw)) return rule.error();
  }
  // Message déjà rédigé de façon lisible : on le conserve tel quel.
  if (raw && /^[A-ZÀ-Ÿ][^A-Z_]{4,}/.test(raw) && !/[_]{1,}|failed|error/i.test(raw)) {
    return { title: raw };
  }
  return {
    title: fallbackTitle ?? t("system.error.fallbackTitle"),
    hint: t("system.error.retryHint"),
  };
}

/** Version aplatie, pratique pour un toast à une ligne. */
export function errorMessage(err: unknown, fallbackTitle?: string): string {
  const f = humanizeError(err, fallbackTitle);
  return f.hint ? `${f.title} — ${f.hint}` : f.title;
}

/**
 * Résumé lisible d'une opération par lot :
 * « 12 fichiers copiés » / « 10 copiés, 2 impossibles ».
 */
export function batchSummary(
  verbPast: string,
  succeeded: number,
  failed: number,
): { ok: boolean; message: string } {
  if (failed === 0) {
    return {
      ok: true,
      message: t("system.error.batch.noneFailed", { count: succeeded, verb: verbPast }),
    };
  }
  if (succeeded === 0) {
    return {
      ok: false,
      message: t("system.error.batch.allFailed", { verb: verbPast, failed }),
    };
  }
  return {
    ok: false,
    message: t("system.error.batch.partial", { count: failed, succeeded, failed, verb: verbPast }),
  };
}
