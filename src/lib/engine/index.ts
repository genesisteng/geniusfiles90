/**
 * GeniusFiles — Moteur d'exécution universel.
 *
 * Point d'entrée public. Ce moteur est **totalement indépendant** de
 * l'assistant IA : il ne contient aucune logique conversationnelle,
 * n'importe aucun module `ai-gateway` et ne connaît ni Gemini ni
 * Lovable AI. Il se contente de recevoir une commande structurée et de
 * l'exécuter contre le stockage réel via les modules internes.
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │  Émetteur (UI, IA, tests, automatisations)                     │
 * │      │                                                         │
 * │      ▼                                                         │
 * │  execute({ type, params }, { onProgress, signal })             │
 * │      │                                                         │
 * │      ▼                                                         │
 * │  Registre  ──►  Handler.validate  ──►  Handler.run             │
 * │      │                                     │                   │
 * │      ▼                                     ▼                   │
 * │  EngineResult { ok, data | error, durationMs, cancelled }      │
 * └────────────────────────────────────────────────────────────────┘
 *
 * Nouvelles opérations : implémentez un `CommandHandler` puis appelez
 * `engineRegistry.register(handler)`. Aucune modification des
 * fondations n'est nécessaire.
 */
import { EngineExecutionError, toEngineError } from "./errors";
import { engineRegistry } from "./registry";
import type { CommandHandler, EngineCommand, EngineExecuteOptions, EngineResult } from "./types";

import { listHandler } from "./handlers/list";
import { copyHandler, moveHandler } from "./handlers/transfer";
import { renameHandler } from "./handlers/rename";
import { deleteHandler } from "./handlers/delete";
import { createHandler } from "./handlers/create";
import { compressHandler, extractHandler } from "./handlers/archive";
import { shareHandler } from "./handlers/share";
import { analyzeHandler } from "./handlers/analyze";
import { searchHandler } from "./handlers/search";
import { sortHandler, filterHandler } from "./handlers/sort-filter";
import { propertiesHandler } from "./handlers/properties";
import { organizeHandler } from "./handlers/organize";
import { t } from "@/lib/i18n";

/* ---------- Enregistrement des gestionnaires par défaut ---------- */

let registered = false;
function ensureDefaultsRegistered() {
  if (registered) return;
  registered = true;
  const defaults: CommandHandler[] = [
    listHandler as CommandHandler,
    copyHandler as CommandHandler,
    moveHandler as CommandHandler,
    renameHandler as CommandHandler,
    deleteHandler as CommandHandler,
    createHandler as CommandHandler,
    compressHandler as CommandHandler,
    extractHandler as CommandHandler,
    shareHandler as CommandHandler,
    analyzeHandler as CommandHandler,
    searchHandler as CommandHandler,
    sortHandler as CommandHandler,
    filterHandler as CommandHandler,
    propertiesHandler as CommandHandler,
    organizeHandler as CommandHandler,
  ];
  for (const h of defaults) engineRegistry.register(h);
}

ensureDefaultsRegistered();

/* ---------- API publique ---------- */

export async function execute<D = unknown>(
  command: EngineCommand,
  options: EngineExecuteOptions = {},
): Promise<EngineResult<D>> {
  const started = Date.now();
  const base = { type: command.type, commandId: command.id };

  const handler = engineRegistry.get(command.type);
  if (!handler) {
    return {
      ...base,
      ok: false,
      error: {
        code: "UNKNOWN_COMMAND",
        message: t("system.engine.unknownCommand", { type: command.type }),
      },
      durationMs: Date.now() - started,
    };
  }

  try {
    const validation = handler.validate?.(command.params);
    if (validation && !validation.ok) {
      return {
        ...base,
        ok: false,
        error: { code: validation.code, message: validation.message, details: validation.details },
        durationMs: Date.now() - started,
      };
    }
    if (options.signal?.aborted) {
      return {
        ...base,
        ok: false,
        cancelled: true,
        error: { code: "CANCELLED", message: t("system.engine.cancelledBeforeRun") },
        durationMs: Date.now() - started,
      };
    }
    const data = (await handler.run(command.params, options)) as D;
    return { ...base, ok: true, data, durationMs: Date.now() - started };
  } catch (err) {
    const normalized = toEngineError(err);
    return {
      ...base,
      ok: false,
      cancelled: normalized.code === "CANCELLED",
      error: normalized,
      durationMs: Date.now() - started,
    };
  }
}

/**
 * Exécute une séquence de commandes. Par défaut, on arrête au premier
 * échec ; passez `continueOnError: true` pour tout tenter. Chaque
 * résultat est retourné dans l'ordre d'origine.
 */
export async function executeBatch(
  commands: EngineCommand[],
  options: EngineExecuteOptions & { continueOnError?: boolean } = {},
): Promise<EngineResult[]> {
  const results: EngineResult[] = [];
  for (const cmd of commands) {
    if (options.signal?.aborted) {
      results.push({
        type: cmd.type,
        commandId: cmd.id,
        ok: false,
        cancelled: true,
        error: { code: "CANCELLED", message: t("system.engine.batchCancelled") },
        durationMs: 0,
      });
      break;
    }
    const res = await execute(cmd, options);
    results.push(res);
    if (!res.ok && !options.continueOnError) break;
  }
  return results;
}

export function registerCommand<P, D>(handler: CommandHandler<P, D>): void {
  engineRegistry.register(handler);
}

export function unregisterCommand(type: string): void {
  engineRegistry.unregister(type);
}

export function listCommands(): string[] {
  return engineRegistry.list();
}

export function hasCommand(type: string): boolean {
  return engineRegistry.has(type);
}

export { EngineExecutionError, engineRegistry };
export type { CommandHandler, EngineCommand, EngineResult, EngineExecuteOptions } from "./types";
export type { EngineError, EngineErrorCode, EngineProgress, ValidationResult } from "./types";
