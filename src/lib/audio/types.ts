import { t } from "@/lib/i18n";
/**
 * GeniusFiles — Éditeur audio : contrats de données.
 *
 * Le modèle est *non destructif* : la source décodée n'est jamais modifiée.
 * Une édition = une opération pure ajoutée à une liste (`AudioOp[]`). Le
 * rendu est la composition de ces opérations sur le clip source, ce qui
 * rend Undo/Redo exacts et bon marché (on ne stocke que des paramètres,
 * jamais des copies complètes du signal).
 */

/** Signal audio décodé, en flottants -1..1, un tableau par canal. */
export type AudioClip = {
  sampleRate: number;
  /** Chaque canal a la même longueur. */
  channels: Float32Array[];
  /** Nombre d'échantillons par canal. */
  length: number;
};

export type TimeRange = { start: number; end: number };

type AudioOpKind =
  /** Ne conserver que la portion sélectionnée. */
  | { id: string; type: "keep"; range: TimeRange }
  /** Supprimer la portion (le reste est recollé). */
  | { id: string; type: "delete"; range: TimeRange }
  /** Remplacer la portion par du silence. */
  | { id: string; type: "silence"; range: TimeRange }
  /** Gain en dB sur une portion (ou tout le fichier si `range` absent). */
  | { id: string; type: "gain"; range?: TimeRange; db: number }
  | { id: string; type: "fadeIn"; duration: number }
  | { id: string; type: "fadeOut"; duration: number }
  /** Normalisation crête vers `peakDb` (dBFS, négatif). */
  | { id: string; type: "normalize"; peakDb: number }
  | { id: string; type: "reverse"; range?: TimeRange }
  /** Vitesse (0.25..4). `keepPitch` conserve la hauteur. */
  | { id: string; type: "speed"; factor: number; keepPitch: boolean }
  /** Hauteur en demi-tons (-12..12), durée inchangée. */
  | { id: string; type: "pitch"; semitones: number }
  /** Insertion d'un presse-papier audio à une position. */
  | { id: string; type: "insert"; at: number; clipId: string }
  /** Concaténation d'un autre fichier à la fin. */
  | { id: string; type: "append"; clipId: string }
  /** Écho / delay à répétitions. */
  | {
      id: string;
      type: "echo";
      range?: TimeRange;
      delay: number;
      decay: number;
      repeats: number;
      mix: number;
    }
  /** Réverbération (taille de pièce, amortissement, dosage). */
  | { id: string; type: "reverb"; range?: TimeRange; size: number; damping: number; mix: number }
  /** Égaliseur 3 bandes, en dB. */
  | {
      id: string;
      type: "eq";
      range?: TimeRange;
      lowDb: number;
      midDb: number;
      highDb: number;
    }
  /** Filtre passe-bas / passe-haut résonnant. */
  | {
      id: string;
      type: "filter";
      range?: TimeRange;
      mode: "low" | "high";
      cutoff: number;
      q: number;
    }
  /** Compresseur de dynamique. */
  | {
      id: string;
      type: "compress";
      range?: TimeRange;
      thresholdDb: number;
      ratio: number;
      attackMs: number;
      releaseMs: number;
      makeupDb: number;
    }
  /** Porte de bruit. */
  | {
      id: string;
      type: "gate";
      range?: TimeRange;
      thresholdDb: number;
      attackMs: number;
      releaseMs: number;
    }
  /** Saturation douce. */
  | { id: string; type: "saturate"; range?: TimeRange; driveDb: number; mix: number }
  /** Largeur stéréo (0 = mono, 1 = inchangé, 2 = large). */
  | { id: string; type: "stereo"; width: number }
  /** Bip de censure : remplace exactement la plage, durée inchangée. */
  | {
      id: string;
      type: "censor";
      range: TimeRange;
      freq: number;
      gain: number;
      style: "continu" | "double" | "triple";
      fade: number;
      mode: "replace" | "over";
    };

/**
 * Opération d'édition. `track` désigne la piste concernée (0 = piste
 * principale, 1 = piste secondaire) ; absent = piste principale.
 */
export type AudioOp = AudioOpKind & {
  track?: 0 | 1;
  /** Opérations d'un même lot : annulées/rétablies ensemble. */
  group?: string;
};

export type AudioOpType = AudioOp["type"];

/** Libellé d'une opération, calculé à l'exécution (jamais figé au chargement). */
export function getOpLabel(type: AudioOpType): string {
  const labels: Record<AudioOpType, string> = {
    keep: t("media.effect.keep"),
    delete: t("media.effect.delete"),
    silence: t("media.effect.silence"),
    gain: t("media.effect.gain"),
    fadeIn: t("media.effect.fadeIn"),
    fadeOut: t("media.effect.fadeOut"),
    normalize: t("media.effect.normalize"),
    reverse: t("media.effect.reverse"),
    speed: t("media.effect.speed"),
    pitch: t("media.effect.pitch"),
    insert: t("media.effect.insert"),
    append: t("media.effect.append"),
    echo: t("media.effect.echo"),
    reverb: t("media.effect.reverb"),
    eq: t("media.effect.eq"),
    filter: t("media.effect.filter"),
    compress: t("media.effect.compress"),
    gate: t("media.effect.gate"),
    saturate: t("media.effect.saturate"),
    stereo: t("media.effect.stereo"),
    censor: t("media.effect.censor"),
  };
  return labels[type];
}

export function opId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
