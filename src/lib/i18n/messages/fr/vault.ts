/**
 * Coffre-fort (français) : configuration, verrouillage, navigateur de
 * fichiers protégés et réglages du coffre.
 */
export default {
  "vault.title": "Coffre-fort",
  "vault.exit": "Quitter le coffre-fort",
  "vault.loading": "Chargement…",

  "vault.method.pin": "code PIN",
  "vault.method.password": "mot de passe",
  "vault.method.pattern": "schéma",

  "vault.setup.title": "Configurer le coffre-fort",
  "vault.setup.desc":
    "Vos fichiers sensibles restent hors ligne et invisibles dans le reste de GeniusFiles tant qu'ils sont protégés.",
  "vault.setup.done": "Coffre-fort configuré",
  "vault.setup.failed": "Configuration impossible",
  "vault.setup.step.method": "Méthode",
  "vault.setup.step.secret": "Code",
  "vault.setup.step.confirm": "Confirmation",
  "vault.setup.method.pin.label": "Code PIN",
  "vault.setup.method.pin.desc": "4 chiffres minimum — rapide à saisir sur mobile.",
  "vault.setup.method.pattern.label": "Schéma",
  "vault.setup.method.pattern.desc": "Reliez au moins 4 points sur une grille 3×3.",
  "vault.setup.method.password.label": "Mot de passe",
  "vault.setup.method.password.desc": "6 caractères minimum — pour un maximum de robustesse.",
  "vault.setup.secret.pattern.label": "Dessinez votre schéma",
  "vault.setup.secret.choose": "Choisissez votre {method}",
  "vault.setup.pattern.recorded": "Schéma enregistré ({count} points)",
  "vault.setup.pattern.hint": "Reliez au moins 4 points sans lever le doigt.",
  "vault.setup.hint.pin": "4 chiffres minimum. Évitez les suites évidentes comme 0000 ou 1234.",
  "vault.setup.hint.password": "6 caractères minimum. Mélangez lettres, chiffres et symboles.",
  "vault.setup.confirm.label": "Confirmez votre {method}",
  "vault.setup.mismatch": "Les valeurs ne correspondent pas.",
  "vault.setup.activate": "Activer le coffre-fort",

  "vault.biometric.label": "Déverrouillage biométrique",
  "vault.biometric.reason": "Déverrouiller le coffre-fort",
  "vault.biometric.useCode": "Utiliser le code",
  "vault.biometric.status.available":
    "Utiliser votre empreinte digitale ou votre visage comme raccourci.",
  "vault.biometric.status.none_enrolled":
    "Aucune empreinte enregistrée — ajoutez-en une dans les réglages Android.",
  "vault.biometric.status.no_hardware":
    "Cet appareil n'a pas de capteur biométrique — le code reste requis.",
  "vault.biometric.status.hw_unavailable":
    "Capteur biométrique momentanément indisponible — réessayez plus tard.",
  "vault.biometric.status.security_update_required":
    "Une mise à jour de sécurité Android est nécessaire pour la biométrie.",
  "vault.biometric.status.unsupported":
    "Biométrie non prise en charge par cette version d'Android.",
  "vault.biometric.status.lockout":
    "Trop de tentatives — la biométrie est temporairement bloquée par Android.",
  "vault.biometric.status.cancelled": "Authentification biométrique annulée.",
  "vault.biometric.status.failed": "Authentification biométrique échouée — utilisez votre code.",
  "vault.biometric.status.web": "Disponible uniquement dans l'application Android.",
  "vault.biometric.status.unknown": "Statut biométrique inconnu — le code reste requis.",

  "vault.auth.error.oldCode": "Ancien code incorrect",
  "vault.auth.error.notFound": "Coffre-fort introuvable",

  "vault.lock.title": "Coffre-fort verrouillé",
  "vault.lock.subtitle.pattern": "Dessinez votre schéma pour déverrouiller.",
  "vault.lock.subtitle.secret": "Saisissez votre {method} pour déverrouiller.",
  "vault.lock.error.pattern": "Schéma incorrect",
  "vault.lock.error.code": "Code incorrect",
  "vault.lock.verifying": "Vérification…",
  "vault.lock.unlock": "Déverrouiller",
  "vault.lock.useBiometric": "Utiliser la biométrie",
  "vault.lock.attempts_one":
    "{count} tentative échouée. Prenez votre temps — aucune donnée n'est envoyée.",
  "vault.lock.attempts_other":
    "{count} tentatives échouées. Prenez votre temps — aucune donnée n'est envoyée.",
  "vault.lock.forgot": "J'ai oublié mon code",

  "vault.reset.title": "Réinitialiser le coffre-fort",
  "vault.reset.descBefore": "Cette action supprimera",
  "vault.reset.descBold": "définitivement",
  "vault.reset.descAfter":
    "tous les fichiers du coffre-fort et vos réglages d'accès. Aucune récupération n'est possible.",
  "vault.reset.confirmAll": "Tout effacer",
  "vault.reset.done": "Coffre-fort réinitialisé",

  "vault.settings.aria": "Paramètres du coffre-fort",
  "vault.settings.title": "Paramètres du coffre-fort",
  "vault.settings.autoLock.label": "Verrouillage automatique",
  "vault.settings.background.label": "Verrouiller en arrière-plan",
  "vault.settings.background.desc":
    "Ferme le coffre-fort dès que GeniusFiles passe en arrière-plan.",

  "vault.autoLock.30s": "30 secondes",
  "vault.autoLock.1m": "1 minute",
  "vault.autoLock.5m": "5 minutes",
  "vault.autoLock.15m": "15 minutes",
  "vault.autoLock.30m": "30 minutes",
  "vault.autoLock.never": "Jamais",

  "vault.wipe.confirmTitle": "Tout effacer ?",
  "vault.wipe.confirmDesc":
    "Cette action supprime définitivement tout le contenu du coffre-fort et le code d'accès.",
  "vault.wipe.confirmCta": "Réinitialiser",

  "vault.usage.summary_one": "{count} élément · {size}",
  "vault.usage.summary_other": "{count} éléments · {size}",
  "vault.restore.title": "Restaurer",

  "vault.lockAria": "Verrouiller le coffre-fort",
  "vault.banner.title": "Espace privé chiffré",
  "vault.banner.refreshing": " · actualisation…",

  "vault.search.placeholder": "Rechercher dans le coffre-fort…",
  "vault.search.clearAria": "Effacer la recherche",

  "vault.filter.all": "Tous",
  "vault.filter.favorites": "Favoris ({count})",

  "vault.empty.title": "Coffre-fort vide",
  "vault.empty.desc":
    "Ajoutez des fichiers sensibles pour les chiffrer et les masquer du reste de l'application. Ils resteront sur cet appareil.",
  "vault.empty.searchHint": "Essayez un autre terme, ou vérifiez l'orthographe.",
  "vault.empty.favoritesHint":
    "Marquez un fichier du coffre-fort d'une étoile pour le retrouver ici.",

  "vault.add.cta": "Ajouter des fichiers",
  "vault.add.aria": "Ajouter au coffre-fort",
  "vault.add.encrypting_one": "Chiffrement de {count} fichier…",
  "vault.add.encrypting_other": "Chiffrement de {count} fichiers…",
  "vault.add.success_one": "{count} fichier protégé dans le coffre-fort",
  "vault.add.success_other": "{count} fichiers protégés dans le coffre-fort",
  "vault.add.failed.one":
    "« {name} » n'a pas pu être protégé — réessayez, ou vérifiez l'espace disponible.",
  "vault.add.failed.many_one":
    "{count} fichier n'a pas pu être protégé — réessayez, ou vérifiez l'espace disponible.",
  "vault.add.failed.many_other":
    "{count} fichiers n'ont pas pu être protégés — réessayez, ou vérifiez l'espace disponible.",

  "vault.section.folders": "Dossiers",
  "vault.section.results": "Résultats",
  "vault.section.favorites": "Favoris",
  "vault.section.files": "Fichiers",

  "vault.folder.new.title": "Nouveau dossier",
  "vault.folder.new.label": "Nom du dossier",
  "vault.folder.new.cta": "Créer",
  "vault.folder.rename.title": "Renommer le dossier",
  "vault.folder.rename.label": "Nouveau nom",
  "vault.folder.renameAria": "Renommer {name}",
  "vault.folder.deleteAria": "Supprimer {name}",
  "vault.folder.privateLabel": "Dossier privé",
  "vault.folder.create.done": "Dossier créé",
  "vault.folder.create.error":
    "Impossible de créer ce dossier — ce nom est peut-être déjà utilisé.",
  "vault.folder.rename.error":
    "Impossible de renommer ce dossier — ce nom est peut-être déjà utilisé.",
  "vault.folder.delete.done": "Dossier supprimé",
  "vault.folder.delete.error":
    "Ce dossier n'est pas vide — déplacez ou supprimez son contenu d'abord.",

  "vault.move.prompt":
    "Déplacer vers un dossier existant du coffre-fort (laisser vide pour la racine)",
  "vault.move.root": "Déplacé à la racine",
  "vault.move.into": "Déplacé dans « {name} »",
  "vault.action.impossible": "Impossible",

  "vault.restore.progress": "Restauration",
  "vault.restore.success_one": "{count} élément restauré à leur emplacement d'origine",
  "vault.restore.success_other": "{count} éléments restaurés à leur emplacement d'origine",
  "vault.restore.failed_one":
    "{count} élément n'a pas pu être restauré — vérifiez l'espace disponible et réessayez.",
  "vault.restore.failed_other":
    "{count} éléments n'ont pas pu être restaurés — vérifiez l'espace disponible et réessayez.",
  "vault.restore.where_one": "Où souhaitez-vous restaurer cet élément ?",
  "vault.restore.where_other": "Où souhaitez-vous restaurer ces éléments ?",
  "vault.restore.original.label": "Emplacement d'origine",
  "vault.restore.original.desc":
    "Retour à l'endroit où se trouvaient les fichiers avant protection.",
  "vault.restore.choose.label": "Choisir un emplacement…",
  "vault.restore.choose.desc": "Restaurer dans un dossier public de votre appareil.",
  "vault.restore.destinationTitle": "Restaurer vers…",

  "vault.delete.success_one": "Élément supprimé définitivement",
  "vault.delete.success_other": "{count} éléments supprimés définitivement",
  "vault.delete.confirmTitle": "Supprimer définitivement ?",
  "vault.delete.confirmDescBefore": "Cette opération supprime pour de bon",
  "vault.delete.confirmDescAfter": "du coffre-fort. Aucune restauration ne sera possible.",
  "vault.delete.target.one": "« {name} »",
  "vault.delete.target.many": "{count} élément(s)",

  "vault.item.actionsAria": "Actions",
  "vault.item.favoriteAdd": "Ajouter aux favoris",
  "vault.item.favoriteRemove": "Retirer des favoris",
  "vault.item.moveTo": "Déplacer dans un dossier…",
  "vault.item.restoreEllipsis": "Restaurer…",
  "vault.item.addedOn": "Ajouté {date}",
  "vault.item.favoriteAria": "Favori",

  "vault.selection.exitAria": "Quitter la sélection",

  "vault.sort.date": "Date d'ajout",
  "vault.sort.name": "Nom",
  "vault.sort.size": "Taille",
  "vault.sort.type": "Type",

  "vault.preview.subtitle": "{size} · Coffre-fort",
  "vault.preview.noDirPreview": "Aperçu de dossier non disponible",
  "vault.preview.webOnly":
    "Aperçu disponible sur appareil. Le contenu réel se charge côté mobile pour préserver la confidentialité.",
  "vault.preview.unsupported": "Aperçu non disponible pour ce format.",
  "vault.preview.unavailable": "Aperçu indisponible",
  "vault.preview.unreadable": "Fichier non lisible",

  "vault.pattern.grid": "Grille de schéma",

  "vault.error.invalidName": "Nom invalide",
  "vault.error.nameExists": "Ce nom existe déjà",
  "vault.error.folderNotFound": "Dossier introuvable",
  "vault.error.folderNotEmpty": "Le dossier n'est pas vide",
  "vault.error.pluginUnavailable": "Plugin indisponible",
  "vault.error.locationNotFound": "Emplacement introuvable",
  "vault.error.fileNotFound": "Fichier introuvable",
  "vault.error.originUnknown": "Emplacement d'origine inconnu",
  "vault.error.destNotFound": "Dossier de destination introuvable",
} as const;
