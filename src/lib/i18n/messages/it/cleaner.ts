/**
 * "cleaner" domain (Italian): Smart Cleaner and Trash.
 */
export default {
  "cleaner.title": "Cleaner",
  "cleaner.subtitle": "Scansione locale · nulla viene eliminato senza la tua approvazione",
  "cleaner.refresh.aria": "Riavvia la scansione",

  "cleaner.stats.reclaimable": "Spazio recuperabile",
  "cleaner.stats.scanning": "Scansione in corso…",
  "cleaner.stats.ready": "Pronto",
  "cleaner.stats.proposed_one": "{count} elemento proposto",
  "cleaner.stats.proposed_other": "{count} elementi proposti",
  "cleaner.stats.foldersRead": "cartelle lette",
  "cleaner.stats.filesRead": "file letti",

  "cleaner.phase.starting": "Preparazione della scansione…",
  "cleaner.phase.walking": "Lettura della memoria…",
  "cleaner.phase.matching": "Confronto dei duplicati…",
  "cleaner.phase.done": "Scansione completata",

  "cleaner.permission.denied":
    "L'accesso completo ai file non è ancora stato concesso. Alcune categorie restano incomplete finché non viene concesso il permesso.",

  "cleaner.issues.count_one": "{count} posizione non leggibile",
  "cleaner.issues.count_other": "{count} posizioni non leggibili",

  "cleaner.categories.title": "Categorie",
  "cleaner.categories.hint": "Controlla prima di agire",

  "cleaner.empty.title": "Niente da pulire per ora",
  "cleaner.empty.description":
    "Nessun duplicato, cache o file inutilizzato trovato in questa posizione. Riavvia la scansione dopo aver aggiunto file, oppure passa a un'altra posizione.",

  "cleaner.category.count_one": "{count} elemento",
  "cleaner.category.count_other": "{count} elementi",
  "cleaner.category.safe": "nessun rischio noto",
  "cleaner.category.review": "da controllare",
  "cleaner.category.toFree": "da liberare",

  "cleaner.category.duplicates.label": "Duplicati",
  "cleaner.category.duplicates.description":
    "File di dimensione identica trovati in più posizioni. La copia più vecchia viene sempre conservata; vengono proposte solo le copie in eccesso.",
  "cleaner.category.large.label": "File di grandi dimensioni",
  "cleaner.category.large.description":
    "File più grandi di {sizeMb} MB. Nulla viene considerato inutile a priori: aprili prima di decidere.",
  "cleaner.category.old_downloads.label": "Download vecchi",
  "cleaner.category.old_downloads.description":
    'File nella cartella "Download" invariati da più di {days} giorni. Un file vecchio non è necessariamente inutile.',
  "cleaner.category.empty_folders.label": "Cartelle vuote",
  "cleaner.category.empty_folders.description":
    "Cartelle che non contengono assolutamente nulla, nemmeno file nascosti. Le cartelle standard di Android sono preservate.",
  "cleaner.category.temp.label": "File temporanei",
  "cleaner.category.temp.description":
    "File di lavoro presenti in una cartella cache confermata, oppure download interrotti, non modificati da diversi giorni.",
  "cleaner.category.extracted_archives.label": "Archivi già estratti",
  "cleaner.category.extracted_archives.description":
    "Archivi con una cartella dallo stesso nome accanto che contiene già file: l'archivio è ridondante.",
  "cleaner.category.apk.label": "Installer APK",
  "cleaner.category.apk.description":
    "File APK più vecchi di {days} giorni. L'app è probabilmente già installata, ma l'installer resta utilizzabile offline.",
  "cleaner.category.messaging_media.label": "Media di messaggistica",
  "cleaner.category.messaging_media.description":
    "Foto, video e audio ricevuti tramite un'app di messaggistica. Questi file possono avere valore personale: controllali uno per uno.",

  "cleaner.reason.emptyFolder": "Niente dentro, nemmeno file nascosti",
  "cleaner.reason.cacheUnused": "File cache inutilizzato da {days} giorni",
  "cleaner.reason.interruptedDownload": "Download interrotto (.{ext}), {days} giorni",
  "cleaner.reason.editorBackup": "Backup automatico dell'editor",
  "cleaner.reason.extractedArchive": 'Cartella "{name}" estratta accanto',
  "cleaner.reason.apkKept": "Installer conservato da {days} giorni",
  "cleaner.reason.messagingMedia": "Media ricevuto tramite un'app di messaggistica",
  "cleaner.reason.oldDownload": "Invariato da {days} giorni",
  "cleaner.reason.largeFile": "Occupa {sizeMb} MB",
  "cleaner.reason.duplicateKeeper": "Copia conservata (la più vecchia)",
  "cleaner.reason.duplicateContent": "Contenuto identico alla copia conservata",
  "cleaner.reason.duplicateSizeName": "Stessa dimensione e nome della copia conservata",
  "cleaner.issue.unreadable": "Posizione non leggibile (permesso o volume non disponibile)",

  "cleaner.selection.count_one": "{count} elemento selezionato",
  "cleaner.selection.count_other": "{count} elementi selezionati",
  "cleaner.selection.toFree": "{amount} da liberare · cestino, ripristinabile",
  "cleaner.selection.deselect": "Deseleziona",
  "cleaner.selection.clean": "Pulisci · {amount}",

  "cleaner.progress.title": "Pulizia in corso…",
  "cleaner.progress.preparing": "Preparazione della pulizia…",
  "cleaner.progress.preparingShort": "Preparazione…",
  "cleaner.progress.processed_one": "{count} elemento su {total}",
  "cleaner.progress.processed_other": "{count} elementi su {total}",

  "cleaner.confirm.clean.title": "Avviare la pulizia?",
  "cleaner.confirm.clean.desc_one":
    "{count} elemento verrà eliminato e verranno liberati circa {freed}. Sono interessati solo gli elementi selezionati.",
  "cleaner.confirm.clean.desc_other":
    "{count} elementi verranno eliminati e verranno liberati circa {freed}. Sono interessati solo gli elementi selezionati.",
  "cleaner.confirm.clean.confirm": "Pulisci",

  "cleaner.toast.partial.title": "Pulizia parziale",
  "cleaner.toast.partial.desc": "{removed} spostati nel cestino, {failed} falliti. {detail}",
  "cleaner.toast.nothing.title": "Niente è stato eliminato",
  "cleaner.toast.nothing.missing": "{missing} erano già scomparsi dalla memoria.",
  "cleaner.toast.nothing.none": "Nessun elemento è stato elaborato.",
  "cleaner.toast.done.title": "Pulizia completata",
  "cleaner.toast.done.desc":
    "{freed} liberati — {removed} spostati nel cestino. Puoi ripristinarli finché non viene svuotato.",
  "cleaner.toast.failed.title": "La pulizia è fallita",
  "cleaner.toast.failed.desc": "Qualcosa è andato storto durante la pulizia.",

  "cleaner.sheet.title.fallback": "Categoria",
  "cleaner.sheet.noData": "Nessun dato.",
  "cleaner.sheet.lockedAria": "Copia conservata, non può essere eliminata",
  "cleaner.sheet.selectAria": "Seleziona {name}",
  "cleaner.sheet.previewAria": "Anteprima {name}",
  "cleaner.sheet.safe":
    "Nessun rischio noto. Gli elementi vengono spostati nel cestino e restano ripristinabili.",
  "cleaner.sheet.review":
    "Controllali uno per uno: tocca una miniatura per aprire il file prima di selezionarlo.",
  "cleaner.sheet.proposed_one": "{count} proposto",
  "cleaner.sheet.proposed_other": "{count} proposti",
  "cleaner.sheet.recoverable": "{amount} recuperabili",
  "cleaner.sheet.emptyCategory": "Nessun elemento proposto in questa categoria.",
  "cleaner.sheet.group": "Gruppo di {count} copie",

  "cleaner.evidence.content": "Contenuto confrontato",
  "cleaner.evidence.sizeName": "Stessa dimensione e nome",
  "cleaner.evidence.location": "Posizione ed età",
  "cleaner.evidence.measured": "Misurazione diretta",

  "cleaner.trash.title": "Cestino",
  "cleaner.trash.selectHint": "Tocca un elemento per aggiungerlo o rimuoverlo dalla selezione",
  "cleaner.trash.noItems": "Nessun elemento",
  "cleaner.trash.summary_one": "{count} elemento · {size}",
  "cleaner.trash.summary_other": "{count} elementi · {size}",
  "cleaner.trash.search.aria": "Cerca nel cestino",
  "cleaner.trash.moreActions.aria": "Altre azioni",
  "cleaner.trash.sortBy": "Ordina per",
  "cleaner.trash.sort.recent": "Eliminati di recente",
  "cleaner.trash.sort.name": "Nome (A → Z)",
  "cleaner.trash.sort.size": "Dimensione (prima i più grandi)",
  "cleaner.trash.emptyAction": "Svuota completamente",
  "cleaner.trash.searchPlaceholder": "Cerca un elemento eliminato…",
  "cleaner.trash.clearSearch.aria": "Cancella ricerca",
  "cleaner.trash.emptyState.searchDesc": "Nessun elemento eliminato corrisponde a questa ricerca.",
  "cleaner.trash.emptyState.desc":
    "I file eliminati da GeniusFiles appariranno qui, pronti per l'anteprima e il ripristino.",
  "cleaner.trash.sortedCount_one": "{count} mostrato",
  "cleaner.trash.sortedCount_other": "{count} mostrati",
  "cleaner.trash.orphanBadge": "Nessuna posizione",
  "cleaner.trash.countdown.permanent": "Conservato permanentemente",
  "cleaner.trash.countdown.imminent": "In procinto di essere eliminato",
  "cleaner.trash.countdown.days_one": "{count} giorno rimanente",
  "cleaner.trash.countdown.days_other": "{count} giorni rimanenti",
  "cleaner.trash.countdown.hours": "{count}h rimanenti",
  "cleaner.trash.item.deselectAria": "Rimuovi dalla selezione",
  "cleaner.trash.item.previewAria": "Anteprima {name}",

  "cleaner.trash.preview.unavailable.title": "Anteprima non disponibile",
  "cleaner.trash.preview.unavailable.folder": "Ripristina la cartella per esplorarne il contenuto.",
  "cleaner.trash.preview.unavailable.file":
    "Questo file può essere letto solo dopo essere stato ripristinato.",

  "cleaner.trash.restore.success_one": "Elemento ripristinato",
  "cleaner.trash.restore.success_other": "{count} elementi ripristinati",
  "cleaner.trash.restore.partial": "{restored} ripristinati, {failed} falliti",

  "cleaner.trash.purge.success_one": "Elemento eliminato",
  "cleaner.trash.purge.success_other": "{count} elementi eliminati",
  "cleaner.trash.purge.desc": "Eliminato permanentemente · {freed} liberati.",
  "cleaner.trash.purge.partial": "{deleted} eliminati, {failed} falliti",

  "cleaner.trash.emptied.title": "Cestino svuotato",
  "cleaner.trash.emptied.desc_one":
    "{count} elemento eliminato permanentemente · {freed} liberati.",
  "cleaner.trash.emptied.desc_other":
    "{count} elementi eliminati permanentemente · {freed} liberati.",

  "cleaner.trash.destPicker.title": "Scegli una posizione di ripristino",
  "cleaner.trash.restoreOutcome.title": "Ripristino completato",
  "cleaner.trash.restoreOutcome.summary": "{restored} ripristinati, {failed} falliti.",
  "cleaner.trash.restoreOutcome.reason.parentMissing": "Posizione mancante",
  "cleaner.trash.restoreOutcome.reason.missing": "Non trovato",
  "cleaner.trash.restoreOutcome.reason.noTarget": "Destinazione sconosciuta",
  "cleaner.trash.restoreOutcome.reason.failed": "Fallito",

  "cleaner.trash.actionUnavailable.title": "Azione non disponibile dal Cestino",
  "cleaner.trash.actionUnavailable.desc": "Ripristina l'elemento per modificarlo.",

  "cleaner.trash.confirm.empty.title": "Svuotare il cestino?",
  "cleaner.trash.confirm.empty.desc_one":
    "{count} elemento verrà eliminato permanentemente dal dispositivo. Questa azione non può essere annullata.",
  "cleaner.trash.confirm.empty.desc_other":
    "{count} elementi verranno eliminati permanentemente dal dispositivo. Questa azione non può essere annullata.",
  "cleaner.trash.confirm.empty.confirm": "Svuota cestino",

  "cleaner.trash.confirm.purge.title_one": "Eliminare definitivamente {count} elemento?",
  "cleaner.trash.confirm.purge.title_other": "Eliminare definitivamente {count} elementi?",
  "cleaner.trash.confirm.purge.desc":
    "Questa eliminazione è permanente: gli elementi non potranno più essere recuperati.",

  "cleaner.trash.confirm.restore.title_one": "Ripristinare {count} elemento?",
  "cleaner.trash.confirm.restore.title_other": "Ripristinare {count} elementi?",
  "cleaner.trash.confirm.restore.desc":
    "Gli elementi verranno rimessi nella loro cartella originale. Se esiste già un file con lo stesso nome, GeniusFiles proporrà di rinominarlo.",
} as const;
