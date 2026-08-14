/**
 * Point d'entrée public du module Personnalisation.
 *
 * Bootstrap automatique à l'import : `bootstrapPersonalization()` est
 * appelé une fois côté client pour appliquer immédiatement les
 * préférences persistées (thème / animations / densité).
 */
export * from "./types";
export * from "./store";
export * from "./usePrefs";
export * from "./applier";
export * from "./system-bars";

export * from "./backup";
export * from "./widgets";
export * as reserved from "./reserved";
