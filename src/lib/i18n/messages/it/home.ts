/**
 * Home screen: greeting, storage, categories, tools, recent files and
 * file-manager actions exposed from this screen.
 */
export default {
  "home.greeting.night": "Buonanotte",
  "home.greeting.morning": "Buongiorno",
  "home.greeting.afternoon": "Buon pomeriggio",
  "home.greeting.evening": "Buonasera",
  "home.subtitle.default": "Gestisci i tuoi file più velocemente.",
  "home.subtitle.pick": "Apri un'archiviazione o una categoria qui sotto per selezionare.",

  "home.title.files": "File",

  "home.section.categories": "Categorie",
  "home.section.tools": "Strumenti",

  "home.category.documents": "Documenti",
  "home.category.images": "Immagini",
  "home.category.videos": "Video",
  "home.category.audio": "Musica",
  "home.category.downloads": "Download",
  "home.category.apps": "App",

  "home.tool.cleaner": "Pulizia",
  "home.tool.pdfTools": "Strumenti PDF",
  "home.tool.vault": "Cassaforte",
  "home.tool.imageEditor": "Editor immagini",
  "home.tool.audioEditor": "Editor audio",
  "home.tool.trash": "Cestino",

  "home.editorPicker.audioTitle": "Scegli un file audio da modificare",
  "home.editorPicker.imageTitle": "Scegli un'immagine da modificare",

  "home.pickHowTo.aria": "Come selezionare",
  "home.pickHowTo.title": "Come selezionare?",
  "home.pickHowTo.step1": "Apri un'archiviazione o una categoria.",
  "home.pickHowTo.step2Multi": "Tocca ogni file per aggiungerlo alla selezione.",
  "home.pickHowTo.step2Single": "Tocca il file che vuoi selezionare.",
  "home.pickHowTo.step3": "Tocca la sua icona per visualizzarlo in anteprima o aprirlo.",
  "home.pickHowTo.step4": "Termina con “Conferma” oppure “Annulla” per tornare indietro.",

  "home.folder.newTitle": "Nuova cartella",
  "home.folder.nameLabel": "Nome cartella",
  "home.folder.createCta": "Crea",
  "home.folder.created": "Cartella creata",
  "home.folder.createFailed": "Impossibile creare la cartella",

  "home.rename.title": "Rinomina",
  "home.rename.nameLabel": "Nuovo nome",
  "home.rename.cta": "Rinomina",
  "home.rename.done": "Rinominato",
  "home.rename.failed": "Impossibile rinominare",

  "home.destination.copyTitle": "Copia in…",
  "home.destination.moveTitle": "Sposta in…",

  "home.transfer.rootLabel": "Radice dell'archiviazione",
  "home.transfer.cancelled": "Operazione annullata",
  "home.transfer.cancelledDetail": "{count} {unit} elaborati prima dell'annullamento.",
  "home.transfer.copyLabel": "Copia",
  "home.transfer.moveLabel": "Sposta",
  "home.transfer.toLabel": "In “{dest}”",
  "home.transfer.mixedResult": "{succeeded} riusciti, {failed} falliti",

  "home.delete.label": "Eliminazione in corso",
  "home.delete.subtitle": "Spostamento nel cestino",
  "home.delete.cancelledWithCount": "Eliminazione annullata — {count} {unit} già spostati",
  "home.delete.cancelled": "Eliminazione annullata",
  "home.delete.doneSingle": "“{name}” spostato nel cestino",
  "home.delete.doneMultiple": "{count} {unit} spostati nel cestino",
  "home.delete.failed": "{count} eliminazioni non riuscite",

  "home.share.failed": "Impossibile condividere",

  "home.archive.creatingTitle": "Creazione dell'archivio…",
  "home.archive.creatingSubtitle": "Compressione degli elementi selezionati",
  "home.archive.cancelled": "Compressione annullata",
  "home.archive.created": "Archivio creato",
  "home.archive.createdWithSize": "Archivio creato · {size}",
  "home.archive.failed": "Impossibile comprimere",

  "home.extract.title": "Estrazione in corso…",
  "home.extract.subtitle": "Estrazione nella cartella corrente",
  "home.extract.cancelled": "Estrazione annullata",
  "home.extract.done": "Estrazione completata ({count})",
  "home.extract.failed": "Impossibile estrarre",

  "home.editor.fileNotFound": "File non trovato",
  "home.editor.fileNotFoundDesc": "La sua posizione non è più accessibile.",
  "home.editor.fileGone": "“{name}” non è più disponibile",

  "home.recent.aria": "File recenti",
  "home.recent.title": "File recenti",
  "home.recent.viewMore": "Vedi altro",
  "home.recent.empty": "I nuovi file aggiunti alla tua archiviazione appariranno qui.",

  "home.storage.aria": "Archiviazione",
  "home.storage.title": "Archiviazione",
  "home.storage.internal": "Memoria interna",
  "home.storage.usb": "Dispositivo USB",
  "home.storage.sd": "Scheda SD",
  "home.storage.readingSpace": "Lettura dello spazio…",
  "home.storage.usage": "{used} / {total} · {free} liberi",
  "home.storage.open": "Apri {label}",

  "home.scopePicker.label": "Archiviazione",
  "home.scopePicker.all": "Tutte",

  "home.confirm.working": "Un momento…",

  "home.exit.title": "Uscire da GeniusFiles?",
  "home.exit.description":
    "Tutte le attività in corso sono terminate. Puoi riaprire l'app in qualsiasi momento, le tue cartelle e impostazioni saranno ripristinate.",
  "home.exit.confirm": "Esci",

  "home.resume.kind.copy": "copia",
  "home.resume.kind.move": "spostamento",
  "home.resume.kind.compress": "compressione",
  "home.resume.kind.extract": "estrazione",
  "home.resume.kind.clean": "pulizia",
  "home.resume.kind.delete": "eliminazione",
  "home.resume.title": "Operazioni da riprendere",
  "home.resume.resuming": "Ripresa di {kind}…",
  "home.resume.progress": "Interrotto al {pct}% — {done} di {total} elaborati",
  "home.resume.unknownTotal": "un numero sconosciuto di elementi",
  "home.resume.resume": "Riprendi",
  "home.resume.dismiss": "Ignora",

  "home.states.noResultsDesc": "Prova con un'altra parola o modifica i filtri.",
  "home.states.errorDesc": "Questo contenuto non può essere mostrato in questo momento.",

  "home.nav.aria": "Navigazione principale",
} as const;
