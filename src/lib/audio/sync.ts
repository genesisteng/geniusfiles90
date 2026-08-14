/**
 * Synchronisation multipiste réelle (façon « Sync » d'une platine DJ).
 *
 * Le tempo n'est **jamais** deviné : chaque piste porte un BPM saisi
 * manuellement par l'utilisateur. La synchronisation se contente d'un
 * calcul exact — `facteur = bpm_maître / bpm_source` — puis ré-étire
 * réellement l'audio de la piste (WSOLA, hauteur préservée) depuis sa
 * source d'origine. Comme le moteur de lecture démarre toutes les pistes
 * sur la même horloge `AudioContext`, elles restent alignées à
 * l'échantillon près pendant toute la lecture, après un seek comme après
 * une pause.
 */
import type { AudioClip } from "./types";
import { emptyClip } from "./dsp";

/** Bornes acceptées pour une saisie manuelle de BPM. */
export const MIN_BPM = 20;
export const MAX_BPM = 300;
export const DEFAULT_BPM = 120;

/** Valide une saisie utilisateur : renvoie `null` si elle est inexploitable. */
export function normalizeBpm(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  if (rounded < MIN_BPM || rounded > MAX_BPM) return null;
  return rounded;
}

/** Métadonnées de synchronisation portées par une piste. */
export type TrackSync = {
  /** BPM d'origine saisi par l'utilisateur. */
  sourceBpm: number;
  /** BPM cible (celui de la piste maître, saisi par l'utilisateur). */
  targetBpm: number;
  /** Facteur d'étirement appliqué à la durée (1 = aucun). */
  ratio: number;
  /** Identifiant de la piste maître (`main` ou id de piste). */
  masterId: string;
};

/**
 * Étirement temporel WSOLA : recherche du meilleur recouvrement par
 * corrélation croisée avant chaque fondu. Bien plus propre qu'un simple
 * OLA (pas de flanger ni de doubles attaques) et la hauteur est conservée.
 * `ratio` = durée de sortie / durée d'entrée.
 */
export function stretchWsola(clip: AudioClip, ratio: number): AudioClip {
  if (!Number.isFinite(ratio) || ratio <= 0) return clip;
  if (Math.abs(ratio - 1) < 0.0005 || clip.length === 0) return clip;

  const sr = clip.sampleRate;
  const win = Math.max(512, Math.round(sr * 0.045)); // ≈ 45 ms
  const hopSyn = Math.floor(win / 2);
  const hopAna = Math.max(1, Math.round(hopSyn / ratio));
  const search = Math.max(1, Math.round(sr * 0.01)); // ±10 ms
  const outLength = Math.max(1, Math.round(clip.length * ratio));
  const chCount = clip.channels.length;
  const out = emptyClip(sr, chCount, outLength);
  const norm = new Float32Array(outLength);

  const window = new Float32Array(win);
  for (let i = 0; i < win; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1));

  // Référence mono pour choisir le décalage : les canaux restent alignés
  // entre eux, donc l'image stéréo est préservée.
  const mono = clip.channels[0];
  const ref = new Float32Array(hopSyn);
  let outPos = 0;
  let frame = 0;
  let first = true;

  while (outPos < outLength) {
    // Position d'analyse *idéale* : ancrée sur la grille k·hopAna, jamais
    // sur la position retenue à l'itération précédente — sinon les petits
    // recalages de corrélation s'accumulent et la durée dérive.
    const center = frame * hopAna;
    if (center >= clip.length) break;
    let best = center;
    if (!first) {
      const from = Math.max(0, center - search);
      const to = Math.min(clip.length - win - 1, center + search);
      let bestScore = -Infinity;
      for (let cand = from; cand <= to; cand += 2) {
        let score = 0;
        for (let i = 0; i < hopSyn; i += 4) score += ref[i] * (mono[cand + i] ?? 0);
        if (score > bestScore) {
          bestScore = score;
          best = cand;
        }
      }
      if (best < 0) best = 0;
    }
    first = false;

    for (let c = 0; c < chCount; c++) {
      const src = clip.channels[c];
      const dst = out.channels[c];
      for (let i = 0; i < win; i++) {
        const si = best + i;
        const di = outPos + i;
        if (si >= src.length || di >= outLength) break;
        dst[di] += src[si] * window[i];
        if (c === 0) norm[di] += window[i];
      }
    }
    // Segment de référence pour la prochaine corrélation.
    for (let i = 0; i < hopSyn; i++) ref[i] = mono[best + hopSyn + i] ?? 0;

    outPos += hopSyn;
    frame += 1;
  }

  for (let c = 0; c < chCount; c++) {
    const dst = out.channels[c];
    for (let i = 0; i < outLength; i++) {
      const n = norm[i];
      if (n > 0.0001) {
        const v = dst[i] / n;
        dst[i] = v > 1 ? 1 : v < -1 ? -1 : v;
      }
    }
  }
  return out;
}

/**
 * Facteur d'étirement de durée : `bpm_source / bpm_cible`.
 * Aucune interprétation moitié/double, aucun arrondi : la valeur saisie
 * est utilisée telle quelle.
 */
export function tempoRatio(sourceBpm: number, targetBpm: number): number {
  if (!Number.isFinite(sourceBpm) || !Number.isFinite(targetBpm)) return 1;
  if (sourceBpm <= 0 || targetBpm <= 0) return 1;
  return sourceBpm / targetBpm;
}

export type SyncInput = {
  id: string;
  /** Position actuelle sur la timeline (s) — conservée telle quelle. */
  offset: number;
  /** BPM saisi manuellement. */
  bpm: number;
};

export type SyncPlan = {
  id: string;
  /** Étirement à appliquer à l'audio source (1 = inchangé). */
  ratio: number;
  /** Décalage sur la timeline (s), inchangé : l'utilisateur en reste maître. */
  offset: number;
  sourceBpm: number;
  targetBpm: number;
};

/**
 * Calcule, pour chaque piste cible, l'étirement qui l'amène exactement au
 * tempo de la piste maître. Fonction pure et testable : aucun audio n'est
 * traité ici, aucune analyse n'est lancée.
 */
export function planSync(master: SyncInput, targets: SyncInput[]): SyncPlan[] {
  const targetBpm = master.bpm;
  return targets.map((t) => {
    const ratio = tempoRatio(t.bpm, targetBpm);
    return {
      id: t.id,
      ratio: Number.isFinite(ratio) && ratio > 0.1 && ratio < 10 ? ratio : 1,
      offset: Math.max(0, t.offset),
      sourceBpm: t.bpm,
      targetBpm,
    };
  });
}
