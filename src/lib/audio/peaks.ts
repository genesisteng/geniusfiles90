/**
 * Crêtes (waveform) — pyramide multi-résolution par canal.
 *
 * Objectif : un déplacement horizontal ou un zoom ne doit jamais relire le
 * signal complet. On précalcule une fois, par canal, une pyramide de
 * min/max agrégés (256 échantillons par case, puis ×4 à chaque niveau).
 * Le tracé choisit le niveau juste assez fin pour la largeur demandée, ce
 * qui rend le coût d'une frame proportionnel au nombre de colonnes à
 * l'écran, et non à la durée du fichier.
 *
 * Le niveau de base est construit par tranches (la main est rendue au
 * navigateur), les niveaux supérieurs en sont dérivés — c'est quasi gratuit.
 */
import { t } from "@/lib/i18n";
import type { AudioClip } from "./types";

export type Peaks = {
  /** Longueur = buckets * 2 : [min, max] par colonne. */
  data: Float32Array;
  buckets: number;
  /** Fenêtre du clip couverte, en échantillons. */
  from: number;
  to: number;
};

/* ------------------------------------------------------------ compat API */

export function computePeaksSync(
  clip: AudioClip,
  buckets: number,
  from = 0,
  to = clip.length,
): Peaks {
  const start = Math.max(0, Math.min(from, clip.length));
  const end = Math.max(start, Math.min(to, clip.length));
  const count = Math.max(1, Math.floor(buckets));
  const data = new Float32Array(count * 2);
  const span = end - start;
  if (span <= 0) return { data, buckets: count, from: start, to: end };
  const per = span / count;
  const chans = clip.channels;
  for (let b = 0; b < count; b++) {
    const s0 = start + Math.floor(b * per);
    const s1 = Math.min(end, start + Math.floor((b + 1) * per));
    let min = 1;
    let max = -1;
    const step = Math.max(1, Math.floor((s1 - s0) / 4096));
    for (const ch of chans) {
      for (let i = s0; i < s1; i += step) {
        const v = ch[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (min > max) {
      min = 0;
      max = 0;
    }
    data[b * 2] = min;
    data[b * 2 + 1] = max;
  }
  return { data, buckets: count, from: start, to: end };
}

/** Version asynchrone : rend la main entre les tranches. */
export async function computePeaks(
  clip: AudioClip,
  buckets: number,
  from = 0,
  to = clip.length,
  signal?: AbortSignal,
): Promise<Peaks> {
  const count = Math.max(1, Math.floor(buckets));
  if (count <= 2048 && to - from < clip.sampleRate * 600) {
    return computePeaksSync(clip, count, from, to);
  }
  const slice = 256;
  const result = new Float32Array(count * 2);
  for (let b = 0; b < count; b += slice) {
    if (signal?.aborted) throw new DOMException(t("action.cancelled"), "AbortError");
    const chunkStart = from + Math.floor(((to - from) * b) / count);
    const chunkEnd = from + Math.floor(((to - from) * Math.min(count, b + slice)) / count);
    const part = computePeaksSync(clip, Math.min(slice, count - b), chunkStart, chunkEnd);
    result.set(part.data, b * 2);
    await new Promise((r) => setTimeout(r, 0));
  }
  return { data: result, buckets: count, from, to };
}

/* ------------------------------------------------------------- pyramide */

const BASE_SPP = 256;
const RATIO = 4;
const MAX_LEVELS = 10;

type Level = {
  /** Échantillons agrégés par case. */
  spp: number;
  buckets: number;
  /** Un Float32Array par canal, entrelacé [min, max]. */
  channels: Float32Array[];
};

/**
 * Pyramide de crêtes d'un clip. À reconstruire uniquement quand le rendu
 * audio change (nouvelle opération), jamais lors d'un zoom ou d'un pan.
 */
export class PeakStore {
  private clip: AudioClip;
  private levels: Level[] = [];
  private built = 0;
  private cancelled = false;
  private promise: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  /** Vrai quand le store est partagé par le cache (ne pas le détruire). */
  cached = false;

  constructor(clip: AudioClip) {
    this.clip = clip;
  }

  /** Le store décrit-il toujours ce clip précis ? */
  matches(clip: AudioClip): boolean {
    return this.clip === clip && !this.cancelled;
  }

  /**
   * Construit la pyramide une seule fois, même si plusieurs vues la
   * demandent : les crêtes ne sont jamais recalculées pour rien.
   */
  ensure(onChunk?: () => void): Promise<void> {
    if (onChunk) {
      this.listeners.add(onChunk);
      if (this.ready) onChunk();
    }
    if (!this.promise) {
      this.promise = this.build(() => {
        for (const fn of this.listeners) fn();
      }).catch(() => {});
    }
    return this.promise;
  }

  off(onChunk: () => void): void {
    this.listeners.delete(onChunk);
  }

  get channelCount(): number {
    return Math.max(1, this.clip.channels.length);
  }

  /** Fraction du niveau de base déjà calculée (0..1). */
  get progress(): number {
    const total = this.levels[0]?.buckets ?? 0;
    if (total === 0) return 1;
    return Math.min(1, this.built / total);
  }

  get ready(): boolean {
    return this.progress >= 1;
  }

  dispose() {
    this.cancelled = true;
    this.levels = [];
    this.listeners.clear();
    this.cached = false;
  }

  /**
   * Construit la pyramide. `onChunk` est appelé après chaque tranche pour
   * permettre un tracé progressif.
   */
  async build(onChunk?: () => void): Promise<void> {
    const clip = this.clip;
    const chans = this.channelCount;
    const baseBuckets = Math.max(1, Math.ceil(clip.length / BASE_SPP));
    const base: Level = {
      spp: BASE_SPP,
      buckets: baseBuckets,
      channels: Array.from({ length: chans }, () => new Float32Array(baseBuckets * 2)),
    };
    this.levels = [base];
    this.built = 0;

    // Tranches d'environ 1,5 s d'audio : imperceptible mais suffisant pour
    // ne jamais bloquer le thread principal.
    const perChunk = Math.max(64, Math.ceil((clip.sampleRate * 1.5) / BASE_SPP));
    for (let b = 0; b < baseBuckets; b += perChunk) {
      if (this.cancelled) return;
      const end = Math.min(baseBuckets, b + perChunk);
      for (let c = 0; c < chans; c++) {
        const src = clip.channels[Math.min(c, clip.channels.length - 1)];
        const dst = base.channels[c];
        for (let i = b; i < end; i++) {
          const s0 = i * BASE_SPP;
          const s1 = Math.min(clip.length, s0 + BASE_SPP);
          let min = 0;
          let max = 0;
          if (s1 > s0) {
            min = 1;
            max = -1;
            for (let s = s0; s < s1; s++) {
              const v = src[s];
              if (v < min) min = v;
              if (v > max) max = v;
            }
            if (min > max) {
              min = 0;
              max = 0;
            }
          }
          dst[i * 2] = min;
          dst[i * 2 + 1] = max;
        }
      }
      this.built = end;
      onChunk?.();
      if (end < baseBuckets) await new Promise((r) => setTimeout(r, 0));
    }

    // Niveaux supérieurs : dérivés du précédent, coût négligeable.
    let prev = base;
    while (prev.buckets > 2 && this.levels.length < MAX_LEVELS) {
      const buckets = Math.max(1, Math.ceil(prev.buckets / RATIO));
      const level: Level = {
        spp: prev.spp * RATIO,
        buckets,
        channels: Array.from({ length: chans }, () => new Float32Array(buckets * 2)),
      };
      for (let c = 0; c < chans; c++) {
        const src = prev.channels[c];
        const dst = level.channels[c];
        for (let i = 0; i < buckets; i++) {
          let min = 1;
          let max = -1;
          const j0 = i * RATIO;
          const j1 = Math.min(prev.buckets, j0 + RATIO);
          for (let j = j0; j < j1; j++) {
            const lo = src[j * 2];
            const hi = src[j * 2 + 1];
            if (lo < min) min = lo;
            if (hi > max) max = hi;
          }
          if (min > max) {
            min = 0;
            max = 0;
          }
          dst[i * 2] = min;
          dst[i * 2 + 1] = max;
        }
      }
      this.levels.push(level);
      prev = level;
      if (this.cancelled) return;
    }
  }

  /**
   * Remplit `dest` (longueur `cols * 2`) avec les min/max du canal `ch`
   * entre les échantillons `from` et `to`. Aucune allocation.
   */
  fill(ch: number, from: number, to: number, cols: number, dest: Float32Array): void {
    const clip = this.clip;
    const chans = this.channelCount;
    const channel = Math.min(Math.max(0, ch), chans - 1);
    const start = Math.max(0, Math.min(from, clip.length));
    const end = Math.max(start, Math.min(to, clip.length));
    const count = Math.max(1, cols);
    dest.fill(0);
    const span = end - start;
    if (span <= 0) return;
    const perCol = span / count;

    // Zoom très profond : lecture directe des échantillons (peu nombreux).
    if (perCol < BASE_SPP || this.levels.length === 0) {
      const src = clip.channels[Math.min(channel, clip.channels.length - 1)];
      for (let i = 0; i < count; i++) {
        const s0 = Math.floor(start + i * perCol);
        const s1 = Math.max(s0 + 1, Math.floor(start + (i + 1) * perCol));
        let min = 1;
        let max = -1;
        for (let s = s0; s < s1 && s < clip.length; s++) {
          const v = src[s];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        if (min > max) {
          min = 0;
          max = 0;
        }
        dest[i * 2] = min;
        dest[i * 2 + 1] = max;
      }
      return;
    }

    // Niveau le plus grossier dont les cases tiennent dans une colonne.
    let level = this.levels[0];
    for (const candidate of this.levels) {
      if (candidate.spp <= perCol) level = candidate;
      else break;
    }
    const data = level.channels[channel];
    const known = level === this.levels[0] ? this.built : level.buckets;
    for (let i = 0; i < count; i++) {
      const b0 = Math.floor((start + i * perCol) / level.spp);
      const b1 = Math.max(b0 + 1, Math.ceil((start + (i + 1) * perCol) / level.spp));
      let min = 1;
      let max = -1;
      for (let b = b0; b < b1 && b < known; b++) {
        const lo = data[b * 2];
        const hi = data[b * 2 + 1];
        if (lo < min) min = lo;
        if (hi > max) max = hi;
      }
      if (min > max) {
        min = 0;
        max = 0;
      }
      dest[i * 2] = min;
      dest[i * 2 + 1] = max;
    }
  }
}

/* --------------------------------------------------- cache de crêtes */

/**
 * Cache LRU des pyramides déjà calculées, indexé par jeton de rendu.
 * Un annuler/rétablir ou un aller-retour entre deux états retrouve donc
 * ses crêtes instantanément, sans recalcul complet.
 * Les aperçus temps réel (`live_…`) ne sont pas mis en cache : leurs
 * paramètres changent en continu et pollueraient le cache.
 */
const STORES = new Map<string, PeakStore>();
const MAX_STORES = 6;

export function acquirePeakStore(token: string, clip: AudioClip): PeakStore {
  if (token.startsWith("live_")) return new PeakStore(clip);
  const hit = STORES.get(token);
  if (hit && hit.matches(clip)) {
    STORES.delete(token);
    STORES.set(token, hit);
    return hit;
  }
  if (hit) {
    hit.dispose();
    STORES.delete(token);
  }
  const store = new PeakStore(clip);
  store.cached = true;
  STORES.set(token, store);
  while (STORES.size > MAX_STORES) {
    const oldest = STORES.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    STORES.get(oldest)?.dispose();
    STORES.delete(oldest);
  }
  return store;
}

/** Vide le cache (fermeture de l'éditeur). */
export function clearPeakStores(): void {
  for (const s of STORES.values()) s.dispose();
  STORES.clear();
}
