import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Gauge,
  ListVideo,
  Lock,
  MoreVertical,
  Pause,
  PictureInPicture2,
  Play,
  RotateCw,
  SkipBack,
  SkipForward,
  Sun,
  Unlock,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { useOverlayZClass } from "@/lib/files/overlay-z";
import { sourceUrlOf, entryKey, absolutePathOf } from "@/lib/viewer/source";
import { openWithSystem } from "@/lib/viewer/openWith";
import { isAndroidNative } from "@/lib/native/geniusfiles-native";
import { peekThumbnail, resolveThumbnail } from "@/lib/native/thumbnails";
import { getResume, setResume } from "@/lib/viewer/resume";
import { SeekController } from "@/lib/player/seek-controller";
import {
  getSystemVolume,
  setSystemVolume,
  hasNativeVolume,
  hasNativeBrightness,
  getWindowBrightness,
  setWindowBrightness,
  releaseWindowBrightness,
} from "@/lib/native/media-controls";
import { setOrientation, isLandscapeViewport } from "@/lib/native/screen-orientation";
import { acquireImmersive, setStatusBarHidden } from "@/lib/native/immersive";
import { useVideoGestures, type GestureOverlay } from "./useVideoGestures";
import { QueueSheet } from "./QueueSheet";
import { fmtTime, parseTrackName } from "./format";
import { useT } from "@/lib/i18n";

const AUTO_HIDE_MS = 3200;
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
/** Double-tap seek amount (seconds) — matches premium Android players. */
const SKIP = 5;

/**
 * Lecteur vidéo plein écran, calibré sur les lecteurs Android natifs.
 *
 * Points clés :
 *  - **Recherche quasi instantanée** : toutes les demandes passent par un
 *    `SeekController` (coalescing + `fastSeek` pendant le glissement), donc
 *    le décodeur ne traite jamais une file de seeks empilés.
 *  - **Paysage réel** : l'orientation de l'activité Android est pilotée
 *    nativement ; toute l'interface bascule, la vidéo n'est plus un petit
 *    rectangle tourné en CSS.
 *  - **Volume et luminosité système** : les gestes verticaux agissent sur
 *    `STREAM_MUSIC` et sur la luminosité de la fenêtre, pas sur des valeurs
 *    fictives.
 *  - Le portail sur <body> évite qu'un ancêtre transformé ne décale la
 *    surface `fixed` ; l'élément <video> n'est jamais remonté.
 */
export function VideoPlayer({
  parent,
  entries,
  index,
  onIndexChange,
  onClose,
  onMenu,
  poster,
  parentFor,
}: {
  parent: PathRef;
  entries: FileEntry[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onMenu: () => void;
  poster?: string;
  /**
   * Dossier réel d'une entrée de la file. Indispensable pour les listes
   * agrégées (catégories, récents, recherche) : sans lui, les miniatures de
   * la playlist seraient résolues dans le dossier de la vidéo en cours et
   * n'existeraient donc pas pour les vidéos des autres dossiers.
   */
  parentFor?: (entry: FileEntry) => PathRef | null;
}) {
  const overlayZ = useOverlayZClass();
  const t = useT();
  const entry = entries[index];
  /* Lambda souvent recréée à chaque rendu : lue via une ref pour ne jamais
     provoquer de recalcul en cascade sur des files de milliers de vidéos. */
  const parentForRef = useRef(parentFor);
  useEffect(() => {
    parentForRef.current = parentFor;
  });
  const parentOfEntry = useCallback(
    (e: FileEntry) => parentForRef.current?.(e) ?? parent,
    [parent],
  );
  const src = useMemo(() => (entry ? sourceUrlOf(parent, entry) : ""), [entry, parent]);
  const rKey = useMemo(() => (entry ? entryKey(parent, entry) : ""), [entry, parent]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const seekRef = useRef<SeekController>(new SeekController());
  const seek = seekRef.current;

  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [pip, setPip] = useState(false);
  const [locked, setLocked] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [rateSheetOpen, setRateSheetOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  /* Aucun mode de cadrage : la vidéo est toujours affichée dans son ratio
     d'origine (object-contain), comme les lecteurs Android natifs. */

  const [landscape, setLandscape] = useState(false);
  const [landscapeLocked, setLandscapeLocked] = useState(false);
  const [overlay, setOverlay] = useState<GestureOverlay>(null);
  /** Volume média système (0→1) — reflète la vraie valeur Android. */
  const [volume, setVolumeState] = useState(1);
  /** Luminosité réelle de la fenêtre (0→1) ; repli CSS hors Android. */
  const [brightness, setBrightnessState] = useState(1);
  const nativeBrightness = useRef(false);

  useEffect(() => setMounted(true), []);

  // ---- Miniature : première image peinte instantanément -------------------
  const absPath = useMemo(() => (entry ? absolutePathOf(parent, entry) : ""), [entry, parent]);
  const [thumb, setThumb] = useState<string | null>(() =>
    absPath ? peekThumbnail(absPath, 640) : null,
  );

  useEffect(() => {
    if (!absPath) return;
    setThumb(peekThumbnail(absPath, 640) ?? peekThumbnail(absPath, 320));
    let alive = true;
    void resolveThumbnail(absPath, 640).then((url) => {
      if (alive && url) setThumb(url);
    });
    return () => {
      alive = false;
    };
  }, [absPath]);

  // Préchargement léger des voisins : miniature uniquement (aucun décodage
  // vidéo supplémentaire, donc aucune surconsommation CPU/batterie). Chaque
  // voisin est résolu dans SON dossier réel, pas dans celui de la vidéo lue.
  useEffect(() => {
    for (const delta of [1, -1]) {
      const next = entries[index + delta];
      if (next) void resolveThumbnail(absolutePathOf(parentOfEntry(next), next), 640);
    }
  }, [entries, index, parentOfEntry]);

  // ---- Mode immersif ------------------------------------------------------
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("gf-immersive");
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.classList.remove("gf-immersive");
    };
  }, []);

  /* Barre d'état Android : suit la chrome du lecteur (plein écran réel
     quand les commandes sont masquées, lisible quand elles reviennent). */
  useEffect(() => {
    const release = acquireImmersive();
    return () => {
      release();
    };
  }, []);
  useEffect(() => {
    setStatusBarHidden(!chromeVisible);
  }, [chromeVisible]);

  // ---- Orientation réelle -------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setLandscape(isLandscapeViewport());
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  // L'orientation est rendue au système à la fermeture, tout comme la
  // luminosité : aucun état résiduel après la sortie du lecteur.
  useEffect(() => {
    return () => {
      void setOrientation("auto");
      void releaseWindowBrightness();
    };
  }, []);

  // ---- Volume & luminosité système ---------------------------------------
  useEffect(() => {
    let alive = true;
    void getSystemVolume().then((v) => {
      if (alive && v != null) setVolumeState(v);
      else if (alive && videoRef.current) setVolumeState(videoRef.current.volume);
    });
    void getWindowBrightness().then((b) => {
      if (!alive) return;
      nativeBrightness.current = hasNativeBrightness();
      if (b != null) setBrightnessState(b);
    });
    return () => {
      alive = false;
    };
  }, []);

  const applyVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolumeState(clamped);
    if (hasNativeVolume()) void setSystemVolume(clamped);
    const v = videoRef.current;
    if (v && !hasNativeVolume()) {
      v.volume = clamped;
      v.muted = clamped === 0;
    }
  }, []);

  const applyBrightness = useCallback((value: number) => {
    const clamped = Math.max(0.02, Math.min(1, value));
    setBrightnessState(clamped);
    if (hasNativeBrightness()) void setWindowBrightness(clamped);
  }, []);

  // ---- Chrome auto-hide ---------------------------------------------------
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeVisibleRef = useRef(true);
  chromeVisibleRef.current = chromeVisible;
  const bumpChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChromeVisible(false), AUTO_HIDE_MS);
  }, []);
  const hideChrome = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setChromeVisible(false);
  }, []);

  useEffect(() => {
    bumpChrome();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [bumpChrome, index]);

  // ---- Changement de source : reprise + vitesse ---------------------------
  const prevKeyRef = useRef<string>("");
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const previousKey = prevKeyRef.current;
    if (previousKey && previousKey !== rKey) {
      try {
        setResume(previousKey, v.currentTime, v.duration || undefined);
      } catch {
        /* ignore */
      }
    }
    prevKeyRef.current = rKey;

    setPos(0);
    setDur(0);
    setReady(false);
    setBuffering(true);
    setError(null);
    v.playbackRate = rate;
    try {
      v.load();
    } catch {
      /* ignore */
    }

    const resume = getResume(rKey);
    const applyResume = () => {
      if (resume && resume.pos > 3 && (!resume.extra || resume.pos < resume.extra - 5)) {
        seek.seek(resume.pos, "precise");
      }
      v.play().catch(() => {
        /* Autoplay may be blocked — user can tap Play. */
      });
    };
    if (v.readyState >= 1) applyResume();
    else v.addEventListener("loadedmetadata", applyResume, { once: true });
    v.play().catch(() => {
      /* ignored — resume handler retries */
    });
    return () => v.removeEventListener("loadedmetadata", applyResume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rKey, reloadNonce, mounted]);

  /**
   * ---- Récupération de lecture ------------------------------------------
   *
   * La WebView Chromium ne décode qu'un sous-ensemble des formats qu'Android
   * sait lire (MKV/HEVC, AVI, WMV, FLV, certains AC3/DTS…). Avant d'afficher
   * « Lecture impossible », on épuise donc les voies réellement disponibles :
   *
   *   1. un rechargement propre de la source (échecs transitoires du pont
   *      de fichiers, réseau interrompu, décodeur momentanément occupé) ;
   *   2. la remise au lecteur système de l'appareil, qui utilise les codecs
   *      matériels : la plupart des vidéos « incompatibles » se lisent là ;
   *   3. seulement si tout échoue, un message d'erreur clair.
   */
  const recoveryRef = useRef(0);

  /** Ouvre la vidéo dans un lecteur système compatible. */
  const openExternally = useCallback(async () => {
    if (!entry || !isAndroidNative()) return false;
    try {
      await openWithSystem(parentOfEntry(entry), entry, "view");
      return true;
    } catch {
      return false;
    }
  }, [entry, parentOfEntry]);

  const handleFailure = useCallback(
    async (reason: "timeout" | number | undefined) => {
      const v = videoRef.current;
      setBuffering(false);
      setPlaying(false);

      const unsupported = reason === 4;
      // Étape 1 — un seul rechargement, sauf format d'emblée non décodable.
      if (!unsupported && recoveryRef.current === 0 && v) {
        recoveryRef.current = 1;
        try {
          v.load();
          void v.play().catch(() => {
            /* l'utilisateur peut relancer */
          });
          setBuffering(true);
          return;
        } catch {
          /* on passe au repli natif */
        }
      }

      // Étape 2 — lecteur système (codecs matériels de l'appareil).
      if (recoveryRef.current < 2) {
        recoveryRef.current = 2;
        try {
          v?.pause();
        } catch {
          /* ignore */
        }
        if (await openExternally()) {
          onClose();
          return;
        }
      }

      // Étape 3 — échec réel : message clair, sans masquer la cause.
      setError(
        unsupported
          ? t("media.player.video.unsupportedFormat")
          : reason === 2
            ? t("media.player.video.playbackError")
            : reason === "timeout"
              ? t("media.player.video.loadTimeout")
              : t("media.player.video.cannotPlay"),
      );
    },
    [openExternally, onClose, t],
  );

  // ---- Chien de garde de chargement --------------------------------------
  // Le minuteur ne conclut à l'échec que si *rien* n'a progressé : tant que
  // des octets arrivent (buffered qui grandit), une grosse vidéo 4K sur
  // carte SD lente continue simplement de charger.
  useEffect(() => {
    if (!src || ready || error) return;
    let lastBuffered = -1;
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || v.readyState >= 2) return;
      const end = v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0;
      if (end > lastBuffered) {
        lastBuffered = end;
        return;
      }
      window.clearInterval(id);
      void handleFailure("timeout");
    }, 20000);
    return () => window.clearInterval(id);
  }, [src, reloadNonce, ready, error, handleFailure]);

  const retry = useCallback(() => {
    recoveryRef.current = 0;
    setError(null);
    setReady(false);
    setBuffering(true);
    setReloadNonce((n) => n + 1);
  }, []);




  // ---- Câblage de l'élément <video> --------------------------------------
  const latestIndex = useRef(index);
  const entriesLenRef = useRef(entries.length);
  const onIndexChangeRef = useRef(onIndexChange);
  useEffect(() => {
    latestIndex.current = index;
    entriesLenRef.current = entries.length;
    onIndexChangeRef.current = onIndexChange;
  }, [index, entries.length, onIndexChange]);

  /**
   * Non nul / vrai pendant un glissement : la position affichée est alors
   * pilotée par le doigt et jamais écrasée par les événements du moteur
   * (c'était la source des « retours en arrière » visuels).
   */
  const scrubRef = useRef<number | null>(null);
  const gestureScrubRef = useRef(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Le contrôleur ne peut être branché qu'une fois l'élément réellement
    // monté. Auparavant cet effet s'exécutait avant le premier rendu utile
    // (`mounted === false` renvoyait `null`) : plus aucun écouteur n'était
    // posé et **toutes** les demandes de seek étaient perdues — l'interface
    // avançait, le moteur restait sur place.
    seek.attach(v);

    const onMeta = () => {
      setDur(v.duration || 0);
    };

    const onFirstFrame = () => {
      setReady(true);
      setBuffering(false);
      setError(null);
    };
    // `timeupdate` cadence ~4 Hz : suffisant pour le texte, et la barre est
    // lissée en CSS. Aucune boucle rAF, donc aucun rendu à 60 Hz.
    const onTime = () => {
      if (scrubRef.current != null || gestureScrubRef.current) return;
      setPos(v.currentTime || 0);
    };
    const onSeeked = () => {
      setBuffering(false);
      if (scrubRef.current == null && !gestureScrubRef.current) setPos(v.currentTime || 0);
    };
    const onPlay = () => {
      setPlaying(true);
    };
    const onPlaying = () => {
      setPlaying(true);
      onFirstFrame();
    };
    const onPause = () => setPlaying(false);
    const onError = () => {
      // Aucune erreur affichée tant qu'une voie de lecture reste possible :
      // rechargement, puis lecteur système de l'appareil.
      void handleFailure(v.error?.code);
    };

    const onWaiting = () => setBuffering(true);
    const onEnded = () => {
      setPlaying(false);
      try {
        setResume(prevKeyRef.current, 0, v.duration || undefined);
      } catch {
        /* ignore */
      }
      const nextIndex = latestIndex.current + 1;
      if (nextIndex < entriesLenRef.current) onIndexChangeRef.current(nextIndex);
    };
    const onEnterPip = () => setPip(true);
    const onLeavePip = () => setPip(false);

    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    v.addEventListener("loadeddata", onFirstFrame);
    v.addEventListener("canplay", onFirstFrame);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("play", onPlay);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("pause", onPause);
    v.addEventListener("error", onError);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("ended", onEnded);
    v.addEventListener("enterpictureinpicture", onEnterPip);
    v.addEventListener("leavepictureinpicture", onLeavePip);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
      v.removeEventListener("loadeddata", onFirstFrame);
      v.removeEventListener("canplay", onFirstFrame);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("error", onError);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("enterpictureinpicture", onEnterPip);
      v.removeEventListener("leavepictureinpicture", onLeavePip);
      seek.detach();
      try {
        if (prevKeyRef.current) {
          setResume(prevKeyRef.current, v.currentTime, v.duration || undefined);
        }
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Point de reprise périodique.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v || !rKey) return;
      try {
        setResume(rKey, v.currentTime, v.duration || undefined);
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [playing, rKey]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  // ---- Actions ------------------------------------------------------------
  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    bumpChrome();
  }, [bumpChrome]);

  const skipBy = useCallback(
    (delta: number) => {
      seek.seekBy(delta, "fast");
      seek.commit(undefined, false);
      bumpChrome();
    },
    [seek, bumpChrome],
  );

  const goNext = useCallback(() => {
    if (index < entries.length - 1) onIndexChange(index + 1);
  }, [index, entries.length, onIndexChange]);
  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const togglePip = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      const doc = document as Document & {
        pictureInPictureElement?: Element | null;
        exitPictureInPicture?: () => Promise<void>;
      };
      if (doc.pictureInPictureElement) await doc.exitPictureInPicture?.();
      else if ("requestPictureInPicture" in v) await v.requestPictureInPicture();
    } catch {
      /* ignore */
    }
  };

  /**
   * Bascule paysage ⇄ automatique. L'orientation de l'*activité* change,
   * donc toute l'interface pivote — la lecture n'est jamais interrompue
   * puisque l'élément <video> n'est pas remonté.
   */
  const rotate = async () => {
    const next = !landscapeLocked;
    setLandscapeLocked(next);
    await setOrientation(next ? "landscape" : "auto");
    bumpChrome();
  };

  // ---- Raccourcis clavier --------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === " " || e.key === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        skipBy(SKIP);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        skipBy(-SKIP);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        applyVolume(volume + 0.05);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        applyVolume(volume - 0.05);
      } else if (e.key === "f") {
        e.preventDefault();
        void rotate();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        goNext();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggle, skipBy, goNext, goPrev, onClose, volume, applyVolume]);

  // ---- Gestes --------------------------------------------------------------
  const gestureHandlers = useVideoGestures({
    locked,
    skipSeconds: SKIP,
    videoRef,
    seek,
    duration: dur,
    getVolume: () => volume,
    setVolume: applyVolume,
    getBrightness: () => brightness,
    setBrightness: applyBrightness,
    setOverlay,
    bumpChrome,
    hideChrome,
    chromeVisibleRef,
    onScrubStart: () => {
      gestureScrubRef.current = true;
    },
    onScrubEnd: () => {
      gestureScrubRef.current = false;
      const v = videoRef.current;
      if (v) setPos(seek.effectiveTime || v.currentTime || 0);
    },
  });

  // ---- Barre de progression ------------------------------------------------
  const barRef = useRef<HTMLDivElement | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  scrubRef.current = scrub;

  const timeFromPointer = (e: React.PointerEvent): number | null => {
    const bar = barRef.current;
    if (!bar || dur <= 0) return null;
    const rect = bar.getBoundingClientRect();
    const r = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return r * dur;
  };
  const onBarDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const t = timeFromPointer(e);
    if (t == null) return;
    setScrub(t);
    // Le déplacement démarre immédiatement au toucher : aucune attente.
    seek.seek(t, "fast");
  };
  const onBarMove = (e: React.PointerEvent) => {
    if (scrub == null) return;
    const t = timeFromPointer(e);
    if (t == null) return;
    setScrub(t);
    seek.seek(t, "fast");
  };
  const commitScrub = () => {
    if (scrub != null) {
      // On ne relance la lecture que si elle était en cours : un scrub
      // ne doit jamais réveiller une vidéo volontairement mise en pause.
      seek.commit(scrub, playing);
      setPos(scrub);
    }
    setScrub(null);
    bumpChrome();
  };

  if (!entry || !mounted) return null;

  const meta = parseTrackName(entry.name);
  const posterUrl = thumb ?? poster ?? null;
  const displayPos = scrub ?? pos;
  const progress = dur > 0 ? Math.min(1, displayPos / dur) : 0;
  const chromeCls = chromeVisible
    ? "opacity-100 translate-y-0"
    : "pointer-events-none opacity-0 translate-y-1";
  const objectFit = "object-contain";

  const cssBrightness = nativeBrightness.current ? 1 : brightness;

  const ui = (
    <div
      className={`gf-video-shell fixed ${overlayZ} overflow-hidden select-none`}
      role="dialog"
      aria-modal
      data-orientation={landscape ? "landscape" : "portrait"}
      /* Plein écran réel : la scène occupe 100 % de la fenêtre, découpe
         (display cutout) et barres système comprises. Aucune marge, aucun
         reste de contrainte portrait — seule la chrome applique des
         safe-areas pour rester lisible. */
      style={{ top: 0, left: 0, width: "100dvw", height: "100dvh" }}
    >
      {/* Couche miniature — peinte instantanément, jamais d'écran noir. */}
      {!ready ? (
        <div className="absolute inset-0 z-0" aria-hidden>
          {posterUrl ? (
            <>
              <img
                src={posterUrl}
                alt=""
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl"
              />
              <img
                src={posterUrl}
                alt=""
                decoding="async"
                className={`absolute inset-0 h-full w-full ${objectFit}`}
              />
            </>
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_50%_40%,var(--pl-glow),transparent_70%)]" />
          )}
        </div>
      ) : null}

      <div className="absolute inset-0 z-[1] flex items-center justify-center">
        {src ? (
          <video
            ref={videoRef}
            src={src}
            poster={posterUrl ?? undefined}
            autoPlay
            playsInline
            preload="auto"
            controls={false}
            disablePictureInPicture={false}
            style={{
              filter: cssBrightness === 1 ? undefined : `brightness(${cssBrightness})`,
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              margin: "auto",
              backgroundColor: "transparent",
              backfaceVisibility: "hidden",
              opacity: ready || playing ? 1 : 0,
              transition: "opacity 180ms linear",
            }}
            className={objectFit}
          />
        ) : (
          <div className="absolute top-[22%] mx-6 max-w-md rounded-2xl bg-[color-mix(in_oklab,var(--pl-fg)_5%,transparent)] p-5 text-center text-[13px] text-[color-mix(in_oklab,var(--pl-fg)_70%,transparent)] backdrop-blur">
            {t("media.player.video.previewUnavailable")}
          </div>
        )}
      </div>

      {/* Couche de gestes */}
      <div
        className="absolute inset-0 z-10"
        style={{ touchAction: "none" }}
        onPointerDown={gestureHandlers.onPointerDown}
        onPointerMove={gestureHandlers.onPointerMove}
        onPointerUp={gestureHandlers.onPointerUp}
        onPointerCancel={gestureHandlers.onPointerUp}
      />

      {/* Indicateur de chargement discret */}
      {(buffering || !ready) && src && !error ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color-mix(in_oklab,var(--pl-fg)_25%,transparent)] border-t-[color-mix(in_oklab,var(--pl-fg)_90%,transparent)]" />
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 z-[45] flex items-center justify-center px-8">
          <div className="w-full max-w-sm rounded-2xl bg-[color-mix(in_oklab,var(--pl-scrim)_80%,transparent)] p-5 text-center backdrop-blur-md">
            <p className="text-[14px] font-semibold">{t("media.player.video.playbackFailed")}</p>
            <p className="mt-1 text-[12px] text-[color-mix(in_oklab,var(--pl-fg)_70%,transparent)]">
              {error}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={retry}
                className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground active:scale-95"
              >
                {t("media.player.action.retry")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-[color-mix(in_oklab,var(--pl-fg)_10%,transparent)] px-4 py-2 text-[13px] font-semibold active:scale-95"
              >
                {t("media.player.action.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Overlays de gestes */}
      {overlay ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          {overlay.kind === "seek" ? (
            <div className="rounded-2xl bg-[color-mix(in_oklab,var(--pl-scrim)_70%,transparent)] px-5 py-3 text-center text-[13px] backdrop-blur-md">
              <div className="text-[20px] font-semibold tabular-nums">
                {fmtTime(overlay.preview)}
              </div>
              <div className="text-[color-mix(in_oklab,var(--pl-fg)_70%,transparent)]">
                {overlay.delta >= 0 ? "+" : ""}
                {overlay.delta.toFixed(0)} s
              </div>
            </div>
          ) : overlay.kind === "skip" ? (
            <div
              key={`${overlay.side}-${overlay.amount}`}
              className={`absolute inset-y-0 flex w-2/5 items-center justify-center animate-fade-in ${
                overlay.side === "left"
                  ? "left-0 rounded-r-[50%] bg-[color-mix(in_oklab,var(--pl-fg)_10%,transparent)]"
                  : "right-0 rounded-l-[50%] bg-[color-mix(in_oklab,var(--pl-fg)_10%,transparent)]"
              }`}
            >
              <div className="flex flex-col items-center gap-1 animate-scale-in">
                <div className="flex items-center">
                  {overlay.side === "left" ? (
                    <>
                      <ChevronLeft className="h-6 w-6 -mr-3.5 opacity-60" />
                      <ChevronLeft className="h-6 w-6 -mr-3.5 opacity-85" />
                      <ChevronLeft className="h-6 w-6" />
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-6 w-6 -mr-3.5" />
                      <ChevronRight className="h-6 w-6 -mr-3.5 opacity-85" />
                      <ChevronRight className="h-6 w-6 opacity-60" />
                    </>
                  )}
                </div>
                <span className="text-[13px] font-semibold tabular-nums">
                  {t("media.player.seekSeconds", { count: overlay.amount })}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-full bg-[color-mix(in_oklab,var(--pl-scrim)_70%,transparent)] px-4 py-2 backdrop-blur-md">
              {overlay.kind === "volume" ? (
                overlay.value === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )
              ) : (
                <Sun className="h-4 w-4" />
              )}
              <div className="h-1.5 w-44 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--pl-fg)_20%,transparent)]">
                <div
                  className="h-full bg-[var(--pl-fg)] transition-[width] duration-75"
                  style={{ width: `${Math.round(overlay.value * 100)}%` }}
                />
              </div>
              <span className="w-10 text-right text-[12px] font-semibold tabular-nums">
                {Math.round(overlay.value * 100)}%
              </span>
            </div>
          )}
        </div>
      ) : null}

      {/* Mode verrouillé */}
      {locked ? (
        <button
          type="button"
          onClick={() => {
            setLocked(false);
            bumpChrome();
          }}
          className={`absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_oklab,var(--pl-scrim)_60%,transparent)] p-4 backdrop-blur-md transition-opacity duration-300 ${
            chromeVisible ? "opacity-100" : "opacity-0"
          }`}
          aria-label={t("media.player.aria.unlock")}
        >
          <Lock className="h-6 w-6" />
        </button>
      ) : (
        <>
          {/* Barre supérieure */}
          <div
            className={`absolute inset-x-0 top-0 z-40 flex items-center gap-2 bg-gradient-to-b from-[color-mix(in_oklab,var(--pl-scrim)_96%,transparent)] via-[color-mix(in_oklab,var(--pl-scrim)_70%,transparent)] to-transparent pl-[calc(env(safe-area-inset-left,0px)+0.5rem)] pr-[calc(env(safe-area-inset-right,0px)+0.5rem)] transition-all duration-300 ${
              landscape
                ? "pb-4 pt-[calc(env(safe-area-inset-top,0px)+0.25rem)]"
                : "pb-8 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]"
            } ${chromeCls}`}
          >
            <IconBtn label={t("media.player.aria.closeVideo")} onClick={onClose}>
              <ArrowLeft className="h-5 w-5" />
            </IconBtn>
            <div className="min-w-0 flex-1 px-1">
              <p className="truncate text-[14px] font-semibold">{meta.title}</p>
              <p className="truncate text-[11px] text-[color-mix(in_oklab,var(--pl-fg)_60%,transparent)]">
                {index + 1} / {entries.length}
              </p>
            </div>
            <IconBtn label={t("media.player.aria.lock")} onClick={() => setLocked(true)}>
              <Unlock className="h-5 w-5" />
            </IconBtn>
            <IconBtn label={t("media.player.aria.pip")} onClick={togglePip} active={pip}>
              <PictureInPicture2 className="h-5 w-5" />
            </IconBtn>
            <IconBtn label={t("media.player.aria.moreActions")} onClick={onMenu}>
              <MoreVertical className="h-5 w-5" />
            </IconBtn>
          </div>

          {/* Transport central */}
          <div
            className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center transition-all duration-300 ${
              landscape ? "gap-16" : "gap-10"
            } ${chromeCls}`}
          >
            <button
              type="button"
              onClick={goPrev}
              disabled={index <= 0}
              className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--pl-scrim)_45%,transparent)] backdrop-blur-md transition-transform duration-150 active:scale-90 disabled:opacity-30"
              aria-label={t("media.player.aria.previousVideo")}
            >
              <SkipBack className="h-7 w-7 fill-current" />
            </button>
            <button
              type="button"
              onClick={toggle}
              className={`pointer-events-auto flex items-center justify-center rounded-full bg-[var(--pl-fg)] text-[var(--pl-bg)] shadow-2xl transition-transform duration-150 active:scale-90 ${
                landscape ? "h-16 w-16" : "h-[76px] w-[76px]"
              }`}
              aria-label={playing ? t("media.player.aria.pause") : t("media.player.aria.play")}
            >
              {playing ? (
                <Pause className="h-9 w-9 fill-current" />
              ) : (
                <Play className="ml-1 h-9 w-9 fill-current" />
              )}
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={index >= entries.length - 1}
              className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--pl-scrim)_45%,transparent)] backdrop-blur-md transition-transform duration-150 active:scale-90 disabled:opacity-30"
              aria-label={t("media.player.aria.nextVideo")}
            >
              <SkipForward className="h-7 w-7 fill-current" />
            </button>
          </div>

          {/* Barre inférieure */}
          <div
            className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-[color-mix(in_oklab,var(--pl-scrim)_98%,transparent)] via-[color-mix(in_oklab,var(--pl-scrim)_80%,transparent)] to-transparent pl-[calc(env(safe-area-inset-left,0px)+1rem)] pr-[calc(env(safe-area-inset-right,0px)+1rem)] transition-all duration-300 ${
              landscape
                ? "pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-6"
                : "pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-12"
            } ${chromeCls}`}
          >
            {/* Progression */}
            <div
              ref={barRef}
              className="relative flex h-10 w-full cursor-pointer items-center"
              style={{ touchAction: "none" }}
              role="slider"
              aria-label={t("media.player.aria.progress")}
              aria-valuemin={0}
              aria-valuemax={Math.round(dur)}
              aria-valuenow={Math.round(displayPos)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  skipBy(SKIP);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  skipBy(-SKIP);
                }
              }}
              onPointerDown={onBarDown}
              onPointerMove={onBarMove}
              onPointerUp={commitScrub}
              onPointerCancel={commitScrub}
            >
              <div className="absolute inset-x-0 h-[5px] overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--pl-fg)_22%,transparent)]">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${progress * 100}%`,
                    transition: scrub == null ? "width 260ms linear" : "none",
                  }}
                />
              </div>
              <div
                className="pointer-events-none absolute h-4 w-4 rounded-full bg-primary shadow-lg"
                style={{
                  left: `${progress * 100}%`,
                  transform: `translateX(-50%) scale(${scrub != null ? 1.35 : 1})`,
                  transition:
                    scrub == null
                      ? "left 260ms linear, transform 150ms ease"
                      : "transform 150ms ease",
                }}
              />
            </div>

            <div className="flex items-center justify-between px-0.5 text-[12px] font-medium tabular-nums text-[color-mix(in_oklab,var(--pl-fg)_75%,transparent)]">
              <span>{fmtTime(displayPos)}</span>
              <span>{dur > 0 ? fmtTime(dur) : "--:--"}</span>
            </div>

            {/* Actions */}
            <div
              className={`flex items-center justify-center gap-4 ${landscape ? "mt-1.5" : "mt-3"}`}
            >
              <button
                type="button"
                onClick={() => {
                  setRateSheetOpen((s) => !s);
                  bumpChrome();
                }}
                className="flex h-12 items-center gap-2 rounded-full bg-[color-mix(in_oklab,var(--pl-fg)_12%,transparent)] px-5 text-[13px] font-semibold transition-transform active:scale-95"
                aria-label={t("media.player.aria.playbackSpeed")}
              >
                <Gauge className="h-[18px] w-[18px]" />
                {rate}×
              </button>
              <IconBtn
                label={
                  landscapeLocked
                    ? t("media.player.aria.autoOrientation")
                    : t("media.player.aria.landscape")
                }
                onClick={rotate}
                active={landscapeLocked}
              >
                <RotateCw className="h-[22px] w-[22px]" />
              </IconBtn>
              <IconBtn label={t("media.player.aria.playlist")} onClick={() => setQueueOpen(true)}>
                <ListVideo className="h-[22px] w-[22px]" />
              </IconBtn>
            </div>

            {rateSheetOpen ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-[color-mix(in_oklab,var(--pl-scrim)_60%,transparent)] p-2 backdrop-blur-md">
                {RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRate(r);
                      setRateSheetOpen(false);
                      bumpChrome();
                    }}
                    className={`min-w-12 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      r === rate
                        ? "bg-primary text-primary-foreground"
                        : "bg-[color-mix(in_oklab,var(--pl-fg)_10%,transparent)] text-[var(--pl-fg)]"
                    }`}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}

      <QueueSheet
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        entries={entries}
        activeIndex={index}
        onSelect={(i) => {
          onIndexChange(i);
          setQueueOpen(false);
        }}
        variant="video"
        title={t("media.player.videosTitle")}
        pathFor={(e) => absolutePathOf(parentOfEntry(e), e)}
      />
    </div>
  );

  return createPortal(ui, document.body);
}

function IconBtn({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform duration-150 active:scale-90 ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-[color-mix(in_oklab,var(--pl-fg)_12%,transparent)] text-[var(--pl-fg)]"
      }`}
    >
      {children}
    </button>
  );
}
