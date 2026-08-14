/**
 * Pistes additionnelles de l'éditeur (nombre illimité).
 *
 * La piste principale garde sa pile d'opérations non destructive. Les
 * pistes ajoutées sont des clips posés sur la même timeline, avec leur
 * décalage, leur volume, leur mute et leur solo. Les éditions de ces
 * pistes (couper, supprimer, déplacer) produisent un nouveau clip : leur
 * historique propre est une simple pile d'instantanés (les Float32Array
 * sont partagés, donc c'est bon marché).
 */
import type { AudioClip, TimeRange } from "./types";
import { deleteRange, durationOf, keepRange, silenceRange } from "./dsp";
import type { TrackSync } from "./sync";

export type ExtraTrack = {
  id: string;
  name: string;
  clip: AudioClip;
  /** Décalage de départ sur la timeline, en secondes (>= 0). */
  offset: number;
  /** Volume linéaire 0..2. */
  gain: number;
  muted: boolean;
  solo: boolean;
  /**
   * Audio d'origine, conservé pour que la synchronisation reparte
   * toujours de la source (aucun étirement cumulé, aucune perte).
   */
  baseClip?: AudioClip;
  /** Décalage d'origine, restauré par « Désynchroniser ». */
  baseOffset?: number;
  /**
   * BPM saisi manuellement par l'utilisateur (jamais détecté).
   * Absent = valeur par défaut de l'éditeur.
   */
  bpm?: number;
  /** État de synchronisation (absent = piste indépendante). */
  sync?: TrackSync;
};

export function trackId(): string {
  return `tr_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}

export function trackDuration(t: ExtraTrack): number {
  return durationOf(t.clip);
}

export function trackEnd(t: ExtraTrack): number {
  return Math.max(0, t.offset) + trackDuration(t);
}

/** Durée totale du montage (piste principale + pistes ajoutées). */
export function timelineDuration(mainDuration: number, tracks: ExtraTrack[]): number {
  return tracks.reduce((max, t) => Math.max(max, trackEnd(t)), Math.max(0, mainDuration));
}

/**
 * Pistes réellement audibles : dès qu'une piste est en solo, les autres
 * (piste principale comprise) se taisent.
 */
export function hasSolo(tracks: ExtraTrack[]): boolean {
  return tracks.some((t) => t.solo && !t.muted);
}

export function isAudible(t: ExtraTrack, tracks: ExtraTrack[]): boolean {
  if (t.muted) return false;
  return hasSolo(tracks) ? t.solo : true;
}

/** Convertit une plage de la timeline dans le référentiel local d'une piste. */
export function toLocalRange(t: ExtraTrack, range: TimeRange): TimeRange | null {
  const start = Math.min(range.start, range.end) - t.offset;
  const end = Math.max(range.start, range.end) - t.offset;
  const len = trackDuration(t);
  const a = Math.max(0, Math.min(len, start));
  const b = Math.max(0, Math.min(len, end));
  if (b - a < 0.002) return null;
  return { start: a, end: b };
}

export type TrackEdit = "delete" | "silence" | "keep";

/**
 * Applique une édition destructive à une piste sur la portion de timeline
 * sélectionnée. Retourne la piste inchangée si la sélection ne la touche pas.
 */
export function editTrack(t: ExtraTrack, range: TimeRange, edit: TrackEdit): ExtraTrack {
  const local = toLocalRange(t, range);
  if (!local) return t;
  if (edit === "delete") return { ...t, clip: deleteRange(t.clip, local) };
  if (edit === "silence") return { ...t, clip: silenceRange(t.clip, local) };
  // « keep » : la piste est recadrée, donc son point de départ suit la sélection.
  return { ...t, clip: keepRange(t.clip, local), offset: t.offset + local.start };
}
