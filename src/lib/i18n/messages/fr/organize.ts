/**
 * Organisation intelligente + Gestionnaire d'applications (français).
 *
 * Les libellés de catégories du classifieur (`classifier.ts`) et les
 * segments de dossiers suggérés ne sont volontairement PAS ici : ils
 * servent aussi de noms de dossiers réels créés sur l'appareil et ne
 * doivent jamais changer avec la langue (sous peine d'orphelins).
 */
export default {
  "organize.title": "Organisation intelligente",
  "organize.subtitle": "Analyse locale de votre rangement. Aucune modification sans votre accord.",
  "organize.action.rescan": "Relancer l'analyse",
  "organize.stat.reorganizable": "Réorganisable",
  "organize.stat.recommendations": "Recommandations",
  "organize.stat.scannedFiles": "Fichiers analysés",
  "organize.action.smartRename": "Renommage intelligent",
  "organize.section.recommendations": "Recommandations",
  "organize.section.recommendationsHint": "Chaque action explique son intérêt.",
  "organize.scanning": "Analyse de votre rangement en cours…",
  "organize.empty.title": "Votre rangement est déjà clair",
  "organize.empty.desc":
    "Aucune amélioration à vous proposer pour l'instant. Relancez l'analyse après avoir ajouté de nouveaux fichiers.",
  "organize.section.distribution": "Distribution actuelle",
  "organize.section.distributionHint": "Top catégories de votre stockage.",
  "organize.section.collections": "Collections dynamiques",
  "organize.section.collectionsHint": "Vues virtuelles — n'altèrent aucun fichier.",
  "organize.preview.defaultTitle": "Aperçu",
  "organize.preview.computing": "Calcul de l'aperçu…",
  "organize.confirm.title": "Appliquer ce rangement ?",
  "organize.confirm.desc":
    "{summary} Vous pourrez tout annuler depuis l'historique ou la corbeille.",
  "organize.progress.title": "Rangement en cours",
  "organize.progress.preparing": "Préparation du rangement…",
  "organize.collection.defaultTitle": "Collection",
  "organize.collection.searching": "Recherche des fichiers correspondants…",
  "organize.collection.empty":
    "Aucun fichier ne correspond à cette collection pour l'instant. Elle se remplira automatiquement dès que des fichiers correspondants apparaîtront.",
  "organize.collection.limited": "Aperçu limité aux 200 premiers résultats sur {total}.",
  "organize.rec.why": "Pourquoi ?",

  "organize.toast.scanFailed.title": "L'analyse du rangement a échoué",
  "organize.toast.scanFailed.desc": "Impossible d'analyser vos fichiers pour le moment.",
  "organize.toast.previewFailed.title": "Aperçu indisponible",
  "organize.toast.previewFailed.desc": "Impossible de préparer l'aperçu de ce rangement.",
  "organize.toast.interrupted.title": "Rangement interrompu",
  "organize.toast.interrupted.desc": "Aucune autre modification ne sera appliquée.",
  "organize.toast.done.title": "Rangement terminé",
  "organize.toast.done.desc_one":
    "{count} action appliquée. Vous pouvez tout annuler depuis l'historique.",
  "organize.toast.done.desc_other":
    "{count} actions appliquées. Vous pouvez tout annuler depuis l'historique.",
  "organize.toast.partial.title": "Rangement partiel",
  "organize.toast.partial.applied_one": "{count} action appliquée",
  "organize.toast.partial.applied_other": "{count} actions appliquées",
  "organize.toast.partial.failed_one": "{count} échec",
  "organize.toast.partial.failed_other": "{count} échecs",
  "organize.toast.applyFailed.title": "Le rangement a échoué",
  "organize.toast.applyFailed.desc": "Impossible d'appliquer ce rangement pour le moment.",
  "organize.toast.noRename.title": "Aucun renommage à proposer",
  "organize.toast.noRename.desc":
    "Les noms de vos fichiers sont déjà clairs, rien à améliorer ici.",

  "organize.rename.planTitle": "Renommage intelligent",
  "organize.rename.planDesc_one": "{count} fichier",
  "organize.rename.planDesc_other": "{count} fichiers",
  "organize.rename.hint":
    "Proposez, corrigez, décochez : rien n'est renommé tant que vous n'appliquez pas.",
  "organize.rename.applyCount": "Appliquer ({count})",
  "organize.rename.resetAria": "Réinitialiser",
  "organize.rename.checkboxAria": "Renommer {name}",
  "organize.rename.empty": "Aucune proposition — les noms actuels sont déjà lisibles.",

  "organize.plan.noActions": "Aucune action à appliquer.",
  "organize.plan.summary_one": "{count} action sera appliquée sur vos fichiers.",
  "organize.plan.summary_other": "{count} actions seront appliquées sur vos fichiers.",
  "organize.plan.none": "Aucune action ne sera appliquée.",
  "organize.count.renames_one": "{count} renommage",
  "organize.count.renames_other": "{count} renommages",
  "organize.count.moves_one": "{count} déplacement",
  "organize.count.moves_other": "{count} déplacements",
  "organize.count.groups_one": "{count} regroupement",
  "organize.count.groups_other": "{count} regroupements",
  "organize.count.archives_one": "{count} archivage",
  "organize.count.archives_other": "{count} archivages",

  "organize.preview.noChangesGlobal": "Ce rangement n'entraîne aucune modification visible.",
  "organize.preview.createdFolders": "Dossiers créés",
  "organize.preview.noChangesNode": "Aucun changement.",

  "organize.rec.messyTitle": "Ranger « {folder} » par catégorie",
  "organize.rec.messyWhy":
    "{detail} Regrouper les fichiers similaires facilite la recherche et le partage.",
  "organize.rec.cta.preview": "Prévisualiser",
  "organize.rec.messyPlanTitle": "Réorganiser {folder}",
  "organize.rec.messyPlanDesc":
    "Créer un sous-dossier par catégorie détectée et y déplacer les fichiers correspondants.",
  "organize.action.groupReason_one":
    "Regrouper le fichier « {catId} » dans un sous-dossier « {catLabel} ».",
  "organize.action.groupReason_other":
    "Regrouper les {count} fichiers « {catId} » dans un sous-dossier « {catLabel} ».",
  "organize.rec.overloadedTitle": "Alléger « {folder} »",
  "organize.rec.overloadedWhy":
    "{detail} Un dossier de moins de 80 fichiers reste rapide à parcourir.",
  "organize.rec.cta.openFolder": "Ouvrir le dossier",
  "organize.rec.overloadedPlanDesc":
    "Sélectionner des groupes de fichiers à déplacer manuellement.",
  "organize.rec.misplacedTitle": "Déplacer des fichiers hors sujet de « {folder} »",
  "organize.rec.misplacedWhy":
    "{detail} Chaque fichier est plus facile à retrouver quand il est rangé dans un dossier cohérent.",
  "organize.action.moveReason": "Déplacer vers {category} — plus adapté au contenu.",
  "organize.rec.misplacedPlanTitle_one": "Déplacer {count} fichier",
  "organize.rec.misplacedPlanTitle_other": "Déplacer {count} fichiers",
  "organize.rec.misplacedPlanDesc": "Déplace les fichiers vers un dossier plus adapté à leur type.",
  "organize.rec.unclearTitle_one": "Renommer {count} fichier générique",
  "organize.rec.unclearTitle_other": "Renommer {count} fichiers génériques",
  "organize.rec.unclearWhy": "{detail} Un nom clair permet de retrouver un fichier sans l'ouvrir.",
  "organize.rec.cta.renamePreview": "Aperçu du renommage",
  "organize.rec.unclearPlanDesc": "Propose des noms lisibles.",
  "organize.rec.isolatedTitle_one": "Regrouper {count} fichier « {category} »",
  "organize.rec.isolatedTitle_other": "Regrouper {count} fichiers « {category} »",
  "organize.rec.isolatedWhy":
    "{detail} Un sous-dossier dédié rend l'ensemble immédiatement visible.",
  "organize.rec.isolatedPlanTitle": "Créer « {category} »",
  "organize.rec.isolatedPlanDesc": "Crée un sous-dossier dédié et y déplace les fichiers.",
  "organize.action.isolatedReason_one": "Sous-dossier « {category} » pour {count} fichier.",
  "organize.action.isolatedReason_other": "Sous-dossier « {category} » pour {count} fichiers.",
  "organize.rec.hardTitle": "Réorganisation globale recommandée",
  "organize.rec.hardWhy":
    "{detail} Un rangement par catégorie majeure réduit la friction au quotidien.",
  "organize.rec.cta.priorities": "Voir les priorités",
  "organize.rec.hardPlanTitle": "Réorganisation globale",
  "organize.rec.hardPlanDesc": "Un survol des actions les plus impactantes.",
  "organize.rec.summaryTitle": "Environ {size} mieux organisable",
  "organize.rec.summaryWhy":
    "Cette estimation additionne l'espace concerné par les recommandations ci-dessous.",
  "organize.rec.cta.seeRecs": "Voir les recommandations",
  "organize.rec.summaryPlanTitle": "Aperçu",
  "organize.rec.summaryPlanDesc": "Récapitulatif du potentiel d'organisation.",

  "organize.scanner.root": "Racine",
  "organize.scanner.overloadedDetail_one":
    "{count} fichier dans ce dossier — il devient difficile à parcourir.",
  "organize.scanner.overloadedDetail_other":
    "{count} fichiers dans ce dossier — il devient difficile à parcourir.",
  "organize.scanner.messyDetail":
    "Mélange de {count} types de fichiers — un rangement par catégorie améliorera la navigation.",
  "organize.scanner.misplacedDetail_one": "{count} fichier hors sujet pour un dossier {kind}.",
  "organize.scanner.misplacedDetail_other": "{count} fichiers hors sujet pour un dossier {kind}.",
  "organize.scanner.unclearDetail_one": "{count} fichier porte un nom peu explicite.",
  "organize.scanner.unclearDetail_other": "{count} fichiers portent des noms peu explicites.",
  "organize.scanner.isolatedDetail_one":
    "{count} fichier « {category} » isolé — regroupez-le dans un sous-dossier dédié.",
  "organize.scanner.isolatedDetail_other":
    "{count} fichiers « {category} » isolés — regroupez-les dans un sous-dossier dédié.",
  "organize.scanner.hardDetail":
    "Plusieurs dossiers sont volumineux. Une réorganisation globale est recommandée.",
  "organize.kind.audio": "audio",
  "organize.kind.video": "vidéo",
  "organize.kind.image": "image",

  "organize.renamer.artistTitle": "Titre et artiste détectés dans les métadonnées.",
  "organize.renamer.titleOnly": "Titre détecté dans les métadonnées.",
  "organize.renamer.docType": "Type de document détecté : {type}.",
  "organize.renamer.receipt": "Reçu détecté sur l'image.",
  "organize.renamer.invoice": "Facture détectée sur l'image.",
  "organize.renamer.businessCard": "Carte de visite détectée.",
  "organize.renamer.screenshot": "Capture d'écran détectée.",
  "organize.renamer.document": "Document numérisé détecté.",
  "organize.renamer.genericName": "Nom générique remplacé par un intitulé lisible.",
  "organize.renamer.receiptName": "Recu {date}",
  "organize.renamer.invoiceName": "Facture {date}",
  "organize.renamer.businessCardName": "Carte de visite {date}",
  "organize.renamer.screenshotName": "Capture {date}",
  "organize.renamer.documentName": "Document scanné {date}",
  "organize.renamer.photoName": "Photo {date}",
  "organize.renamer.videoName": "Vidéo {date}",
  "organize.renamer.fileName": "Fichier {date}",

  "organize.apps.title": "Applications",
  "organize.apps.subtitleLoading": "Analyse de vos applications…",
  "organize.apps.count_one": "{count} application",
  "organize.apps.count_other": "{count} applications",
  "organize.apps.refreshAria": "Actualiser la liste",
  "organize.apps.sectionAll": "Toutes les applications",
  "organize.apps.searchPlaceholder": "Rechercher une application…",
  "organize.apps.clearSearchAria": "Effacer la recherche",
  "organize.apps.filter.user": "Utilisateur",
  "organize.apps.filter.system": "Système",
  "organize.apps.filter.all": "Toutes",
  "organize.apps.sortAria": "Trier : {label}",
  "organize.apps.layoutGridAria": "Affichage en grille",
  "organize.apps.layoutListAria": "Affichage en liste",
  "organize.apps.pluginError.title": "Liste des applications indisponible",
  "organize.apps.pluginError.desc":
    "GeniusFiles n'a pas pu lire les applications installées sur cet appareil. Fermez puis rouvrez l'application, ou réessayez dans un instant.",
  "organize.apps.emptySearch.title": "Aucune application ne correspond",
  "organize.apps.emptyNone.title": "Aucune application à afficher",
  "organize.apps.emptySearch.desc":
    "Essayez un autre nom, ou changez de filtre pour inclure les applications système.",
  "organize.apps.emptyNone.desc":
    "Changez de filtre pour afficher les applications système ou toutes les applications.",
  "organize.apps.sectionRecommendations": "Recommandations",
  "organize.apps.sectionRecommendationsHint": "Informations, aucune action automatique",
  "organize.apps.sort.name": "Nom",
  "organize.apps.sort.size": "Taille",
  "organize.apps.sort.installed": "Installation",
  "organize.apps.sort.updated": "Mise à jour",
  "organize.apps.sort.used": "Dernière utilisation",
  "organize.apps.badgeSystem": "Système",
  "organize.apps.sortBy": "Trier par",
  "organize.apps.sortActive": "Actif",
  "organize.apps.usage.grantTitle": "Afficher les tailles réelles",
  "organize.apps.usage.descPartial":
    "Vos applications sont listées. L'accès Android aux données d'utilisation ajoute la taille réelle (code, données, cache) et la dernière ouverture.",
  "organize.apps.usage.descFull":
    "L'accès Android aux données d'utilisation permet de calculer la taille réelle de chaque application et de repérer celles que vous n'ouvrez plus.",
  "organize.apps.usage.opening": "Ouverture…",
  "organize.apps.usage.openSettings": "Ouvrir les paramètres",
  "organize.apps.usage.recheck": "J'ai accordé l'autorisation — réessayer",
  "organize.apps.usage.toast":
    "Activez « GeniusFiles » dans « Accès aux données d'utilisation », puis revenez ici.",
  "organize.apps.usage.available": "Tailles réelles et dernière utilisation disponibles.",
  "organize.apps.usage.unavailable":
    "Tailles estimées : l'accès aux données d'utilisation n'est pas encore accordé.",
  "organize.apps.stats.totalLabel": "Espace occupé",
  "organize.apps.stats.totalCount": "{count} au total",
  "organize.apps.stats.user": "utilisateur",
  "organize.apps.stats.system": "système",
  "organize.apps.stats.userCount": "{count} utilisateur",
  "organize.apps.stats.systemCount": "{count} système",
  "organize.apps.reclaimable": "Jusqu'à {size} récupérables",
  "organize.apps.reclaimableDesc":
    "En archivant les applications rarement utilisées ou en vidant les caches volumineux. Aucune suppression automatique.",
  "organize.apps.unusedTitle": "Rarement utilisées",
  "organize.apps.heavyTitle": "Applications volumineuses",
  "organize.apps.recEmpty":
    "Rien à signaler pour le moment. GeniusFiles surveille l'usage et l'espace occupé.",

  "organize.apps.detail.type": "Type",
  "organize.apps.detail.typeSystem": "Système",
  "organize.apps.detail.typeUser": "Utilisateur",
  "organize.apps.detail.state": "État",
  "organize.apps.detail.enabled": "Activée",
  "organize.apps.detail.disabled": "Désactivée",
  "organize.apps.detail.installed": "Installée",
  "organize.apps.detail.updated": "Mise à jour",
  "organize.apps.detail.totalSize": "Taille totale",
  "organize.apps.detail.apk": "APK",
  "organize.apps.detail.data": "Données",
  "organize.apps.detail.cache": "Cache",
  "organize.apps.detail.targetSdk": "Cible SDK",
  "organize.apps.detail.lastUsed": "Dernière ouverture",
  "organize.apps.detail.location": "Emplacement",
  "organize.apps.action.open": "Ouvrir",
  "organize.apps.action.systemInfo": "Infos système",
  "organize.apps.action.share": "Partager",
  "organize.apps.action.backup": "Sauvegarder APK",
  "organize.apps.action.backingUp": "Sauvegarde…",
  "organize.apps.action.permissions": "Permissions",
  "organize.apps.action.storage": "Stockage",
  "organize.apps.permissions.title": "Permissions accordées",
  "organize.apps.permissions.loading": "Chargement…",
  "organize.apps.permissions.none": "Aucune permission dangereuse accordée.",
  "organize.apps.permissions.moreDeclared":
    "{count} autres permissions déclarées mais non accordées.",
  "organize.apps.storage.title": "Activité de stockage",
  "organize.apps.storage.loading": "Chargement…",
  "organize.apps.storage.unavailable": "Détail par catégorie indisponible sur cet appareil.",
  "organize.apps.storage.app": "Application",
  "organize.apps.storage.data": "Données",
  "organize.apps.storage.cache": "Cache",
  "organize.apps.storage.total": "Total",
  "organize.apps.uninstall": "Désinstaller",
  "organize.apps.systemNotice":
    "Cette application fait partie du système Android : elle ne peut pas être désinstallée.",

  "organize.apps.toast.openFailed.title": "Impossible d'ouvrir cette application",
  "organize.apps.toast.openFailed.desc":
    "Elle est peut-être désactivée sur votre appareil. Vérifiez-la dans les réglages Android.",
  "organize.apps.toast.settingsFailed.title":
    "Impossible d'ouvrir les réglages de cette application",
  "organize.apps.toast.settingsFailed.desc":
    "Ouvrez Réglages Android › Applications, puis sélectionnez cette application.",
  "organize.apps.toast.shareFailed.title": "Partage impossible",
  "organize.apps.toast.shareFailed.desc":
    "Aucune application de partage n'est disponible sur cet appareil.",
  "organize.apps.toast.backupDone.title": "Sauvegarde terminée",
  "organize.apps.toast.backupDone.desc":
    "Une copie de « {name} » ({size}) a été enregistrée dans vos fichiers.",
  "organize.apps.toast.backupFailed.title": "Sauvegarde impossible",
  "organize.apps.toast.backupFailed.desc":
    "Vérifiez l'espace disponible sur votre appareil, puis réessayez.",
  "organize.apps.confirm.backupTitle": "Sauvegarder « {name} » ?",
  "organize.apps.confirm.backupDesc":
    "Une copie de l'application sera enregistrée dans vos fichiers. Elle vous permettra de la réinstaller plus tard, même sans connexion.",
  "organize.apps.confirm.backupConfirm": "Sauvegarder",
  "organize.apps.systemUninstall.title": "Cette application fait partie du système",
  "organize.apps.systemUninstall.desc":
    "Android ne permet pas de la désinstaller. Vous pouvez la désactiver depuis les réglages.",
  "organize.apps.confirm.uninstallTitle": "Désinstaller « {name} » ?",
  "organize.apps.confirm.uninstallDesc":
    "L'application et ses données seront retirées de votre appareil. Android vous demandera une dernière confirmation.",
  "organize.apps.confirm.uninstallConfirm": "Désinstaller",
  "organize.apps.toast.uninstallFailed.title": "Désinstallation impossible",
  "organize.apps.toast.uninstallFailed.desc":
    "Cette application ne peut pas être retirée depuis GeniusFiles. Essayez depuis les réglages Android.",
  "organize.apps.share.template":
    "{name}\nVersion : {version} ({code})\nTaille : {size}\nInstallée le : {installed}\nMise à jour le : {updated}",
  "organize.apps.backupUnavailable": "Indisponible sur cette plateforme",

  // Ajouts génération automatique (i18n complet)
  "organize.capturesDEcran": "Captures d'écran",
  "organize.documentsNumerises": "Documents numérisés",
} as const;
