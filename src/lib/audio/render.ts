/**
 * Composition des opérations d'édition sur le clip source.
 *
 * Le rendu est incrémental : on mémorise le résultat de chaque préfixe de
 * la liste d'opérations (jusqu'à `MAX_CACHE` entrées, les plus anciennes
 * sont libérées). Ajouter une opération ne recalcule donc que la dernière
 * étape, et un Undo est instantané. Aucune copie n'est conservée pour les
 * états non visités.
 */
import type { AudioClip, AudioOp } from "./types";
import {
  applyGain,
  changePitch,
  changeSpeed,
  deleteRange,
  fadeIn,
  fadeOut,
  insertClip,
  keepRange,
  normalize,
  reverse,
  silenceRange,
  concatClips,
  resampleTo,
} from "./dsp";
import {
  compress,
  echo,
  equalize,
  filterClip,
  gate,
  reverb,
  saturate,
  stereoWidth,
} from "./effects";
import { censorRange } from "./censor";

/** Presse-papier / pièces importées, référencées par identifiant. */
const clips = new Map<string, AudioClip>();

export function storeClip(id: string, clip: AudioClip) {
  clips.set(id, clip);
}

export function getClip(id: string): AudioClip | undefined {
  return clips.get(id);
}

export function clearClips() {
  clips.clear();
}

const MAX_CACHE = 6;

export class RenderCache {
  private source: AudioClip;
  /** clé = signature du préfixe d'opérations. */
  private cache = new Map<string, AudioClip>();

  constructor(source: AudioClip) {
    this.source = source;
  }

  get sourceClip(): AudioClip {
    return this.source;
  }

  private static key(ops: AudioOp[]): string {
    return ops.map((o) => o.id).join(">");
  }

  private remember(key: string, clip: AudioClip) {
    if (key === "") return;
    this.cache.set(key, clip);
    while (this.cache.size > MAX_CACHE) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  /** Rend l'état correspondant à la liste d'opérations donnée. */
  render(ops: AudioOp[]): AudioClip {
    const fullKey = RenderCache.key(ops);
    if (fullKey === "") return this.source;
    const cached = this.cache.get(fullKey);
    if (cached) return cached;

    // Repart du plus long préfixe déjà connu.
    let startIndex = 0;
    let clip = this.source;
    for (let i = ops.length - 1; i > 0; i--) {
      const hit = this.cache.get(RenderCache.key(ops.slice(0, i)));
      if (hit) {
        clip = hit;
        startIndex = i;
        break;
      }
    }
    for (let i = startIndex; i < ops.length; i++) {
      clip = applyOp(clip, ops[i]);
      this.remember(RenderCache.key(ops.slice(0, i + 1)), clip);
    }
    return clip;
  }

  dispose() {
    this.cache.clear();
  }
}

export function applyOp(clip: AudioClip, op: AudioOp): AudioClip {
  switch (op.type) {
    case "keep":
      return keepRange(clip, op.range);
    case "delete":
      return deleteRange(clip, op.range);
    case "silence":
      return silenceRange(clip, op.range);
    case "gain":
      return applyGain(clip, op.db, op.range);
    case "fadeIn":
      return fadeIn(clip, op.duration);
    case "fadeOut":
      return fadeOut(clip, op.duration);
    case "normalize":
      return normalize(clip, op.peakDb);
    case "reverse":
      return reverse(clip, op.range);
    case "speed":
      return changeSpeed(clip, op.factor, op.keepPitch);
    case "pitch":
      return changePitch(clip, op.semitones);
    case "insert": {
      const piece = clips.get(op.clipId);
      if (!piece) return clip;
      return insertClip(clip, piece, Math.round(op.at * clip.sampleRate));
    }
    case "append": {
      const piece = clips.get(op.clipId);
      if (!piece) return clip;
      return concatClips([clip, resampleTo(piece, clip.sampleRate)]);
    }
    case "echo":
      return echo(
        clip,
        { delay: op.delay, decay: op.decay, repeats: op.repeats, mix: op.mix },
        op.range,
      );
    case "reverb":
      return reverb(clip, { size: op.size, damping: op.damping, mix: op.mix }, op.range);
    case "eq":
      return equalize(clip, { lowDb: op.lowDb, midDb: op.midDb, highDb: op.highDb }, op.range);
    case "filter":
      return filterClip(clip, op.mode, op.cutoff, op.q, op.range);
    case "compress":
      return compress(
        clip,
        {
          thresholdDb: op.thresholdDb,
          ratio: op.ratio,
          attackMs: op.attackMs,
          releaseMs: op.releaseMs,
          makeupDb: op.makeupDb,
        },
        op.range,
      );
    case "gate":
      return gate(
        clip,
        { thresholdDb: op.thresholdDb, attackMs: op.attackMs, releaseMs: op.releaseMs },
        op.range,
      );
    case "saturate":
      return saturate(clip, op.driveDb, op.mix, op.range);
    case "stereo":
      return stereoWidth(clip, op.width);
    case "censor":
      return censorRange(clip, op.range, {
        freq: op.freq,
        gain: op.gain,
        style: op.style,
        fade: op.fade,
        mode: op.mode,
      });
    default:
      return clip;
  }
}
