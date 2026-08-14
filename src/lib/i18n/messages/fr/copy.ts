/**
 * Vocabulaire du domaine « copy » : messages de confirmation, états vides
 * illustrés, écran de diagnostic clavier et page introuvable.
 */
export default {
  // Confirmations avant action sensible (src/lib/copy/index.ts)
  "copy.confirm.moveToTrash.title_one": "Supprimer {count} fichier ?",
  "copy.confirm.moveToTrash.title_other": "Supprimer {count} fichiers ?",
  "copy.confirm.moveToTrash.description_one":
    "Ce fichier sera déplacé vers la corbeille. Vous pourrez le restaurer tant que la corbeille n'est pas vidée.",
  "copy.confirm.moveToTrash.description_other":
    "Ces fichiers seront déplacés vers la corbeille. Vous pourrez les restaurer tant que la corbeille n'est pas vidée.",
  "copy.confirm.moveToTrash.confirmLabel": "Déplacer vers la corbeille",

  "copy.confirm.deleteForever.title_one": "Supprimer définitivement {count} élément ?",
  "copy.confirm.deleteForever.title_other": "Supprimer définitivement {count} éléments ?",
  "copy.confirm.deleteForever.description":
    "Cette suppression est définitive : les éléments ne pourront plus être récupérés.",
  "copy.confirm.deleteForever.confirmLabel": "Supprimer définitivement",

  "copy.confirm.emptyTrash.title": "Vider la corbeille ?",
  "copy.confirm.emptyTrash.description_one":
    "{count} élément sera supprimé définitivement de votre appareil. Cette action est irréversible.",
  "copy.confirm.emptyTrash.description_other":
    "{count} éléments seront supprimés définitivement de votre appareil. Cette action est irréversible.",
  "copy.confirm.emptyTrash.confirmLabel": "Vider la corbeille",

  "copy.confirm.move.title_one": "Déplacer {count} élément ?",
  "copy.confirm.move.title_other": "Déplacer {count} éléments ?",
  "copy.confirm.move.description_one":
    "Cet élément sera retiré de son emplacement actuel et placé dans « {destination} ».",
  "copy.confirm.move.description_other":
    "Ces éléments seront retirés de leur emplacement actuel et placés dans « {destination} ».",
  "copy.confirm.move.confirmLabel": "Déplacer",

  "copy.confirm.encrypt.title_one": "Placer {count} fichier dans le coffre-fort ?",
  "copy.confirm.encrypt.title_other": "Placer {count} fichiers dans le coffre-fort ?",
  "copy.confirm.encrypt.description":
    "Les fichiers seront chiffrés et n'apparaîtront plus dans la galerie ni dans les autres applications. Seul votre code du coffre-fort permettra de les rouvrir.",
  "copy.confirm.encrypt.confirmLabel": "Chiffrer et déplacer",

  "copy.confirm.restore.title_one": "Restaurer {count} élément ?",
  "copy.confirm.restore.title_other": "Restaurer {count} éléments ?",
  "copy.confirm.restore.description":
    "Les éléments seront replacés à leur emplacement d'origine. Si un fichier du même nom existe déjà, GeniusFiles vous proposera de le renommer.",
  "copy.confirm.restore.confirmLabel": "Restaurer",

  "copy.confirm.clean.title": "Lancer le nettoyage ?",
  "copy.confirm.clean.description_one":
    "{count} élément sera supprimé et environ {freed} seront libérés. Seuls les éléments que vous avez cochés sont concernés.",
  "copy.confirm.clean.description_other":
    "{count} éléments seront supprimés et environ {freed} seront libérés. Seuls les éléments que vous avez cochés sont concernés.",
  "copy.confirm.clean.confirmLabel": "Nettoyer",

  "copy.confirm.overwriteFile.title": "Remplacer « {name} » ?",
  "copy.confirm.overwriteFile.description":
    "Un fichier porte déjà ce nom à cet emplacement. Il sera définitivement remplacé par le nouveau fichier.",
  "copy.confirm.overwriteFile.confirmLabel": "Remplacer",

  "copy.confirm.deletePages.title_one": "Supprimer {count} page ?",
  "copy.confirm.deletePages.title_other": "Supprimer {count} pages ?",
  "copy.confirm.deletePages.description_one":
    "Cette page sera retirée du nouveau PDF créé. Le fichier d'origine reste inchangé.",
  "copy.confirm.deletePages.description_other":
    "Ces pages seront retirées du nouveau PDF créé. Le fichier d'origine reste inchangé.",
  "copy.confirm.deletePages.confirmLabel": "Supprimer",

  "copy.confirm.runAutomation.title": "Exécuter « {name} » ?",
  "copy.confirm.runAutomation.description":
    "GeniusFiles appliquera cette règle maintenant à vos fichiers. Vous verrez le détail des modifications à la fin.",
  "copy.confirm.runAutomation.confirmLabel": "Exécuter maintenant",

  // Vocabulaire commun (jonction de listes)
  "copy.joinList.and": "et",

  // États vides illustrés (src/lib/copy/empty-illustrations.ts)
  "copy.empty.files.title": "Aucun fichier",
  "copy.empty.files.description": "Il n'y a rien à afficher ici pour le moment.",
  "copy.empty.documents.title": "Aucun document",
  "copy.empty.documents.description": "Vos documents apparaîtront ici dès qu'il y en aura.",
  "copy.empty.images.title": "Aucune image",
  "copy.empty.images.description": "Vos photos et images apparaîtront ici.",
  "copy.empty.videos.title": "Aucune vidéo",
  "copy.empty.videos.description": "Vos vidéos apparaîtront ici dès qu'il y en aura.",
  "copy.empty.audio.title": "Aucune musique",
  "copy.empty.audio.description": "Vos musiques et enregistrements apparaîtront ici.",
  "copy.empty.downloads.title": "Aucun téléchargement",
  "copy.empty.downloads.description": "Les fichiers que vous téléchargez apparaîtront ici.",
  "copy.empty.favorites.title": "Aucun favori",
  "copy.empty.favorites.description": "Marquez un fichier d'une étoile pour le retrouver ici.",
  "copy.empty.trash.title": "Corbeille vide",
  "copy.empty.trash.description":
    "Les éléments supprimés apparaîtront ici avant leur effacement définitif.",
  "copy.empty.search.title": "Aucun résultat",
  "copy.empty.search.description": "Essayez un autre mot-clé ou ajustez vos filtres.",
  "copy.empty.folder.title": "Dossier vide",
  "copy.empty.folder.description": "Ce dossier ne contient encore aucun élément.",
  "copy.empty.storage.title": "Stockage inaccessible",
  "copy.empty.storage.description": "Impossible d'accéder à cet emplacement de stockage.",
  "copy.empty.permission.title": "Permission refusée",
  "copy.empty.permission.description": "Autorisez GeniusFiles à accéder à vos fichiers.",
  "copy.empty.network.title": "Erreur réseau",
  "copy.empty.network.description": "Vérifiez votre connexion Internet puis réessayez.",
  "copy.empty.notFound.title": "Fichier introuvable",
  "copy.empty.notFound.description": "Ce fichier n'existe plus ou a été déplacé.",
  "copy.empty.openFailed.title": "Ouverture impossible",
  "copy.empty.openFailed.description": "Impossible d'ouvrir ce fichier.",
  "copy.empty.lowSpace.title": "Mémoire insuffisante",
  "copy.empty.lowSpace.description":
    "L'espace disponible est insuffisant pour terminer cette opération. Libérez de l'espace puis réessayez.",
  "copy.empty.unknownError.title": "Erreur inconnue",
  "copy.empty.unknownError.description":
    "Une erreur inattendue s'est produite. Veuillez réessayer dans quelques instants.",
  "copy.empty.operationFailed.title": "Échec de l'opération",
  "copy.empty.operationFailed.description":
    "L'action demandée n'a pas pu être exécutée. Vérifiez les informations puis réessayez.",

  // Libellés des actions d'états illustrés
  "copy.emptyAction.retry": "Réessayer",
  "copy.emptyAction.allow": "Autoriser",
  "copy.emptyAction.back": "Retour",
  "copy.emptyAction.openWith": "Choisir une autre application",
  "copy.emptyAction.freeSpace": "Libérer de l'espace",

  // État hors connexion du chat
  "copy.chatOffline.title": "Aucune connexion Internet",
  "copy.chatOffline.description":
    "Impossible d'envoyer votre message pour le moment. Vérifiez votre connexion puis réessayez.",
  "copy.chatOffline.retry": "Réessayer",

  // Page introuvable (src/routes/__root.tsx)
  "copy.notFound.title": "Page introuvable",
  "copy.notFound.description": "Cette page n'existe pas ou a été déplacée.",
  "copy.notFound.backHome": "Retour à l'accueil",

  // Écran de diagnostic clavier (src/routes/diagnostic-clavier.tsx)
  "copy.keyboardDiag.title": "Test du clavier",
  "copy.keyboardDiag.subtitle":
    "Vérifiez que le clavier Android réagit correctement selon le type de champ",
  "copy.keyboardDiag.preset.text": "Texte (nom de dossier, renommage)",
  "copy.keyboardDiag.preset.search": "Recherche",
  "copy.keyboardDiag.preset.sentence": "Conversation (notes, commentaires)",
  "copy.keyboardDiag.preset.words": "Nom propre / titre court",
  "copy.keyboardDiag.preset.multiline": "Commentaire multiligne",
  "copy.keyboardDiag.preset.password": "Mot de passe (comparaison)",
  "copy.keyboardDiag.fieldTypeLabel": "Type de champ",
  "copy.keyboardDiag.testFieldLabel": "Champ de test",
  "copy.keyboardDiag.placeholder": "Tapez ici pour tester le clavier…",
  "copy.keyboardDiag.expectedBehavior": "Comportement attendu pour ce champ",
  "copy.keyboardDiag.row.fieldType": "Type de champ",
  "copy.keyboardDiag.row.autoCorrect": "Correction automatique",
  "copy.keyboardDiag.row.autoCorrect.on": "activée",
  "copy.keyboardDiag.row.autoCorrect.off": "désactivée",
  "copy.keyboardDiag.row.autoCapitalize": "Majuscule automatique",
  "copy.keyboardDiag.row.autoCapitalize.on": "activée",
  "copy.keyboardDiag.row.autoCapitalize.off": "désactivée",
  "copy.keyboardDiag.row.suggestions": "Suggestions attendues",
  "copy.keyboardDiag.row.yes": "oui",
  "copy.keyboardDiag.row.no": "non",
  "copy.keyboardDiag.row.detectedLanguage": "Langue détectée",
  "copy.keyboardDiag.row.notDetected": "non détectée",
  "copy.keyboardDiag.row.activeField": "Champ actif",
  "copy.keyboardDiag.row.typedChars": "Caractères saisis",
  "copy.keyboardDiag.activityTitle": "Activité du clavier",
  "copy.keyboardDiag.clear": "Vider",
  "copy.keyboardDiag.noEvents": "Aucun événement pour le moment.",
  "copy.keyboardDiag.hint":
    "Astuce : si les suggestions ou la majuscule automatique ne s'affichent pas sur cet écran, le problème vient du clavier système lui-même (paramètres Gboard/SwiftKey), pas de l'application.",
  "copy.keyboardDiag.event.focus": "focus",
  "copy.keyboardDiag.event.blur": "blur",
  "copy.keyboardDiag.event.keydown": 'keydown "{key}"',
  "copy.keyboardDiag.event.compositionStart": "saisie en cours (clavier prédictif actif)",
  "copy.keyboardDiag.event.compositionEnd": 'compositionend "{data}"',
  "copy.keyboardDiag.event.beforeInput": 'beforeinput {inputType} "{data}"',
  // Unités comptables (src/lib/copy/index.ts)
  "copy.unit.file_one": "fichier",
  "copy.unit.file_other": "fichiers",
  "copy.unit.folder_one": "dossier",
  "copy.unit.folder_other": "dossiers",
  "copy.unit.item_one": "élément",
  "copy.unit.item_other": "éléments",
  "copy.unit.video_one": "vidéo",
  "copy.unit.video_other": "vidéos",
  "copy.unit.photo_one": "photo",
  "copy.unit.photo_other": "photos",
  "copy.unit.song_one": "chanson",
  "copy.unit.song_other": "chansons",
  "copy.unit.action_one": "action",
  "copy.unit.action_other": "actions",
  "copy.unit.page_one": "page",
  "copy.unit.page_other": "pages",
  "copy.unit.result_one": "résultat",
  "copy.unit.result_other": "résultats",
  "copy.unit.app_one": "application",
  "copy.unit.app_other": "applications",

  // Progression et résumés d'action
  "copy.progress.withDone": "{action} de {done} sur {total}…",
  "copy.progress.total": "{action} de {total}…",
  "copy.progress.ongoing": "{action} en cours…",
  "copy.summary.detail": "{base}.",
  "copy.summary.detailTo": "{base} vers {destination}.",
} as const;
