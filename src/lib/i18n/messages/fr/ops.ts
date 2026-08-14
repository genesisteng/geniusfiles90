/**
 * Services et moteurs fichiers (opérations, corbeille, transferts,
 * archives, sélection, recommandations, tâches). Messages destinés à
 * l'utilisateur uniquement — identifiants techniques et logs exclus.
 */
export default {
  // Erreurs génériques d'opérations sur le stockage.
  "ops.error.invalidName": "Nom invalide",
  "ops.error.pluginUnavailable": "Plugin indisponible",
  "ops.error.createFailed": "Création impossible",
  "ops.error.renameFailed": "Renommage impossible",
  "ops.error.nameExists": "Ce nom existe déjà",
  "ops.error.deleteFailed": "Suppression impossible",
  "ops.error.copyFailed": "Copie impossible",
  "ops.error.accessDenied": "Accès au stockage refusé",
  "ops.error.notFound": "Élément introuvable (déjà supprimé ou déplacé)",
  "ops.error.notADirectory": "Dossier de destination invalide",
  "ops.error.noSpace": "Espace de stockage insuffisant",
  "ops.error.unsupported": "Opération non prise en charge par ce stockage",
  "ops.error.storageUnavailable": "Stockage indisponible",
  "ops.error.destinationMissing": "Destination introuvable",
  "ops.error.alreadyExists": "Existe déjà",
  "ops.error.alreadyExistsAtDestination": "Existe déjà à destination",
  "ops.error.moveUnconfirmed": "Déplacement non confirmé par le stockage",
  "ops.error.copyUnconfirmedSourceKept": "Copie non confirmée — source conservée",
  "ops.error.transferUnconfirmed": "Transfert non confirmé par le stockage",
  "ops.error.itemInaccessible": "Élément inaccessible ou verrouillé",
  "ops.error.deleteFailedStillPresent": "Suppression impossible — élément toujours présent",
  "ops.error.shareNoFiles":
    "Sélectionnez au moins un fichier (les dossiers ne peuvent pas être partagés).",
  "ops.error.shareFailed": "Partage impossible",
  "ops.error.parentMissing": "Dossier parent introuvable",
  "ops.error.parentMissingParams": "Dossier parent manquant",
  "ops.error.emptyName": "Nom vide",
  "ops.error.nameForbiddenChars": "Le nom ne peut pas contenir « / » ou « \\ »",
  "ops.error.foldersOnly": "Seuls les dossiers sont pris en charge",
  "ops.error.noItemsToDelete": "Aucun élément à supprimer",
  "ops.error.noItemsToProcess": "Aucun élément à traiter",
  "ops.error.sourceAndDestinationRequired": "Source et destination requises",
  "ops.error.pathMissing": "Chemin manquant",
  "ops.error.accessDeniedRead": "Accès refusé",
  "ops.error.locationUnavailable": "Emplacement indisponible",
  "ops.error.readFailed": "Lecture impossible",
  "ops.error.noLocationToAnalyze": "Aucun emplacement à analyser",
  "ops.error.noLocationToSearch": "Aucun emplacement à parcourir",
  "ops.error.noFileToShare": "Aucun fichier à partager",
  "ops.error.missingEntryList": "Liste d'entrées manquante",
  "ops.error.unknownCommand": "Commande inconnue : {type}",
  "ops.error.commandCancelledBeforeRun": "Commande annulée avant exécution",
  "ops.error.batchInterrupted": "Lot interrompu",
  "ops.error.deleteCancelled": "Suppression annulée",
  "ops.error.transferCancelled": "Opération annulée",
  "ops.error.transferFailed": "Transfert impossible",
  "ops.error.organizeCancelled": "Rangement annulé",
  "ops.error.organizeFolderReadFailed": "Impossible de lire le dossier à ranger",
  "ops.error.unknownRule": "Règle inconnue",
  "ops.error.folderMissing": "Dossier manquant",

  // Archives.
  "ops.error.archiveFormatUnsupportedRead": "Format non pris en charge pour la lecture",
  "ops.error.archiveFormatUnsupported": "Format non pris en charge",
  "ops.error.archiveReadFailed": "Lecture impossible",
  "ops.error.archiveNameExists": "Une archive du même nom existe déjà",
  "ops.error.archiveNameMissing": "Nom d'archive manquant",
  "ops.error.noItemsToCompress": "Aucun élément à compresser",
  "ops.error.extractParamsIncomplete": "Paramètres d'extraction incomplets",
  "ops.error.compressCancelled": "Compression annulée",
  "ops.error.compressFailed": "Compression impossible",
  "ops.error.extractCancelled": "Extraction annulée",
  "ops.error.extractFailed": "Extraction impossible",
  "ops.archive.createSummary": "Archive « {name} » créée ({count} élément(s))",
  "ops.archive.extractSummary": "Extraction de « {name} » ({count} élément(s))",

  // Créer / renommer.
  "ops.mkdir.summary": "Nouveau dossier « {name} »",
  "ops.rename.summary": "« {from} » renommé en « {to} »",

  // Suppression / corbeille.
  "ops.delete.summary_one": "« {name} » déplacé dans la Corbeille",
  "ops.delete.summary_other": "{count} éléments déplacés dans la Corbeille",
  "ops.trash.restoreSummary_one": "Restauré « {name} »",
  "ops.trash.restoreSummary_other": "{count} éléments restaurés depuis la Corbeille",
  "ops.trash.permanentDeleteSummary_one": "Suppression définitive de « {name} »",
  "ops.trash.permanentDeleteSummary_other": "{count} éléments supprimés définitivement",
  "ops.trash.emptiedSummary": "Corbeille vidée ({count})",

  // Copier / déplacer.
  "ops.transfer.copySummary_one": "Copié « {name} »",
  "ops.transfer.copySummary_other": "Copie de {count} éléments",
  "ops.transfer.moveSummary_one": "Déplacé « {name} »",
  "ops.transfer.moveSummary_other": "Déplacement de {count} éléments",
  "ops.transfer.copyDone": "Copie terminée",
  "ops.transfer.moveDone": "Déplacement terminé",
  "ops.transfer.copyCancelled": "Copie annulée",
  "ops.transfer.moveCancelled": "Déplacement annulé",
  "ops.transfer.copyIncomplete": "Copie incomplète",
  "ops.transfer.moveIncomplete": "Déplacement incomplet",
  "ops.transfer.summary": "{count} élément(s) {verb}",
  "ops.transfer.verbCopied": "copié(s)",
  "ops.transfer.verbMoved": "déplacé(s)",
  "ops.transfer.failuresCount": "{count} échec(s)",
  "ops.transfer.duration": "en {time}",

  // Partage.
  "ops.share.summary_one": "Partage de « {name} »",
  "ops.share.summary_other": "Partage de {count} fichiers",

  // Session de sélection (pick).
  "ops.pick.selectFolders": "Sélectionnez vos dossiers",
  "ops.pick.selectFolder": "Sélectionnez un dossier",
  "ops.pick.selectItems": "Sélectionnez vos éléments",
  "ops.pick.selectItem": "Sélectionnez un élément",
  "ops.pick.selectFiles": "Sélectionnez vos fichiers",
  "ops.pick.selectFile": "Sélectionnez un fichier",

  // Menu "Plus" de la sélection.
  "ops.selection.moveToVault": "Déplacer vers le dossier sécurisé",
  "ops.selection.openAs": "Ouvrir en tant que",
  "ops.selection.properties": "Propriétés",
  "ops.selection.cut": "Couper",
  "ops.selection.pin": "Épingler en haut",
  "ops.selection.unpin": "Désépingler d'en haut",
  "ops.selection.hide": "Masquer",
  "ops.selection.addToHome": "Ajouter à l'écran d'accueil",
  "ops.selection.exit": "Quitter la sélection",
  "ops.selection.range": "Intervalle",
  "ops.selection.ariaLabel": "Actions de sélection",

  // Catégories.
  "ops.categories.images": "Images",
  "ops.categories.videos": "Vidéos",
  "ops.categories.audio": "Musique",
  "ops.categories.documents": "Documents",
  "ops.categories.downloads": "Téléchargements",
  "ops.categories.archives": "Archives",
  "ops.categories.code": "Code",
  "ops.categories.apk": "Applications",
  "ops.categories.fonts": "Polices",
  "ops.categories.other": "Autres",

  // Recommandations du tableau de bord.
  "ops.recommendations.storageCritical.title": "Stockage presque plein",
  "ops.recommendations.storageCritical.desc":
    "Il ne reste que {free} libres sur {total}. Libérez de l'espace pour préserver les performances de votre téléphone.",
  "ops.recommendations.storageCritical.cta": "Libérer",
  "ops.recommendations.storageWarn.title": "Stockage bien rempli",
  "ops.recommendations.storageWarn.desc":
    "{percent}% du stockage est utilisé. Un nettoyage préventif est recommandé.",
  "ops.recommendations.storageWarn.cta": "Analyser",
  "ops.recommendations.trendDown.title": "Espace libre en baisse",
  "ops.recommendations.trendDown.desc":
    "Vous avez utilisé environ {size} sur les derniers jours. Vérifiez ce qui prend de la place.",
  "ops.recommendations.trendDown.cta": "Voir la répartition",
  "ops.recommendations.apk.title_one": "{count} fichier d'installation (APK)",
  "ops.recommendations.apk.title_other": "{count} fichiers d'installation (APK)",
  "ops.recommendations.apk.desc":
    "{size} occupés par des APK. Supprimez ceux que vous n'utilisez plus après installation.",
  "ops.recommendations.apk.cta": "Ouvrir",
  "ops.recommendations.archive.title": "Archives volumineuses",
  "ops.recommendations.archive.desc":
    "{size} d'archives détectées. Décompressez celles dont vous avez besoin et supprimez les autres.",
  "ops.recommendations.video.title": "Vidéos volumineuses",
  "ops.recommendations.video.desc":
    "Vos vidéos représentent {size}. Envisagez de déplacer les plus anciennes vers la carte SD ou un disque externe pour libérer de la place.",
  "ops.recommendations.trashLarge.title": "La Corbeille prend de la place",
  "ops.recommendations.trashLarge.desc_one":
    "{size} sont conservés dans la Corbeille ({count} élément). Videz-la pour récupérer immédiatement cet espace.",
  "ops.recommendations.trashLarge.desc_other":
    "{size} sont conservés dans la Corbeille ({count} éléments). Videz-la pour récupérer immédiatement cet espace.",
  "ops.recommendations.trashLarge.cta": "Ouvrir la Corbeille",
  "ops.recommendations.allGood.title": "Tout est en ordre",
  "ops.recommendations.allGood.desc":
    "Aucune action prioritaire détectée. Le tableau de bord vous alertera dès qu'une optimisation sera pertinente.",

  // Tâches longues (journal + notifications).
  "ops.jobs.copy": "Copie en cours",
  "ops.jobs.move": "Déplacement en cours",
  "ops.jobs.compress": "Compression en cours",
  "ops.jobs.extract": "Extraction en cours",
  "ops.jobs.clean": "Nettoyage en cours",
  "ops.jobs.delete": "Suppression en cours",
  "ops.jobs.remaining": "reste {time}",
  "ops.jobs.itemsProcessed": "{count} élément(s) traité(s)",
  "ops.jobs.failuresCount": "{count} échec(s)",
  "ops.time.seconds": "{count} s",
  "ops.time.minutes": "{count} min",
  "ops.time.hoursMinutes": "{hours} h {minutes} min",

  // Fenêtre de progression.
  "ops.progress.hide": "Masquer",
  "ops.progress.cancel": "Annuler",
  "ops.progress.cancelling": "Annulation…",
  "ops.progress.phase.cancelling": "Annulation…",
  "ops.progress.phase.preparing": "Préparation…",
  "ops.progress.phase.finalizing": "Finalisation…",
  "ops.progress.phase.running": "En cours",
  "ops.progress.analyzing": "Analyse des éléments sélectionnés…",
  "ops.progress.items": "{count}/{total} éléments",
  "ops.progress.remaining": "Reste ~{time}",
  "ops.progress.hideHint":
    "« Masquer » n'interrompt rien : le transfert continue en arrière-plan, même si vous quittez GeniusFiles.",
} as const;
