/**
 * Retour haptique de l'éditeur audio — à seuils.
 *
 * Le principe : jamais une vibration « par pixel ». Chaque canal (poignée
 * gauche, poignée droite, tête de lecture, zoom…) mémorise le dernier pas
 * franchi ; l'impulsion n'est émise que lorsque la valeur change de pas.
 * On obtient une sensation de crans précis, sans bourdonnement continu.
 */
import { tick } from "@/lib/photo/haptics";

const steps = new Map<string, number>();

/** Émet une impulsion uniquement au franchissement d'un pas de `step`. */
export function stepTick(channel: string, value: number, step: number): void {
  if (!Number.isFinite(value) || step <= 0) return;
  const index = Math.round(value / step);
  if (steps.get(channel) === index) return;
  steps.set(channel, index);
  tick();
}

/** Impulsion unique quand un état booléen devient vrai (butée, palier…). */
export function edgeTick(channel: string, active: boolean, strong = false): void {
  const was = steps.get(channel) === 1;
  steps.set(channel, active ? 1 : 0);
  if (active && !was) tick(strong ? "medium" : "light");
}

/** Impulsion franche pour une action validée (sélection posée, application). */
export function confirmTick(): void {
  tick("medium");
}

/** Oublie l'état d'un canal (fin de geste). */
export function resetTick(channel: string): void {
  steps.delete(channel);
}
