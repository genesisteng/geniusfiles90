/**
 * Moteur de lecture de l'éditeur.
 *
 * Utilise le même `AudioContext` que le décodage (donc la même pile audio
 * que le reste de GeniusFiles) et lit directement le(s) clip(s) rendu(s)
 * en mémoire : la prévisualisation correspond exactement au futur export.
 *
 * Deux pistes peuvent être lues simultanément : elles sont démarrées sur
 * la même base d'horloge, ce qui garantit une synchronisation exacte.
 */
import { audioContext } from "./decode";
import type { AudioClip } from "./types";

export type PlayLayer = {
  clip: AudioClip;
  token: string;
  /** Décalage de la piste sur la timeline, en secondes. */
  offset: number;
  /** Volume linéaire. */
  gain: number;
  muted?: boolean;
};

export class ClipPlayer {
  private sources: AudioBufferSourceNode[] = [];
  private main: AudioBufferSourceNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private startedAt = 0;
  private startOffset = 0;
  private stopAt: number | null = null;
  private endAt = 0;
  private lastTime = 0;

  onEnded: (() => void) | null = null;

  /**
   * Retard matériel entre l'instant traité par l'`AudioContext` et le son
   * réellement audible (tampon interne + sortie système).
   */
  private latency(): number {
    const ctx = audioContext() as AudioContext & { outputLatency?: number };
    const base = Number.isFinite(ctx.baseLatency) ? ctx.baseLatency : 0;
    // Seule la latence de traitement est retirée. `outputLatency` inclut sur
    // Android le tampon système déjà « en vol » : le soustraire faisait
    // reculer le curseur derrière le son entendu (retard visible sur les
    // montées brusques). Bornée à 40 ms pour rester sans effet perceptible.
    return base > 0 && base < 0.04 ? base : 0;
  }

  /**
   * Position réelle de lecture, lue directement sur l'horloge du
   * `AudioContext` (la même que celle qui cadence le son). Aucun timer,
   * aucune accumulation : l'affichage ne peut pas dériver.
   * `lead` permet d'anticiper l'instant d'affichage réel d'une frame afin
   * que le pixel dessiné corresponde au son entendu au même moment.
   * Retourne `null` quand rien n'est en cours.
   */
  currentTime(lead = 0): number | null {
    if (!this.main) return null;
    const now = audioContext().currentTime;
    const t = this.startOffset + Math.max(0, now - this.startedAt + lead - this.latency());
    return this.stopAt != null ? Math.min(t, this.stopAt) : Math.min(t, this.endAt);
  }

  private toBuffer(clip: AudioClip, token: string): AudioBuffer {
    const hit = this.buffers.get(token);
    if (hit) return hit;
    const ctx = audioContext();
    const buf = ctx.createBuffer(
      Math.max(1, clip.channels.length),
      Math.max(1, clip.length),
      clip.sampleRate,
    );
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const data = clip.channels[Math.min(c, clip.channels.length - 1)];
      buf.getChannelData(c).set(data);
    }
    if (this.buffers.size > 3) this.buffers.clear();
    this.buffers.set(token, buf);
    return buf;
  }

  /** Invalide les tampons lorsque le rendu change. */
  invalidate() {
    this.buffers.clear();
  }

  get playing(): boolean {
    return this.main !== null;
  }

  play(clip: AudioClip, token: string, from: number, until?: number, layers: PlayLayer[] = []) {
    this.stop(false);
    const ctx = audioContext();
    void ctx.resume();
    const buffer = this.toBuffer(clip, token);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const offset = Math.max(0, Math.min(from, buffer.duration));
    const duration = until != null ? Math.max(0.01, until - offset) : undefined;
    // Départ au plus près de l'instant présent : juste de quoi laisser le
    // planificateur audio préparer le premier bloc, sans latence perçue.
    const startTime = ctx.currentTime + Math.max(0.005, Math.min(0.02, ctx.baseLatency || 0.01));
    src.onended = () => {
      if (this.main === src) {
        this.stopSecondary();
        this.main = null;
        this.lastTime = until ?? offset + buffer.duration - offset;
        this.onEnded?.();
      }
    };

    try {
      if (duration != null) src.start(startTime, offset, duration);
      else src.start(startTime, offset);
    } catch {
      return;
    }
    this.main = src;
    this.sources = [src];

    for (const layer of layers) {
      if (layer.muted || layer.clip.length === 0) continue;
      try {
        const buf = this.toBuffer(layer.clip, layer.token);
        const node = ctx.createBufferSource();
        node.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.value = Math.max(0, layer.gain);
        node.connect(gain);
        gain.connect(ctx.destination);
        const local = offset - layer.offset;
        if (local >= buf.duration) continue;
        if (local >= 0) node.start(startTime, local);
        else node.start(startTime - local, 0);
        this.sources.push(node);
      } catch {
        /* une piste secondaire ne doit jamais casser la lecture */
      }
    }

    this.startedAt = startTime;
    this.startOffset = offset;
    this.stopAt = until ?? null;
    this.endAt = buffer.duration;
    this.lastTime = offset;
  }

  private stopSecondary() {
    for (const node of this.sources) {
      if (node === this.main) continue;
      try {
        node.stop();
      } catch {
        /* déjà arrêté */
      }
      node.disconnect();
    }
    this.sources = this.main ? [this.main] : [];
  }

  /**
   * Arrête la lecture. La position exacte atteinte est mémorisée
   * ({@link lastPosition}) afin que le curseur reste précisément là où le
   * son s'est tu.
   */
  stop(notify = true) {
    const live = this.currentTime();
    if (live != null) this.lastTime = live;
    const src = this.main;
    this.main = null;
    this.stopSecondary();
    if (src) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* déjà arrêté */
      }
      src.disconnect();
      if (notify) this.onEnded?.();
    }
    this.sources = [];
  }

  /** Dernière position connue (lecture en cours ou arrêtée). */
  get lastPosition(): number {
    return this.currentTime() ?? this.lastTime;
  }

  dispose() {
    this.stop(false);
    this.buffers.clear();
    this.onEnded = null;
  }
}
