/**
 * GeniusFiles — jeu d'icônes propriétaire.
 *
 * Toutes les icônes suivent le socle décrit dans `GfIcon.tsx` : même grille,
 * même graisse, même finition, même accent duotone. Les familles partagent
 * volontairement des silhouettes communes :
 *
 * · Famille « feuille »   : documents, PDF, texte, code, archive, police.
 * · Famille « cadre »     : image, vidéo, éditeurs visuels.
 * · Famille « bloc »      : stockages, appareils, applications.
 * · Famille « anneau »    : états (succès, information, erreur, chargement).
 *
 * Une icône appartient donc visuellement à GeniusFiles par sa géométrie,
 * pas par un logo apposé.
 */
import { Accent, createGfIcon } from "./GfIcon";

/* --------------------------------------------------------------------- */
/* Silhouettes partagées                                                   */
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

/* --------------------------------------------------------------------- */
/* Famille « fichiers »                                                    */
/* --------------------------------------------------------------------- */

export const GfFolder = createGfIcon(
  "GfFolder",
  <>
    <Accent d="M2.75 9.75h18.5v8.5a1.5 1.5 0 0 1-1.5 1.5H4.25a1.5 1.5 0 0 1-1.5-1.5Z" />
    <path d="M2.75 7.25a1.5 1.5 0 0 1 1.5-1.5h4.1a1.5 1.5 0 0 1 1.16.55l1.24 1.5h9a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H4.25a1.5 1.5 0 0 1-1.5-1.5Z" />
    <path d="M2.75 9.9h18.5" />
  </>,
);

export const GfFolderOpen = createGfIcon(
  "GfFolderOpen",
  <>
    <Accent d="M4.6 11.25h17.15l-2.3 7.05a1.5 1.5 0 0 1-1.43 1.05H4.25a1.5 1.5 0 0 1-1.5-1.5v-6.6Z" />
    <path d="M2.75 18.25V7.25a1.5 1.5 0 0 1 1.5-1.5h4.1a1.5 1.5 0 0 1 1.16.55l1.24 1.5h6.5a1.5 1.5 0 0 1 1.5 1.5v1.95" />
    <path d="M4.6 11.25h16.15a1 1 0 0 1 .95 1.31l-1.85 5.74a1.5 1.5 0 0 1-1.43 1.05H4.25a1.5 1.5 0 0 1-1.5-1.5" />
  </>,
);

export const GfFile = createGfIcon("GfFile", <Sheet />);

export const GfDocument = createGfIcon(
  "GfDocument",
  <>
    <Sheet />
    <path d="M9.1 12.4h5.9M9.1 15.4h5.9M9.1 18.4h3.4" />
  </>,
);

export const GfPdf = createGfIcon(
  "GfPdf",
  <>
    <Sheet />
    <Accent d="M8.6 13.4h6.9a1 1 0 0 1 1 1v3.2a1 1 0 0 1-1 1H8.6a1 1 0 0 1-1-1v-3.2a1 1 0 0 1 1-1Z" />
    <path d="M8.6 13.4h6.9a1 1 0 0 1 1 1v3.2a1 1 0 0 1-1 1H8.6a1 1 0 0 1-1-1v-3.2a1 1 0 0 1 1-1Z" />
    <path d="M10.5 18.6v-4.1h1.1a1.15 1.15 0 0 1 0 2.3h-1.1" />
  </>,
);

export const GfText = createGfIcon(
  "GfText",
  <>
    <Sheet />
    <path d="M9.1 12.6h5.9M12.05 12.6v6" />
  </>,
);

export const GfCode = createGfIcon(
  "GfCode",
  <>
    <Sheet />
    <path d="M10.15 13.5 8.2 15.9l1.95 2.4M13.95 13.5l1.95 2.4-1.95 2.4" />
  </>,
);

export const GfArchive = createGfIcon(
  "GfArchive",
  <>
    <Sheet />
    <Accent d="M10.9 11.3h2.3v8.2a1.15 1.15 0 0 1-2.3 0Z" />
    <path d="M11.05 4.9h2M11.05 7.4h2M11.05 9.9h2" />
    <path d="M10.9 13.1h2.3v5.9a1.15 1.15 0 0 1-2.3 0Z" />
  </>,
);

export const GfFont = createGfIcon(
  "GfFont",
  <>
    <Sheet />
    <path d="m9.3 18.5 2.75-6.2 2.75 6.2M10.2 16.5h3.7" />
  </>,
);

export const GfImage = createGfIcon(
  "GfImage",
  <>
    <Accent d="M3.4 17.1 8 12.4a1.4 1.4 0 0 1 2 0l4.15 4.2 1.5-1.45a1.4 1.4 0 0 1 1.95 0l3 2.85v.55a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2Z" />
    <path d="M4.75 3.75h14.5a2 2 0 0 1 2 2v12.5a2 2 0 0 1-2 2H4.75a2 2 0 0 1-2-2V5.75a2 2 0 0 1 2-2Z" />
    <path d="m2.9 17.4 5.1-5.15a1.4 1.4 0 0 1 2 0l4.05 4.1" />
    <path d="m12.75 15.15 2.05-2a1.4 1.4 0 0 1 1.95 0l4.4 4.2" />
    <circle cx="8.6" cy="8.35" r="1.55" />
  </>,
);

export const GfVideo = createGfIcon(
  "GfVideo",
  <>
    <Accent d="M10.4 9.5 15 12l-4.6 2.5Z" />
    <path d="M4.75 3.75h14.5a2 2 0 0 1 2 2v12.5a2 2 0 0 1-2 2H4.75a2 2 0 0 1-2-2V5.75a2 2 0 0 1 2-2Z" />
    <path d="M7.1 3.9v16.2M16.9 3.9v16.2" />
    <path d="M10.4 9.35a.6.6 0 0 1 .9-.52l3.9 2.13a.6.6 0 0 1 0 1.05l-3.9 2.14a.6.6 0 0 1-.9-.53Z" />
  </>,
);

export const GfAudio = createGfIcon(
  "GfAudio",
  <>
    <Accent d="M11.7 15.9a2.6 2.6 0 1 1-2.6-2.6 2.6 2.6 0 0 1 2.6 2.6Z" />
    <path d="M11.7 15.9a2.6 2.6 0 1 1-2.6-2.6 2.6 2.6 0 0 1 2.6 2.6Z" />
    <path d="M11.7 15.9V6.2a1 1 0 0 1 .78-.98l6.1-1.35a1 1 0 0 1 1.22.98v3.1a1 1 0 0 1-.78.97l-7.32 1.6" />
  </>,
);

export const GfApk = createGfIcon(
  "GfApk",
  <>
    <Accent d="M6.75 9.25h10.5a1.5 1.5 0 0 1 1.5 1.5v6.5a2.5 2.5 0 0 1-2.5 2.5h-8.5a2.5 2.5 0 0 1-2.5-2.5v-6.5a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="M5.25 10.75a1.5 1.5 0 0 1 1.5-1.5h10.5a1.5 1.5 0 0 1 1.5 1.5v6.5a2.5 2.5 0 0 1-2.5 2.5h-8.5a2.5 2.5 0 0 1-2.5-2.5Z" />
    <path d="m7.9 4.4 1.7 2.35M16.1 4.4l-1.7 2.35" />
    <path d="M9.6 12.7h.01M14.4 12.7h.01" />
    <path d="M2.75 12.4v3.2M21.25 12.4v3.2" />
  </>,
);

export const GfDownload = createGfIcon(
  "GfDownload",
  <>
    <Accent d="M2.9 15.6h18.2v2.65a2 2 0 0 1-2 2H4.9a2 2 0 0 1-2-2Z" />
    <path d="M12 3.25v9.4" />
    <path d="m8.25 9.15 3.75 3.6 3.75-3.6" />
    <path d="M2.9 15.6h4.35l1.1 1.85h7.3l1.1-1.85h4.35v2.65a2 2 0 0 1-2 2H4.9a2 2 0 0 1-2-2Z" />
  </>,
);

/* --------------------------------------------------------------------- */
/* Famille « stockages »                                                   */
/* --------------------------------------------------------------------- */

export const GfInternalStorage = createGfIcon(
  "GfInternalStorage",
  <>
    <Accent d="M4.75 13.25h14.5a1.75 1.75 0 0 1 1.75 1.75v2.5a1.75 1.75 0 0 1-1.75 1.75H4.75A1.75 1.75 0 0 1 3 17.5V15a1.75 1.75 0 0 1 1.75-1.75Z" />
    <path d="M4.75 4.75h14.5A1.75 1.75 0 0 1 21 6.5V9a1.75 1.75 0 0 1-1.75 1.75H4.75A1.75 1.75 0 0 1 3 9V6.5a1.75 1.75 0 0 1 1.75-1.75Z" />
    <path d="M4.75 13.25h14.5A1.75 1.75 0 0 1 21 15v2.5a1.75 1.75 0 0 1-1.75 1.75H4.75A1.75 1.75 0 0 1 3 17.5V15a1.75 1.75 0 0 1 1.75-1.75Z" />
    <path d="M6.4 7.75h.01M6.4 16.25h.01" />
    <path d="M15.6 7.75h2.1M15.6 16.25h2.1" />
  </>,
);

export const GfSdCard = createGfIcon(
  "GfSdCard",
  <>
    <Accent d="M6.25 3.5h6.1L18 9.15v9.6a1.75 1.75 0 0 1-1.75 1.75H6.25A1.75 1.75 0 0 1 4.5 18.75V5.25A1.75 1.75 0 0 1 6.25 3.5Z" />
    <path d="M6.25 3.5h6.1L18 9.15v9.6a1.75 1.75 0 0 1-1.75 1.75H6.25A1.75 1.75 0 0 1 4.5 18.75V5.25A1.75 1.75 0 0 1 6.25 3.5Z" />
    <path d="M8.5 7.4v2.6M11.25 6.6v3.4M14 7.4v2.6" />
  </>,
);

export const GfUsbDrive = createGfIcon(
  "GfUsbDrive",
  <>
    <Accent d="M6.75 9.5h10.5a1.75 1.75 0 0 1 1.75 1.75v6a1.75 1.75 0 0 1-1.75 1.75H6.75A1.75 1.75 0 0 1 5 17.25v-6A1.75 1.75 0 0 1 6.75 9.5Z" />
    <path d="M6.75 9.5h10.5a1.75 1.75 0 0 1 1.75 1.75v6a1.75 1.75 0 0 1-1.75 1.75H6.75A1.75 1.75 0 0 1 5 17.25v-6A1.75 1.75 0 0 1 6.75 9.5Z" />
    <path d="M9.4 9.5V6.1a1.6 1.6 0 0 1 1.6-1.6h2a1.6 1.6 0 0 1 1.6 1.6v3.4" />
    <path d="M8.9 13.4v1.7M15.1 13.4v1.7" />
  </>,
);

export const GfExternalStorage = createGfIcon(
  "GfExternalStorage",
  <>
    <Accent d="M4.9 14.25h14.2a1.75 1.75 0 0 1 1.75 1.75v1.5a1.75 1.75 0 0 1-1.75 1.75H4.9a1.75 1.75 0 0 1-1.75-1.75V16a1.75 1.75 0 0 1 1.75-1.75Z" />
    <path d="M6.4 4.75h11.2a1.75 1.75 0 0 1 1.55.95l2 3.8a1.75 1.75 0 0 1 .2.8V16a1.75 1.75 0 0 1-1.75 1.75H4.4A1.75 1.75 0 0 1 2.65 16v-5.7a1.75 1.75 0 0 1 .2-.8l2-3.8a1.75 1.75 0 0 1 1.55-.95Z" />
    <path d="M2.85 10.4h18.3" />
    <path d="M6 14h.01M9 14h.01" />
  </>,
);

export const GfNetworkStorage = createGfIcon(
  "GfNetworkStorage",
  <>
    <Accent d="M4.75 13.4h14.5a1.6 1.6 0 0 1 1.6 1.6v2.4a1.6 1.6 0 0 1-1.6 1.6H4.75a1.6 1.6 0 0 1-1.6-1.6V15a1.6 1.6 0 0 1 1.6-1.6Z" />
    <path d="M4.75 5.4h14.5A1.6 1.6 0 0 1 20.85 7v2.4a1.6 1.6 0 0 1-1.6 1.6H4.75a1.6 1.6 0 0 1-1.6-1.6V7a1.6 1.6 0 0 1 1.6-1.6Z" />
    <path d="M4.75 13.4h14.5a1.6 1.6 0 0 1 1.6 1.6v2.4a1.6 1.6 0 0 1-1.6 1.6H4.75a1.6 1.6 0 0 1-1.6-1.6V15a1.6 1.6 0 0 1 1.6-1.6Z" />
    <path d="M6.6 8.2h.01M6.6 16.2h.01" />
    <path d="M12 11v2.4" />
  </>,
);

export const GfStorageGauge = createGfIcon(
  "GfStorageGauge",
  <>
    <Accent d="M12 3.25a8.75 8.75 0 0 1 8.35 6.15l-8.35 2.6Z" />
    <circle cx="12" cy="12" r="8.75" />
    <path d="M12 3.25v8.75l6.15 3.6" />
  </>,
);

/* --------------------------------------------------------------------- */
/* Navigation principale                                                   */
/* --------------------------------------------------------------------- */

export const GfHome = createGfIcon(
  "GfHome",
  <>
    <Accent d="M9.6 20.5v-4.4a2.4 2.4 0 0 1 4.8 0v4.4Z" />
    <path d="M3.4 10.4 11 4.15a1.6 1.6 0 0 1 2 0l7.6 6.25a1.6 1.6 0 0 1 .58 1.24v7.16a1.7 1.7 0 0 1-1.7 1.7H4.52a1.7 1.7 0 0 1-1.7-1.7v-7.16a1.6 1.6 0 0 1 .58-1.24Z" />
    <path d="M9.6 20.5v-4.4a2.4 2.4 0 0 1 4.8 0v4.4" />
  </>,
);

export const GfGeniusAi = createGfIcon(
  "GfGeniusAi",
  <>
    <Accent d="M11 3.4a.6.6 0 0 1 1.12 0l1.36 3.6a.6.6 0 0 0 .35.35l3.6 1.36a.6.6 0 0 1 0 1.12l-3.6 1.36a.6.6 0 0 0-.35.35l-1.36 3.6a.6.6 0 0 1-1.12 0l-1.36-3.6a.6.6 0 0 0-.35-.35l-3.6-1.36a.6.6 0 0 1 0-1.12l3.6-1.36a.6.6 0 0 0 .35-.35Z" />
    <path d="M11 3.4a.6.6 0 0 1 1.12 0l1.36 3.6a.6.6 0 0 0 .35.35l3.6 1.36a.6.6 0 0 1 0 1.12l-3.6 1.36a.6.6 0 0 0-.35.35l-1.36 3.6a.6.6 0 0 1-1.12 0l-1.36-3.6a.6.6 0 0 0-.35-.35l-3.6-1.36a.6.6 0 0 1 0-1.12l3.6-1.36a.6.6 0 0 0 .35-.35Z" />
    <path d="M17.15 15.2a.45.45 0 0 1 .84 0l.6 1.6a.45.45 0 0 0 .26.26l1.6.6a.45.45 0 0 1 0 .84l-1.6.6a.45.45 0 0 0-.26.26l-.6 1.6a.45.45 0 0 1-.84 0l-.6-1.6a.45.45 0 0 0-.26-.26l-1.6-.6a.45.45 0 0 1 0-.84l1.6-.6a.45.45 0 0 0 .26-.26Z" />
  </>,
);

export const GfAutomations = createGfIcon(
  "GfAutomations",
  <>
    <Accent d="M12.9 2.9 6.4 12.4a.6.6 0 0 0 .5.94h3.55l-1.35 7.06a.6.6 0 0 0 1.08.45l6.5-9.5a.6.6 0 0 0-.5-.94h-3.55l1.35-7.06a.6.6 0 0 0-1.08-.45Z" />
    <path d="M12.9 2.9 6.4 12.4a.6.6 0 0 0 .5.94h3.55l-1.35 7.06a.6.6 0 0 0 1.08.45l6.5-9.5a.6.6 0 0 0-.5-.94h-3.55l1.35-7.06a.6.6 0 0 0-1.08-.45Z" />
    <path d="M19.4 6.6h1.85M2.75 17.4H4.6" />
  </>,
);

export const GfPdfTools = createGfIcon(
  "GfPdfTools",
  <>
    <Accent d="M9.15 6.5h4.2L17.5 10.6v7.65a1 1 0 0 1-1 1H9.15a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1Z" />
    <path d="M6.6 4.4V3.6a1 1 0 0 1 1-1h4.9l4.9 4.85" />
    <path d="M8.15 7.5a1 1 0 0 1 1-1h4.2l4.15 4.1v7.65a1 1 0 0 1-1 1H9.15a1 1 0 0 1-1-1Z" />
    <path d="M13.35 6.5v3.1a1 1 0 0 0 1 1h3.15" />
    <path d="M10.6 14.6h4.35M10.6 17.1h2.6" />
  </>,
);

export const GfSettings = createGfIcon(
  "GfSettings",
  <>
    <Accent d="M8.35 4.75a2.05 2.05 0 1 1-2.05 2.05 2.05 2.05 0 0 1 2.05-2.05Zm7.3 10.4a2.05 2.05 0 1 1-2.05 2.05 2.05 2.05 0 0 1 2.05-2.05Z" />
    <path d="M2.9 6.8h3.4M10.4 6.8h10.7M2.9 17.2h10.7M17.2 17.2h3.9" />
    <circle cx="8.35" cy="6.8" r="2.05" />
    <circle cx="15.25" cy="17.2" r="2.05" />
  </>,
);

/* --------------------------------------------------------------------- */
/* Outils                                                                  */
/* --------------------------------------------------------------------- */

export const GfCleaner = createGfIcon(
  "GfCleaner",
  <>
    <Accent d="m8.75 12.55 4.7-4.7 3.3 3.3-4.7 4.7a1.4 1.4 0 0 1-.9.4l-3.4.3.3-3.4a1.4 1.4 0 0 1 .4-.9Z" />
    <path d="m13.45 7.85 2.05-2.05a1.55 1.55 0 0 1 2.2 0l1.1 1.1a1.55 1.55 0 0 1 0 2.2l-2.05 2.05Z" />
    <path d="m8.75 12.55 4.7-4.7 3.3 3.3-4.7 4.7a1.4 1.4 0 0 1-.9.4l-3.4.3.3-3.4a1.4 1.4 0 0 1 .4-.9Z" />
    <path d="M4.3 4.4v2.5M3.05 5.65h2.5M5.1 17.4v1.9M4.15 18.35h1.9" />
  </>,
);

export const GfVault = createGfIcon(
  "GfVault",
  <>
    <Accent d="M12 10.05a2.35 2.35 0 1 1-2.35 2.35A2.35 2.35 0 0 1 12 10.05Z" />
    <path d="M5.25 3.75h13.5a1.9 1.9 0 0 1 1.9 1.9v11.7a1.9 1.9 0 0 1-1.9 1.9H5.25a1.9 1.9 0 0 1-1.9-1.9V5.65a1.9 1.9 0 0 1 1.9-1.9Z" />
    <circle cx="12" cy="12.4" r="3.6" />
    <path d="M12 8.8v-.9M12 16.9v-.9M15.6 12.4h.9M8.4 12.4h-.9" />
    <path d="M6.6 19.25v1.3M17.4 19.25v1.3" />
  </>,
);

export const GfVaultOpen = createGfIcon(
  "GfVaultOpen",
  <>
    <Accent d="M12.4 10.05a2.35 2.35 0 1 1-2.35 2.35 2.35 2.35 0 0 1 2.35-2.35Z" />
    <path d="M3.35 5.65a1.9 1.9 0 0 1 1.9-1.9h9.15a1.9 1.9 0 0 1 1.9 1.9v11.7a1.9 1.9 0 0 1-1.9 1.9H5.25a1.9 1.9 0 0 1-1.9-1.9Z" />
    <circle cx="9.85" cy="12.4" r="3.2" />
    <path d="M16.3 6.4h1.85a2.5 2.5 0 0 1 2.5 2.5v8.45a1.9 1.9 0 0 1-1.9 1.9h-.9" />
    <path d="M6.6 19.25v1.3M17.4 19.25v1.3" />
  </>,
);

export const GfTransfer = createGfIcon(
  "GfTransfer",
  <>
    <Accent d="M4.5 3.6h4.1a1.6 1.6 0 0 1 1.6 1.6v3.4a1.6 1.6 0 0 1-1.6 1.6H4.5a1.6 1.6 0 0 1-1.6-1.6V5.2A1.6 1.6 0 0 1 4.5 3.6Zm10.9 10.2h4.1a1.6 1.6 0 0 1 1.6 1.6v3.4a1.6 1.6 0 0 1-1.6 1.6h-4.1a1.6 1.6 0 0 1-1.6-1.6v-3.4a1.6 1.6 0 0 1 1.6-1.6Z" />
    <path d="M4.5 3.6h4.1a1.6 1.6 0 0 1 1.6 1.6v3.4a1.6 1.6 0 0 1-1.6 1.6H4.5a1.6 1.6 0 0 1-1.6-1.6V5.2A1.6 1.6 0 0 1 4.5 3.6Z" />
    <path d="M15.4 13.8h4.1a1.6 1.6 0 0 1 1.6 1.6v3.4a1.6 1.6 0 0 1-1.6 1.6h-4.1a1.6 1.6 0 0 1-1.6-1.6v-3.4a1.6 1.6 0 0 1 1.6-1.6Z" />
    <path d="M17.45 10.75V6.9a1.6 1.6 0 0 0-1.6-1.6H12.6" />
    <path d="m14.35 7.5-1.9-2.2 1.9-2.2" />
    <path d="M6.55 13.25v3.85a1.6 1.6 0 0 0 1.6 1.6h3.25" />
    <path d="m9.65 16.5 1.9 2.2-1.9 2.2" />
  </>,
);

export const GfTrash = createGfIcon(
  "GfTrash",
  <>
    <Accent d="M5.9 7.9h12.2l-.95 11.05a1.7 1.7 0 0 1-1.7 1.55H8.55a1.7 1.7 0 0 1-1.7-1.55Z" />
    <path d="M5.9 7.9h12.2l-.95 11.05a1.7 1.7 0 0 1-1.7 1.55H8.55a1.7 1.7 0 0 1-1.7-1.55Z" />
    <path d="M3.6 7.9h16.8" />
    <path d="M9.35 5.35a1.7 1.7 0 0 1 1.7-1.55h1.9a1.7 1.7 0 0 1 1.7 1.55l.2 2.55H9.15Z" />
    <path d="M10.4 11.6v5M13.6 11.6v5" />
  </>,
);

export const GfApps = createGfIcon(
  "GfApps",
  <>
    <Accent d="M14.1 13.35h5.05a1.55 1.55 0 0 1 1.55 1.55v4.05a1.55 1.55 0 0 1-1.55 1.55H14.1a1.55 1.55 0 0 1-1.55-1.55V14.9a1.55 1.55 0 0 1 1.55-1.55Z" />
    <path d="M4.85 3.5h4.3a1.55 1.55 0 0 1 1.55 1.55v4.3A1.55 1.55 0 0 1 9.15 10.9h-4.3A1.55 1.55 0 0 1 3.3 9.35v-4.3A1.55 1.55 0 0 1 4.85 3.5Z" />
    <path d="M4.85 13.1h4.3a1.55 1.55 0 0 1 1.55 1.55v4.3a1.55 1.55 0 0 1-1.55 1.55h-4.3A1.55 1.55 0 0 1 3.3 18.95v-4.3A1.55 1.55 0 0 1 4.85 13.1Z" />
    <path d="M14.85 13.1h4.3a1.55 1.55 0 0 1 1.55 1.55v4.3a1.55 1.55 0 0 1-1.55 1.55h-4.3a1.55 1.55 0 0 1-1.55-1.55v-4.3a1.55 1.55 0 0 1 1.55-1.55Z" />
    <circle cx="17" cy="7.2" r="3.7" />
  </>,
);

export const GfPhotoEditor = createGfIcon(
  "GfPhotoEditor",
  <>
    <Accent d="M3.4 16.6 8 12.2a1.4 1.4 0 0 1 1.95 0l3.35 3.3v2.75a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2Z" />
    <path d="M12.9 3.75H4.75a2 2 0 0 0-2 2v12.5a2 2 0 0 0 2 2h8.15" />
    <path d="M2.9 17.1 8 12.2a1.4 1.4 0 0 1 1.95 0l2.95 2.95" />
    <circle cx="8.1" cy="8.1" r="1.5" />
    <path d="m15.55 12.05 4.1-4.1a1.5 1.5 0 0 1 2.12 2.12l-4.1 4.1-2.72.6Z" />
  </>,
);

export const GfAudioEditor = createGfIcon(
  "GfAudioEditor",
  <>
    <Accent d="M11.2 6.75h1.6v10.5h-1.6Z" />
    <path d="M4.4 10.1v3.8M7.8 7.6v8.8M12 5.4v13.2M16.2 8.4v7.2M19.6 10.6v2.8" />
  </>,
);

export const GfSearch = createGfIcon(
  "GfSearch",
  <>
    <Accent d="M10.6 3.9a6.7 6.7 0 1 1-6.7 6.7 6.7 6.7 0 0 1 6.7-6.7Z" />
    <circle cx="10.6" cy="10.6" r="6.7" />
    <path d="m15.55 15.55 4.55 4.55" />
    <path d="M7.6 10.3a3 3 0 0 1 2.6-2.85" />
  </>,
);

export const GfCompress = createGfIcon(
  "GfCompress",
  <>
    <Accent d="M4.75 9.9h14.5a1.6 1.6 0 0 1 1.6 1.6v6.35a1.9 1.9 0 0 1-1.9 1.9H5.05a1.9 1.9 0 0 1-1.9-1.9V11.5a1.6 1.6 0 0 1 1.6-1.6Z" />
    <path d="M3.15 11.5a1.6 1.6 0 0 1 1.6-1.6h14.5a1.6 1.6 0 0 1 1.6 1.6v6.35a1.9 1.9 0 0 1-1.9 1.9H5.05a1.9 1.9 0 0 1-1.9-1.9Z" />
    <path d="M12 3.35v4.6" />
    <path d="m8.7 5.5 3.3 2.45 3.3-2.45" />
    <path d="M9.6 14.6h4.8" />
  </>,
);

export const GfExtract = createGfIcon(
  "GfExtract",
  <>
    <Accent d="M4.75 11.4h14.5a1.6 1.6 0 0 1 1.6 1.6v4.85a1.9 1.9 0 0 1-1.9 1.9H5.05a1.9 1.9 0 0 1-1.9-1.9V13a1.6 1.6 0 0 1 1.6-1.6Z" />
    <path d="M3.15 13a1.6 1.6 0 0 1 1.6-1.6h14.5a1.6 1.6 0 0 1 1.6 1.6v4.85a1.9 1.9 0 0 1-1.9 1.9H5.05a1.9 1.9 0 0 1-1.9-1.9Z" />
    <path d="M12 8.7V3.4" />
    <path d="m8.7 6.15 3.3-2.75 3.3 2.75" />
    <path d="M9.6 15.9h4.8" />
  </>,
);

export const GfShare = createGfIcon(
  "GfShare",
  <>
    <Accent d="M17.4 2.9a2.85 2.85 0 1 1-2.85 2.85A2.85 2.85 0 0 1 17.4 2.9Zm0 12.35a2.85 2.85 0 1 1-2.85 2.85 2.85 2.85 0 0 1 2.85-2.85Zm-10.8-6.1A2.85 2.85 0 1 1 3.75 12 2.85 2.85 0 0 1 6.6 9.15Z" />
    <circle cx="17.4" cy="5.75" r="2.85" />
    <circle cx="6.6" cy="12" r="2.85" />
    <circle cx="17.4" cy="18.25" r="2.85" />
    <path d="m9.1 10.6 5.8-3.4M9.1 13.4l5.8 3.4" />
  </>,
);

export const GfConvert = createGfIcon(
  "GfConvert",
  <>
    <Accent d="M12 3.9a8.1 8.1 0 0 1 7.35 4.7H12Z" />
    <path d="M20.1 8.6a8.55 8.55 0 0 0-15.4-.6" />
    <path d="M3.9 15.4a8.55 8.55 0 0 0 15.4.6" />
    <path d="M20.4 3.9v4.7h-4.7M3.6 20.1v-4.7h4.7" />
  </>,
);

export const GfOrganize = createGfIcon(
  "GfOrganize",
  <>
    <Accent d="M2.75 9.75h11v8.5a1.5 1.5 0 0 1-1.5 1.5H4.25a1.5 1.5 0 0 1-1.5-1.5Z" />
    <path d="M2.75 7.25a1.5 1.5 0 0 1 1.5-1.5h3.6a1.5 1.5 0 0 1 1.16.55l1.24 1.5h2a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H4.25a1.5 1.5 0 0 1-1.5-1.5Z" />
    <path d="M16.4 5.75h4.85M16.4 10.4h3.1M16.4 15.05h4.85M16.4 19.7h3.1" />
  </>,
);

/* --------------------------------------------------------------------- */
/* Sécurité / coffre-fort                                                  */
/* --------------------------------------------------------------------- */

export const GfBiometric = createGfIcon(
  "GfBiometric",
  <>
    <Accent d="M12 8.4a3.6 3.6 0 0 1 3.6 3.6v2.4a9 9 0 0 1-.7 3.5H9.1a9 9 0 0 1-.7-3.5V12A3.6 3.6 0 0 1 12 8.4Z" />
    <path d="M4.6 8.05a8.7 8.7 0 0 1 14.8 0" />
    <path d="M7.35 12a4.65 4.65 0 0 1 9.3 0v2.2a12.4 12.4 0 0 1-.75 4.25" />
    <path d="M12 12v2.6a10.4 10.4 0 0 0 .9 4.25" />
    <path d="M9.7 19.4a12 12 0 0 1-1.15-5.2V12" />
  </>,
);

export const GfLocked = createGfIcon(
  "GfLocked",
  <>
    <Accent d="M5.4 10.35h13.2a1.6 1.6 0 0 1 1.6 1.6v6.65a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6v-6.65a1.6 1.6 0 0 1 1.6-1.6Z" />
    <path d="M5.4 10.35h13.2a1.6 1.6 0 0 1 1.6 1.6v6.65a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6v-6.65a1.6 1.6 0 0 1 1.6-1.6Z" />
    <path d="M7.7 10.35V7.6a4.3 4.3 0 0 1 8.6 0v2.75" />
    <path d="M12 14.1v2.4" />
  </>,
);

export const GfUnlocked = createGfIcon(
  "GfUnlocked",
  <>
    <Accent d="M5.4 10.35h13.2a1.6 1.6 0 0 1 1.6 1.6v6.65a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6v-6.65a1.6 1.6 0 0 1 1.6-1.6Z" />
    <path d="M5.4 10.35h13.2a1.6 1.6 0 0 1 1.6 1.6v6.65a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6v-6.65a1.6 1.6 0 0 1 1.6-1.6Z" />
    <path d="M7.7 10.35V7.6a4.3 4.3 0 0 1 8.42-1.25" />
    <path d="M12 14.1v2.4" />
  </>,
);

export const GfKey = createGfIcon(
  "GfKey",
  <>
    <Accent d="M15.85 3.9a4.9 4.9 0 1 1-4.9 4.9 4.9 4.9 0 0 1 4.9-4.9Z" />
    <circle cx="15.85" cy="8.8" r="4.9" />
    <path d="m12.35 12.25-8.5 8.5" />
    <path d="m6.35 15.35 2.15 2.15M8.9 12.8l2.15 2.15" />
  </>,
);

export const GfShieldCheck = createGfIcon(
  "GfShieldCheck",
  <>
    <Accent d="M12 2.9 19 5.6v5.6c0 4.35-2.9 7.6-7 9.9-4.1-2.3-7-5.55-7-9.9V5.6Z" />
    <path d="M12 2.9 19 5.6v5.6c0 4.35-2.9 7.6-7 9.9-4.1-2.3-7-5.55-7-9.9V5.6Z" />
    <path d="m8.85 11.95 2.25 2.3 4.05-4.6" />
  </>,
);

export const GfShieldAlert = createGfIcon(
  "GfShieldAlert",
  <>
    <Accent d="M12 2.9 19 5.6v5.6c0 4.35-2.9 7.6-7 9.9-4.1-2.3-7-5.55-7-9.9V5.6Z" />
    <path d="M12 2.9 19 5.6v5.6c0 4.35-2.9 7.6-7 9.9-4.1-2.3-7-5.55-7-9.9V5.6Z" />
    <path d="M12 7.9v4.3M12 15.35h.01" />
  </>,
);

/* --------------------------------------------------------------------- */
/* Famille « anneau » : états, dialogues, retours                          */
/* --------------------------------------------------------------------- */

export const GfInfo = createGfIcon(
  "GfInfo",
  <>
    <Accent d="M12 3.25A8.75 8.75 0 1 1 3.25 12 8.75 8.75 0 0 1 12 3.25Z" />
    <circle cx="12" cy="12" r="8.75" />
    <path d="M12 11.1v5.05M12 8.05h.01" />
  </>,
);

export const GfSuccess = createGfIcon(
  "GfSuccess",
  <>
    <Accent d="M12 3.25A8.75 8.75 0 1 1 3.25 12 8.75 8.75 0 0 1 12 3.25Z" />
    <circle cx="12" cy="12" r="8.75" />
    <path d="m8.15 12.2 2.6 2.6 5.1-5.6" />
  </>,
);

export const GfWarning = createGfIcon(
  "GfWarning",
  <>
    <Accent d="M12 3.25A8.75 8.75 0 1 1 3.25 12 8.75 8.75 0 0 1 12 3.25Z" />
    <circle cx="12" cy="12" r="8.75" />
    <path d="M12 7.6v4.75M12 15.7h.01" />
  </>,
);

export const GfError = createGfIcon(
  "GfError",
  <>
    <Accent d="M12 3.25A8.75 8.75 0 1 1 3.25 12 8.75 8.75 0 0 1 12 3.25Z" />
    <circle cx="12" cy="12" r="8.75" />
    <path d="m9.35 9.35 5.3 5.3M14.65 9.35l-5.3 5.3" />
  </>,
);

export const GfPermission = createGfIcon(
  "GfPermission",
  <>
    <Accent d="M12 2.9 19 5.6v5.6c0 4.35-2.9 7.6-7 9.9-4.1-2.3-7-5.55-7-9.9V5.6Z" />
    <path d="M12 2.9 19 5.6v5.6c0 4.35-2.9 7.6-7 9.9-4.1-2.3-7-5.55-7-9.9V5.6Z" />
    <circle cx="12" cy="10.4" r="2.05" />
    <path d="M12 12.45v3.1M12 14.2h1.5" />
  </>,
);

export const GfOffline = createGfIcon(
  "GfOffline",
  <>
    <Accent d="M12 15.9a2.1 2.1 0 1 1-2.1 2.1 2.1 2.1 0 0 1 2.1-2.1Z" />
    <path d="M3.15 8.4a13.6 13.6 0 0 1 5.2-3.05M15.9 5.5a13.6 13.6 0 0 1 4.95 2.9" />
    <path d="M6.5 12a9.2 9.2 0 0 1 2.55-1.65M15.1 10.5A9.2 9.2 0 0 1 17.5 12" />
    <circle cx="12" cy="18" r="2.1" />
    <path d="m3.9 3.9 16.2 16.2" />
  </>,
);

export const GfNoResults = createGfIcon(
  "GfNoResults",
  <>
    <Accent d="M10.6 3.9a6.7 6.7 0 1 1-6.7 6.7 6.7 6.7 0 0 1 6.7-6.7Z" />
    <circle cx="10.6" cy="10.6" r="6.7" />
    <path d="m15.55 15.55 4.55 4.55" />
    <path d="M8.2 10.6h4.8" />
  </>,
);

export const GfNotFound = createGfIcon(
  "GfNotFound",
  <>
    <Accent d="M12.85 2.75 18 7.9h-4.15a1 1 0 0 1-1-1Z" />
    <path d="M18 11.15V7.9l-5.15-5.15h-5.6a1 1 0 0 0-1 1v16.5a1 1 0 0 0 1 1h4.05" />
    <path d="M12.85 2.75v4.15a1 1 0 0 0 1 1H18" />
    <circle cx="15.9" cy="16.05" r="3.35" />
    <path d="m18.4 18.5 2.35 2.35" />
  </>,
);

export const GfOpenFailed = createGfIcon(
  "GfOpenFailed",
  <>
    <Accent d="M12.85 2.75 18 7.9h-4.15a1 1 0 0 1-1-1Z" />
    <path d="M18 10.9V7.9l-5.15-5.15h-5.6a1 1 0 0 0-1 1v16.5a1 1 0 0 0 1 1h3.6" />
    <path d="M12.85 2.75v4.15a1 1 0 0 0 1 1H18" />
    <path d="M13.9 17.55h6.6" />
    <path d="m17.9 14.95 2.6 2.6-2.6 2.6" />
  </>,
);

export const GfLowSpace = createGfIcon(
  "GfLowSpace",
  <>
    <Accent d="M12 3.25a8.75 8.75 0 0 1 8.35 6.15L12 12Z" />
    <circle cx="12" cy="12" r="8.75" />
    <path d="M12 6.6V12l3.9 2.3" />
    <path d="M12 16.9h.01" />
  </>,
);

export const GfFavorite = createGfIcon(
  "GfFavorite",
  <>
    <Accent d="m12 3.6 2.55 5.3 5.8.8-4.2 4.05 1 5.75L12 16.8l-5.15 2.7 1-5.75-4.2-4.05 5.8-.8Z" />
    <path d="m12 3.6 2.55 5.3 5.8.8-4.2 4.05 1 5.75L12 16.8l-5.15 2.7 1-5.75-4.2-4.05 5.8-.8Z" />
  </>,
);

export const GfRecent = createGfIcon(
  "GfRecent",
  <>
    <Accent d="M12 3.25A8.75 8.75 0 1 1 3.25 12 8.75 8.75 0 0 1 12 3.25Z" />
    <circle cx="12" cy="12" r="8.75" />
    <path d="M12 6.9V12l3.5 2.05" />
  </>,
);

export const GfEmptyFiles = createGfIcon(
  "GfEmptyFiles",
  <>
    <Accent d="M2.75 10.4h13.5v7.85a1.5 1.5 0 0 1-1.5 1.5H4.25a1.5 1.5 0 0 1-1.5-1.5Z" />
    <path d="M2.75 7.9a1.5 1.5 0 0 1 1.5-1.5h3.6a1.5 1.5 0 0 1 1.16.55l1.24 1.5h4.5a1.5 1.5 0 0 1 1.5 1.5v8.3a1.5 1.5 0 0 1-1.5 1.5H4.25a1.5 1.5 0 0 1-1.5-1.5Z" />
    <path d="M19 4.2v3.1M20.55 5.75h-3.1" />
    <path d="M20.4 11.4v2.2M21.5 12.5h-2.2" />
  </>,
);
