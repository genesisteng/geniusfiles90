/**
 * Reader tools — outils exposés par une « scène » de lecture (PDF, Office,
 * texte…) et affichés dans le menu du lecteur.
 *
 * La barre d'actions flottante en bas de l'écran a été supprimée : toutes
 * les commandes (zoom, rotation, recherche, pagination…) remontent ici et
 * sont rendues par l'en-tête / le menu du lecteur, comme dans les lecteurs
 * Android natifs.
 */
import type { AppIcon } from "@/components/icons";

export type ReaderTool = {
  id: string;
  label: string;
  icon: AppIcon;
  onSelect: () => void;
  active?: boolean;
  disabled?: boolean;
  /** Valeur courante affichée à droite (ex. « 120 % », « 3 / 24 »). */
  value?: string;
  /** Ferme le menu après sélection (par défaut vrai). */
  keepOpen?: boolean;
};

export type ReaderToolsSetter = (tools: ReaderTool[]) => void;
