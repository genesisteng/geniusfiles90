import { useEffect, useRef, useState } from "react";

import { hideSplash } from "@/lib/native/splash";
import { onStartupReady } from "@/lib/startup/boot";

/**
 * Splash screen applicatif de GeniusFiles.
 *
 * Il prend le relais du splash natif Android à l'identique : celui-ci peint
 * la MÊME illustration, sur le MÊME fond, à la MÊME échelle (192dp de
 * large, centrée) et à la MÊME position — voir `generate-app-icons.mjs`.
 * L'utilisateur voit donc une seule image, immobile, de la première frame
 * du système jusqu'à l'ouverture de l'accueil.
 *
 * Chaîne de recouvrement (aucun trou visuel possible) :
 *   fond de fenêtre Android → splash système (illustration + fond) → cet
 *   overlay, déjà présent dans le HTML pré-rendu, donc peint dès la
 *   première frame de la WebView. Le splash natif n'est masqué qu'APRÈS la
 *   peinture confirmée de cet overlay (image décodée + 2 frames) : aucun
 *   écran blanc, noir ou gris ne peut s'intercaler.
 *
 * Règles :
 *  - illustration officielle unique (`/brand/geniusfiles-splash.png`,
 *    PNG RGBA détouré 802×666 recadré au plus juste, préchargé en priorité haute) ;
 *  - aucune animation d'entrée : l'image est déjà à l'écran (splash natif),
 *    un fondu d'entrée produirait un clignotement ;
 *  - seule animation : le fondu de sortie ;
 *  - sortie dès que l'application est réellement prête (aucune attente
 *    artificielle), avec un plancher anti-scintillement très court.
 */
/**
 * Illustration officielle, déclinée en variantes DÉJÀ à la taille exacte
 * d'affichage pour chaque densité d'écran (176dp × 146dp × densité,
 * réduites en lanczos3 depuis le master officiel 801×664 — même la variante
 * 4× (704 px) reste une RÉDUCTION : aucun agrandissement, donc aucun flou).
 *
 * Pourquoi : la WebView Android rééchantillonne en bilinéaire simple. Faire
 * réduire le master 802px vers 384px (téléphone @2x) adoucissait les
 * contours et créait une différence de netteté perceptible avec le splash
 * système (composé, lui, en lanczos3). En servant une variante 1:1 avec le
 * nombre de pixels physiques réellement peints, la WebView ne redimensionne
 * plus RIEN : l'illustration est strictement identique à la source, nette,
 * sans pixellisation et sans variation de qualité à la passation.
 */
export const SPLASH_ART_URL = "/brand/geniusfiles-splash-2x.png";
export const SPLASH_ART_SRCSET =
  "/brand/geniusfiles-splash-1x.png 1x, /brand/geniusfiles-splash-2x.png 2x, /brand/geniusfiles-splash-3x.png 3x, /brand/geniusfiles-splash-4x.png 4x";

/**
 * Largeur exacte de l'illustration, en px CSS (= dp sous la WebView
 * Android, qui n'applique aucun zoom). Elle reproduit à l'identique la
 * largeur peinte par le splash natif — thème de lancement (API < 31) comme
 * SplashScreen système (API 31+) — voir `scripts/generate-app-icons.mjs`.
 *
 * 176dp est aussi la plus grande largeur servie SANS agrandissement
 * jusqu'à la densité ×4 (176 × 4 = 704 px ≤ 801 px, résolution du master
 * officiel) : c'est ce qui supprime le flou observé sur les téléphones
 * haute densité. Valeur fixe (jamais relative au viewport) : c'est la
 * seule façon de garantir l'absence de changement d'échelle entre le
 * splash natif et l'overlay, sur téléphone comme sur tablette.
 */
const SPLASH_ART_WIDTH_PX = 176;
/**
 * Hauteur ENTIÈRE (176 × 664/801 ≈ 145,9 → 146). Une hauteur fractionnaire
 * force la WebView à rééchantillonner l'image sur une grille non entière :
 * contours adoucis et léger scintillement au moment du fondu. Les deux
 * dimensions sont donc fixées en pixels entiers.
 */
const SPLASH_ART_HEIGHT_PX = 146;

/**
 * Plancher anti-scintillement : uniquement destiné à éviter un « flash »
 * du splash sur un appareil très rapide. Il n'ajoute jamais d'attente
 * perceptible et court en parallèle de l'initialisation.
 */
const MIN_VISIBLE_MS = 90;
/** Durée du fondu de sortie — doit rester synchro avec la transition CSS. */
const FADE_OUT_MS = 260;

export function SplashOverlay() {
  const [mounted, setMounted] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const nativeHidden = useRef(false);

  // Fin réelle de l'initialisation (ou plafond de sécurité).
  useEffect(() => onStartupReady(() => setAppReady(true)), []);

  useEffect(() => {
    const t = window.setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, []);

  /**
   * Masque le splash natif seulement quand cette illustration est
   * décodée ET peinte : la passation est strictement sans couture.
   * Filet de sécurité si l'image tarde ou échoue.
   */
  useEffect(() => {
    const handOver = () => {
      if (nativeHidden.current) return;
      nativeHidden.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => void hideSplash()));
    };
    const safety = window.setTimeout(handOver, 1500);
    const img = imgRef.current;
    const done = () => {
      window.clearTimeout(safety);
      handOver();
    };
    if (img?.complete) {
      void (img.decode?.().catch(() => {}) ?? Promise.resolve()).then(done);
    } else if (img) {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    } else {
      done();
    }
    return () => window.clearTimeout(safety);
  }, []);

  // Sortie : uniquement quand l'app est prête ET le plancher écoulé.
  const leaving = appReady && minElapsed;
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setMounted(false), FADE_OUT_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[999] grid place-items-center bg-background"
      style={{
        opacity: leaving ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        willChange: "opacity",
        // Couche de composition dédiée : le fondu est purement GPU, la page
        // d'accueil dessous n'est jamais re-tramée pendant la transition
        // (cause classique du micro-clignotement en fin de splash).
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
        contain: "strict",
      }}
    >
      {/* Illustration unique : taille et centre identiques au splash natif,
          aucune animation d'entrée, aucun élément secondaire. */}
      <img
        ref={imgRef}
        src={SPLASH_ART_URL}
        srcSet={SPLASH_ART_SRCSET}
        alt=""
        width={SPLASH_ART_WIDTH_PX}
        height={SPLASH_ART_HEIGHT_PX}
        decoding="sync"
        fetchPriority="high"
        draggable={false}
        className="block select-none object-contain"
        style={{
          width: `${SPLASH_ART_WIDTH_PX}px`,
          height: `${SPLASH_ART_HEIGHT_PX}px`,
        }}
      />
    </div>
  );
}
