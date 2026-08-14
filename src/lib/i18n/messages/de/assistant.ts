/**
 * Genius AI — Assistent-Bildschirm, Unterhaltungsmenü, Ausführungspipeline
 * und zugehörige Diagnosemeldungen.
 */
export default {
  "assistant.header.menuLabel": "Unterhaltungsmenü öffnen",
  "assistant.header.title": "Genius AI",
  "assistant.header.newChat": "Neue Unterhaltung",

  "assistant.input.placeholder": "Anfrage eingeben…",
  "assistant.input.ariaLabel": "Nachricht",
  "assistant.input.stop": "Antwort stoppen",
  "assistant.input.send": "Senden",

  "assistant.error.title": "Genius AI konnte nicht geladen werden",
  "assistant.error.desc":
    "Eine gespeicherte Unterhaltung scheint nicht lesbar zu sein. Erneut versuchen oder eine neue Unterhaltung starten.",

  "assistant.welcome.title": "Willkommen bei Genius AI",
  "assistant.welcome.desc":
    "Unterhalten Sie sich natürlich mit dem Assistenten und verwalten Sie Ihre Dateien per Konversation.",
  "assistant.welcome.privacyTitle": "Garantierter Datenschutz",
  "assistant.welcome.privacy1": "Ihre Dateien bleiben ausschließlich auf Ihrem Gerät.",
  "assistant.welcome.privacy2":
    "Genius AI greift nie direkt auf den Speicher zu. Es versteht lediglich die Anfrage und leitet sie an die lokale Ausführungs-Engine von GeniusFiles weiter, die die gewünschten Aktionen ausführt.",
  "assistant.welcome.privacy3":
    "Es wird nie eine Datei an einen Server oder eine externe KI gesendet.",

  "assistant.message.copied": "Kopiert",
  "assistant.message.copy": "Kopieren",
  "assistant.message.copyAria": "Nachricht kopieren",
  "assistant.message.copiedAria": "Nachricht kopiert",

  "assistant.templates.ariaLabel": "Vorschläge",
  "assistant.templates.classifyPhotos": "Alle Fotos nach Jahr, dann nach Monat sortieren.",
  "assistant.templates.moveLargeVideos":
    "Alle Videos über 500 MB in einen Ordner „Große Videos“ verschieben.",
  "assistant.templates.findRecentPdfs":
    "Alle PDFs finden, die in den letzten 30 Tagen geändert wurden.",
  "assistant.templates.biggestFolders":
    "Zeigen, welche Ordner im internen Speicher am meisten Platz belegen.",
  "assistant.templates.weekVideos": "Alle diese Woche aufgenommenen Videos finden.",
  "assistant.templates.sortDownloads": "Den Downloads-Ordner nach Dateityp sortieren.",
  "assistant.templates.renamePhotosByDate": "Alle Bilder anhand des Aufnahmedatums umbenennen.",
  "assistant.templates.archiveWorkDocs":
    "Alle Arbeitsdokumente in einen Archiv-Ordner verschieben.",
  "assistant.templates.findUnusedFiles":
    "Dateien finden, die seit über zwei Jahren ungenutzt sind.",
  "assistant.templates.analyzeStorage":
    "Meinen gesamten Speicher analysieren und erklären, was am meisten Platz belegt.",
  "assistant.templates.listShortAudio": "Alle Audiodateien unter zwei Minuten auflisten.",
  "assistant.templates.todayScreenshots": "Alle heute aufgenommenen Screenshots finden.",
  "assistant.templates.compressDocuments": "Den Documents-Ordner in ein ZIP-Archiv komprimieren.",
  "assistant.templates.countPdfs": "Wie viele PDF-Dateien habe ich auf meinem Smartphone?",

  "assistant.drawer.ariaLabel": "Genius-AI-Menü",
  "assistant.drawer.closeAria": "Menü schließen",
  "assistant.drawer.title": "Unterhaltungen",
  "assistant.drawer.newChat": "Neuer Chat",
  "assistant.drawer.searchPlaceholder": "Unterhaltung suchen…",
  "assistant.drawer.searchAria": "Unterhaltung suchen",
  "assistant.drawer.emptySearch": "Keine Unterhaltung entspricht dieser Suche.",
  "assistant.drawer.emptyAll": "Noch keine Unterhaltungen. Schreiben Sie Genius AI, um zu starten.",
  "assistant.drawer.today": "Heute",
  "assistant.drawer.yesterday": "Gestern",
  "assistant.drawer.last7": "Letzte 7 Tage",
  "assistant.drawer.last30": "Letzte 30 Tage",
  "assistant.drawer.older": "Älter",
  "assistant.drawer.renameAria": "{title} umbenennen",
  "assistant.drawer.deleteAria": "{title} löschen",
  "assistant.drawer.renameLabel": "Neuer Name",
  "assistant.drawer.defaultTitle": "Neue Unterhaltung",

  "assistant.pipeline.ariaLabel": "Genius AI: {label}",
  "assistant.pipeline.understand": "Verstehen",
  "assistant.pipeline.plan": "Analyse",
  "assistant.pipeline.execute": "Ausführung",
  "assistant.pipeline.verify": "Überprüfung",
  "assistant.pipeline.respond": "Antwort wird verfasst",

  "assistant.stage.list_storage_roots": "Speicherorte werden gelesen…",
  "assistant.stage.list": "Ordner werden gelesen…",
  "assistant.stage.search": "Dateien werden gesucht…",
  "assistant.stage.analyze": "Speicher wird analysiert…",
  "assistant.stage.properties": "Details werden gelesen…",
  "assistant.stage.create": "Ordner wird erstellt…",
  "assistant.stage.rename": "Wird umbenannt…",
  "assistant.stage.delete": "Wird gelöscht…",
  "assistant.stage.copy": "Dateien werden kopiert…",
  "assistant.stage.move": "Dateien werden verschoben…",
  "assistant.stage.organize": "Dateien werden organisiert…",
  "assistant.stage.compress": "Wird komprimiert…",
  "assistant.stage.extract": "Wird extrahiert…",
  "assistant.stage.share": "Teilen wird vorbereitet…",
  "assistant.stage.sort": "Dateien werden sortiert…",
  "assistant.stage.filter": "Dateien werden gefiltert…",
  "assistant.stage.default": "Die Ausführungs-Engine bearbeitet Ihre Anfrage…",
  "assistant.stage.searchProgress_one": "Dateien werden gesucht… {count} gefunden",
  "assistant.stage.searchProgress_other": "Dateien werden gesucht… {count} gefunden",
  "assistant.stage.analyzeProgress_one": "Speicher wird analysiert… {count} Element gelesen",
  "assistant.stage.analyzeProgress_other": "Speicher wird analysiert… {count} Elemente gelesen",
  "assistant.stage.batchProgressTotal": "{base} {processed} / {total}…",
  "assistant.stage.batchProgressCount": "{base} {processed}…",

  "assistant.diag.offline":
    "Keine Internetverbindung — Genius AI benötigt das Netzwerk, um Ihre Anfrage zu verstehen.",
  "assistant.diag.network":
    "Genius AI konnte nicht erreicht werden. Internetverbindung prüfen und erneut versuchen.",
  "assistant.diag.timeout": "Genius AI benötigt zu lange für eine Antwort. Erneut versuchen.",
  "assistant.diag.config":
    "Genius AI ist auf diesem Server nicht richtig konfiguriert (KI-Dienst app-seitig nicht verfügbar).",
  "assistant.diag.rateLimit":
    "Zu viele Anfragen hintereinander gesendet. Einige Sekunden warten und erneut versuchen.",
  "assistant.diag.credits": "Das KI-Nutzungskontingent ist derzeit ausgeschöpft.",
  "assistant.diag.unavailable":
    "Der KI-Dienst ist vorübergehend nicht verfügbar. In Kürze erneut versuchen.",
  "assistant.diag.internal":
    "Die Verarbeitung wurde vor der endgültigen Antwort unterbrochen. Bereits abgeschlossene Schritte bleiben erhalten — erneut versuchen, um fortzufahren.",

  "assistant.analysis.title": "Intelligente Analyse",
  "assistant.analysis.resumeAria": "Fortsetzen",
  "assistant.analysis.pauseAria": "Pausieren",
  "assistant.analysis.clear": "Löschen",
  "assistant.analysis.progressNamed_one": "„{name}“ wird analysiert… (noch {count})",
  "assistant.analysis.progressNamed_other": "„{name}“ wird analysiert… (noch {count})",
  "assistant.analysis.queued": "{files} in Warteschlange werden analysiert…",
  "assistant.analysis.done_one": "{count} Datei analysiert",
  "assistant.analysis.done_other": "{count} Dateien analysiert",
  "assistant.analysis.statRunning": "{count} laufend",
  "assistant.analysis.statQueued": "{count} in Warteschlange",
  "assistant.analysis.statDone": "{count} analysiert",
  "assistant.analysis.statSkipped": "{count} bereits bekannt",
  "assistant.analysis.statFailed": "{count} fehlgeschlagen",
  "assistant.analysis.statPaused": "Pausiert",

  // Ajouts génération automatique (i18n complet)
  "assistant.executeReellementUneCommandeSurLe":
    "Führt TATSÄCHLICH einen Befehl auf der lokalen Datei-Engine von GeniusFiles aus (echte Android-APIs, echte Dateien). Dies ist der einzige zulässige Kanal, um auf den Speicher einzuwirken: auflisten, suchen, analysieren, Eigenschaften lesen, Ordner erstellen, umbenennen, verschieben, kopieren, löschen, aufräumen, komprimieren, extrahieren, teilen, sortieren, filtern. Dieses Tool sofort aufrufen, sobald ein Befehl erteilt wird, ohne um Bestätigung zu bitten — außer bei endgültigem Löschen oder Überschreiben von Daten. NIEMALS ein Ergebnis erfinden: Nur die Ausgabe dieses Tools spiegelt den tatsächlichen Zustand des Speichers wider.",
} as const;
