import { cn } from "@/lib/utils";

/**
 * Canonical URL for the official GeniusFiles brand logo.
 *
 * Served from `public/brand/geniusfiles-logo.png` : master 1059×1059 (résolution native du fichier officiel),
 * **détouré (fond transparent)** et **recadré au plus juste** sur la
 * marque. Aucune marge morte : le logo remplit donc exactement la boîte
 * dans laquelle on le place, en interface comme dans les icônes Android
 * générées par `scripts/generate-app-icons.mjs`.
 *
 * Vite/TanStack copie `public/` vers `dist/client/`, et
 * `scripts/build-mobile.mjs` le copie dans `dist-mobile/` : l'asset est
 * donc embarqué dans l'APK/AAB et disponible hors-ligne.
 */
export const GENIUSFILES_LOGO_URL = "/brand/geniusfiles-logo.png";

/**
 * Déclinaisons du master, réduites en lanczos3 à la compilation des assets.
 *
 * Le master 1059² pèse ~1 Mo : le décoder au démarrage pour l'afficher à
 * 28 px coûtait du CPU, de la mémoire et de la bande passante sur le chemin
 * critique. Le navigateur choisit désormais la variante immédiatement
 * supérieure à la taille physique demandée (`sizes`), donc aucun
 * agrandissement, aucune perte de netteté, et un décodage quasi instantané.
 */
export const GENIUSFILES_LOGO_SRCSET =
  "/brand/geniusfiles-logo-64.png 64w, /brand/geniusfiles-logo-128.png 128w, /brand/geniusfiles-logo-256.png 256w, /brand/geniusfiles-logo-512.png 512w, /brand/geniusfiles-logo.png 1059w";

interface LogoProps {
  className?: string;
  /** Displayed size in px — used for intrinsic width/height + inline size. */
  size?: number;
  alt?: string;
  /** Preload with high fetch priority (splash, permission gate, top bar). */
  priority?: boolean;
  /**
   * Rend le logo dans une tuile de marque : coins arrondis cohérents avec
   * le reste de l'app, léger anneau et ombre douce. À utiliser partout où
   * le logo joue le rôle d'« icône applicative » (header, à propos), afin
   * qu'il ne ressemble jamais à une simple image posée dans la page.
   */
  tile?: boolean;
}

/**
 * Canonical GeniusFiles logo renderer.
 *
 * Règles :
 *  - toujours servir l'asset officiel embarqué (`public/brand/…`) ;
 *  - jamais de rognage (`object-contain`) ni de déformation (ratio 1:1) ;
 *  - jamais rendu plus grand que la taille demandée (pas de flash 1024 px) ;
 *  - downscale navigateur + `image-rendering: auto` → net sur toutes les
 *    densités (le master est en 1024², donc ≥ 2× la plus grande taille
 *    d'affichage, xxxhdpi compris).
 */
export function Logo({
  className,
  size = 64,
  alt = "GeniusFiles",
  priority = false,
  tile = false,
}: LogoProps) {
  const img = (
    <img
      src={GENIUSFILES_LOGO_URL}
      srcSet={GENIUSFILES_LOGO_SRCSET}
      sizes={`${size}px`}
      alt={alt}
      width={size}
      height={size}
      decoding={priority ? "sync" : "async"}
      loading="eager"
      fetchPriority={priority ? "high" : "auto"}
      draggable={false}
      className={cn("block select-none object-contain", !tile && className)}
      style={{ width: tile ? "100%" : size, height: tile ? "100%" : size, imageRendering: "auto" }}
    />
  );

  if (!tile) return img;

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden bg-surface-2 ring-1 ring-border/60 shadow-sm",
        className,
      )}
      style={{
        width: size,
        height: size,
        // Rayon proportionnel (≈ 28 %) : même langage de formes que les
        // tuiles `rounded-2xl` de l'interface, et que le masque squircle
        // des launchers Android.
        borderRadius: Math.round(size * 0.28),
        padding: Math.round(size * 0.06),
      }}
    >
      {img}
    </span>
  );
}
