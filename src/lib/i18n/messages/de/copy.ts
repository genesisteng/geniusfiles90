/**
 * "copy" domain vocabulary: Bestätigungsmeldungen, illustrierte Leerzustände,
 * Tastatur-Diagnosebildschirm und Seite „Nicht gefunden“.
 */
export default {
  // Confirmations before a sensitive action (src/lib/copy/index.ts)
  "copy.confirm.moveToTrash.title_one": "{count} Datei löschen?",
  "copy.confirm.moveToTrash.title_other": "{count} Dateien löschen?",
  "copy.confirm.moveToTrash.description_one":
    "Diese Datei wird in den Papierkorb verschoben. Sie können sie wiederherstellen, solange der Papierkorb nicht geleert wurde.",
  "copy.confirm.moveToTrash.description_other":
    "Diese Dateien werden in den Papierkorb verschoben. Sie können sie wiederherstellen, solange der Papierkorb nicht geleert wurde.",
  "copy.confirm.moveToTrash.confirmLabel": "In den Papierkorb verschieben",

  "copy.confirm.deleteForever.title_one": "{count} Element endgültig löschen?",
  "copy.confirm.deleteForever.title_other": "{count} Elemente endgültig löschen?",
  "copy.confirm.deleteForever.description":
    "Diese Löschung ist endgültig: Diese Elemente können danach nicht wiederhergestellt werden.",
  "copy.confirm.deleteForever.confirmLabel": "Endgültig löschen",

  "copy.confirm.emptyTrash.title": "Papierkorb leeren?",
  "copy.confirm.emptyTrash.description_one":
    "{count} Element wird endgültig von Ihrem Gerät gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.",
  "copy.confirm.emptyTrash.description_other":
    "{count} Elemente werden endgültig von Ihrem Gerät gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.",
  "copy.confirm.emptyTrash.confirmLabel": "Papierkorb leeren",

  "copy.confirm.move.title_one": "{count} Element verschieben?",
  "copy.confirm.move.title_other": "{count} Elemente verschieben?",
  "copy.confirm.move.description_one":
    "Dieses Element wird aus seinem aktuellen Speicherort entfernt und in „{destination}“ abgelegt.",
  "copy.confirm.move.description_other":
    "Diese Elemente werden aus ihrem aktuellen Speicherort entfernt und in „{destination}“ abgelegt.",
  "copy.confirm.move.confirmLabel": "Verschieben",

  "copy.confirm.encrypt.title_one": "{count} Datei in den Tresor verschieben?",
  "copy.confirm.encrypt.title_other": "{count} Dateien in den Tresor verschieben?",
  "copy.confirm.encrypt.description":
    "Die Dateien werden verschlüsselt und erscheinen nicht mehr in der Galerie oder anderen Apps. Nur Ihr Tresorcode kann sie wieder entsperren.",
  "copy.confirm.encrypt.confirmLabel": "Verschlüsseln und verschieben",

  "copy.confirm.restore.title_one": "{count} Element wiederherstellen?",
  "copy.confirm.restore.title_other": "{count} Elemente wiederherstellen?",
  "copy.confirm.restore.description":
    "Elemente werden an ihrem ursprünglichen Ort wiederhergestellt. Falls bereits eine Datei mit demselben Namen existiert, bietet GeniusFiles an, sie umzubenennen.",
  "copy.confirm.restore.confirmLabel": "Wiederherstellen",

  "copy.confirm.clean.title": "Bereinigung starten?",
  "copy.confirm.clean.description_one":
    "{count} Element wird gelöscht und etwa {freed} werden freigegeben. Nur die angehakten Elemente sind betroffen.",
  "copy.confirm.clean.description_other":
    "{count} Elemente werden gelöscht und etwa {freed} werden freigegeben. Nur die angehakten Elemente sind betroffen.",
  "copy.confirm.clean.confirmLabel": "Bereinigen",

  "copy.confirm.overwriteFile.title": "„{name}“ ersetzen?",
  "copy.confirm.overwriteFile.description":
    "An diesem Ort existiert bereits eine Datei mit diesem Namen. Sie wird endgültig durch die neue Datei ersetzt.",
  "copy.confirm.overwriteFile.confirmLabel": "Ersetzen",

  "copy.confirm.deletePages.title_one": "{count} Seite löschen?",
  "copy.confirm.deletePages.title_other": "{count} Seiten löschen?",
  "copy.confirm.deletePages.description_one":
    "Diese Seite wird aus dem neuen zu erstellenden PDF entfernt. Die Originaldatei bleibt unverändert.",
  "copy.confirm.deletePages.description_other":
    "Diese Seiten werden aus dem neuen zu erstellenden PDF entfernt. Die Originaldatei bleibt unverändert.",
  "copy.confirm.deletePages.confirmLabel": "Löschen",

  "copy.confirm.runAutomation.title": "„{name}“ jetzt ausführen?",
  "copy.confirm.runAutomation.description":
    "GeniusFiles wendet diese Regel jetzt sofort auf Ihre Dateien an. Die Details der Änderungen sehen Sie anschließend.",
  "copy.confirm.runAutomation.confirmLabel": "Jetzt ausführen",

  // Shared vocabulary (list joining)
  "copy.joinList.and": "und",

  // Illustrated empty states (src/lib/copy/empty-illustrations.ts)
  "copy.empty.files.title": "Keine Dateien",
  "copy.empty.files.description": "Hier gibt es noch nichts anzuzeigen.",
  "copy.empty.documents.title": "Keine Dokumente",
  "copy.empty.documents.description": "Ihre Dokumente erscheinen hier.",
  "copy.empty.images.title": "Keine Bilder",
  "copy.empty.images.description": "Ihre Fotos und Bilder erscheinen hier.",
  "copy.empty.videos.title": "Keine Videos",
  "copy.empty.videos.description": "Ihre Videos erscheinen hier.",
  "copy.empty.audio.title": "Keine Musik",
  "copy.empty.audio.description": "Ihre Musik und Aufnahmen erscheinen hier.",
  "copy.empty.downloads.title": "Keine Downloads",
  "copy.empty.downloads.description": "Heruntergeladene Dateien erscheinen hier.",
  "copy.empty.favorites.title": "Keine Favoriten",
  "copy.empty.favorites.description":
    "Markieren Sie eine Datei als Favorit, um sie hier zu finden.",
  "copy.empty.trash.title": "Der Papierkorb ist leer",
  "copy.empty.trash.description":
    "Gelöschte Elemente erscheinen hier, bevor sie endgültig gelöscht werden.",
  "copy.empty.search.title": "Keine Ergebnisse",
  "copy.empty.search.description":
    "Versuchen Sie ein anderes Stichwort oder passen Sie die Filter an.",
  "copy.empty.folder.title": "Leerer Ordner",
  "copy.empty.folder.description": "Dieser Ordner enthält noch nichts.",
  "copy.empty.storage.title": "Speicher nicht verfügbar",
  "copy.empty.storage.description": "Dieser Speicherort ist nicht erreichbar.",
  "copy.empty.permission.title": "Zugriff verweigert",
  "copy.empty.permission.description": "Gewähren Sie GeniusFiles Zugriff auf Ihre Dateien.",
  "copy.empty.network.title": "Netzwerkfehler",
  "copy.empty.network.description":
    "Prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.",
  "copy.empty.notFound.title": "Datei nicht gefunden",
  "copy.empty.notFound.description": "Diese Datei existiert nicht mehr oder wurde verschoben.",
  "copy.empty.openFailed.title": "Öffnen nicht möglich",
  "copy.empty.openFailed.description": "Diese Datei konnte nicht geöffnet werden.",
  "copy.empty.lowSpace.title": "Nicht genug Speicherplatz",
  "copy.empty.lowSpace.description":
    "Es ist nicht genug freier Speicherplatz vorhanden, um diesen Vorgang abzuschließen. Speicherplatz freigeben und erneut versuchen.",
  "copy.empty.unknownError.title": "Unbekannter Fehler",
  "copy.empty.unknownError.description":
    "Etwas Unerwartetes ist passiert. Bitte versuchen Sie es in Kürze erneut.",
  "copy.empty.operationFailed.title": "Vorgang fehlgeschlagen",
  "copy.empty.operationFailed.description":
    "Die gewünschte Aktion konnte nicht abgeschlossen werden. Details prüfen und erneut versuchen.",

  // Illustrated-state action labels
  "copy.emptyAction.retry": "Erneut versuchen",
  "copy.emptyAction.allow": "Zulassen",
  "copy.emptyAction.back": "Zurück",
  "copy.emptyAction.openWith": "Andere App wählen",
  "copy.emptyAction.freeSpace": "Speicherplatz freigeben",

  // Chat offline state
  "copy.chatOffline.title": "Keine Internetverbindung",
  "copy.chatOffline.description":
    "Ihre Nachricht kann derzeit nicht gesendet werden. Verbindung prüfen und erneut versuchen.",
  "copy.chatOffline.retry": "Erneut versuchen",

  // Not-found page (src/routes/__root.tsx)
  "copy.notFound.title": "Seite nicht gefunden",
  "copy.notFound.description": "Diese Seite existiert nicht oder wurde verschoben.",
  "copy.notFound.backHome": "Zurück zur Startseite",

  // Keyboard diagnostics screen (src/routes/diagnostic-clavier.tsx)
  "copy.keyboardDiag.title": "Tastaturtest",
  "copy.keyboardDiag.subtitle":
    "Prüfen, ob die Android-Tastatur für jeden Feldtyp korrekt reagiert",
  "copy.keyboardDiag.preset.text": "Text (Ordnername, Umbenennen)",
  "copy.keyboardDiag.preset.search": "Suche",
  "copy.keyboardDiag.preset.sentence": "Unterhaltung (Notizen, Kommentare)",
  "copy.keyboardDiag.preset.words": "Eigenname / kurzer Titel",
  "copy.keyboardDiag.preset.multiline": "Mehrzeiliger Kommentar",
  "copy.keyboardDiag.preset.password": "Passwort (Vergleich)",
  "copy.keyboardDiag.fieldTypeLabel": "Feldtyp",
  "copy.keyboardDiag.testFieldLabel": "Testfeld",
  "copy.keyboardDiag.placeholder": "Hier tippen, um die Tastatur zu testen…",
  "copy.keyboardDiag.expectedBehavior": "Erwartetes Verhalten für dieses Feld",
  "copy.keyboardDiag.row.fieldType": "Feldtyp",
  "copy.keyboardDiag.row.autoCorrect": "Autokorrektur",
  "copy.keyboardDiag.row.autoCorrect.on": "an",
  "copy.keyboardDiag.row.autoCorrect.off": "aus",
  "copy.keyboardDiag.row.autoCapitalize": "Automatische Großschreibung",
  "copy.keyboardDiag.row.autoCapitalize.on": "an",
  "copy.keyboardDiag.row.autoCapitalize.off": "aus",
  "copy.keyboardDiag.row.suggestions": "Vorschläge erwartet",
  "copy.keyboardDiag.row.yes": "ja",
  "copy.keyboardDiag.row.no": "nein",
  "copy.keyboardDiag.row.detectedLanguage": "Erkannte Sprache",
  "copy.keyboardDiag.row.notDetected": "nicht erkannt",
  "copy.keyboardDiag.row.activeField": "Aktives Feld",
  "copy.keyboardDiag.row.typedChars": "Eingegebene Zeichen",
  "copy.keyboardDiag.activityTitle": "Tastaturaktivität",
  "copy.keyboardDiag.clear": "Löschen",
  "copy.keyboardDiag.noEvents": "Noch keine Ereignisse.",
  "copy.keyboardDiag.hint":
    "Tipp: Wenn Vorschläge oder die automatische Großschreibung auf diesem Bildschirm nicht erscheinen, liegt das an der Systemtastatur selbst (Gboard-/SwiftKey-Einstellungen), nicht an der App.",
  "copy.keyboardDiag.event.focus": "Fokus",
  "copy.keyboardDiag.event.blur": "Fokusverlust",
  "copy.keyboardDiag.event.keydown": "keydown „{key}“",
  "copy.keyboardDiag.event.compositionStart": "Eingabe läuft (prädiktive Tastatur aktiv)",
  "copy.keyboardDiag.event.compositionEnd": "compositionend „{data}“",
  "copy.keyboardDiag.event.beforeInput": "beforeinput {inputType} „{data}“",
  // Countable units (src/lib/copy/index.ts)
  "copy.unit.file_one": "Datei",
  "copy.unit.file_other": "Dateien",
  "copy.unit.folder_one": "Ordner",
  "copy.unit.folder_other": "Ordner",
  "copy.unit.item_one": "Element",
  "copy.unit.item_other": "Elemente",
  "copy.unit.video_one": "Video",
  "copy.unit.video_other": "Videos",
  "copy.unit.photo_one": "Foto",
  "copy.unit.photo_other": "Fotos",
  "copy.unit.song_one": "Song",
  "copy.unit.song_other": "Songs",
  "copy.unit.action_one": "Aktion",
  "copy.unit.action_other": "Aktionen",
  "copy.unit.page_one": "Seite",
  "copy.unit.page_other": "Seiten",
  "copy.unit.result_one": "Ergebnis",
  "copy.unit.result_other": "Ergebnisse",
  "copy.unit.app_one": "App",
  "copy.unit.app_other": "Apps",

  // Progress and action summaries
  "copy.progress.withDone": "{action} {done} von {total}…",
  "copy.progress.total": "{action} {total}…",
  "copy.progress.ongoing": "{action} läuft…",
  "copy.summary.detail": "{base}.",
  "copy.summary.detailTo": "{base} nach {destination}.",
} as const;
