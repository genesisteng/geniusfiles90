/**
 * Global audio playback singleton.
 *
 * Owns the ONE <audio> element used by GeniusFiles. Never destroyed while
 * the app is alive, so opening/closing the full-screen player, switching
 * tracks or navigating between routes never interrupts playback.
 *
 * All commands (play/pause/next/prev/jumpTo/seek/stop) are guarded with
 * try/catch — no error path can bubble to React and unmount the UI.
 *
 * State (queue names, index, position, shuffle, repeat) is persisted to
 * localStorage so the user finds the same session after re-opening the
 * app minutes or hours later.
 */
import type { FileEntry, PathRef } from "@/lib/files/types";
import { sourceUrlOf, entryKey } from "@/lib/viewer/source";
import { getResume, setResume } from "@/lib/viewer/resume";
import { parseTrackName } from "@/components/player/format";
import {
  mediaSessionStart,
  mediaSessionUpdate,
  mediaSessionStop,
  onMediaAction,
} from "@/lib/native/media-session";

export type RepeatMode = "off" | "all" | "one";

export type AudioState = {
  parent: PathRef | null;
  /**
   * Dossier parent propre à chaque piste, aligné sur `queue`.
   *
   * Une file construite depuis une catégorie (Musique, Récents, Recherche…)
   * mélange des fichiers venant de dossiers différents : résoudre leur URL
   * avec le seul `parent` de la piste sélectionnée produisait des chemins
   * inexistants, donc une erreur de chargement et un saut automatique en
   * chaîne. `parents` conserve le vrai dossier de chaque piste.
   */
  parents: PathRef[] | null;
  queue: FileEntry[];
  index: number;
  playing: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  uiOpen: boolean;
  loaded: boolean;
};

const STORAGE_KEY = "gf.player.state.v1";
/** Nombre maximal de pistes persistées autour de la position courante. */
const SAVE_WINDOW = 400;
/** Au-delà, la comparaison de file se fait par échantillon (O(1)). */
const DEEP_COMPARE_MAX = 2000;

type Listener = () => void;

function initialState(): AudioState {
  return {
    parent: null,
    parents: null,
    queue: [],
    index: 0,
    playing: false,
    position: 0,
    duration: 0,
    shuffle: false,
    repeat: "off",
    uiOpen: false,
    loaded: false,
  };
}

class AudioStore {
  private state: AudioState = initialState();
  private listeners = new Set<Listener>();
  private audio: HTMLAudioElement | null = null;
  private currentSrc = "";
  private saveTimer: number | null = null;
  private nativeWired = false;

  getState(): AudioState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const l of this.listeners) {
      try {
        l();
      } catch {
        /* ignore */
      }
    }
    this.scheduleSave();
    this.pushToNative();
  }

  private setState(patch: Partial<AudioState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  // ---------- audio element lifecycle ----------

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof document === "undefined") return null;
    if (this.audio) return this.audio;
    const a = document.createElement("audio");
    a.preload = "auto";
    a.setAttribute("playsinline", "true");
    a.style.display = "none";
    document.body.appendChild(a);
    a.addEventListener("timeupdate", () => {
      this.setState({ position: a.currentTime });
    });
    a.addEventListener("loadedmetadata", () => {
      this.setState({ duration: a.duration || 0, loaded: true });
    });
    a.addEventListener("play", () => this.setState({ playing: true }));
    a.addEventListener("pause", () => {
      this.setState({ playing: false });
      this.saveResume();
    });
    a.addEventListener("ended", () => {
      this.saveResume(0);
      if (this.state.repeat === "one") {
        try {
          a.currentTime = 0;
          void a.play();
        } catch {
          /* ignore */
        }
      } else {
        this.advance("ended");
      }
    });
    a.addEventListener("error", () => {
      /* Un `error` peut aussi provenir du démontage d'une source (src retiré
         lors d'un changement de piste). On ne saute JAMAIS en chaîne :
         - la source en erreur doit être la source courante ;
         - une seule tentative de saut automatique par piste ;
         - le minuteur est annulé dès qu'une nouvelle piste est chargée.
         Sans ces gardes, chaque changement de piste déclenchait un saut
         supplémentaire et la file défilait toute seule. */
      const failed = this.currentSrc;
      if (!failed || !a.getAttribute("src")) return;
      if (this.autoSkipDoneFor === failed) return;
      this.autoSkipDoneFor = failed;
      this.clearSkipTimer();
      this.skipTimer = window.setTimeout(() => {
        this.skipTimer = null;
        if (this.currentSrc !== failed) return; // piste déjà changée
        if (this.state.queue.length > 1 && this.state.repeat !== "one") this.advance("error");
      }, 1200);
    });
    this.audio = a;
    this.wireNativeOnce();
    return a;
  }

  /**
   * Avance d'exactement une piste, jamais plus.
   *
   * `advancing` neutralise toute ré-entrance (ended + error + action native
   * simultanés) : un seul changement d'index est appliqué par cycle.
   */
  private advancing = false;
  private advance(_reason: "ended" | "error" | "user") {
    if (this.advancing) return;
    this.advancing = true;
    try {
      this.next();
    } finally {
      this.advancing = false;
    }
  }

  private skipTimer: number | null = null;
  private autoSkipDoneFor = "";
  private clearSkipTimer() {
    if (this.skipTimer != null && typeof window !== "undefined") {
      window.clearTimeout(this.skipTimer);
    }
    this.skipTimer = null;
  }

  private wireNativeOnce() {
    if (this.nativeWired) return;
    this.nativeWired = true;
    try {
      onMediaAction((action) => {
        switch (action) {
          case "play":
            this.play();
            break;
          case "pause":
            this.pause();
            break;
          case "toggle":
            this.toggle();
            break;
          case "next":
            this.next();
            break;
          case "prev":
            this.prev();
            break;
          case "stop":
            this.stop();
            break;
          case "open":
            this.openUI();
            break;
        }
      });
    } catch {
      /* ignore */
    }
  }

  /** Dossier réel de la piste `i` (file mixte) ou parent global par défaut. */
  private parentAt(i: number): PathRef | null {
    const { parents, parent } = this.state;
    return parents?.[i] ?? parent;
  }

  private loadCurrent(autoplay: boolean) {
    const a = this.ensureAudio();
    if (!a) return;
    const { queue, index } = this.state;
    const parent = this.parentAt(index);
    const entry = queue[index];
    if (!parent || !entry) {
      this.currentSrc = "";
      try {
        a.pause();
        a.removeAttribute("src");
        a.load();
      } catch {
        /* ignore */
      }
      return;
    }
    const src = sourceUrlOf(parent, entry);
    if (src === this.currentSrc) {
      if (autoplay) this.play();
      return;
    }
    this.currentSrc = src;
    // Nouvelle piste : on annule tout saut automatique en attente hérité de
    // la piste précédente (sinon la file continuait à défiler seule).
    this.clearSkipTimer();
    this.autoSkipDoneFor = "";
    try {
      // Start playback intent BEFORE metadata arrives so the browser begins
      // decoding immediately instead of waiting a full load round-trip.
      a.src = src;
      a.load();
      if (autoplay) this.play();
      const rKey = entryKey(parent, entry);
      const resume = getResume(rKey);
      const applyResume = () => {
        if (resume && resume.pos > 3 && resume.pos < (a.duration || Infinity) - 5) {
          try {
            a.currentTime = resume.pos;
          } catch {
            /* ignore */
          }
        }
      };
      if (a.readyState >= 1) applyResume();
      else a.addEventListener("loadedmetadata", applyResume, { once: true });
      this.setState({ position: 0, duration: 0, loaded: false });
      this.prefetchNeighbours();
    } catch {
      /* ignore */
    }
  }

  /** Warm the browser cache for the next/previous track so skips feel instant. */
  private prefetch = new Map<string, HTMLAudioElement>();
  private prefetchNeighbours() {
    if (typeof document === "undefined") return;
    try {
      const { queue, index } = this.state;
      if (queue.length < 2) return;
      const wanted = new Set<string>();
      for (const i of [index + 1, index - 1]) {
        const e = queue[i];
        const pref = this.parentAt(i);
        if (!e || !pref) continue;
        const url = sourceUrlOf(pref, e);
        if (!url || url === this.currentSrc) continue;
        wanted.add(url);
        if (this.prefetch.has(url)) continue;
        const p = document.createElement("audio");
        p.preload = "auto";
        p.muted = true;
        p.src = url;
        try {
          p.load();
        } catch {
          /* ignore */
        }
        this.prefetch.set(url, p);
      }
      for (const [url, el] of this.prefetch) {
        if (wanted.has(url)) continue;
        try {
          el.removeAttribute("src");
          el.load();
        } catch {
          /* ignore */
        }
        this.prefetch.delete(url);
      }
    } catch {
      /* ignore */
    }
  }

  /** Direct handle for UI-side smoothing (read-only usage). */
  getAudioEl(): HTMLAudioElement | null {
    return this.audio;
  }

  private saveResume(explicit?: number) {
    try {
      const { queue, index } = this.state;
      const parent = this.parentAt(index);
      const entry = queue[index];
      if (!parent || !entry || !this.audio) return;
      const pos = explicit ?? this.audio.currentTime;
      setResume(entryKey(parent, entry), pos, this.audio.duration || undefined);
    } catch {
      /* ignore */
    }
  }

  // ---------- public commands ----------

  playQueue(parent: PathRef, entries: FileEntry[], index: number, parents?: (PathRef | null)[]) {
    try {
      const clamped = Math.max(0, Math.min(entries.length - 1, index));
      /* Files identiques : identité de tableau d'abord (cas courant, coût
         nul), puis comparaison profonde uniquement sur les listes courtes.
         Au-delà de 2 000 pistes on échantillonne début/milieu/fin : aucun
         parcours O(n) n'est déclenché par une simple ouverture de piste. */
      const prev = this.state.queue;
      const sameParent =
        !!this.state.parent &&
        this.state.parent.rootId === parent.rootId &&
        this.state.parent.segments.join("/") === parent.segments.join("/");
      let sameList = prev === entries;
      if (!sameList && sameParent && prev.length === entries.length && prev.length > 0) {
        if (prev.length <= DEEP_COMPARE_MAX) {
          sameList = prev.every((e, i) => e.name === entries[i]?.name);
        } else {
          const probes = [0, prev.length >> 1, prev.length - 1, clamped];
          sameList = probes.every((i) => prev[i]?.name === entries[i]?.name);
        }
      }
      if (sameParent && sameList) {
        if (clamped !== this.state.index) {
          this.setState({ index: clamped });
          this.loadCurrent(true);
        } else {
          this.play();
        }
        return;
      }
      // Nouvelle file : la table des dossiers n'est matérialisée qu'ici.
      const resolved: PathRef[] | null = parents
        ? entries.map((_, i) => parents[i] ?? parent)
        : null;
      this.setState({ parent, parents: resolved, queue: entries, index: clamped });
      this.loadCurrent(true);
    } catch {
      /* never throw */
    }
  }

  toggle() {
    if (this.state.playing) this.pause();
    else this.play();
  }

  play() {
    try {
      const a = this.ensureAudio();
      if (!a) return;
      if (!a.src && this.state.queue.length) this.loadCurrent(false);
      const p = a.play();
      if (p && typeof (p as Promise<void>).catch === "function") {
        (p as Promise<void>).catch(() => {
          /* autoplay blocked or transient — leave state consistent */
        });
      }
    } catch {
      /* ignore */
    }
  }

  pause() {
    try {
      this.audio?.pause();
    } catch {
      /* ignore */
    }
  }

  next() {
    try {
      // Toute action utilisateur annule un saut automatique en attente.
      this.clearSkipTimer();
      const { queue, index, shuffle, repeat } = this.state;
      if (queue.length === 0) return;
      let n: number;
      if (shuffle && queue.length > 1) {
        do {
          n = Math.floor(Math.random() * queue.length);
        } while (n === index);
      } else {
        n = index + 1;
        if (n >= queue.length) n = repeat === "all" ? 0 : queue.length - 1;
      }
      if (n === index) {
        // At end with repeat off — stop cleanly but keep track loaded
        try {
          this.audio?.pause();
          if (this.audio) this.audio.currentTime = 0;
        } catch {
          /* ignore */
        }
        return;
      }
      this.setState({ index: n });
      this.loadCurrent(true);
    } catch {
      /* ignore */
    }
  }

  prev() {
    try {
      // Toute action utilisateur annule un saut automatique en attente.
      this.clearSkipTimer();
      const { queue, index, repeat } = this.state;
      if (queue.length === 0) return;
      // Standard behaviour: if >3s in, restart current track
      const a = this.audio;
      if (a && a.currentTime > 3) {
        try {
          a.currentTime = 0;
          return;
        } catch {
          /* fall through */
        }
      }
      let n = index - 1;
      if (n < 0) n = repeat === "all" ? queue.length - 1 : 0;
      if (n === index) return;
      this.setState({ index: n });
      this.loadCurrent(true);
    } catch {
      /* ignore */
    }
  }

  jumpTo(i: number) {
    try {
      // Toute action utilisateur annule un saut automatique en attente.
      this.clearSkipTimer();
      if (i < 0 || i >= this.state.queue.length) return;
      if (i === this.state.index) {
        this.play();
        return;
      }
      this.setState({ index: i });
      this.loadCurrent(true);
    } catch {
      /* ignore */
    }
  }

  seek(seconds: number) {
    try {
      const a = this.audio;
      if (!a) return;
      a.currentTime = Math.max(0, Math.min(a.duration || seconds, seconds));
      this.setState({ position: a.currentTime });
    } catch {
      /* ignore */
    }
  }

  setShuffle(v: boolean) {
    this.setState({ shuffle: v });
  }

  setRepeat(m: RepeatMode) {
    this.setState({ repeat: m });
  }

  stop() {
    try {
      this.saveResume();
      this.audio?.pause();
      if (this.audio) {
        try {
          this.audio.removeAttribute("src");
          this.audio.load();
        } catch {
          /* ignore */
        }
      }
      this.currentSrc = "";
      try {
        mediaSessionStop();
      } catch {
        /* ignore */
      }
      this.state = { ...initialState(), shuffle: this.state.shuffle, repeat: this.state.repeat };
      this.emit();
    } catch {
      /* ignore */
    }
  }

  openUI() {
    if (!this.state.uiOpen) this.setState({ uiOpen: true });
  }
  closeUI() {
    if (this.state.uiOpen) this.setState({ uiOpen: false });
  }

  // ---------- persistence ----------

  private scheduleSave() {
    if (typeof window === "undefined") return;
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), 400);
  }

  /**
   * Persistance bornée : seule une fenêtre autour de la piste courante est
   * sérialisée (au plus {@link SAVE_WINDOW} éléments).
   *
   * Sans cette borne, une file issue d'une catégorie globale (100 000+
   * pistes) était re-sérialisée toutes les 400 ms — à chaque `timeupdate`,
   * chaque pause, chaque changement de piste — ce qui bloquait le thread
   * principal et rendait les contrôles et la playlist lents.
   */
  private save() {
    if (typeof window === "undefined") return;
    try {
      const { parent, parents, queue, index, shuffle, repeat, position } = this.state;
      const start = Math.max(0, Math.min(queue.length, index - SAVE_WINDOW / 2) | 0);
      const end = Math.min(queue.length, start + SAVE_WINDOW);
      const slice = queue.slice(start, end);
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          parent,
          parents: parents ? parents.slice(start, end) : null,
          queue: slice.map((e) => ({ name: e.name, ext: e.ext, size: e.size, kind: e.kind })),
          index: index - start,
          shuffle,
          repeat,
          position,
        }),
      );
    } catch {
      /* quota / privacy — ignore */
    }
  }

  restore() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        parent: PathRef | null;
        parents?: PathRef[] | null;
        queue: FileEntry[];
        index: number;
        shuffle: boolean;
        repeat: RepeatMode;
        position: number;
      };
      if (!data.parent || !Array.isArray(data.queue) || data.queue.length === 0) return;
      this.state = {
        ...initialState(),
        parent: data.parent,
        parents:
          Array.isArray(data.parents) && data.parents.length === data.queue.length
            ? data.parents
            : null,
        queue: data.queue,
        index: Math.max(0, Math.min(data.queue.length - 1, data.index || 0)),
        shuffle: !!data.shuffle,
        repeat: (data.repeat as RepeatMode) || "off",
      };
      // Load metadata but do not autoplay on cold start.
      this.loadCurrent(false);
      this.emit();
    } catch {
      /* ignore */
    }
  }

  // ---------- native bridge ----------

  private lastNativeKey = "";
  private pushToNative() {
    try {
      const { queue, index, playing } = this.state;
      const parent = this.parentAt(index);
      const entry = queue[index];
      if (!parent || !entry) {
        if (this.lastNativeKey) {
          this.lastNativeKey = "";
          void mediaSessionStop();
        }
        return;
      }
      const meta = parseTrackName(entry.name);
      const key = `${entry.name}|${playing ? 1 : 0}`;
      const isNew = key.split("|")[0] !== this.lastNativeKey.split("|")[0];
      this.lastNativeKey = key;
      const payload = {
        title: meta.title,
        artist: meta.artist ?? "Artiste inconnu",
        playing,
        position: this.state.position,
        duration: this.state.duration,
      };
      if (isNew) void mediaSessionStart(payload);
      else void mediaSessionUpdate(payload);
    } catch {
      /* ignore */
    }
  }
}

export const audioStore = new AudioStore();

// Restore lazily after the module loads so getResume/localStorage is available.
if (typeof window !== "undefined") {
  // Delay so the app shell mounts first.
  window.setTimeout(() => {
    try {
      audioStore.restore();
    } catch {
      /* ignore */
    }
  }, 250);
}

// ---------- React helpers ----------
import { useSyncExternalStore } from "react";

export function useAudioState(): AudioState {
  return useSyncExternalStore(
    (cb) => audioStore.subscribe(cb),
    () => audioStore.getState(),
    () => audioStore.getState(),
  );
}
