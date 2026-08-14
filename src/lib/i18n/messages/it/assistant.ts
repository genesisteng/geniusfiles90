/**
 * Genius AI — assistant screen, conversations drawer, execution pipeline
 * and related diagnostics messages.
 */
export default {
  "assistant.header.menuLabel": "Apri il menu delle conversazioni",
  "assistant.header.title": "Genius Ai",
  "assistant.header.newChat": "Nuova conversazione",

  "assistant.input.placeholder": "Scrivi la tua richiesta…",
  "assistant.input.ariaLabel": "Messaggio",
  "assistant.input.stop": "Interrompi la risposta",
  "assistant.input.send": "Invia",

  "assistant.error.title": "Genius Ai non è riuscito a caricarsi",
  "assistant.error.desc":
    "Una conversazione salvata sembra illeggibile. Puoi riprovare o iniziare una nuova conversazione.",

  "assistant.welcome.title": "Benvenuto in Genius Ai",
  "assistant.welcome.desc":
    "Chatta in modo naturale con il tuo assistente e gestisci i tuoi file con una semplice conversazione.",
  "assistant.welcome.privacyTitle": "Privacy garantita",
  "assistant.welcome.privacy1": "I tuoi file restano esclusivamente sul tuo dispositivo.",
  "assistant.welcome.privacy2":
    "Genius Ai non accede mai direttamente alla tua memoria. Comprende semplicemente la tua richiesta e la trasmette al motore di esecuzione locale di GeniusFiles, che esegue le azioni richieste.",
  "assistant.welcome.privacy3": "Nessun file viene mai inviato a un server o a un'IA esterna.",

  "assistant.message.copied": "Copiato",
  "assistant.message.copy": "Copia",
  "assistant.message.copyAria": "Copia il messaggio",
  "assistant.message.copiedAria": "Messaggio copiato",

  "assistant.templates.ariaLabel": "Suggerimenti",
  "assistant.templates.classifyPhotos": "Ordina tutte le foto per anno, poi per mese.",
  "assistant.templates.moveLargeVideos":
    "Sposta tutti i video superiori a 500 MB in una cartella Video grandi.",
  "assistant.templates.findRecentPdfs": "Trova tutti i PDF modificati negli ultimi 30 giorni.",
  "assistant.templates.biggestFolders":
    "Mostra quali cartelle occupano più spazio nella memoria interna.",
  "assistant.templates.weekVideos": "Trova tutti i video registrati questa settimana.",
  "assistant.templates.sortDownloads": "Ordina la cartella Download per tipo di file.",
  "assistant.templates.renamePhotosByDate": "Rinomina tutte le immagini usando la data di scatto.",
  "assistant.templates.archiveWorkDocs":
    "Sposta tutti i documenti di lavoro in una cartella Archivi.",
  "assistant.templates.findUnusedFiles": "Trova i file non utilizzati da più di due anni.",
  "assistant.templates.analyzeStorage":
    "Analizza tutta la memoria e spiega cosa occupa più spazio.",
  "assistant.templates.listShortAudio": "Elenca tutti i file audio più brevi di due minuti.",
  "assistant.templates.todayScreenshots": "Trova tutti gli screenshot scattati oggi.",
  "assistant.templates.compressDocuments": "Comprimi la cartella Documenti in un archivio ZIP.",
  "assistant.templates.countPdfs": "Quanti file PDF ho sul telefono?",

  "assistant.drawer.ariaLabel": "Menu di Genius Ai",
  "assistant.drawer.closeAria": "Chiudi il menu",
  "assistant.drawer.title": "Conversazioni",
  "assistant.drawer.newChat": "Nuova chat",
  "assistant.drawer.searchPlaceholder": "Cerca una conversazione…",
  "assistant.drawer.searchAria": "Cerca una conversazione",
  "assistant.drawer.emptySearch": "Nessuna conversazione corrisponde a questa ricerca.",
  "assistant.drawer.emptyAll":
    "Ancora nessuna conversazione. Scrivi a Genius Ai per iniziarne una.",
  "assistant.drawer.today": "Oggi",
  "assistant.drawer.yesterday": "Ieri",
  "assistant.drawer.last7": "Ultimi 7 giorni",
  "assistant.drawer.last30": "Ultimi 30 giorni",
  "assistant.drawer.older": "Precedenti",
  "assistant.drawer.renameAria": "Rinomina {title}",
  "assistant.drawer.deleteAria": "Elimina {title}",
  "assistant.drawer.renameLabel": "Nuovo nome",
  "assistant.drawer.defaultTitle": "Nuova conversazione",

  "assistant.pipeline.ariaLabel": "Genius Ai: {label}",
  "assistant.pipeline.understand": "Comprensione",
  "assistant.pipeline.plan": "Analisi",
  "assistant.pipeline.execute": "Esecuzione",
  "assistant.pipeline.verify": "Verifica",
  "assistant.pipeline.respond": "Scrittura della risposta",

  "assistant.stage.list_storage_roots": "Lettura delle posizioni…",
  "assistant.stage.list": "Lettura delle cartelle…",
  "assistant.stage.search": "Ricerca dei file…",
  "assistant.stage.analyze": "Analisi della memoria…",
  "assistant.stage.properties": "Lettura dei dettagli…",
  "assistant.stage.create": "Creazione della cartella…",
  "assistant.stage.rename": "Ridenominazione…",
  "assistant.stage.delete": "Eliminazione…",
  "assistant.stage.copy": "Copia dei file…",
  "assistant.stage.move": "Spostamento dei file…",
  "assistant.stage.organize": "Organizzazione dei file…",
  "assistant.stage.compress": "Compressione…",
  "assistant.stage.extract": "Estrazione…",
  "assistant.stage.share": "Preparazione della condivisione…",
  "assistant.stage.sort": "Ordinamento dei file…",
  "assistant.stage.filter": "Filtro dei file…",
  "assistant.stage.default": "Il motore di esecuzione sta elaborando la tua richiesta…",
  "assistant.stage.searchProgress_one": "Ricerca dei file… {count} trovato",
  "assistant.stage.searchProgress_other": "Ricerca dei file… {count} trovati",
  "assistant.stage.analyzeProgress_one": "Analisi della memoria… {count} elemento letto",
  "assistant.stage.analyzeProgress_other": "Analisi della memoria… {count} elementi letti",
  "assistant.stage.batchProgressTotal": "{base} {processed} / {total}…",
  "assistant.stage.batchProgressCount": "{base} {processed}…",

  "assistant.diag.offline":
    "Nessuna connessione a Internet — Genius Ai ha bisogno della rete per comprendere la tua richiesta.",
  "assistant.diag.network":
    "Impossibile contattare Genius Ai. Controlla la connessione Internet e riprova.",
  "assistant.diag.timeout": "Genius Ai sta impiegando troppo tempo a rispondere. Riprova.",
  "assistant.diag.config":
    "Genius Ai non è configurato correttamente su questo server (servizio IA non disponibile lato app).",
  "assistant.diag.rateLimit":
    "Troppe richieste inviate di seguito. Attendi qualche secondo e riprova.",
  "assistant.diag.credits": "La quota di utilizzo dell'IA è attualmente esaurita.",
  "assistant.diag.unavailable":
    "Il servizio IA è temporaneamente non disponibile. Riprova tra poco.",
  "assistant.diag.internal":
    "L'elaborazione è stata interrotta prima della risposta finale. I passaggi completati sono mantenuti: riprova per continuare.",

  "assistant.analysis.title": "Analisi intelligente",
  "assistant.analysis.resumeAria": "Riprendi",
  "assistant.analysis.pauseAria": "Pausa",
  "assistant.analysis.clear": "Cancella",
  "assistant.analysis.progressNamed_one": "Analisi di “{name}”… ({count} rimanente)",
  "assistant.analysis.progressNamed_other": "Analisi di “{name}”… ({count} rimanenti)",
  "assistant.analysis.queued": "Analisi di {files} in coda…",
  "assistant.analysis.done_one": "{count} file analizzato",
  "assistant.analysis.done_other": "{count} file analizzati",
  "assistant.analysis.statRunning": "{count} in corso",
  "assistant.analysis.statQueued": "{count} in coda",
  "assistant.analysis.statDone": "{count} analizzati",
  "assistant.analysis.statSkipped": "{count} già noti",
  "assistant.analysis.statFailed": "{count} falliti",
  "assistant.analysis.statPaused": "In pausa",

  // Ajouts génération automatique (i18n complet)
  "assistant.executeReellementUneCommandeSurLe":
    "Esegue REALMENTE un comando sul motore locale dei file di GeniusFiles (API Android reali, file reali). È l'unico canale consentito per agire sulla memoria: elencare, cercare, analizzare, leggere proprietà, creare una cartella, rinominare, spostare, copiare, eliminare, riordinare, comprimere, estrarre, condividere, ordinare, filtrare. Chiama questo strumento immediatamente non appena viene impartito un ordine, senza chiedere conferma — tranne per l'eliminazione permanente o la sovrascrittura di dati. Non inventare MAI un risultato: solo l'output di questo strumento riflette lo stato reale della memoria.",
} as const;
