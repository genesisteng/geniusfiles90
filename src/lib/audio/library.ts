/**
 * Bibliothèque de sons synthétisés.
 *
 * Aucun fichier audio n'est embarqué : chaque son est calculé à la demande
 * (oscillateurs, enveloppes, bruit filtré). L'application reste donc légère
 * et les sons s'adaptent automatiquement à la fréquence d'échantillonnage
 * du projet.
 */
import type { AudioClip } from "./types";
import { t } from "@/lib/i18n";

export type SoundId =
  | "bip"
  | "bipDouble"
  | "bipTriple"
  | "bipLong"
  | "clic"
  | "tick"
  | "notification"
  | "alarme"
  | "sirene"
  | "sweep"
  | "la440"
  | "bruitBlanc"
  | "bruitRose"
  | "silence";

export type SoundDef = {
  id: SoundId;
  /** Durée par défaut, en secondes. */
  duration: number;
  category: "bips" | "alertes" | "tonalités" | "ambiances";
};

export const SOUNDS: SoundDef[] = [
  { id: "bip", duration: 0.12, category: "bips" },
  { id: "bipDouble", duration: 0.36, category: "bips" },
  { id: "bipTriple", duration: 0.56, category: "bips" },
  { id: "bipLong", duration: 0.8, category: "bips" },
  { id: "clic", duration: 0.05, category: "bips" },
  { id: "tick", duration: 0.08, category: "bips" },
  { id: "notification", duration: 0.7, category: "alertes" },
  { id: "alarme", duration: 1.2, category: "alertes" },
  { id: "sirene", duration: 1.6, category: "alertes" },
  { id: "sweep", duration: 1, category: "tonalités" },
  { id: "la440", duration: 1, category: "tonalités" },
  { id: "bruitBlanc", duration: 1.5, category: "ambiances" },
  { id: "bruitRose", duration: 1.5, category: "ambiances" },
  { id: "silence", duration: 1, category: "ambiances" },
];

/** Libellé affiché pour un son (calculé à l'exécution, jamais figé au chargement). */
export function soundLabel(id: SoundId): string {
  return t(`media.sound.${id}`);
}

/** Enveloppe attaque/extinction douce (anti-clic). */
function envelope(n: number, length: number, attack: number, release: number): number {
  if (n < attack) return n / attack;
  const left = length - n;
  if (left < release) return Math.max(0, left / release);
  return 1;
}

function tone(
  out: Float32Array,
  sampleRate: number,
  from: number,
  count: number,
  freqAt: (t: number) => number,
  amp: number,
  harmonic = 0,
) {
  const attack = Math.max(1, Math.round(sampleRate * 0.005));
  const release = Math.max(1, Math.round(sampleRate * 0.02));
  let phase = 0;
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate;
    phase += (2 * Math.PI * freqAt(t)) / sampleRate;
    let v = Math.sin(phase);
    if (harmonic > 0) v += harmonic * Math.sin(phase * 2);
    out[from + i] = v * amp * envelope(i, count, attack, release);
  }
}

/** Génère un son mono, aux dimensions demandées. */
export function generateSound(
  id: SoundId,
  sampleRate: number,
  channelCount: number,
  durationOverride?: number,
  gain = 0.7,
): AudioClip {
  const def = SOUNDS.find((s) => s.id === id) ?? SOUNDS[0];
  const duration = Math.max(0.02, Math.min(30, durationOverride ?? def.duration));
  const length = Math.max(1, Math.round(duration * sampleRate));
  const mono = new Float32Array(length);
  const amp = Math.max(0, Math.min(1, gain));

  switch (id) {
    case "bip":
    case "bipLong":
    case "la440": {
      const f = id === "la440" ? 440 : id === "bipLong" ? 880 : 1000;
      tone(mono, sampleRate, 0, length, () => f, amp);
      break;
    }
    case "bipDouble":
    case "bipTriple": {
      const count = id === "bipDouble" ? 2 : 3;
      const slot = Math.floor(length / count);
      const on = Math.floor(slot * 0.55);
      for (let k = 0; k < count; k++) {
        tone(mono, sampleRate, k * slot, Math.min(on, length - k * slot), () => 1100, amp);
      }
      break;
    }
    case "clic":
    case "tick": {
      const decay = id === "clic" ? 0.008 : 0.02;
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const noise = Math.random() * 2 - 1;
        const body = Math.sin(2 * Math.PI * (id === "clic" ? 2400 : 1200) * t);
        mono[i] = (noise * 0.5 + body * 0.5) * amp * Math.exp(-t / decay);
      }
      break;
    }
    case "notification": {
      // Deux notes montantes (do — sol), timbre doux.
      const slot = Math.floor(length / 2);
      tone(mono, sampleRate, 0, slot, () => 784, amp * 0.9, 0.25);
      tone(mono, sampleRate, slot, length - slot, () => 1175, amp * 0.8, 0.25);
      break;
    }
    case "alarme": {
      // Alternance rapide de deux hauteurs.
      const period = Math.round(sampleRate * 0.15);
      for (let i = 0; i < length; i++) {
        const high = Math.floor(i / period) % 2 === 0;
        const t = i / sampleRate;
        mono[i] =
          Math.sin(2 * Math.PI * (high ? 1000 : 700) * t) *
          amp *
          envelope(i, length, sampleRate * 0.01, sampleRate * 0.05);
      }
      break;
    }
    case "sirene": {
      tone(
        mono,
        sampleRate,
        0,
        length,
        (t) => 600 + 400 * Math.sin(2 * Math.PI * 0.8 * t),
        amp * 0.9,
      );
      break;
    }
    case "sweep": {
      const start = 200;
      const end = 4000;
      tone(mono, sampleRate, 0, length, (t) => start * (end / start) ** (t / duration), amp * 0.8);
      break;
    }
    case "bruitBlanc": {
      const attack = sampleRate * 0.02;
      for (let i = 0; i < length; i++) {
        mono[i] = (Math.random() * 2 - 1) * amp * 0.6 * envelope(i, length, attack, attack);
      }
      break;
    }
    case "bruitRose": {
      // Filtre de Voss-McCartney simplifié : spectre en 1/f, doux à l'oreille.
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      const attack = sampleRate * 0.02;
      for (let i = 0; i < length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        const v = (b0 + b1 + b2 + w * 0.1848) * 0.25;
        mono[i] = v * amp * envelope(i, length, attack, attack);
      }
      break;
    }
    case "silence":
    default:
      break;
  }

  const channels: Float32Array[] = [mono];
  for (let c = 1; c < Math.max(1, channelCount); c++) channels.push(Float32Array.from(mono));
  return { sampleRate, channels, length };
}
