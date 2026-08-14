/**
 * Accueil : salutation, stockages, catégories, outils, fichiers récents
 * et actions du gestionnaire de fichiers exposées depuis cet écran.
 */
export default {
  "home.greeting.night": "Bonne nuit",
  "home.greeting.morning": "Bonjour",
  "home.greeting.afternoon": "Bon après-midi",
  "home.greeting.evening": "Bonsoir",
  "home.subtitle.default": "Gérez vos fichiers plus rapidement.",
  "home.subtitle.pick": "Accédez au stockage ou aux catégories ci-dessous pour sélectionner.",

  "home.title.files": "Fichiers",

  "home.section.categories": "Catégories",
  "home.section.tools": "Outils",

  "home.category.documents": "Documents",
  "home.category.images": "Images",
  "home.category.videos": "Vidéos",
  "home.category.audio": "Musiques",
  "home.category.downloads": "Téléchargements",
  "home.category.apps": "Applications",

  "home.tool.cleaner": "Nettoyeur",
  "home.tool.pdfTools": "Outils PDF",
  "home.tool.vault": "Coffre-fort",
  "home.tool.imageEditor": "Éditeur d'images",
  "home.tool.audioEditor": "Éditeur audio",
  "home.tool.trash": "Corbeille",

  "home.editorPicker.audioTitle": "Sélectionnez un fichier audio à modifier",
  "home.editorPicker.imageTitle": "Sélectionnez une image à modifier",

  "home.pickHowTo.aria": "Comment sélectionner",
  "home.pickHowTo.title": "Comment sélectionner ?",
  "home.pickHowTo.step1": "Accédez à un stockage ou à une catégorie.",
  "home.pickHowTo.step2Multi": "Touchez chaque fichier à ajouter à votre sélection.",
  "home.pickHowTo.step2Single": "Touchez le fichier voulu pour le sélectionner.",
  "home.pickHowTo.step3": "Touchez son icône pour le prévisualiser ou l'ouvrir.",
  "home.pickHowTo.step4": "Terminez avec « Valider », ou « Annuler » pour revenir.",

  "home.folder.newTitle": "Nouveau dossier",
  "home.folder.nameLabel": "Nom du dossier",
  "home.folder.createCta": "Créer",
  "home.folder.created": "Dossier créé",
  "home.folder.createFailed": "Création impossible",

  "home.rename.title": "Renommer",
  "home.rename.nameLabel": "Nouveau nom",
  "home.rename.cta": "Renommer",
  "home.rename.done": "Renommé",
  "home.rename.failed": "Renommage impossible",

  "home.destination.copyTitle": "Copier vers…",
  "home.destination.moveTitle": "Déplacer vers…",

  "home.transfer.rootLabel": "Racine du stockage",
  "home.transfer.cancelled": "Opération annulée",
  "home.transfer.cancelledDetail": "{count} {unit}(s) traité(s) avant l'annulation.",
  "home.transfer.copyLabel": "Copie",
  "home.transfer.moveLabel": "Déplacement",
  "home.transfer.toLabel": "Vers « {dest} »",
  "home.transfer.mixedResult": "{succeeded} réussi(s), {failed} échec(s)",

  "home.delete.label": "Suppression",
  "home.delete.subtitle": "Déplacement vers la Corbeille",
  "home.delete.cancelledWithCount": "Suppression annulée — {count} {unit} déjà déplacé(s)",
  "home.delete.cancelled": "Suppression annulée",
  "home.delete.doneSingle": "« {name} » déplacé dans la Corbeille",
  "home.delete.doneMultiple": "{count} {unit}s déplacés dans la Corbeille",
  "home.delete.failed": "{count} suppression(s) impossible(s)",

  "home.share.failed": "Partage impossible",

  "home.archive.creatingTitle": "Création de l'archive…",
  "home.archive.creatingSubtitle": "Compression des éléments sélectionnés",
  "home.archive.cancelled": "Compression annulée",
  "home.archive.created": "Archive créée",
  "home.archive.createdWithSize": "Archive créée · {size}",
  "home.archive.failed": "Compression impossible",

  "home.extract.title": "Extraction en cours…",
  "home.extract.subtitle": "Décompression dans le dossier courant",
  "home.extract.cancelled": "Extraction annulée",
  "home.extract.done": "Extraction terminée ({count})",
  "home.extract.failed": "Extraction impossible",

  "home.editor.fileNotFound": "Fichier introuvable",
  "home.editor.fileNotFoundDesc": "Son emplacement n'est plus accessible.",
  "home.editor.fileGone": "« {name} » n'est plus disponible",

  "home.recent.aria": "Fichiers récents",
  "home.recent.title": "Fichiers récents",
  "home.recent.viewMore": "Voir plus",
  "home.recent.empty": "Les nouveaux fichiers ajoutés à votre stockage apparaîtront ici.",

  "home.storage.aria": "Stockages",
  "home.storage.title": "Stockages",
  "home.storage.internal": "Stockage interne",
  "home.storage.usb": "Périphérique USB",
  "home.storage.sd": "Carte SD",
  "home.storage.readingSpace": "Lecture de l'espace…",
  "home.storage.usage": "{used} / {total} · {free} libres",
  "home.storage.open": "Ouvrir {label}",

  "home.scopePicker.label": "Stockage",
  "home.scopePicker.all": "Tous",

  "home.confirm.working": "Un instant…",

  "home.exit.title": "Quitter GeniusFiles ?",
  "home.exit.description":
    "Toutes les tâches en cours sont terminées. Vous pouvez rouvrir l'application à tout moment, vos dossiers et réglages seront restaurés.",
  "home.exit.confirm": "Quitter",

  "home.resume.kind.copy": "Copie",
  "home.resume.kind.move": "Déplacement",
  "home.resume.kind.compress": "Compression",
  "home.resume.kind.extract": "Extraction",
  "home.resume.kind.clean": "Nettoyage",
  "home.resume.kind.delete": "Suppression",
  "home.resume.title": "Opérations à reprendre",
  "home.resume.resuming": "Reprise de la {kind} en cours…",
  "home.resume.progress": "Interrompue à {pct} % — {done} sur {total} traités",
  "home.resume.unknownTotal": "un nombre inconnu d'éléments",
  "home.resume.resume": "Reprendre",
  "home.resume.dismiss": "Ignorer",

  "home.states.noResultsDesc": "Essayez un autre mot ou modifiez les filtres.",
  "home.states.errorDesc": "Impossible d'afficher ce contenu pour le moment.",

  "home.nav.aria": "Navigation principale",
} as const;
