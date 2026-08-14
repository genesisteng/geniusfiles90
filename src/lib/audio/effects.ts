/**
 * Effets audio réels de l'éditeur GeniusFiles.
 *
 * Tout est calculé en JavaScript pur sur les échantillons flottants : aucun
 * `OfflineAudioContext`, aucune dépendance. Raisons : le résultat est
 * strictement identique en aperçu et à l'export, le traitement reste
 * disponible même quand le WebView refuse de créer un contexte audio, et
 * l'application ne grossit pas.
 *
 * Chaque fonction est *pure* : elle renvoie un nouveau clip et ne touche
 * jamais la source — c'est ce qui rend l'historique Undo/Redo exact.
 *
 * Les effets acceptent une portion (`TimeRange`). Le traitement est alors
 * appliqué à la région puis raccordé au reste par un court fondu croisé,
 * ce qui évite les clics aux jonctions.
 */
import { cloneClip, rangeToSamples } from "./dsp";
import type { AudioClip, TimeRange } from "./types";

/* --------------------------------------------------------------- outils */

function clamp1(v: number): number {
  return v > 1 ? 1 : v < -1 ? -1 : v;
}

function dbToLin(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Applique `process` (traitement en place d'un canal) à la portion
 * demandée, avec fondu croisé de 4 ms aux bords.
 */
function ranged(
  clip: AudioClip,
  range: TimeRange | undefined,
  process: (data: Float32Array, channel: number, sampleRate: number) => void,
): AudioClip {
  const out = cloneClip(clip);
  if (!range) {
    out.channels.forEach((ch, i) => process(ch, i, out.sampleRate));
    return out;
  }
  const { a, b } = rangeToSamples(clip, range);
  if (b - a < 2) return out;
  const fade = Math.min(Math.floor(out.sampleRate * 0.004), Math.floor((b - a) / 4));
  for (let c = 0; c < out.channels.length; c++) {
    const full = out.channels[c];
    const region = full.subarray(a, b);
    const dry = Float32Array.from(region);
    process(region, c, out.sampleRate);
    for (let i = 0; i < fade; i++) {
      const w = i / fade;
      region[i] = dry[i] * (1 - w) + region[i] * w;
      const j = region.length - 1 - i;
      region[j] = dry[j] * (1 - w) + region[j] * w;
    }
  }
  return out;
}

/* ---------------------------------------------------------- biquad (RBJ) */

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

function lowpass(sr: number, freq: number, q: number): Biquad {
  const w = (2 * Math.PI * Math.min(freq, sr * 0.45)) / sr;
  const alpha = Math.sin(w) / (2 * Math.max(0.1, q));
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  return {
    b0: (1 - cos) / 2 / a0,
    b1: (1 - cos) / a0,
    b2: (1 - cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

function highpass(sr: number, freq: number, q: number): Biquad {
  const w = (2 * Math.PI * Math.min(freq, sr * 0.45)) / sr;
  const alpha = Math.sin(w) / (2 * Math.max(0.1, q));
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  return {
    b0: (1 + cos) / 2 / a0,
    b1: -(1 + cos) / a0,
    b2: (1 + cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

function lowShelf(sr: number, freq: number, gainDb: number): Biquad {
  const A = Math.pow(10, gainDb / 40);
  const w = (2 * Math.PI * Math.min(freq, sr * 0.45)) / sr;
  const cos = Math.cos(w);
  const sin = Math.sin(w);
  const beta = Math.sqrt(A) / 0.9;
  const a0 = A + 1 + (A - 1) * cos + beta * sin;
  return {
    b0: (A * (A + 1 - (A - 1) * cos + beta * sin)) / a0,
    b1: (2 * A * (A - 1 - (A + 1) * cos)) / a0,
    b2: (A * (A + 1 - (A - 1) * cos - beta * sin)) / a0,
    a1: (-2 * (A - 1 + (A + 1) * cos)) / a0,
    a2: (A + 1 + (A - 1) * cos - beta * sin) / a0,
  };
}

function highShelf(sr: number, freq: number, gainDb: number): Biquad {
  const A = Math.pow(10, gainDb / 40);
  const w = (2 * Math.PI * Math.min(freq, sr * 0.45)) / sr;
  const cos = Math.cos(w);
  const sin = Math.sin(w);
  const beta = Math.sqrt(A) / 0.9;
  const a0 = A + 1 - (A - 1) * cos + beta * sin;
  return {
    b0: (A * (A + 1 + (A - 1) * cos + beta * sin)) / a0,
    b1: (-2 * A * (A - 1 + (A + 1) * cos)) / a0,
    b2: (A * (A + 1 + (A - 1) * cos - beta * sin)) / a0,
    a1: (2 * (A - 1 - (A + 1) * cos)) / a0,
    a2: (A + 1 - (A - 1) * cos - beta * sin) / a0,
  };
}

function peaking(sr: number, freq: number, q: number, gainDb: number): Biquad {
  const A = Math.pow(10, gainDb / 40);
  const w = (2 * Math.PI * Math.min(freq, sr * 0.45)) / sr;
  const alpha = Math.sin(w) / (2 * Math.max(0.1, q));
  const cos = Math.cos(w);
  const a0 = 1 + alpha / A;
  return {
    b0: (1 + alpha * A) / a0,
    b1: (-2 * cos) / a0,
    b2: (1 - alpha * A) / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha / A) / a0,
  };
}

function runBiquad(data: Float32Array, f: Biquad): void {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = f.b0 * x0 + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    data[i] = clamp1(y0);
  }
}

/* ------------------------------------------------------- égaliseur / filtre */

export type EqParams = { lowDb: number; midDb: number; highDb: number };

/** Égaliseur 3 bandes (graves 200 Hz, médiums 1,8 kHz, aigus 6 kHz). */
export function equalize(clip: AudioClip, p: EqParams, range?: TimeRange): AudioClip {
  return ranged(clip, range, (data, _c, sr) => {
    if (p.lowDb !== 0) runBiquad(data, lowShelf(sr, 200, p.lowDb));
    if (p.midDb !== 0) runBiquad(data, peaking(sr, 1800, 0.9, p.midDb));
    if (p.highDb !== 0) runBiquad(data, highShelf(sr, 6000, p.highDb));
  });
}

/** Passe-bas / passe-haut résonnant. */
export function filterClip(
  clip: AudioClip,
  mode: "low" | "high",
  cutoff: number,
  q: number,
  range?: TimeRange,
): AudioClip {
  return ranged(clip, range, (data, _c, sr) => {
    runBiquad(data, mode === "low" ? lowpass(sr, cutoff, q) : highpass(sr, cutoff, q));
  });
}

/* -------------------------------------------------------------- écho */

export type EchoParams = {
  /** Retard en secondes (0.02 – 1.5). */
  delay: number;
  /** Atténuation de chaque répétition (0.1 – 0.9). */
  decay: number;
  /** Nombre de répétitions audibles. */
  repeats: number;
  /** Dosage de l'effet (0 – 1). */
  mix: number;
};

/**
 * Écho à répétitions discrètes. Chaque répétition est ajoutée par
 * sommation directe : le résultat ne « souffle » pas et reste prévisible,
 * contrairement à une boucle de rétroaction non bornée.
 */
export function echo(clip: AudioClip, p: EchoParams, range?: TimeRange): AudioClip {
  return ranged(clip, range, (data, _c, sr) => {
    const step = Math.max(1, Math.round(p.delay * sr));
    const dry = Float32Array.from(data);
    const repeats = Math.max(1, Math.min(12, Math.round(p.repeats)));
    for (let r = 1; r <= repeats; r++) {
      const gain = Math.pow(p.decay, r) * p.mix;
      if (gain < 0.001) break;
      const shift = step * r;
      for (let i = shift; i < data.length; i++) {
        data[i] = clamp1(data[i] + dry[i - shift] * gain);
      }
    }
  });
}

/* ------------------------------------------------------------ réverbération */

export type ReverbParams = {
  /** Taille de pièce 0.1 – 1 (temps de réverbération). */
  size: number;
  /** Amortissement des aigus 0 – 1. */
  damping: number;
  /** Dosage 0 – 1. */
  mix: number;
};

const COMB_MS = [29.7, 37.1, 41.1, 43.7, 26.9, 31.9];
const ALLPASS_MS = [5.0, 1.7, 12.7];

/**
 * Réverbération de type Schroeder/Freeverb simplifiée : 6 filtres en peigne
 * amortis en parallèle, puis 3 passe-tout en série. Coût linéaire, rendu
 * dense et naturel, aucune table d'impulsion à embarquer.
 */
export function reverb(clip: AudioClip, p: ReverbParams, range?: TimeRange): AudioClip {
  const size = Math.max(0.05, Math.min(1, p.size));
  const damp = Math.max(0, Math.min(0.95, p.damping)) * 0.4 + 0.2;
  const feedback = 0.7 + size * 0.28;
  return ranged(clip, range, (data, channel, sr) => {
    const dry = Float32Array.from(data);
    const wet = new Float32Array(data.length);
    // Léger décalage par canal : élargit l'image stéréo.
    const spread = channel === 0 ? 0 : 0.0007;
    for (let k = 0; k < COMB_MS.length; k++) {
      const len = Math.max(2, Math.round((COMB_MS[k] / 1000 + spread) * sr * (0.6 + size * 0.9)));
      const buf = new Float32Array(len);
      let idx = 0;
      let store = 0;
      for (let i = 0; i < dry.length; i++) {
        const out = buf[idx];
        store = out * (1 - damp) + store * damp;
        buf[idx] = dry[i] + store * feedback;
        idx = idx + 1 === len ? 0 : idx + 1;
        wet[i] += out;
      }
    }
    const scale = 1 / COMB_MS.length;
    for (let i = 0; i < wet.length; i++) wet[i] *= scale;

    for (const ms of ALLPASS_MS) {
      const len = Math.max(2, Math.round((ms / 1000 + spread) * sr));
      const buf = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < wet.length; i++) {
        const bufOut = buf[idx];
        const out = -wet[i] + bufOut;
        buf[idx] = wet[i] + bufOut * 0.5;
        idx = idx + 1 === len ? 0 : idx + 1;
        wet[i] = out;
      }
    }

    const mix = Math.max(0, Math.min(1, p.mix));
    for (let i = 0; i < data.length; i++) {
      data[i] = clamp1(dry[i] * (1 - mix * 0.4) + wet[i] * mix * 0.9);
    }
  });
}

/* ---------------------------------------------------------- dynamique */

export type CompressorParams = {
  thresholdDb: number;
  /** 1 = aucun effet, 20 ≈ limiteur. */
  ratio: number;
  attackMs: number;
  releaseMs: number;
  makeupDb: number;
};

/**
 * Compresseur à détection de crête, avec attaque/relâchement lissés.
 * Le gain est calculé sur la somme des canaux pour préserver l'image
 * stéréo (un canal ne « pompe » pas indépendamment de l'autre).
 */
export function compress(clip: AudioClip, p: CompressorParams, range?: TimeRange): AudioClip {
  const out = cloneClip(clip);
  const sr = out.sampleRate;
  const a = range ? rangeToSamples(clip, range).a : 0;
  const b = range ? rangeToSamples(clip, range).b : out.length;
  const thr = dbToLin(p.thresholdDb);
  const ratio = Math.max(1, p.ratio);
  const atk = Math.exp(-1 / (Math.max(0.1, p.attackMs) * 0.001 * sr));
  const rel = Math.exp(-1 / (Math.max(1, p.releaseMs) * 0.001 * sr));
  const makeup = dbToLin(p.makeupDb);
  let env = 0;
  const chans = out.channels;
  for (let i = a; i < b; i++) {
    let peak = 0;
    for (const ch of chans) {
      const v = Math.abs(ch[i]);
      if (v > peak) peak = v;
    }
    const coeff = peak > env ? atk : rel;
    env = peak + coeff * (env - peak);
    let gain = 1;
    if (env > thr && env > 0) {
      const over = env / thr;
      gain = Math.pow(over, 1 / ratio - 1);
    }
    const g = gain * makeup;
    for (const ch of chans) ch[i] = clamp1(ch[i] * g);
  }
  return out;
}

export type GateParams = { thresholdDb: number; attackMs: number; releaseMs: number };

/** Porte de bruit : atténue ce qui passe sous le seuil (souffle, silences). */
export function gate(clip: AudioClip, p: GateParams, range?: TimeRange): AudioClip {
  const out = cloneClip(clip);
  const sr = out.sampleRate;
  const a = range ? rangeToSamples(clip, range).a : 0;
  const b = range ? rangeToSamples(clip, range).b : out.length;
  const thr = dbToLin(p.thresholdDb);
  const atk = Math.exp(-1 / (Math.max(0.5, p.attackMs) * 0.001 * sr));
  const rel = Math.exp(-1 / (Math.max(5, p.releaseMs) * 0.001 * sr));
  let env = 0;
  let gainState = 0;
  const chans = out.channels;
  for (let i = a; i < b; i++) {
    let peak = 0;
    for (const ch of chans) {
      const v = Math.abs(ch[i]);
      if (v > peak) peak = v;
    }
    env = peak > env ? peak + atk * (env - peak) : peak + rel * (env - peak);
    const target = env >= thr ? 1 : 0;
    const coeff = target > gainState ? atk : rel;
    gainState = target + coeff * (gainState - target);
    for (const ch of chans) ch[i] = clamp1(ch[i] * gainState);
  }
  return out;
}

/* ------------------------------------------------------------ saturation */

/**
 * Saturation douce (tangente hyperbolique) : ajoute de la présence et de la
 * chaleur sans écrêtage brutal. Compensation de niveau intégrée.
 */
export function saturate(
  clip: AudioClip,
  driveDb: number,
  mix: number,
  range?: TimeRange,
): AudioClip {
  const drive = dbToLin(Math.max(0, driveDb));
  const comp = 1 / Math.tanh(drive);
  const m = Math.max(0, Math.min(1, mix));
  return ranged(clip, range, (data) => {
    for (let i = 0; i < data.length; i++) {
      const wet = Math.tanh(data[i] * drive) * comp;
      data[i] = clamp1(data[i] * (1 - m) + wet * m);
    }
  });
}

/* --------------------------------------------------------------- stéréo */

/**
 * Largeur stéréo par matrice milieu/côté. 0 = mono, 1 = inchangé,
 * 2 = très large. Sans effet sur un fichier mono.
 */
export function stereoWidth(clip: AudioClip, width: number): AudioClip {
  const out = cloneClip(clip);
  if (out.channels.length < 2) return out;
  const w = Math.max(0, Math.min(2, width));
  const [l, r] = out.channels;
  for (let i = 0; i < out.length; i++) {
    const mid = (l[i] + r[i]) / 2;
    const side = ((l[i] - r[i]) / 2) * w;
    l[i] = clamp1(mid + side);
    r[i] = clamp1(mid - side);
  }
  return out;
}
