/**
 * Erreurs typées du moteur. `EngineExecutionError` est le seul canal
 * qu'un gestionnaire doit utiliser pour signaler un échec structuré ;
 * toute autre exception est capturée et convertie en
 * `EXECUTION_FAILED` par l'exécuteur.
 */
import type { EngineErrorCode } from "./types";
import { t } from "@/lib/i18n";

export class EngineExecutionError extends Error {
  readonly code: EngineErrorCode;
  readonly details?: unknown;
  constructor(code: EngineErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "EngineExecutionError";
    this.code = code;
    this.details = details;
  }
}

export function toEngineError(err: unknown): {
  code: EngineErrorCode;
  message: string;
  details?: unknown;
} {
  if (err instanceof EngineExecutionError) {
    return { code: err.code, message: err.message, details: err.details };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { code: "EXECUTION_FAILED", message: msg || t("system.error.unknown") };
}
