/**
 * Registre des gestionnaires de commande.
 *
 * L'ajout ou le remplacement d'un gestionnaire ne nécessite aucune
 * modification des fondations : `register()` accepte n'importe quel
 * `CommandHandler` conforme au contrat.
 */
import type { CommandHandler } from "./types";

class CommandRegistry {
  private readonly handlers = new Map<string, CommandHandler>();

  register<P, D>(handler: CommandHandler<P, D>): void {
    this.handlers.set(handler.type, handler as CommandHandler);
  }

  unregister(type: string): void {
    this.handlers.delete(type);
  }

  get(type: string): CommandHandler | undefined {
    return this.handlers.get(type);
  }

  list(): string[] {
    return Array.from(this.handlers.keys()).sort();
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }
}

export const engineRegistry = new CommandRegistry();
