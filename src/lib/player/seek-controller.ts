/**
 * Contrôleur de recherche (seek) quasi instantané.
 *
 * Cause réelle des seeks « qui reviennent en arrière » corrigée ici :
 *
 *  1. `fastSeek()` n'existe que sur Firefox. Sur la WebView Android
 *     (Chromium) l'ancien code croyait piloter le moteur alors qu'il
 *     retombait sur `currentTime` — mais un *unique* minuteur servait à la
 *     fois de throttle et de chien de garde : une demande throttlée
 *     rencontrait `if (this.timer) return` et était purement perdue.
 *     L'UI affichait la nouvelle position, le moteur gardait l'ancienne.
 *  2. Aucun écrasement de la position en attente : la dernière demande
 *     gagne toujours (coalescing), et elle est **toujours** écrite.
 *
 * Stratégie (identique aux lecteurs Android natifs) :
 *  - une seule position en attente : la plus récente gagne ;
 *  - pas plus d'une écriture moteur toutes les ~100 ms pendant un
 *    glissement, mais la dernière est garantie ;
 *  - écriture immédiate et prioritaire au relâchement (`commit`).
 */

export type SeekMode = "fast" | "precise";

/** Cadence maximale des seeks moteur pendant un glissement (ms). */
const SCRUB_INTERVAL_MS = 100;
/** Filet de sécurité : certaines WebView n'émettent pas toujours `seeked`. */
const SEEK_WATCHDOG_MS = 500;

export class SeekController {
  private el: HTMLVideoElement | null = null;
  private pending: number | null = null;
  private lastWrite = 0;
  private busy = false;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  private onSeeked = () => {
    this.clearWatchdog();
    this.busy = false;
    this.flush();
  };

  attach(el: HTMLVideoElement | null) {
    if (this.el === el) return;
    this.detach();
    this.el = el;
    if (!el) return;
    el.addEventListener("seeked", this.onSeeked);
    el.addEventListener("error", this.onSeeked);
  }

  detach() {
    const el = this.el;
    if (el) {
      el.removeEventListener("seeked", this.onSeeked);
      el.removeEventListener("error", this.onSeeked);
    }
    if (this.throttleTimer) clearTimeout(this.throttleTimer);
    this.throttleTimer = null;
    this.clearWatchdog();
    this.el = null;
    this.pending = null;
    this.busy = false;
  }

  get attached(): boolean {
    return this.el != null;
  }

  /** Position réellement demandée (utile pour l'affichage). */
  get target(): number | null {
    return this.pending;
  }

  /** Position vers laquelle le moteur se dirige (demandée ou courante). */
  get effectiveTime(): number {
    return this.pending ?? this.el?.currentTime ?? 0;
  }

  private clamp(time: number): number {
    const el = this.el;
    const duration = el && Number.isFinite(el.duration) ? el.duration : 0;
    if (duration > 0) return Math.max(0, Math.min(duration - 0.05, time));
    return Math.max(0, time);
  }

  /** Demande une nouvelle position. La dernière demande gagne toujours. */
  seek(time: number, mode: SeekMode = "precise") {
    if (!this.el) return;
    this.pending = this.clamp(time);
    this.flush(mode === "precise");
  }

  /** Déplacement relatif (double-tap, clavier, boutons ±10 s). */
  seekBy(delta: number, mode: SeekMode = "fast"): number | null {
    const el = this.el;
    if (!el) return null;
    const base = this.pending ?? el.currentTime ?? 0;
    this.pending = this.clamp(base + delta);
    const target = this.pending;
    // Un saut discret est toujours appliqué immédiatement : c'est une
    // intention explicite de l'utilisateur, jamais un mouvement continu.
    this.flush(true);
    void mode;
    return target;
  }

  /**
   * Fin du geste : écriture immédiate et prioritaire, puis relecture sans
   * attendre `canplay` (aucun écran noir, aucun gel).
   */
  commit(time?: number, resumePlayback = true) {
    const el = this.el;
    if (!el) return;
    if (time != null) this.pending = this.clamp(time);
    this.busy = false;
    this.flush(true);
    if (resumePlayback && el.paused) {
      void el.play().catch(() => {
        /* l'utilisateur peut relancer manuellement */
      });
    }
  }

  private clearWatchdog() {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private flush(force = false) {
    const el = this.el;
    if (!el || this.pending == null) return;

    if (!force) {
      if (this.busy) return; // `seeked` relancera le flush
      const elapsed = performance.now() - this.lastWrite;
      if (elapsed < SCRUB_INTERVAL_MS) {
        // La demande n'est jamais perdue : elle reste en attente et un
        // minuteur dédié (distinct du chien de garde) la ré-émet.
        if (!this.throttleTimer) {
          this.throttleTimer = setTimeout(() => {
            this.throttleTimer = null;
            this.flush();
          }, SCRUB_INTERVAL_MS - elapsed);
        }
        return;
      }
    }

    const target = this.pending;
    this.pending = null;
    this.lastWrite = performance.now();
    this.busy = true;
    try {
      el.currentTime = target;
    } catch {
      this.busy = false;
      return;
    }
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      this.watchdog = null;
      this.busy = false;
      this.flush();
    }, SEEK_WATCHDOG_MS);
  }
}
