/**
 * GeniusFiles — socle du langage iconographique.
 *
 * Règles communes à TOUTES les icônes de l'application (aucune exception) :
 *
 * 1. Grille        : viewBox 24×24, marge de sécurité 2px, points clés sur
 *                    une grille de 0,5px. Aucune icône ne touche le bord.
 * 2. Graisse       : trait unique de 1,7px (2px maximum en très petite
 *                    taille), jamais mélangée dans un même écran.
 * 3. Terminaisons  : `round` pour les extrémités ET les jonctions.
 * 4. Rayons        : 2px pour les grands rectangles, 1px pour les petits,
 *                    même langage courbe que les cartes de l'interface.
 * 5. Couleur       : toujours `currentColor` — l'icône hérite du contexte,
 *                    donc du thème clair ou sombre, sans variante d'asset.
 * 6. Profondeur    : un seul « accent » duotone par icône (même couleur,
 *                    16 % d'opacité). C'est la signature GeniusFiles : elle
 *                    donne du volume sans casser la lisibilité ni le
 *                    contraste, et disparaît proprement en petite taille.
 * 7. Détail        : deux niveaux de lecture maximum (silhouette + un
 *                    détail distinctif). Rien de décoratif.
 *
 * Performances : composants SVG inline, sans image, sans police, sans
 * requête réseau. Le rendu est instantané et la mémoire négligeable.
 */
import type { ReactElement, ReactNode, SVGProps } from "react";

export type GfIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Taille en pixels (carré). Par défaut 24, comme la grille de dessin. */
  size?: number | string;
  /** Graisse du trait. Par défaut 1,7 — la graisse canonique GeniusFiles. */
  strokeWidth?: number;
};

export type GfIconComponent = ((props: GfIconProps) => ReactElement) & {
  displayName?: string;
};

/** Aplat duotone : même couleur que le trait, 16 % — la signature maison. */
export function Accent(props: SVGProps<SVGPathElement>): ReactElement {
  return <path fill="currentColor" stroke="none" opacity={0.16} {...props} />;
}

export function GfIconBase({
  size = 24,
  strokeWidth = 1.7,
  children,
  ...rest
}: GfIconProps & { children: ReactNode }): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Fabrique interne : garantit que chaque icône partage exactement le socle. */
export function createGfIcon(name: string, children: ReactNode): GfIconComponent {
  const Icon: GfIconComponent = (props: GfIconProps) => (
    <GfIconBase {...props}>{children}</GfIconBase>
  );
  Icon.displayName = name;
  return Icon;
}
