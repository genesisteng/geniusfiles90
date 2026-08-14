/**
 * Domaine « cleaner » (français) : Nettoyeur intelligent et Corbeille.
 */
export default {
  "cleaner.title": "Nettoyeur",
  "cleaner.subtitle": "Analyse locale · rien n'est supprimé sans votre accord",
  "cleaner.refresh.aria": "Relancer l'analyse",

  "cleaner.stats.reclaimable": "Espace récupérable",
  "cleaner.stats.scanning": "Analyse…",
  "cleaner.stats.ready": "Prêt",
  "cleaner.stats.proposed_one": "{count} élément proposé",
  "cleaner.stats.proposed_other": "{count} éléments proposés",
  "cleaner.stats.foldersRead": "dossiers lus",
  "cleaner.stats.filesRead": "fichiers lus",

  "cleaner.phase.starting": "Préparation de l'analyse…",
  "cleaner.phase.walking": "Lecture du stockage…",
  "cleaner.phase.matching": "Comparaison des doublons…",
  "cleaner.phase.done": "Analyse terminée",

  "cleaner.permission.denied":
    "L'accès complet aux fichiers n'est pas encore accordé. Certaines catégories restent incomplètes tant que l'autorisation n'est pas donnée.",

  "cleaner.issues.count_one": "{count} emplacement n'a pas pu être lu",
  "cleaner.issues.count_other": "{count} emplacements n'ont pas pu être lus",

  "cleaner.categories.title": "Catégories",
  "cleaner.categories.hint": "Passez en revue avant d'agir",

  "cleaner.empty.title": "Rien à nettoyer pour l'instant",
  "cleaner.empty.description":
    "Aucun doublon, cache ou fichier inutile détecté sur cet emplacement. Relancez l'analyse après avoir ajouté des fichiers, ou changez d'emplacement à analyser.",

  "cleaner.category.count_one": "{count} élément",
  "cleaner.category.count_other": "{count} éléments",
  "cleaner.category.safe": "sans risque",
  "cleaner.category.review": "à vérifier",
  "cleaner.category.toFree": "à libérer",

  "cleaner.category.duplicates.label": "Doublons",
  "cleaner.category.duplicates.description":
    "Fichiers de taille identique retrouvés à plusieurs endroits. La copie la plus ancienne est toujours conservée ; seules les copies supplémentaires sont proposées.",
  "cleaner.category.large.label": "Fichiers volumineux",
  "cleaner.category.large.description":
    "Fichiers de plus de {sizeMb} Mo. Rien n'est inutile a priori : ouvrez-les avant de décider.",
  "cleaner.category.old_downloads.label": "Téléchargements anciens",
  "cleaner.category.old_downloads.description":
    "Fichiers du dossier « Téléchargements » inchangés depuis plus de {days} jours. Un fichier ancien n'est pas forcément inutile.",
  "cleaner.category.empty_folders.label": "Dossiers vides",
  "cleaner.category.empty_folders.description":
    "Dossiers ne contenant strictement aucun élément, même caché. Les dossiers standards Android sont préservés.",
  "cleaner.category.temp.label": "Fichiers temporaires",
  "cleaner.category.temp.description":
    "Fichiers de travail situés dans un dossier de cache avéré, ou téléchargements interrompus, au repos depuis plusieurs jours.",
  "cleaner.category.extracted_archives.label": "Archives déjà extraites",
  "cleaner.category.extracted_archives.description":
    "Archives accompagnées d'un dossier du même nom contenant déjà des fichiers : l'archive est redondante.",
  "cleaner.category.apk.label": "Installateurs APK",
  "cleaner.category.apk.description":
    "Fichiers .apk de plus de {days} jours. L'application est probablement déjà installée, mais l'installateur reste réutilisable hors ligne.",
  "cleaner.category.messaging_media.label": "Médias de messagerie",
  "cleaner.category.messaging_media.description":
    "Photos, vidéos et audio reçus via une messagerie. Ces médias peuvent avoir une valeur personnelle : vérifiez-les un par un.",

  "cleaner.reason.emptyFolder": "Aucun élément, même caché",
  "cleaner.reason.cacheUnused": "Fichier de cache inutilisé depuis {days} j",
  "cleaner.reason.interruptedDownload": "Téléchargement interrompu (.{ext}), {days} j",
  "cleaner.reason.editorBackup": "Sauvegarde automatique d'éditeur",
  "cleaner.reason.extractedArchive": "Dossier « {name} » extrait à côté",
  "cleaner.reason.apkKept": "Installateur conservé depuis {days} j",
  "cleaner.reason.messagingMedia": "Média reçu via une messagerie",
  "cleaner.reason.oldDownload": "Inchangé depuis {days} j",
  "cleaner.reason.largeFile": "Occupe {sizeMb} Mo",
  "cleaner.reason.duplicateKeeper": "Copie conservée (la plus ancienne)",
  "cleaner.reason.duplicateContent": "Contenu identique à la copie conservée",
  "cleaner.reason.duplicateSizeName": "Taille et nom identiques à la copie conservée",
  "cleaner.issue.unreadable": "Emplacement illisible (permission ou volume indisponible)",

  "cleaner.selection.count_one": "{count} élément sélectionné",
  "cleaner.selection.count_other": "{count} éléments sélectionnés",
  "cleaner.selection.toFree": "{amount} à libérer · corbeille, restaurable",
  "cleaner.selection.deselect": "Désélectionner",
  "cleaner.selection.clean": "Nettoyer · {amount}",

  "cleaner.progress.title": "Nettoyage en cours",
  "cleaner.progress.preparing": "Préparation du nettoyage…",
  "cleaner.progress.preparingShort": "Préparation…",
  "cleaner.progress.processed_one": "{count} élément sur {total}",
  "cleaner.progress.processed_other": "{count} éléments sur {total}",

  "cleaner.confirm.clean.title": "Lancer le nettoyage ?",
  "cleaner.confirm.clean.desc_one":
    "{count} élément sera supprimé et environ {freed} seront libérés. Seuls les éléments que vous avez cochés sont concernés.",
  "cleaner.confirm.clean.desc_other":
    "{count} éléments seront supprimés et environ {freed} seront libérés. Seuls les éléments que vous avez cochés sont concernés.",
  "cleaner.confirm.clean.confirm": "Nettoyer",

  "cleaner.toast.partial.title": "Nettoyage partiel",
  "cleaner.toast.partial.desc": "{removed} déplacés vers la corbeille, {failed} en échec. {detail}",
  "cleaner.toast.nothing.title": "Rien n'a été supprimé",
  "cleaner.toast.nothing.missing": "{missing} avaient déjà disparu du stockage.",
  "cleaner.toast.nothing.none": "Aucun élément n'a pu être traité.",
  "cleaner.toast.done.title": "Nettoyage terminé",
  "cleaner.toast.done.desc":
    "{freed} libérés — {removed} déplacés vers la corbeille. Vous pouvez les restaurer tant qu'elle n'est pas vidée.",
  "cleaner.toast.failed.title": "Le nettoyage a échoué",
  "cleaner.toast.failed.desc": "Une erreur est survenue pendant le nettoyage.",

  "cleaner.sheet.title.fallback": "Catégorie",
  "cleaner.sheet.noData": "Aucune donnée.",
  "cleaner.sheet.lockedAria": "Copie conservée, non supprimable",
  "cleaner.sheet.selectAria": "Sélectionner {name}",
  "cleaner.sheet.previewAria": "Prévisualiser {name}",
  "cleaner.sheet.safe":
    "Suppression sans risque connu. Les éléments partent vers la corbeille et restent restaurables.",
  "cleaner.sheet.review":
    "À vérifier un par un : appuyez sur une miniature pour ouvrir le fichier avant de le sélectionner.",
  "cleaner.sheet.proposed_one": "{count} proposé",
  "cleaner.sheet.proposed_other": "{count} proposés",
  "cleaner.sheet.recoverable": "{amount} récupérable",
  "cleaner.sheet.emptyCategory": "Rien à proposer dans cette catégorie.",
  "cleaner.sheet.group": "Groupe de {count} copies",

  "cleaner.evidence.content": "Contenu comparé",
  "cleaner.evidence.sizeName": "Taille et nom identiques",
  "cleaner.evidence.location": "Emplacement et âge",
  "cleaner.evidence.measured": "Mesure directe",

  "cleaner.trash.title": "Corbeille",
  "cleaner.trash.selectHint": "Appuyez sur un élément pour l'ajouter ou le retirer",
  "cleaner.trash.noItems": "Aucun élément",
  "cleaner.trash.summary_one": "{count} élément · {size}",
  "cleaner.trash.summary_other": "{count} éléments · {size}",
  "cleaner.trash.search.aria": "Rechercher dans la corbeille",
  "cleaner.trash.moreActions.aria": "Plus d'actions",
  "cleaner.trash.sortBy": "Trier par",
  "cleaner.trash.sort.recent": "Suppression récente",
  "cleaner.trash.sort.name": "Nom (A → Z)",
  "cleaner.trash.sort.size": "Taille (décroissante)",
  "cleaner.trash.emptyAction": "Vider entièrement",
  "cleaner.trash.searchPlaceholder": "Rechercher un élément supprimé…",
  "cleaner.trash.clearSearch.aria": "Effacer la recherche",
  "cleaner.trash.emptyState.searchDesc": "Aucun élément supprimé ne correspond à cette recherche.",
  "cleaner.trash.emptyState.desc":
    "Les fichiers supprimés depuis GeniusFiles apparaîtront ici et pourront être prévisualisés puis restaurés.",
  "cleaner.trash.sortedCount_one": "{count} affiché",
  "cleaner.trash.sortedCount_other": "{count} affichés",
  "cleaner.trash.orphanBadge": "Sans emplacement",
  "cleaner.trash.countdown.permanent": "Conservation permanente",
  "cleaner.trash.countdown.imminent": "Suppression imminente",
  "cleaner.trash.countdown.days_one": "{count} jour restant",
  "cleaner.trash.countdown.days_other": "{count} jours restants",
  "cleaner.trash.countdown.hours": "{count}h restantes",
  "cleaner.trash.item.deselectAria": "Retirer de la sélection",
  "cleaner.trash.item.previewAria": "Prévisualiser {name}",

  "cleaner.trash.preview.unavailable.title": "Aperçu indisponible",
  "cleaner.trash.preview.unavailable.folder": "Restaurez le dossier pour en explorer le contenu.",
  "cleaner.trash.preview.unavailable.file": "Ce fichier ne peut être lu qu'après restauration.",

  "cleaner.trash.restore.success_one": "Élément restauré",
  "cleaner.trash.restore.success_other": "{count} éléments restaurés",
  "cleaner.trash.restore.partial": "{restored} restauré(s), {failed} en échec",

  "cleaner.trash.purge.success_one": "Élément supprimé",
  "cleaner.trash.purge.success_other": "{count} éléments supprimés",
  "cleaner.trash.purge.desc": "Suppression définitive · {freed} libérés.",
  "cleaner.trash.purge.partial": "{deleted} supprimé(s), {failed} en échec",

  "cleaner.trash.emptied.title": "Corbeille vidée",
  "cleaner.trash.emptied.desc_one": "{count} élément supprimé définitivement · {freed} libérés.",
  "cleaner.trash.emptied.desc_other":
    "{count} éléments supprimés définitivement · {freed} libérés.",

  "cleaner.trash.destPicker.title": "Choisir un emplacement de restauration",
  "cleaner.trash.restoreOutcome.title": "Restauration terminée",
  "cleaner.trash.restoreOutcome.summary": "{restored} restauré(s), {failed} en échec.",
  "cleaner.trash.restoreOutcome.reason.parentMissing": "Emplacement absent",
  "cleaner.trash.restoreOutcome.reason.missing": "Introuvable",
  "cleaner.trash.restoreOutcome.reason.noTarget": "Destination inconnue",
  "cleaner.trash.restoreOutcome.reason.failed": "Échec",

  "cleaner.trash.actionUnavailable.title": "Action indisponible depuis la Corbeille",
  "cleaner.trash.actionUnavailable.desc": "Restaurez l'élément pour le modifier.",

  "cleaner.trash.confirm.empty.title": "Vider la corbeille ?",
  "cleaner.trash.confirm.empty.desc_one":
    "{count} élément sera supprimé définitivement de votre appareil. Cette action est irréversible.",
  "cleaner.trash.confirm.empty.desc_other":
    "{count} éléments seront supprimés définitivement de votre appareil. Cette action est irréversible.",
  "cleaner.trash.confirm.empty.confirm": "Vider la corbeille",

  "cleaner.trash.confirm.purge.title_one": "Supprimer définitivement {count} élément ?",
  "cleaner.trash.confirm.purge.title_other": "Supprimer définitivement {count} éléments ?",
  "cleaner.trash.confirm.purge.desc":
    "Cette suppression est définitive : les éléments ne pourront plus être récupérés.",

  "cleaner.trash.confirm.restore.title_one": "Restaurer {count} élément ?",
  "cleaner.trash.confirm.restore.title_other": "Restaurer {count} éléments ?",
  "cleaner.trash.confirm.restore.desc":
    "Les éléments seront replacés à leur emplacement d'origine. Si un fichier du même nom existe déjà, GeniusFiles vous proposera de le renommer.",
} as const;
