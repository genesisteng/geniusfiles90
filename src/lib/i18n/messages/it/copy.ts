/**
 * "copy" domain vocabulary: confirmation messages, illustrated empty
 * states, keyboard diagnostics screen and not-found page.
 */
export default {
  // Confirmations before a sensitive action (src/lib/copy/index.ts)
  "copy.confirm.moveToTrash.title_one": "Eliminare {count} file?",
  "copy.confirm.moveToTrash.title_other": "Eliminare {count} file?",
  "copy.confirm.moveToTrash.description_one":
    "Questo file verrà spostato nel cestino. Puoi ripristinarlo finché il cestino non viene svuotato.",
  "copy.confirm.moveToTrash.description_other":
    "Questi file verranno spostati nel cestino. Puoi ripristinarli finché il cestino non viene svuotato.",
  "copy.confirm.moveToTrash.confirmLabel": "Sposta nel cestino",

  "copy.confirm.deleteForever.title_one": "Eliminare definitivamente {count} elemento?",
  "copy.confirm.deleteForever.title_other": "Eliminare definitivamente {count} elementi?",
  "copy.confirm.deleteForever.description":
    "Questa eliminazione è permanente: questi elementi non potranno essere recuperati in seguito.",
  "copy.confirm.deleteForever.confirmLabel": "Elimina definitivamente",

  "copy.confirm.emptyTrash.title": "Svuotare il cestino?",
  "copy.confirm.emptyTrash.description_one":
    "{count} elemento verrà eliminato permanentemente dal dispositivo. Questa azione non può essere annullata.",
  "copy.confirm.emptyTrash.description_other":
    "{count} elementi verranno eliminati permanentemente dal dispositivo. Questa azione non può essere annullata.",
  "copy.confirm.emptyTrash.confirmLabel": "Svuota cestino",

  "copy.confirm.move.title_one": "Spostare {count} elemento?",
  "copy.confirm.move.title_other": "Spostare {count} elementi?",
  "copy.confirm.move.description_one":
    "Questo elemento verrà rimosso dalla posizione attuale e collocato in \u201c{destination}\u201d.",
  "copy.confirm.move.description_other":
    "Questi elementi verranno rimossi dalla posizione attuale e collocati in \u201c{destination}\u201d.",
  "copy.confirm.move.confirmLabel": "Sposta",

  "copy.confirm.encrypt.title_one": "Spostare {count} file nel caveau?",
  "copy.confirm.encrypt.title_other": "Spostare {count} file nel caveau?",
  "copy.confirm.encrypt.description":
    "I file verranno crittografati e non appariranno più nella galleria o in altre app. Solo il codice del tuo caveau potrà sbloccarli di nuovo.",
  "copy.confirm.encrypt.confirmLabel": "Crittografa e sposta",

  "copy.confirm.restore.title_one": "Ripristinare {count} elemento?",
  "copy.confirm.restore.title_other": "Ripristinare {count} elementi?",
  "copy.confirm.restore.description":
    "Gli elementi verranno ripristinati nella posizione originale. Se esiste già un file con lo stesso nome, GeniusFiles proporrà di rinominarlo.",
  "copy.confirm.restore.confirmLabel": "Ripristina",

  "copy.confirm.clean.title": "Avviare la pulizia?",
  "copy.confirm.clean.description_one":
    "{count} elemento verrà eliminato e verranno liberati circa {freed}. Sono interessati solo gli elementi selezionati.",
  "copy.confirm.clean.description_other":
    "{count} elementi verranno eliminati e verranno liberati circa {freed}. Sono interessati solo gli elementi selezionati.",
  "copy.confirm.clean.confirmLabel": "Pulisci",

  "copy.confirm.overwriteFile.title": "Sostituire \u201c{name}\u201d?",
  "copy.confirm.overwriteFile.description":
    "Esiste già un file con questo nome in questa posizione. Verrà sostituito permanentemente dal nuovo file.",
  "copy.confirm.overwriteFile.confirmLabel": "Sostituisci",

  "copy.confirm.deletePages.title_one": "Eliminare {count} pagina?",
  "copy.confirm.deletePages.title_other": "Eliminare {count} pagine?",
  "copy.confirm.deletePages.description_one":
    "Questa pagina verrà rimossa dal nuovo PDF in fase di creazione. Il file originale resta invariato.",
  "copy.confirm.deletePages.description_other":
    "Queste pagine verranno rimosse dal nuovo PDF in fase di creazione. Il file originale resta invariato.",
  "copy.confirm.deletePages.confirmLabel": "Elimina",

  "copy.confirm.runAutomation.title": "Eseguire \u201c{name}\u201d?",
  "copy.confirm.runAutomation.description":
    "GeniusFiles applicherà subito questa regola ai tuoi file. Vedrai i dettagli delle modifiche in seguito.",
  "copy.confirm.runAutomation.confirmLabel": "Esegui ora",

  // Shared vocabulary (list joining)
  "copy.joinList.and": "e",

  // Illustrated empty states (src/lib/copy/empty-illustrations.ts)
  "copy.empty.files.title": "Nessun file",
  "copy.empty.files.description": "Non c'è ancora nulla da mostrare qui.",
  "copy.empty.documents.title": "Nessun documento",
  "copy.empty.documents.description": "I tuoi documenti appariranno qui.",
  "copy.empty.images.title": "Nessuna immagine",
  "copy.empty.images.description": "Le tue foto e immagini appariranno qui.",
  "copy.empty.videos.title": "Nessun video",
  "copy.empty.videos.description": "I tuoi video appariranno qui.",
  "copy.empty.audio.title": "Nessuna musica",
  "copy.empty.audio.description": "La tua musica e le tue registrazioni appariranno qui.",
  "copy.empty.downloads.title": "Nessun download",
  "copy.empty.downloads.description": "I file scaricati appariranno qui.",
  "copy.empty.favorites.title": "Nessun preferito",
  "copy.empty.favorites.description": "Contrassegna un file come preferito per trovarlo qui.",
  "copy.empty.trash.title": "Il cestino è vuoto",
  "copy.empty.trash.description":
    "Gli elementi eliminati appaiono qui prima di essere rimossi definitivamente.",
  "copy.empty.search.title": "Nessun risultato",
  "copy.empty.search.description": "Prova un'altra parola chiave o modifica i filtri.",
  "copy.empty.folder.title": "Cartella vuota",
  "copy.empty.folder.description": "Questa cartella non contiene ancora nulla.",
  "copy.empty.storage.title": "Memoria non disponibile",
  "copy.empty.storage.description":
    "Non è possibile raggiungere questa posizione di archiviazione.",
  "copy.empty.permission.title": "Permesso negato",
  "copy.empty.permission.description": "Consenti a GeniusFiles di accedere ai tuoi file.",
  "copy.empty.network.title": "Errore di rete",
  "copy.empty.network.description": "Controlla la connessione Internet e riprova.",
  "copy.empty.notFound.title": "File non trovato",
  "copy.empty.notFound.description": "Questo file non esiste più o è stato spostato.",
  "copy.empty.openFailed.title": "Impossibile aprire",
  "copy.empty.openFailed.description": "Non è stato possibile aprire questo file.",
  "copy.empty.lowSpace.title": "Spazio insufficiente",
  "copy.empty.lowSpace.description":
    "Non c'è abbastanza spazio libero per completare questa operazione. Libera spazio e riprova.",
  "copy.empty.unknownError.title": "Errore sconosciuto",
  "copy.empty.unknownError.description": "Si è verificato un imprevisto. Riprova tra un momento.",
  "copy.empty.operationFailed.title": "Operazione fallita",
  "copy.empty.operationFailed.description":
    "L'azione richiesta non è stata completata. Controlla i dettagli e riprova.",

  // Illustrated-state action labels
  "copy.emptyAction.retry": "Riprova",
  "copy.emptyAction.allow": "Consenti",
  "copy.emptyAction.back": "Indietro",
  "copy.emptyAction.openWith": "Scegli un'altra app",
  "copy.emptyAction.freeSpace": "Libera spazio",

  // Chat offline state
  "copy.chatOffline.title": "Nessuna connessione a Internet",
  "copy.chatOffline.description":
    "Il tuo messaggio non può essere inviato ora. Controlla la connessione e riprova.",
  "copy.chatOffline.retry": "Riprova",

  // Not-found page (src/routes/__root.tsx)
  "copy.notFound.title": "Pagina non trovata",
  "copy.notFound.description": "Questa pagina non esiste o è stata spostata.",
  "copy.notFound.backHome": "Torna alla home",

  // Keyboard diagnostics screen (src/routes/diagnostic-clavier.tsx)
  "copy.keyboardDiag.title": "Test tastiera",
  "copy.keyboardDiag.subtitle":
    "Verifica che la tastiera Android reagisca correttamente per ogni tipo di campo",
  "copy.keyboardDiag.preset.text": "Testo (nome cartella, rinomina)",
  "copy.keyboardDiag.preset.search": "Ricerca",
  "copy.keyboardDiag.preset.sentence": "Conversazione (note, commenti)",
  "copy.keyboardDiag.preset.words": "Nome proprio / titolo breve",
  "copy.keyboardDiag.preset.multiline": "Commento multilinea",
  "copy.keyboardDiag.preset.password": "Password (confronto)",
  "copy.keyboardDiag.fieldTypeLabel": "Tipo di campo",
  "copy.keyboardDiag.testFieldLabel": "Campo di test",
  "copy.keyboardDiag.placeholder": "Scrivi qui per testare la tastiera…",
  "copy.keyboardDiag.expectedBehavior": "Comportamento previsto per questo campo",
  "copy.keyboardDiag.row.fieldType": "Tipo di campo",
  "copy.keyboardDiag.row.autoCorrect": "Correzione automatica",
  "copy.keyboardDiag.row.autoCorrect.on": "attiva",
  "copy.keyboardDiag.row.autoCorrect.off": "disattiva",
  "copy.keyboardDiag.row.autoCapitalize": "Maiuscole automatiche",
  "copy.keyboardDiag.row.autoCapitalize.on": "attive",
  "copy.keyboardDiag.row.autoCapitalize.off": "disattive",
  "copy.keyboardDiag.row.suggestions": "Suggerimenti previsti",
  "copy.keyboardDiag.row.yes": "sì",
  "copy.keyboardDiag.row.no": "no",
  "copy.keyboardDiag.row.detectedLanguage": "Lingua rilevata",
  "copy.keyboardDiag.row.notDetected": "non rilevata",
  "copy.keyboardDiag.row.activeField": "Campo attivo",
  "copy.keyboardDiag.row.typedChars": "Caratteri digitati",
  "copy.keyboardDiag.activityTitle": "Attività tastiera",
  "copy.keyboardDiag.clear": "Cancella",
  "copy.keyboardDiag.noEvents": "Nessun evento ancora.",
  "copy.keyboardDiag.hint":
    "Suggerimento: se i suggerimenti o le maiuscole automatiche non appaiono in questa schermata, il problema proviene dalla tastiera di sistema stessa (impostazioni Gboard/SwiftKey), non dall'app.",
  "copy.keyboardDiag.event.focus": "focus",
  "copy.keyboardDiag.event.blur": "blur",
  "copy.keyboardDiag.event.keydown": 'keydown "{key}"',
  "copy.keyboardDiag.event.compositionStart": "input in corso (tastiera predittiva attiva)",
  "copy.keyboardDiag.event.compositionEnd": 'compositionend "{data}"',
  "copy.keyboardDiag.event.beforeInput": 'beforeinput {inputType} "{data}"',
  // Countable units (src/lib/copy/index.ts)
  "copy.unit.file_one": "file",
  "copy.unit.file_other": "file",
  "copy.unit.folder_one": "cartella",
  "copy.unit.folder_other": "cartelle",
  "copy.unit.item_one": "elemento",
  "copy.unit.item_other": "elementi",
  "copy.unit.video_one": "video",
  "copy.unit.video_other": "video",
  "copy.unit.photo_one": "foto",
  "copy.unit.photo_other": "foto",
  "copy.unit.song_one": "brano",
  "copy.unit.song_other": "brani",
  "copy.unit.action_one": "azione",
  "copy.unit.action_other": "azioni",
  "copy.unit.page_one": "pagina",
  "copy.unit.page_other": "pagine",
  "copy.unit.result_one": "risultato",
  "copy.unit.result_other": "risultati",
  "copy.unit.app_one": "app",
  "copy.unit.app_other": "app",

  // Progress and action summaries
  "copy.progress.withDone": "{action} {done} di {total}…",
  "copy.progress.total": "{action} {total}…",
  "copy.progress.ongoing": "{action} in corso…",
  "copy.summary.detail": "{base}.",
  "copy.summary.detailTo": "{base} verso {destination}.",
} as const;
