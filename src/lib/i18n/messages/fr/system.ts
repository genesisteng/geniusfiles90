/**
 * Domaine « system » (français) : permissions Android, erreurs système,
 * intégration native, paramètres et analyse.
 */
export default {
  "system.error.unknown": "Erreur inconnue",
  "system.error.fallbackTitle": "Action impossible",
  "system.error.retryHint":
    "Réessayez ; si le problème persiste, vérifiez l'espace disponible et les autorisations.",

  "system.error.accessDenied.title": "Accès au dossier refusé",
  "system.error.accessDenied.hint":
    "Autorisez « Tous les fichiers » pour GeniusFiles dans les réglages Android.",
  "system.error.lowSpace.title": "Espace de stockage insuffisant",
  "system.error.lowSpace.hint": "Libérez de la place avec le Nettoyeur, puis réessayez.",
  "system.error.nameExists.title": "Ce nom existe déjà",
  "system.error.nameExists.hint": "Choisissez un autre nom ou remplacez l'élément existant.",
  "system.error.fileNotFound.title": "Fichier introuvable",
  "system.error.fileNotFound.hint": "Il a peut-être été déplacé ou supprimé. Actualisez la liste.",
  "system.error.fileInUse.title": "Fichier en cours d'utilisation",
  "system.error.fileInUse.hint": "Fermez l'application qui l'utilise, puis réessayez.",
  "system.error.readOnly.title": "Stockage en lecture seule",
  "system.error.readOnly.hint": "Choisissez une destination sur la mémoire interne.",
  "system.error.offline.title": "Connexion indisponible",
  "system.error.offline.hint":
    "Cette action nécessite Internet. Les fonctions locales restent utilisables.",
  "system.error.cancelled.title": "Opération annulée",
  "system.error.nativeOnly.title": "Fonction indisponible ici",
  "system.error.nativeOnly.hint":
    "Cette action nécessite l'application Android installée sur l'appareil.",
  "system.error.invalidName.title": "Nom invalide",
  "system.error.invalidName.hint": "Évitez les caractères « / » et « \\ ».",
  "system.error.passwordProtected.title": "Ce document est protégé par un mot de passe",
  "system.error.passwordProtected.hint": "Saisissez le mot de passe du document, puis réessayez.",
  "system.error.corrupted.title": "Ce fichier semble endommagé",
  "system.error.corrupted.hint":
    "Il ne peut pas être ouvert. Essayez avec une autre copie du fichier.",
  "system.error.unsupportedFormat.title": "Format non pris en charge",
  "system.error.unsupportedFormat.hint":
    "GeniusFiles ne sait pas encore ouvrir ce type de fichier.",
  "system.error.rateLimited.title": "Trop de demandes en peu de temps",
  "system.error.rateLimited.hint": "Patientez quelques instants avant de relancer l'opération.",
  "system.error.tooLarge.title": "Fichier trop volumineux",
  "system.error.tooLarge.hint":
    "Traitez-le en plusieurs parties ou fermez les autres applications, puis réessayez.",

  "system.error.batch.noneFailed_one": "{count} élément {verb}",
  "system.error.batch.noneFailed_other": "{count} éléments {verb}",
  "system.error.batch.allFailed":
    "Aucun élément {verb} — {failed} en échec. Vérifiez les autorisations et l'espace disponible.",
  "system.error.batch.partial_one": "{succeeded} {verb}, {failed} impossible",
  "system.error.batch.partial_other": "{succeeded} {verb}, {failed} impossibles",

  "system.permission.contextualPrompt":
    "Cette action a besoin d'un accès complet à vos fichiers pour les parcourir et les modifier.",
  "system.permission.notGranted": "L'accès à vos fichiers n'est pas encore autorisé.",

  "system.engine.unknownCommand": "Commande inconnue : {type}",
  "system.engine.cancelledBeforeRun": "Commande annulée avant exécution",
  "system.engine.batchCancelled": "Lot interrompu",

  "system.engine.emptyName": "Nom vide",
  "system.engine.pathMissing": "Chemin manquant",
  "system.engine.itemMissing": "Élément manquant",
  "system.engine.parentMissing": "Dossier parent manquant",
  "system.engine.sourceDestRequired": "Source et destination requises",
  "system.engine.noItemsToProcess": "Aucun élément à traiter",
  "system.engine.noItemsToDelete": "Aucun élément à supprimer",
  "system.engine.noItemsToCompress": "Aucun élément à compresser",
  "system.engine.noFileToShare": "Aucun fichier à partager",
  "system.engine.noLocationToAnalyze": "Aucun emplacement à analyser",
  "system.engine.noLocationToBrowse": "Aucun emplacement à parcourir",
  "system.engine.missingEntriesList": "Liste d'entrées manquante",
  "system.engine.archiveNameMissing": "Nom d'archive manquant",
  "system.engine.incompleteExtractParams": "Paramètres d'extraction incomplets",
  "system.engine.onlyFoldersSupported": "Seuls les dossiers sont pris en charge",
  "system.engine.invalidCharsInName": "Le nom ne peut pas contenir « / » ou « \\ »",

  "system.engine.accessDenied": "Accès refusé",
  "system.engine.locationUnavailable": "Emplacement indisponible",
  "system.engine.readFailed": "Lecture impossible",
  "system.engine.createFailed": "Création impossible",
  "system.engine.renameFailed": "Renommage impossible",
  "system.engine.shareFailed": "Partage impossible",
  "system.engine.transferFailed": "Transfert impossible",
  "system.engine.deleteFailed": "Suppression impossible",
  "system.engine.compressFailed": "Compression impossible",
  "system.engine.extractFailed": "Extraction impossible",
  "system.engine.compressCancelled": "Compression annulée",
  "system.engine.extractCancelled": "Extraction annulée",
  "system.engine.deleteCancelled": "Suppression annulée",
  "system.engine.transferCancelled": "Opération annulée",
  "system.engine.stillPresentAfterDelete": "Toujours présent après la suppression",

  "system.native.openFailed.noApp": "Aucune application ne peut ouvrir ce fichier.",
  "system.native.openFailed.notFound": "Ce fichier n'existe plus.",
  "system.native.folderNotFound": "Ce dossier n'existe plus.",
  "system.native.alreadyExists": "Un élément portant ce nom existe déjà.",
  "system.native.unsupportedOperation": "Cette opération n'est pas prise en charge ici.",
  "system.native.storageUnavailable": "Le stockage est momentanément indisponible.",
  "system.native.settingsUnavailable":
    "Impossible d'ouvrir automatiquement les paramètres sur cet appareil. Ouvrez les paramètres de GeniusFiles, puis activez l'accès pour gérer tous les fichiers.",
  "system.native.storagePermissionRequired":
    "Autorisation d'accès au stockage requise pour afficher et gérer vos fichiers.",
  "system.native.installUnavailable":
    "L'installation d'applications n'est disponible que sur Android.",
  "system.native.installNeedsPermission":
    "Android doit d'abord autoriser GeniusFiles à installer des applications.",
  "system.native.installFileMissing": "Ce fichier n'existe plus.",
  "system.native.installInvalidApk": "Ce fichier n'est pas un APK installable.",
  "system.native.noInstallerAvailable":
    "Aucun installateur de paquets n'est disponible sur cet appareil.",
  "system.native.openedFromOtherApp": "Ouverture depuis une autre application…",
  "system.native.receivedFiles_one": "{count} fichier reçu",
  "system.native.receivedFiles_other": "{count} fichiers reçus",
  "system.native.widgetSummary": "{free} libres sur {total}",

  "system.shortcut.search.label": "Recherche",
  "system.shortcut.search.longLabel": "Rechercher un fichier",
  "system.shortcut.cleaner.label": "Nettoyeur",
  "system.shortcut.cleaner.longLabel": "Analyser le stockage",

  "system.backup.invalidJson": "Fichier JSON invalide.",
  "system.backup.notAnExport": "Ce fichier n'est pas un export GeniusFiles.",
  "system.backup.invalidContent": "Contenu invalide.",

  "system.storageAccess.title": "Autoriser l'accès à vos fichiers",
  "system.storageAccess.description":
    "Pour parcourir, ouvrir, copier, déplacer et organiser vos fichiers, GeniusFiles a besoin d'un accès complet à votre stockage.",
  "system.storageAccess.privacyNote":
    "Vos fichiers restent sur votre appareil : rien n'est envoyé ailleurs.",
  "system.storageAccess.later": "Plus tard",
  "system.storageAccess.opening": "Ouverture…",
  "system.storageAccess.allow": "Autoriser l'accès",
  "system.storageAccess.cannotOpenSettings":
    "Impossible d'ouvrir l'écran d'autorisation. Ouvrez les réglages de GeniusFiles pour activer l'accès aux fichiers.",
  "system.storageAccess.enableInAndroid":
    "Activez l'accès dans l'écran Android, puis revenez dans GeniusFiles.",

  "system.analysisProgress.title": "Analyse intelligente",
  "system.analysisProgress.currentLabel_one": "Analyse de « {label} »… ({count} fichier restant)",
  "system.analysisProgress.currentLabel_other":
    "Analyse de « {label} »… ({count} fichiers restants)",
  "system.analysisProgress.pending_one": "Analyse de {count} fichier en attente…",
  "system.analysisProgress.pending_other": "Analyse de {count} fichiers en attente…",
  "system.analysisProgress.done_one": "{count} fichier analysé",
  "system.analysisProgress.done_other": "{count} fichiers analysés",
  "system.analysisProgress.resume.aria": "Reprendre",
  "system.analysisProgress.pause.aria": "Suspendre",
  "system.analysisProgress.cancel.aria": "Annuler",
  "system.analysisProgress.clear": "Effacer",
  "system.analysisProgress.running": "en cours",
  "system.analysisProgress.queued": "en attente",
  "system.analysisProgress.analyzed": "analysés",
  "system.analysisProgress.alreadyKnown": "déjà connus",
  "system.analysisProgress.failed": "en échec",
  "system.analysisProgress.paused": "Suspendu",

  // Ajouts génération automatique (i18n complet)
  "system.accesRefuseParAndroidAutorisezAcces":
    "Accès refusé par Android. Autorisez « Accès à tous les fichiers » dans les paramètres de l'application.",
  "system.apercuDeLEspaceUtiliseDisponible":
    "Aperçu de l'espace utilisé, disponible et par catégorie.",
  "system.ceDossierNExistePlusOu": "Ce dossier n'existe plus ou a été déplacé.",
  "system.contenuDesFichiers": "Contenu des fichiers",
  "system.detectionAvanceeDesDoublonsVisuels": "Détection avancée des doublons visuels",
  "system.dossierIllisibleSurCetAppareil": "Dossier illisible sur cet appareil.",
  "system.dossiersFavoris": "Dossiers favoris",
  "system.espaceRecuperableEtLancementRapideDe":
    "Espace récupérable et lancement rapide de l'analyse.",
  "system.fichierSystemeMasque": "fichier système masqué",
  "system.leNavigateurNePeutPasAcceder":
    "Le navigateur ne peut pas accéder au stockage de l'appareil. Installez l'APK ZarchivAi pour parcourir vos fichiers.",
  "system.memoirePrincipaleDeLAppareil": "Mémoire principale de l'appareil",
  "system.metadonneesAudioVideo": "Métadonnées audio / vidéo",
  "system.ocrImagesDocumentsNumerises": "OCR (images & documents numérisés)",
  "system.ouvertureDirecteDeVosDossiersMarques":
    "Ouverture directe de vos dossiers marqués comme favoris.",
  "system.vosActionsPrefereesSurLEcran": "Vos actions préférées sur l'écran d'accueil du système.",
  "system.native.fileGone": "Ce fichier n'existe plus.",
  "system.native.storagePermission":
    "Autorisation d'accès au stockage requise pour afficher et gérer vos fichiers.",
  "system.native.folderGone": "Ce dossier n'existe plus.",
  "system.native.nameExists": "Un élément portant ce nom existe déjà.",
  "system.native.unsupported": "Cette opération n'est pas prise en charge ici.",
  "system.native.notInstallable": "Ce fichier n'est pas un APK installable.",
  "system.io.previewMissing": "Fichier introuvable (aperçu)",
  "system.io.storageDenied": "Accès au stockage refusé — autorisez « Tous les fichiers ».",
  "system.io.fileExists": "Un fichier du même nom existe déjà.",
  "system.io.destMissing": "Dossier de destination introuvable.",
  "system.io.readFailed": "Lecture impossible",
  "system.io.exportFailed": "Export impossible",
  "system.io.unsupportedFormat": "Format non pris en charge",
  "system.io.notAnExport": "Ce fichier n'est pas un export GeniusFiles.",
  "system.shortcut.search": "Rechercher un fichier",
  "system.shortcut.analyze": "Analyser le stockage",
  "system.cap.text": "Lecture texte / code / CSV",
  "system.cap.pdf": "Extraction texte PDF",
  "system.cap.pdfFallback": "Ouverture dans le Lecteur universel",
  "system.cap.ocrFallback": "Analyse visuelle sans OCR",
  "system.cap.image": "Analyse visuelle & regroupement",
  "system.ai.unknownError": "Erreur inconnue",
  "system.ai.parentUnreadable": "Impossible de lire le dossier parent",
  "system.ai.missingCommandType": "Type de commande manquant",
  "system.ai.missingFolderName": "Nom du dossier manquant",
  "system.ai.renameNamesRequired": "Ancien et nouveau nom requis",
  "system.ai.sourceUnreadable": "Dossier source illisible",
  "system.ai.actionFailed": "Action impossible",
  "storage.internal": "Stockage interne",
  "perso.widget.storage": "Espace de stockage",
  "perso.widget.cleaner": "Nettoyeur intelligent",
  "perso.widget.quickSearch": "Recherche rapide",
  "perso.widget.quickSearchDesc": "Champ de recherche compact toujours accessible.",
  "perso.widget.quickActions": "Actions rapides",
  "meta.audioEditor.title": "Éditeur audio — GeniusFiles",
  "meta.audioEditor.description":
    "Découpez, ajustez le volume, les fondus, la vitesse et exportez vos fichiers audio sans perte.",
  "meta.audioEditor.ogDescription":
    "Éditeur audio non destructif intégré au gestionnaire de fichiers GeniusFiles.",
  "meta.settings.title": "Paramètres — GeniusFiles",
  "meta.settings.description":
    "Réglez l'essentiel de GeniusFiles : thème, langue, stockage, notifications, corbeille et informations sur l'application.",
  "meta.settings.ogDescription": "Les réglages essentiels de GeniusFiles, simples et clairs.",
  "meta.automationHistory.title": "Historique des automatisations — GeniusFiles",
  "meta.automationHistory.description":
    "Consultez les dernières exécutions de vos automatisations GeniusFiles : statut, date, heure et nombre total d'exécutions.",
  "meta.automationHistory.ogDescription":
    "Journal complet des exécutions : réussies, en cours ou en échec.",
  "meta.automations.description":
    "Créez des automatisations fiables : assistant guidé, aperçu clair, exécution réelle des actions sur vos fichiers.",
  "meta.automations.ogDescription":
    "Assistant guidé, aperçu clair, exécution réelle des actions sur vos fichiers.",
  "meta.assistant.description":
    "Discutez naturellement avec Genius AI ou demandez-lui de gérer vos fichiers : recherche, rangement, analyse et automatisations.",
  "meta.assistant.ogDescription":
    "Discutez naturellement avec Genius AI ou demandez-lui de gérer vos fichiers.",
  "meta.vault.description":
    "Protégez vos fichiers sensibles dans un espace privé, verrouillé par code PIN, mot de passe ou biométrie.",
  "meta.vault.ogDescription": "Un espace privé chiffrable, verrouillable, entièrement hors ligne.",
  "meta.trash.description":
    "Retrouvez, prévisualisez et restaurez les fichiers supprimés, ou libérez de l'espace en supprimant définitivement.",
  "meta.trash.ogDescription": "Prévisualisez et restaurez vos fichiers supprimés en un geste.",
  "meta.cleaner.description":
    "Analyse fiable et transparente du stockage : doublons vérifiés, fichiers volumineux, téléchargements anciens, caches et APK inutilisés.",
  "meta.cleaner.ogDescription":
    "Libérez de l'espace en toute confiance : chaque proposition est justifiée et vérifiable avant suppression.",
  "meta.organize.description":
    "Analyse locale du rangement de vos fichiers : recommandations claires, aperçu avant application, renommage intelligent et collections dynamiques.",
  "meta.organize.ogDescription":
    "Comprenez comment vos fichiers sont rangés et améliorez-les en un geste — sans jamais rien perdre.",
  "meta.search.description":
    "Trouvez n'importe quel fichier instantanément — recherche rapide, tolérante aux accents, avec filtres et historique.",
  "meta.apps.description":
    "Applications installées : tailles réelles, permissions, sauvegarde APK, désinstallation et recommandations.",
  "automation.trigger.folderLabel": "Dossier",
  "pdf.tools.pickImage": "Choisir une image (PNG/JPG)",
  "organize.apps.toast.openFailed.title": "Impossible d'ouvrir cette application",
  "organize.apps.toast.shareFailed.title": "Partage impossible",
  "system.ai.unknownStorage": "Stockage inconnu",
  "system.ai.unknownStorageNamed": "Stockage inconnu : {id}",
  "system.ai.unknownTool": "Outil inconnu : {name}",
  "system.ai.unsupportedCommand": "Commande non prise en charge : {type}",
  "system.ai.missingName": "Nom manquant",
  "system.ai.archiveNameRequired": "Nom d'archive requis",
  "system.ai.archiveNameMissing": "Nom d'archive manquant",
  "system.ai.archiveNotFound": "Archive introuvable : {name}",
} as const;
