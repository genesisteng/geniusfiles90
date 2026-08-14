/**
 * GeniusFiles — seconde vague du jeu d'icônes propriétaire.
 *
 * Même socle que `gf-icons.tsx` (grille 24, trait 1,7 px, jonctions
 * arrondies, accent duotone 16 %). Ce module couvre les familles qui
 * n'étaient pas encore dessinées :
 *
 * · Famille « geste »   : actions sur un fichier (partager, renommer,
 *                          copier, déplacer, épingler, masquer…). Toutes
 *                          partagent la même diagonale de mouvement.
 * · Famille « feuille+ » : outils PDF — la silhouette de feuille commune
 *                          au jeu, plus un détail distinctif par outil.
 * · Famille « bloc+ »    : appareils et transferts.
 * · Famille « anneau+ »  : lecture, cycles et états du nettoyeur.
 */
import { Accent, createGfIcon } from "./GfIcon";

/* --------------------------------------------------------------------- */
/* Silhouette de feuille partagée (identique au reste du jeu)              */
/* --------------------------------------------------------------------- */

const SHEET = "M7.25 2.75h5.6L18 7.9v12.35a1 1 0 0 1-1 1H7.25a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1Z";
const SHEET_FOLD = "M12.85 2.75v4.15a1 1 0 0 0 1 1H18";
const SHEET_ACCENT = "M12.85 2.75 18 7.9h-4.15a1 1 0 0 1-1-1Z";

function Sheet() {
  return (
    <>
      <Accent d={SHEET_ACCENT} />
      <path d={SHEET} />
      <path d={SHEET_FOLD} />
    </>
  );
}

/** Petite feuille (utilisée quand deux documents cohabitent). */
const MINI_SHEET = "M4.6 5.75h4.05l2.6 2.6v8.4a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z";

/* --------------------------------------------------------------------- */
/* Famille « geste » — actions sur les fichiers                            */
/* --------------------------------------------------------------------- */

export const GfShareNodes = createGfIcon(
  "GfShareNodes",
  <>
    <Accent d="M17.6 2.9a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2Z" />
    <circle cx="17.6" cy="6" r="3.1" />
    <circle cx="6.4" cy="12" r="3.1" />
    <circle cx="17.6" cy="18" r="3.1" />
    <path d="m9.15 10.6 5.7-3.05M9.15 13.4l5.7 3.05" />
  </>,
);

export const GfRename = createGfIcon(
  "GfRename",
  <>
    <Accent d="M13.4 6.6 17.4 10.6l-6.4 6.4-4 .55.55-4Z" />
    <path d="M13.4 6.6 17.4 10.6l-6.4 6.4-4 .55.55-4Z" />
    <path d="m15.35 4.65 1.35-1.35a1.6 1.6 0 0 1 2.25 0l1.75 1.75a1.6 1.6 0 0 1 0 2.25l-1.35 1.35" />
    <path d="M3.25 21.1h9.4" />
  </>,
);

export const GfCopyFiles = createGfIcon(
  "GfCopyFiles",
  <>
    <Accent d="M9.35 7.25h4.2l3 3v8.5a1 1 0 0 1-1 1H9.35a1 1 0 0 1-1-1v-10.5a1 1 0 0 1 1-1Z" />
    <path d="M9.35 7.25h4.2l3 3v8.5a1 1 0 0 1-1 1H9.35a1 1 0 0 1-1-1v-10.5a1 1 0 0 1 1-1Z" />
    <path d="M13.55 7.25v2a1 1 0 0 0 1 1h2" />
    <path d="M13.05 4.55V3.75a1 1 0 0 0-1-1H5.9a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h.75" />
  </>,
);

export const GfMoveTo = createGfIcon(
  "GfMoveTo",
  <>
    <Accent d="M2.9 9.9h11.35v8.35a1.5 1.5 0 0 1-1.5 1.5H4.4a1.5 1.5 0 0 1-1.5-1.5Z" />
    <path d="M2.9 18.25V7.4a1.5 1.5 0 0 1 1.5-1.5h3.6a1.5 1.5 0 0 1 1.16.55l1.2 1.45h4.39a1.5 1.5 0 0 1 1.5 1.5v1.35" />
    <path d="M2.9 19.75h9.85a1.5 1.5 0 0 0 1.5-1.5v-2.6" />
    <path d="M14.9 12.45h6.2M18.55 9.9l2.55 2.55-2.55 2.55" />
  </>,
);

export const GfCut = createGfIcon(
  "GfCut",
  <>
    <Accent d="M6.4 15.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z" />
    <circle cx="6.4" cy="18" r="2.6" />
    <circle cx="17.6" cy="18" r="2.6" />
    <path d="m8.15 16.05 8-13.15M15.85 16.05 7.85 2.9" />
  </>,
);

export const GfPinned = createGfIcon(
  "GfPinned",
  <>
    <Accent d="M9.15 3.4h5.7l-.6 5.35 3 3.15v1.55H6.75V11.9l3-3.15Z" />
    <path d="M9.15 3.4h5.7l-.6 5.35 3 3.15v1.55H6.75V11.9l3-3.15Z" />
    <path d="M12 13.45v7.15" />
  </>,
);

export const GfUnpinned = createGfIcon(
  "GfUnpinned",
  <>
    <path d="M9.15 3.4h5.7l-.6 5.35 3 3.15v1.55h-5.4" />
    <path d="M9.7 8.9 6.75 11.9v1.55h4.1" />
    <path d="M12 13.45v7.15" />
    <path d="m3.4 3 17.2 18" />
  </>,
);

export const GfHidden = createGfIcon(
  "GfHidden",
  <>
    <Accent d="M12 7.35c4.3 0 7.6 2.75 9.1 4.65-1.5 1.9-4.8 4.65-9.1 4.65S4.4 13.9 2.9 12c1.5-1.9 4.8-4.65 9.1-4.65Z" />
    <path d="M4.4 8.4C3.65 9.05 3.15 9.65 2.9 12c1.5 1.9 4.8 4.65 9.1 4.65 1.5 0 2.85-.33 4.03-.85" />
    <path d="M18.75 14.4c1.15-.83 2-1.74 2.35-2.4-1.5-1.9-4.8-4.65-9.1-4.65-.72 0-1.4.08-2.05.22" />
    <path d="m9.85 9.9a3 3 0 0 0 4.25 4.25" />
    <path d="m3.4 3.4 17.2 17.2" />
  </>,
);

export const GfSelectAll = createGfIcon(
  "GfSelectAll",
  <>
    <Accent d="M8.4 8.4h11.35a1.5 1.5 0 0 1 1.5 1.5v9.85a1.5 1.5 0 0 1-1.5 1.5H8.4a1.5 1.5 0 0 1-1.5-1.5V9.9a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="M8.4 8.4h11.35a1.5 1.5 0 0 1 1.5 1.5v9.85a1.5 1.5 0 0 1-1.5 1.5H8.4a1.5 1.5 0 0 1-1.5-1.5V9.9a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="m10.6 14.9 2.4 2.4 4.5-4.6" />
    <path d="M4.25 15.6H3.9a1.5 1.5 0 0 1-1.5-1.5V4.25a1.5 1.5 0 0 1 1.5-1.5h9.85a1.5 1.5 0 0 1 1.5 1.5v.35" />
  </>,
);

export const GfUploadTo = createGfIcon(
  "GfUploadTo",
  <>
    <Accent d="M6.35 13.6 12 7.95l5.65 5.65Z" />
    <path d="M12 3.9v11.6" />
    <path d="m7.05 8.85 4.95-4.95 4.95 4.95" />
    <path d="M3.75 16.35v2.4a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-2.4" />
  </>,
);

export const GfPlus = createGfIcon(
  "GfPlus",
  <>
    <Accent d="M12 2.9a9.1 9.1 0 1 1 0 18.2 9.1 9.1 0 0 1 0-18.2Z" />
    <circle cx="12" cy="12" r="9.1" />
    <path d="M12 7.9v8.2M7.9 12h8.2" />
  </>,
);

export const GfRestore = createGfIcon(
  "GfRestore",
  <>
    <Accent d="M12 4.4a7.6 7.6 0 1 1-7.35 9.5h1.7A5.9 5.9 0 1 0 12 6.1Z" />
    <path d="M20.35 12a8.35 8.35 0 1 1-2.6-6.05" />
    <path d="M20.6 3.9v4.4h-4.4" />
  </>,
);

export const GfRefreshCycle = createGfIcon(
  "GfRefreshCycle",
  <>
    <path d="M20.4 12a8.4 8.4 0 0 1-14.5 5.75" />
    <path d="M3.6 12a8.4 8.4 0 0 1 14.5-5.75" />
    <path d="M18.35 2.9v3.6h-3.6M5.65 21.1v-3.6h3.6" />
  </>,
);

export const GfPlay = createGfIcon(
  "GfPlay",
  <>
    <Accent d="M12 2.9a9.1 9.1 0 1 1 0 18.2 9.1 9.1 0 0 1 0-18.2Z" />
    <circle cx="12" cy="12" r="9.1" />
    <path d="M10.2 8.65 15.6 12l-5.4 3.35Z" />
  </>,
);

export const GfPause = createGfIcon(
  "GfPause",
  <>
    <Accent d="M12 2.9a9.1 9.1 0 1 1 0 18.2 9.1 9.1 0 0 1 0-18.2Z" />
    <circle cx="12" cy="12" r="9.1" />
    <path d="M10.15 8.9v6.2M13.85 8.9v6.2" />
  </>,
);

export const GfStop = createGfIcon(
  "GfStop",
  <>
    <Accent d="M12 2.9a9.1 9.1 0 1 1 0 18.2 9.1 9.1 0 0 1 0-18.2Z" />
    <circle cx="12" cy="12" r="9.1" />
    <rect x="9" y="9" width="6" height="6" rx="1.2" />
  </>,
);

export const GfHistory = createGfIcon(
  "GfHistory",
  <>
    <Accent d="M12 4.4a7.6 7.6 0 1 1-7.35 9.5h1.7A5.9 5.9 0 1 0 12 6.1Z" />
    <path d="M3.65 12a8.35 8.35 0 1 1 2.6 6.05" />
    <path d="M3.4 3.9v4.4h4.4" />
    <path d="M12 8.1V12l2.7 1.6" />
  </>,
);

export const GfSort = createGfIcon(
  "GfSort",
  <>
    <Accent d="M3.4 5.15h9.2v1.7H3.4Z" />
    <path d="M3.4 6h9.2M3.4 12h6.4M3.4 18h3.6" />
    <path d="M16.85 4.4v15.2M13.6 16.35l3.25 3.25 3.25-3.25" />
  </>,
);

export const GfFilter = createGfIcon(
  "GfFilter",
  <>
    <Accent d="M3.4 4.6h17.2l-6.5 7.6v6.4l-4.2 2.15V12.2Z" />
    <path d="M3.4 4.6h17.2l-6.5 7.6v6.4l-4.2 2.15V12.2Z" />
  </>,
);

export const GfEyeOpen = createGfIcon(
  "GfEyeOpen",
  <>
    <Accent d="M12 7.35c4.3 0 7.6 2.75 9.1 4.65-1.5 1.9-4.8 4.65-9.1 4.65S4.4 13.9 2.9 12c1.5-1.9 4.8-4.65 9.1-4.65Z" />
    <path d="M2.9 12c1.5-1.9 4.8-4.65 9.1-4.65S19.6 10.1 21.1 12c-1.5 1.9-4.8 4.65-9.1 4.65S4.4 13.9 2.9 12Z" />
    <circle cx="12" cy="12" r="2.9" />
  </>,
);

export const GfExternalApp = createGfIcon(
  "GfExternalApp",
  <>
    <Accent d="M13.6 3.4h7v7Z" />
    <path d="M10.9 4.4H5.4a2 2 0 0 0-2 2v12.2a2 2 0 0 0 2 2h12.2a2 2 0 0 0 2-2v-5.5" />
    <path d="M13.6 3.4h7v7M20.6 3.4 11.5 12.5" />
  </>,
);

/* --------------------------------------------------------------------- */
/* Famille « feuille+ » — outils PDF                                       */
/* --------------------------------------------------------------------- */

export const GfPdfMerge = createGfIcon(
  "GfPdfMerge",
  <>
    <Accent d={MINI_SHEET} />
    <path d="M3.6 6.4h4.6l2.5 2.5v7.7a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1V7.4a1 1 0 0 1 1-1Z" />
    <path d="M13.8 6.4h4.6l2 2v9.2a1 1 0 0 1-1 1h-5.6a1 1 0 0 1-1-1V7.4a1 1 0 0 1 1-1Z" />
    <path d="M9.65 21.1h4.7M12 18.6v2.5" />
  </>,
);

export const GfPdfSplit = createGfIcon(
  "GfPdfSplit",
  <>
    <Accent d={SHEET_ACCENT} />
    <path d="M7.25 2.75h5.6L18 7.9v3.35H6.25V3.75a1 1 0 0 1 1-1Z" />
    <path d={SHEET_FOLD} />
    <path d="M6.25 14.4h11.75v5.85a1 1 0 0 1-1 1H7.25a1 1 0 0 1-1-1Z" />
    <path d="M2.75 12.85h18.5" strokeDasharray="2.4 2.4" />
  </>,
);

export const GfPdfCompress = createGfIcon(
  "GfPdfCompress",
  <>
    <Accent d="M6.4 9.9h11.2v4.2H6.4Z" />
    <path d="M6.25 9.9V3.75a1 1 0 0 1 1-1h5.6L18 7.9v2" />
    <path d="M18 14.1v6.15a1 1 0 0 1-1 1H7.25a1 1 0 0 1-1-1V14.1" />
    <path d="M4.4 12h15.2" />
    <path d="M9.6 6.75 12 9.15l2.4-2.4M9.6 17.25 12 14.85l2.4 2.4" />
  </>,
);

export const GfPdfConvert = createGfIcon(
  "GfPdfConvert",
  <>
    <Accent d="M4.6 4.4h6.15l2.35 2.35v8.35a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1V5.4a1 1 0 0 1 1-1Z" />
    <path d="M4.6 4.4h6.15l2.35 2.35v8.35a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1V5.4a1 1 0 0 1 1-1Z" />
    <path d="M15.4 8.05h3.95a1 1 0 0 1 1 1v9.55a1 1 0 0 1-1 1h-6.6a1 1 0 0 1-1-1v-1.05" />
    <path d="m16.75 13.15 2.05 2.05-2.05 2.05" />
  </>,
);

export const GfPdfExtract = createGfIcon(
  "GfPdfExtract",
  <>
    <Accent d="M4.6 4.4h6.15l2.35 2.35v6.5H4.6a1 1 0 0 1-1-1V5.4a1 1 0 0 1 1-1Z" />
    <path d="M13.1 9.5V6.75L10.75 4.4H4.6a1 1 0 0 0-1 1v6.85a1 1 0 0 0 1 1h4.3" />
    <path d="M12.6 13.5h6.8a1 1 0 0 1 1 1v5.1a1 1 0 0 1-1 1h-6.8a1 1 0 0 1-1-1v-5.1a1 1 0 0 1 1-1Z" />
    <path d="M16 20.6v-7.1M13.9 15.6 16 13.5l2.1 2.1" />
  </>,
);

export const GfPdfRotate = createGfIcon(
  "GfPdfRotate",
  <>
    <Accent d="M8.4 8.4h9.35a1 1 0 0 1 1 1v9.35a1 1 0 0 1-1 1H8.4a1 1 0 0 1-1-1V9.4a1 1 0 0 1 1-1Z" />
    <path d="M8.4 8.4h9.35a1 1 0 0 1 1 1v9.35a1 1 0 0 1-1 1H8.4a1 1 0 0 1-1-1V9.4a1 1 0 0 1 1-1Z" />
    <path d="M4.55 15.6A6.6 6.6 0 0 1 10.6 4.4" />
    <path d="M8.1 2.4 10.85 4.4 8.1 6.4" />
  </>,
);

export const GfPdfProtect = createGfIcon(
  "GfPdfProtect",
  <>
    <Accent d="M12 2.9 19.6 5.6v6.15c0 4.2-3.15 7.5-7.6 9.35-4.45-1.85-7.6-5.15-7.6-9.35V5.6Z" />
    <path d="M12 2.9 19.6 5.6v6.15c0 4.2-3.15 7.5-7.6 9.35-4.45-1.85-7.6-5.15-7.6-9.35V5.6Z" />
    <rect x="9.35" y="11.15" width="5.3" height="4.3" rx="1" />
    <path d="M10.55 11.15v-1.1a1.45 1.45 0 0 1 2.9 0v1.1" />
  </>,
);

export const GfPdfUnlock = createGfIcon(
  "GfPdfUnlock",
  <>
    <Accent d="M12 2.9 19.6 5.6v6.15c0 4.2-3.15 7.5-7.6 9.35-4.45-1.85-7.6-5.15-7.6-9.35V5.6Z" />
    <path d="M12 2.9 19.6 5.6v6.15c0 4.2-3.15 7.5-7.6 9.35-4.45-1.85-7.6-5.15-7.6-9.35V5.6Z" />
    <rect x="9.35" y="11.15" width="5.3" height="4.3" rx="1" />
    <path d="M14.65 11.15v-1.1a1.45 1.45 0 0 0-2.9 0" />
  </>,
);

export const GfPdfSign = createGfIcon(
  "GfPdfSign",
  <>
    <Accent d="M3.4 17.6c2.2 0 2.5-3.15 3.6-3.15 1.1 0 .9 3.15 2.2 3.15 1.3 0 1.6-2.1 2.6-2.1.9 0 .9 2.1 2.2 2.1 1.3 0 2-1.2 3.2-1.2v2.35H3.4Z" />
    <path d="M3.4 15.6c2.2 0 2.5-9.7 4.85-9.7 1.5 0 1.35 2.6.35 5.3-.95 2.6-2.1 4.4-2.1 4.4" />
    <path d="M9.35 13.6c2.35 0 3.1-2.3 4.3-2.3 1.2 0 .95 2.3 2.35 2.3 1.15 0 1.8-.9 2.6-.9" />
    <path d="M3.4 20.6h17.2" />
  </>,
);

export const GfPdfAnnotate = createGfIcon(
  "GfPdfAnnotate",
  <>
    <Accent d="M13.15 8.6 17.4 12.85l-6.6 6.6-4.3.55.55-4.3Z" />
    <path d="M4.6 11.15V4.4a1 1 0 0 1 1-1h6.1l2.6 2.6v1.4" />
    <path d="M13.15 8.6 17.4 12.85l-6.6 6.6-4.3.55.55-4.3Z" />
    <path d="m15.35 6.4 1.05-1.05a1.55 1.55 0 0 1 2.2 0l1.4 1.4a1.55 1.55 0 0 1 0 2.2L18.95 10" />
  </>,
);

export const GfPdfScan = createGfIcon(
  "GfPdfScan",
  <>
    <Accent d="M3.4 10.9h17.2v2.2H3.4Z" />
    <path d="M3.4 8.15V5.4a2 2 0 0 1 2-2h2.75M20.6 8.15V5.4a2 2 0 0 0-2-2h-2.75" />
    <path d="M3.4 15.85v2.75a2 2 0 0 0 2 2h2.75M20.6 15.85v2.75a2 2 0 0 1-2 2h-2.75" />
    <path d="M3.4 12h17.2" />
  </>,
);

export const GfPdfWatermark = createGfIcon(
  "GfPdfWatermark",
  <>
    <Accent d="M12 6.4c2.15 2.55 3.5 4.4 3.5 6.15a3.5 3.5 0 0 1-7 0c0-1.75 1.35-3.6 3.5-6.15Z" />
    <path d="M6.25 10.4V3.75a1 1 0 0 1 1-1h5.6L18 7.9v12.35a1 1 0 0 1-1 1H7.25a1 1 0 0 1-1-1v-2.1" />
    <path d={SHEET_FOLD} />
    <path d="M11.4 9.9c1.6 1.95 2.6 3.35 2.6 4.65a2.6 2.6 0 0 1-5.2 0c0-1.3 1-2.7 2.6-4.65Z" />
  </>,
);

export const GfPdfPages = createGfIcon(
  "GfPdfPages",
  <>
    <Accent d="M9.35 3.4h6.9a1 1 0 0 1 1 1v13.2a1 1 0 0 1-1 1h-6.9a1 1 0 0 1-1-1V4.4a1 1 0 0 1 1-1Z" />
    <path d="M9.35 3.4h6.9a1 1 0 0 1 1 1v13.2a1 1 0 0 1-1 1h-6.9a1 1 0 0 1-1-1V4.4a1 1 0 0 1 1-1Z" />
    <path d="M5.6 6.15v13.45a1 1 0 0 0 1 1h11.8" />
    <path d="M11.5 14.4h3" />
  </>,
);

export const GfPdfImages = createGfIcon(
  "GfPdfImages",
  <>
    <Accent d="M4.35 15.6 8 11.95a1.3 1.3 0 0 1 1.85 0l3.3 3.35 1.15-1.15a1.3 1.3 0 0 1 1.85 0l2.5 2.5v.35a1.5 1.5 0 0 1-1.5 1.5H5.85a1.5 1.5 0 0 1-1.5-1.5Z" />
    <path d="M5.85 6.4h11.3a1.5 1.5 0 0 1 1.5 1.5v9.1a1.5 1.5 0 0 1-1.5 1.5H5.85a1.5 1.5 0 0 1-1.5-1.5V7.9a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="m4.35 16.1 3.9-3.9a1.3 1.3 0 0 1 1.85 0l3.05 3.05" />
    <circle cx="9.1" cy="10.15" r="1.3" />
    <path d="M7.6 3.4h8.8" />
  </>,
);

export const GfPdfText = createGfIcon(
  "GfPdfText",
  <>
    <Sheet />
    <path d="M9 12.2h6M12 12.2v6.4" />
  </>,
);

export const GfPdfSearch = createGfIcon(
  "GfPdfSearch",
  <>
    <Accent d="M14.4 11.15a3.85 3.85 0 1 1 0 7.7 3.85 3.85 0 0 1 0-7.7Z" />
    <path d="M17.9 9.6V7.9L13.4 3.4H7.25a1 1 0 0 0-1 1v15.85a1 1 0 0 0 1 1h2.4" />
    <circle cx="14.4" cy="15" r="3.85" />
    <path d="m17.25 17.75 3.35 3.35" />
  </>,
);

export const GfPdfForm = createGfIcon(
  "GfPdfForm",
  <>
    <Accent d="M6.15 13.6h11.7v4.15a1 1 0 0 1-1 1H7.15a1 1 0 0 1-1-1Z" />
    <path d="M6.15 4.4a1 1 0 0 1 1-1h9.7a1 1 0 0 1 1 1v13.35a1 1 0 0 1-1 1h-9.7a1 1 0 0 1-1-1Z" />
    <path d="M8.9 7.4h6.2M8.9 10.4h6.2M8.9 15.6h3.35" />
    <path d="M3.4 21.1h17.2" />
  </>,
);

/* --------------------------------------------------------------------- */
/* Famille « nettoyeur »                                                   */
/* --------------------------------------------------------------------- */

export const GfDuplicates = createGfIcon(
  "GfDuplicates",
  <>
    <Accent d="M9.9 8.4h9.7a1 1 0 0 1 1 1v9.7a1 1 0 0 1-1 1H9.9a1 1 0 0 1-1-1V9.4a1 1 0 0 1 1-1Z" />
    <path d="M9.9 8.4h9.7a1 1 0 0 1 1 1v9.7a1 1 0 0 1-1 1H9.9a1 1 0 0 1-1-1V9.4a1 1 0 0 1 1-1Z" />
    <path d="M15.6 5.4v-1a1 1 0 0 0-1-1H4.4a1 1 0 0 0-1 1v10.2a1 1 0 0 0 1 1h1" />
  </>,
);

export const GfJunkFile = createGfIcon(
  "GfJunkFile",
  <>
    <Sheet />
    <path d="M9.4 13.4 14.6 18.6M14.6 13.4 9.4 18.6" />
  </>,
);

export const GfBigFile = createGfIcon(
  "GfBigFile",
  <>
    <Sheet />
    <path d="M12 11.9v6.6M9.4 14.5 12 11.9l2.6 2.6" />
  </>,
);

export const GfStaleFile = createGfIcon(
  "GfStaleFile",
  <>
    <Accent d="M15.6 13.6a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
    <path d="M17.9 10.9V7.9L13.4 3.4H7.25a1 1 0 0 0-1 1v15.85a1 1 0 0 0 1 1H9.5" />
    <circle cx="15.6" cy="17.6" r="4" />
    <path d="M15.6 15.6v2l1.4.85" />
  </>,
);

export const GfEmptyFolderClean = createGfIcon(
  "GfEmptyFolderClean",
  <>
    <Accent d="M2.9 9.9h18.2v8.35a1.5 1.5 0 0 1-1.5 1.5H4.4a1.5 1.5 0 0 1-1.5-1.5Z" />
    <path d="M2.9 18.25V7.4a1.5 1.5 0 0 1 1.5-1.5h4.1a1.5 1.5 0 0 1 1.16.55l1.2 1.45h8.74a1.5 1.5 0 0 1 1.5 1.5v8.85a1.5 1.5 0 0 1-1.5 1.5H4.4a1.5 1.5 0 0 1-1.5-1.5Z" />
    <path d="M9.9 13.9 14.1 18.1M14.1 13.9 9.9 18.1" />
  </>,
);

export const GfCacheSweep = createGfIcon(
  "GfCacheSweep",
  <>
    <Accent d="M9.4 13.6h5.2l1.15 6.5a1 1 0 0 1-1 1.15H9.25a1 1 0 0 1-1-1.15Z" />
    <path d="M9.4 13.6h5.2l1.15 6.5a1 1 0 0 1-1 1.15H9.25a1 1 0 0 1-1-1.15Z" />
    <path d="M7.9 13.6h8.2" />
    <path d="M12 10.9V3.4M8.9 6.4 12 3.4l3.1 3" />
  </>,
);
