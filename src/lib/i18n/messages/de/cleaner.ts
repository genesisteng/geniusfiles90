/**
 * "cleaner" domain (Deutsch): Smart Cleaner und Papierkorb.
 */
export default {
  "cleaner.title": "Cleaner",
  "cleaner.subtitle": "Lokaler Scan · nichts wird ohne Ihre Bestätigung gelöscht",
  "cleaner.refresh.aria": "Scan neu starten",

  "cleaner.stats.reclaimable": "Freigebbarer Speicherplatz",
  "cleaner.stats.scanning": "Wird gescannt…",
  "cleaner.stats.ready": "Bereit",
  "cleaner.stats.proposed_one": "{count} Element vorgeschlagen",
  "cleaner.stats.proposed_other": "{count} Elemente vorgeschlagen",
  "cleaner.stats.foldersRead": "Ordner gelesen",
  "cleaner.stats.filesRead": "Dateien gelesen",

  "cleaner.phase.starting": "Scan wird vorbereitet…",
  "cleaner.phase.walking": "Speicher wird gelesen…",
  "cleaner.phase.matching": "Duplikate werden verglichen…",
  "cleaner.phase.done": "Scan abgeschlossen",

  "cleaner.permission.denied":
    "Der vollständige Dateizugriff wurde noch nicht erteilt. Manche Kategorien bleiben unvollständig, bis die Berechtigung erteilt ist.",

  "cleaner.issues.count_one": "{count} Speicherort konnte nicht gelesen werden",
  "cleaner.issues.count_other": "{count} Speicherorte konnten nicht gelesen werden",

  "cleaner.categories.title": "Kategorien",
  "cleaner.categories.hint": "Vor dem Löschen prüfen",

  "cleaner.empty.title": "Aktuell nichts zu bereinigen",
  "cleaner.empty.description":
    "An diesem Ort wurde kein Duplikat, kein Cache und keine ungenutzte Datei gefunden. Scan nach dem Hinzufügen von Dateien neu starten oder einen anderen Ort wählen.",

  "cleaner.category.count_one": "{count} Element",
  "cleaner.category.count_other": "{count} Elemente",
  "cleaner.category.safe": "kein bekanntes Risiko",
  "cleaner.category.review": "zu prüfen",
  "cleaner.category.toFree": "freizugeben",

  "cleaner.category.duplicates.label": "Duplikate",
  "cleaner.category.duplicates.description":
    "Dateien identischer Größe, die an mehreren Orten gefunden wurden. Die älteste Kopie wird immer behalten; nur die zusätzlichen Kopien werden vorgeschlagen.",
  "cleaner.category.large.label": "Große Dateien",
  "cleaner.category.large.description":
    "Dateien größer als {sizeMb} MB. Nichts wird als überflüssig angenommen: vor der Entscheidung öffnen.",
  "cleaner.category.old_downloads.label": "Alte Downloads",
  "cleaner.category.old_downloads.description":
    "Dateien im Ordner „Downloads“, die seit über {days} Tagen unverändert sind. Eine alte Datei ist nicht zwangsläufig überflüssig.",
  "cleaner.category.empty_folders.label": "Leere Ordner",
  "cleaner.category.empty_folders.description":
    "Ordner, die absolut nichts enthalten, auch keine versteckten Dateien. Standard-Android-Ordner bleiben erhalten.",
  "cleaner.category.temp.label": "Temporäre Dateien",
  "cleaner.category.temp.description":
    "Arbeitsdateien in einem bestätigten Cache-Ordner oder unterbrochene Downloads, seit mehreren Tagen unangetastet.",
  "cleaner.category.extracted_archives.label": "Bereits extrahierte Archive",
  "cleaner.category.extracted_archives.description":
    "Archive mit einem gleichnamigen Ordner daneben, der bereits Dateien enthält: Das Archiv ist überflüssig.",
  "cleaner.category.apk.label": "APK-Installer",
  "cleaner.category.apk.description":
    "APK-Dateien, die älter als {days} Tage sind. Die App ist wahrscheinlich bereits installiert, aber der Installer bleibt offline nutzbar.",
  "cleaner.category.messaging_media.label": "Messenger-Medien",
  "cleaner.category.messaging_media.description":
    "Über eine Messenger-App empfangene Fotos, Videos und Audios. Diese Dateien können persönlichen Wert haben: einzeln prüfen.",

  "cleaner.reason.emptyFolder": "Nichts enthalten, nicht einmal versteckte Dateien",
  "cleaner.reason.cacheUnused": "Ungenutzte Cache-Datei seit {days} Tagen",
  "cleaner.reason.interruptedDownload": "Unterbrochener Download (.{ext}), {days} Tage",
  "cleaner.reason.editorBackup": "Automatisches Editor-Backup",
  "cleaner.reason.extractedArchive": "Ordner „{name}“ daneben extrahiert",
  "cleaner.reason.apkKept": "Installer seit {days} Tagen behalten",
  "cleaner.reason.messagingMedia": "Über eine Messenger-App empfangenes Medium",
  "cleaner.reason.oldDownload": "Seit {days} Tagen unverändert",
  "cleaner.reason.largeFile": "Belegt {sizeMb} MB",
  "cleaner.reason.duplicateKeeper": "Behaltene Kopie (die älteste)",
  "cleaner.reason.duplicateContent": "Inhalt identisch mit der behaltenen Kopie",
  "cleaner.reason.duplicateSizeName": "Gleiche Größe und gleicher Name wie die behaltene Kopie",
  "cleaner.issue.unreadable":
    "Speicherort nicht lesbar (Berechtigung oder Laufwerk nicht verfügbar)",

  "cleaner.selection.count_one": "{count} Element ausgewählt",
  "cleaner.selection.count_other": "{count} Elemente ausgewählt",
  "cleaner.selection.toFree": "{amount} freizugeben · Papierkorb, wiederherstellbar",
  "cleaner.selection.deselect": "Auswahl aufheben",
  "cleaner.selection.clean": "Bereinigen · {amount}",

  "cleaner.progress.title": "Wird bereinigt…",
  "cleaner.progress.preparing": "Bereinigung wird vorbereitet…",
  "cleaner.progress.preparingShort": "Wird vorbereitet…",
  "cleaner.progress.processed_one": "{count} von {total} Element",
  "cleaner.progress.processed_other": "{count} von {total} Elementen",

  "cleaner.confirm.clean.title": "Bereinigung starten?",
  "cleaner.confirm.clean.desc_one":
    "{count} Element wird gelöscht und etwa {freed} werden freigegeben. Nur die angehakten Elemente sind betroffen.",
  "cleaner.confirm.clean.desc_other":
    "{count} Elemente werden gelöscht und etwa {freed} werden freigegeben. Nur die angehakten Elemente sind betroffen.",
  "cleaner.confirm.clean.confirm": "Bereinigen",

  "cleaner.toast.partial.title": "Teilweise Bereinigung",
  "cleaner.toast.partial.desc":
    "{removed} in den Papierkorb verschoben, {failed} fehlgeschlagen. {detail}",
  "cleaner.toast.nothing.title": "Nichts wurde gelöscht",
  "cleaner.toast.nothing.missing": "{missing} waren bereits aus dem Speicher verschwunden.",
  "cleaner.toast.nothing.none": "Kein Element konnte bearbeitet werden.",
  "cleaner.toast.done.title": "Bereinigung abgeschlossen",
  "cleaner.toast.done.desc":
    "{freed} freigegeben — {removed} in den Papierkorb verschoben. Wiederherstellbar, bis er geleert wird.",
  "cleaner.toast.failed.title": "Die Bereinigung ist fehlgeschlagen",
  "cleaner.toast.failed.desc": "Bei der Bereinigung ist ein Fehler aufgetreten.",

  "cleaner.sheet.title.fallback": "Kategorie",
  "cleaner.sheet.noData": "Keine Daten.",
  "cleaner.sheet.lockedAria": "Behaltene Kopie, kann nicht gelöscht werden",
  "cleaner.sheet.selectAria": "{name} auswählen",
  "cleaner.sheet.previewAria": "{name} als Vorschau anzeigen",
  "cleaner.sheet.safe":
    "Kein bekanntes Risiko. Elemente werden in den Papierkorb verschoben und bleiben wiederherstellbar.",
  "cleaner.sheet.review":
    "Einzeln prüfen: Auf eine Vorschau tippen, um die Datei vor der Auswahl zu öffnen.",
  "cleaner.sheet.proposed_one": "{count} vorgeschlagen",
  "cleaner.sheet.proposed_other": "{count} vorgeschlagen",
  "cleaner.sheet.recoverable": "{amount} wiederherstellbar",
  "cleaner.sheet.emptyCategory": "In dieser Kategorie wird nichts vorgeschlagen.",
  "cleaner.sheet.group": "Gruppe von {count} Kopien",

  "cleaner.evidence.content": "Inhalt verglichen",
  "cleaner.evidence.sizeName": "Gleiche Größe und gleicher Name",
  "cleaner.evidence.location": "Speicherort und Alter",
  "cleaner.evidence.measured": "Direkte Messung",

  "cleaner.trash.title": "Papierkorb",
  "cleaner.trash.selectHint":
    "Auf ein Element tippen, um es zur Auswahl hinzuzufügen oder zu entfernen",
  "cleaner.trash.noItems": "Keine Elemente",
  "cleaner.trash.summary_one": "{count} Element · {size}",
  "cleaner.trash.summary_other": "{count} Elemente · {size}",
  "cleaner.trash.search.aria": "Im Papierkorb suchen",
  "cleaner.trash.moreActions.aria": "Weitere Aktionen",
  "cleaner.trash.sortBy": "Sortieren nach",
  "cleaner.trash.sort.recent": "Zuletzt gelöscht",
  "cleaner.trash.sort.name": "Name (A → Z)",
  "cleaner.trash.sort.size": "Größe (größte zuerst)",
  "cleaner.trash.emptyAction": "Vollständig leeren",
  "cleaner.trash.searchPlaceholder": "Gelöschtes Element suchen…",
  "cleaner.trash.clearSearch.aria": "Suche löschen",
  "cleaner.trash.emptyState.searchDesc": "Kein gelöschtes Element entspricht dieser Suche.",
  "cleaner.trash.emptyState.desc":
    "Aus GeniusFiles gelöschte Dateien erscheinen hier, bereit zur Vorschau und Wiederherstellung.",
  "cleaner.trash.sortedCount_one": "{count} angezeigt",
  "cleaner.trash.sortedCount_other": "{count} angezeigt",
  "cleaner.trash.orphanBadge": "Kein Speicherort",
  "cleaner.trash.countdown.permanent": "Dauerhaft behalten",
  "cleaner.trash.countdown.imminent": "Wird bald gelöscht",
  "cleaner.trash.countdown.days_one": "noch {count} Tag",
  "cleaner.trash.countdown.days_other": "noch {count} Tage",
  "cleaner.trash.countdown.hours": "noch {count} Std.",
  "cleaner.trash.item.deselectAria": "Aus der Auswahl entfernen",
  "cleaner.trash.item.previewAria": "{name} als Vorschau anzeigen",

  "cleaner.trash.preview.unavailable.title": "Vorschau nicht verfügbar",
  "cleaner.trash.preview.unavailable.folder":
    "Ordner wiederherstellen, um dessen Inhalt zu durchsuchen.",
  "cleaner.trash.preview.unavailable.file":
    "Diese Datei kann erst nach der Wiederherstellung gelesen werden.",

  "cleaner.trash.restore.success_one": "Element wiederhergestellt",
  "cleaner.trash.restore.success_other": "{count} Elemente wiederhergestellt",
  "cleaner.trash.restore.partial": "{restored} wiederhergestellt, {failed} fehlgeschlagen",

  "cleaner.trash.purge.success_one": "Element gelöscht",
  "cleaner.trash.purge.success_other": "{count} Elemente gelöscht",
  "cleaner.trash.purge.desc": "Endgültig gelöscht · {freed} freigegeben.",
  "cleaner.trash.purge.partial": "{deleted} gelöscht, {failed} fehlgeschlagen",

  "cleaner.trash.emptied.title": "Papierkorb geleert",
  "cleaner.trash.emptied.desc_one": "{count} Element endgültig gelöscht · {freed} freigegeben.",
  "cleaner.trash.emptied.desc_other": "{count} Elemente endgültig gelöscht · {freed} freigegeben.",

  "cleaner.trash.destPicker.title": "Wiederherstellungsort wählen",
  "cleaner.trash.restoreOutcome.title": "Wiederherstellung abgeschlossen",
  "cleaner.trash.restoreOutcome.summary": "{restored} wiederhergestellt, {failed} fehlgeschlagen.",
  "cleaner.trash.restoreOutcome.reason.parentMissing": "Speicherort fehlt",
  "cleaner.trash.restoreOutcome.reason.missing": "Nicht gefunden",
  "cleaner.trash.restoreOutcome.reason.noTarget": "Unbekanntes Ziel",
  "cleaner.trash.restoreOutcome.reason.failed": "Fehlgeschlagen",

  "cleaner.trash.actionUnavailable.title": "Aktion aus dem Papierkorb nicht verfügbar",
  "cleaner.trash.actionUnavailable.desc": "Element wiederherstellen, um es zu bearbeiten.",

  "cleaner.trash.confirm.empty.title": "Papierkorb leeren?",
  "cleaner.trash.confirm.empty.desc_one":
    "{count} Element wird endgültig von Ihrem Gerät gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.",
  "cleaner.trash.confirm.empty.desc_other":
    "{count} Elemente werden endgültig von Ihrem Gerät gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.",
  "cleaner.trash.confirm.empty.confirm": "Papierkorb leeren",

  "cleaner.trash.confirm.purge.title_one": "{count} Element endgültig löschen?",
  "cleaner.trash.confirm.purge.title_other": "{count} Elemente endgültig löschen?",
  "cleaner.trash.confirm.purge.desc":
    "Diese Löschung ist endgültig: Die Elemente können nicht mehr wiederhergestellt werden.",

  "cleaner.trash.confirm.restore.title_one": "{count} Element wiederherstellen?",
  "cleaner.trash.confirm.restore.title_other": "{count} Elemente wiederherstellen?",
  "cleaner.trash.confirm.restore.desc":
    "Die Elemente werden an ihrem ursprünglichen Ort abgelegt. Falls bereits eine Datei mit demselben Namen existiert, bietet GeniusFiles an, sie umzubenennen.",
} as const;
