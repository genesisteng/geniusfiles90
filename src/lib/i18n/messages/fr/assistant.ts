/**
 * Genius AI — messages de l'écran assistant, du tiroir de conversations,
 * de la pipeline d'exécution et des diagnostics associés.
 */
export default {
  "assistant.header.menuLabel": "Ouvrir le menu des conversations",
  "assistant.header.title": "Genius AI",
  "assistant.header.newChat": "Nouvelle conversation",

  "assistant.input.placeholder": "Écrivez votre demande…",
  "assistant.input.ariaLabel": "Message",
  "assistant.input.stop": "Arrêter la réponse",
  "assistant.input.send": "Envoyer",

  "assistant.error.title": "Genius AI n'a pas pu s'afficher",
  "assistant.error.desc":
    "Une conversation enregistrée semble illisible. Vous pouvez réessayer ou repartir d'une nouvelle conversation.",

  "assistant.welcome.title": "Bienvenue dans Genius AI",
  "assistant.welcome.desc":
    "Discutez naturellement avec votre assistant et gérez vos fichiers par simple conversation.",
  "assistant.welcome.privacyTitle": "Confidentialité garantie",
  "assistant.welcome.privacy1": "Vos fichiers restent exclusivement sur votre appareil.",
  "assistant.welcome.privacy2":
    "Genius AI ne consulte jamais directement votre stockage. Il comprend simplement votre demande et la transmet au moteur d'exécution local de GeniusFiles, qui réalise les actions demandées.",
  "assistant.welcome.privacy3":
    "Aucun fichier n'est envoyé vers un serveur ou une intelligence artificielle externe.",

  "assistant.message.copied": "Copié",
  "assistant.message.copy": "Copier",
  "assistant.message.copyAria": "Copier le message",
  "assistant.message.copiedAria": "Message copié",

  "assistant.templates.ariaLabel": "Suggestions",
  "assistant.templates.classifyPhotos": "Classe toutes les photos par année puis par mois.",
  "assistant.templates.moveLargeVideos":
    "Déplace toutes les vidéos de plus de 500 Mo vers un dossier Vidéos volumineuses.",
  "assistant.templates.findRecentPdfs":
    "Recherche tous les PDF modifiés durant les 30 derniers jours.",
  "assistant.templates.biggestFolders":
    "Affiche les dossiers occupant le plus d'espace sur le stockage interne.",
  "assistant.templates.weekVideos": "Recherche toutes les vidéos enregistrées cette semaine.",
  "assistant.templates.sortDownloads": "Range le dossier Téléchargements par type de fichier.",
  "assistant.templates.renamePhotosByDate":
    "Renomme toutes les images en utilisant leur date de prise de vue.",
  "assistant.templates.archiveWorkDocs":
    "Déplace tous les documents de travail dans un dossier Archives.",
  "assistant.templates.findUnusedFiles": "Trouve les fichiers inutilisés depuis plus de deux ans.",
  "assistant.templates.analyzeStorage":
    "Analyse tout mon stockage et explique ce qui occupe le plus d'espace.",
  "assistant.templates.listShortAudio": "Liste tous les fichiers audio de moins de deux minutes.",
  "assistant.templates.todayScreenshots":
    "Recherche toutes les captures d'écran prises aujourd'hui.",
  "assistant.templates.compressDocuments": "Compresse le dossier Documents dans une archive ZIP.",
  "assistant.templates.countPdfs": "Combien de fichiers PDF ai-je sur mon téléphone ?",

  "assistant.drawer.ariaLabel": "Menu Genius AI",
  "assistant.drawer.closeAria": "Fermer le menu",
  "assistant.drawer.title": "Conversations",
  "assistant.drawer.newChat": "Nouveau chat",
  "assistant.drawer.searchPlaceholder": "Rechercher une conversation…",
  "assistant.drawer.searchAria": "Rechercher une conversation",
  "assistant.drawer.emptySearch": "Aucune conversation ne correspond à cette recherche.",
  "assistant.drawer.emptyAll":
    "Aucune conversation pour l'instant. Écrivez à Genius AI pour en commencer une.",
  "assistant.drawer.today": "Aujourd'hui",
  "assistant.drawer.yesterday": "Hier",
  "assistant.drawer.last7": "7 derniers jours",
  "assistant.drawer.last30": "30 derniers jours",
  "assistant.drawer.older": "Plus ancien",
  "assistant.drawer.renameAria": "Renommer {title}",
  "assistant.drawer.deleteAria": "Supprimer {title}",
  "assistant.drawer.renameLabel": "Nouveau nom",
  "assistant.drawer.defaultTitle": "Nouvelle conversation",

  "assistant.pipeline.ariaLabel": "Genius AI : {label}",
  "assistant.pipeline.understand": "Compréhension",
  "assistant.pipeline.plan": "Analyse",
  "assistant.pipeline.execute": "Exécution",
  "assistant.pipeline.verify": "Vérification",
  "assistant.pipeline.respond": "Rédaction de la réponse",

  "assistant.stage.list_storage_roots": "Lecture des emplacements…",
  "assistant.stage.list": "Lecture de vos dossiers…",
  "assistant.stage.search": "Recherche des fichiers…",
  "assistant.stage.analyze": "Analyse du stockage…",
  "assistant.stage.properties": "Lecture des informations…",
  "assistant.stage.create": "Création du dossier…",
  "assistant.stage.rename": "Renommage en cours…",
  "assistant.stage.delete": "Suppression en cours…",
  "assistant.stage.copy": "Copie des fichiers…",
  "assistant.stage.move": "Déplacement des fichiers…",
  "assistant.stage.organize": "Rangement des fichiers…",
  "assistant.stage.compress": "Compression en cours…",
  "assistant.stage.extract": "Extraction en cours…",
  "assistant.stage.share": "Préparation du partage…",
  "assistant.stage.sort": "Tri des fichiers…",
  "assistant.stage.filter": "Filtrage des fichiers…",
  "assistant.stage.default": "Le moteur d'exécution traite votre demande…",
  "assistant.stage.searchProgress_one": "Recherche des fichiers… {count} trouvé",
  "assistant.stage.searchProgress_other": "Recherche des fichiers… {count} trouvés",
  "assistant.stage.analyzeProgress_one": "Analyse du stockage… {count} élément lu",
  "assistant.stage.analyzeProgress_other": "Analyse du stockage… {count} éléments lus",
  "assistant.stage.batchProgressTotal": "{base} {processed} / {total}…",
  "assistant.stage.batchProgressCount": "{base} {processed}…",

  "assistant.diag.offline":
    "Aucune connexion Internet — Genius AI a besoin du réseau pour comprendre votre demande.",
  "assistant.diag.network":
    "Impossible de joindre Genius AI. Vérifiez votre connexion Internet, puis relancez la demande.",
  "assistant.diag.timeout": "Genius AI met trop de temps à répondre. Relancez la demande.",
  "assistant.diag.config":
    "Genius AI n'est pas correctement configuré sur ce serveur (service IA indisponible côté application).",
  "assistant.diag.rateLimit":
    "Trop de demandes envoyées coup sur coup. Patientez quelques secondes, puis relancez.",
  "assistant.diag.credits": "Le quota d'utilisation de l'IA est épuisé pour le moment.",
  "assistant.diag.unavailable":
    "Le service IA est temporairement indisponible. Réessayez dans un instant.",
  "assistant.diag.internal":
    "Le traitement a été interrompu avant la réponse finale. Les étapes déjà effectuées sont conservées — relancez pour reprendre.",

  "assistant.analysis.title": "Analyse intelligente",
  "assistant.analysis.resumeAria": "Reprendre",
  "assistant.analysis.pauseAria": "Suspendre",
  "assistant.analysis.clear": "Effacer",
  "assistant.analysis.progressNamed_one": "Analyse de « {name} »… ({count} restant)",
  "assistant.analysis.progressNamed_other": "Analyse de « {name} »… ({count} restants)",
  "assistant.analysis.queued": "Analyse de {files} en attente…",
  "assistant.analysis.done_one": "{count} fichier analysé",
  "assistant.analysis.done_other": "{count} fichiers analysés",
  "assistant.analysis.statRunning": "{count} en cours",
  "assistant.analysis.statQueued": "{count} en attente",
  "assistant.analysis.statDone": "{count} analysés",
  "assistant.analysis.statSkipped": "{count} déjà connus",
  "assistant.analysis.statFailed": "{count} en échec",
  "assistant.analysis.statPaused": "Suspendu",

  // Ajouts génération automatique (i18n complet)
  "assistant.executeReellementUneCommandeSurLe":
    "Exécute RÉELLEMENT une commande sur le moteur de fichiers local de GeniusFiles (vraies API Android, vrais fichiers). Seul canal autorisé pour agir sur le stockage : lister, rechercher, analyser, lire les propriétés, créer un dossier, renommer, déplacer, copier, supprimer, ranger, compresser, extraire, partager, trier, filtrer. Appelle cet outil immédiatement dès qu'un ordre est donné, sans demander confirmation — sauf suppression définitive ou écrasement de données. N'invente JAMAIS un résultat : seule la sortie de cet outil reflète l'état réel du stockage.",
} as const;
