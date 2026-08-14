/**
 * Smart organization + App manager (German).
 *
 * The classifier's category labels (`classifier.ts`) and suggested
 * folder segments are intentionally NOT here: they also serve as real
 * folder names created on the device and must never change with the
 * language (or they'd create orphans).
 */
export default {
  "organize.title": "Intelligente Organisation",
  "organize.subtitle": "Lokale Analyse deines Speichers. Keine Änderung ohne deine Zustimmung.",
  "organize.action.rescan": "Erneut scannen",
  "organize.stat.reorganizable": "Reorganisierbar",
  "organize.stat.recommendations": "Empfehlungen",
  "organize.stat.scannedFiles": "Gescannte Dateien",
  "organize.action.smartRename": "Intelligentes Umbenennen",
  "organize.section.recommendations": "Empfehlungen",
  "organize.section.recommendationsHint": "Jede Aktion erklärt, warum sie wichtig ist.",
  "organize.scanning": "Dein Speicher wird analysiert…",
  "organize.empty.title": "Dein Speicher ist bereits aufgeräumt",
  "organize.empty.desc":
    "Momentan nichts vorzuschlagen. Scanne erneut, nachdem du neue Dateien hinzugefügt hast.",
  "organize.section.distribution": "Aktuelle Verteilung",
  "organize.section.distributionHint": "Top-Kategorien in deinem Speicher.",
  "organize.section.collections": "Dynamische Sammlungen",
  "organize.section.collectionsHint": "Virtuelle Ansichten — sie ändern keine Datei.",
  "organize.preview.defaultTitle": "Vorschau",
  "organize.preview.computing": "Vorschau wird berechnet…",
  "organize.confirm.title": "Diese Organisation anwenden?",
  "organize.confirm.desc":
    "{summary} Du kannst alles über den Verlauf oder den Papierkorb rückgängig machen.",
  "organize.progress.title": "Wird organisiert",
  "organize.progress.preparing": "Wird vorbereitet…",
  "organize.collection.defaultTitle": "Sammlung",
  "organize.collection.searching": "Passende Dateien werden gesucht…",
  "organize.collection.empty":
    "Noch keine Datei entspricht dieser Sammlung. Sie füllt sich automatisch, sobald passende Dateien vorhanden sind.",
  "organize.collection.limited": "Vorschau auf die ersten 200 von {total} Ergebnissen begrenzt.",
  "organize.rec.why": "Warum?",

  "organize.toast.scanFailed.title": "Speicheranalyse fehlgeschlagen",
  "organize.toast.scanFailed.desc": "Deine Dateien konnten gerade nicht analysiert werden.",
  "organize.toast.previewFailed.title": "Vorschau nicht verfügbar",
  "organize.toast.previewFailed.desc":
    "Die Vorschau für diese Organisation konnte nicht vorbereitet werden.",
  "organize.toast.interrupted.title": "Organisation unterbrochen",
  "organize.toast.interrupted.desc": "Es werden keine weiteren Änderungen mehr angewendet.",
  "organize.toast.done.title": "Organisation abgeschlossen",
  "organize.toast.done.desc_one":
    "{count} Aktion angewendet. Du kannst alles über den Verlauf rückgängig machen.",
  "organize.toast.done.desc_other":
    "{count} Aktionen angewendet. Du kannst alles über den Verlauf rückgängig machen.",
  "organize.toast.partial.title": "Teilweise Organisation",
  "organize.toast.partial.applied_one": "{count} Aktion angewendet",
  "organize.toast.partial.applied_other": "{count} Aktionen angewendet",
  "organize.toast.partial.failed_one": "{count} Fehler",
  "organize.toast.partial.failed_other": "{count} Fehler",
  "organize.toast.applyFailed.title": "Organisation fehlgeschlagen",
  "organize.toast.applyFailed.desc": "Diese Organisation konnte gerade nicht angewendet werden.",
  "organize.toast.noRename.title": "Nichts umzubenennen",
  "organize.toast.noRename.desc":
    "Deine Dateinamen sind bereits klar, hier gibt es nichts zu verbessern.",

  "organize.rename.planTitle": "Intelligentes Umbenennen",
  "organize.rename.planDesc_one": "{count} Datei",
  "organize.rename.planDesc_other": "{count} Dateien",
  "organize.rename.hint":
    "Vorschlagen, korrigieren, abwählen: Nichts wird umbenannt, bis du es anwendest.",
  "organize.rename.applyCount": "Anwenden ({count})",
  "organize.rename.resetAria": "Zurücksetzen",
  "organize.rename.checkboxAria": "{name} umbenennen",
  "organize.rename.empty": "Keine Vorschläge — die aktuellen Namen sind bereits klar.",

  "organize.plan.noActions": "Keine Aktion anzuwenden.",
  "organize.plan.summary_one": "{count} Aktion wird auf deine Dateien angewendet.",
  "organize.plan.summary_other": "{count} Aktionen werden auf deine Dateien angewendet.",
  "organize.plan.none": "Es wird keine Aktion angewendet.",
  "organize.count.renames_one": "{count} Umbenennung",
  "organize.count.renames_other": "{count} Umbenennungen",
  "organize.count.moves_one": "{count} Verschiebung",
  "organize.count.moves_other": "{count} Verschiebungen",
  "organize.count.groups_one": "{count} Gruppe",
  "organize.count.groups_other": "{count} Gruppen",
  "organize.count.archives_one": "{count} Archiv",
  "organize.count.archives_other": "{count} Archive",

  "organize.preview.noChangesGlobal": "Diese Organisation führt zu keiner sichtbaren Änderung.",
  "organize.preview.createdFolders": "Erstellte Ordner",
  "organize.preview.noChangesNode": "Keine Änderungen.",

  "organize.rec.messyTitle": "„{folder}“ nach Kategorie sortieren",
  "organize.rec.messyWhy":
    "{detail} Das Gruppieren ähnlicher Dateien erleichtert die Suche und das Teilen.",
  "organize.rec.cta.preview": "Vorschau",
  "organize.rec.messyPlanTitle": "{folder} reorganisieren",
  "organize.rec.messyPlanDesc":
    "Erstellt einen Unterordner pro erkannter Kategorie und verschiebt die passenden Dateien hinein.",
  "organize.action.groupReason_one":
    "Die Datei „{catId}“ in einen Unterordner „{catLabel}“ gruppieren.",
  "organize.action.groupReason_other":
    "Die {count} Dateien „{catId}“ in einen Unterordner „{catLabel}“ gruppieren.",
  "organize.rec.overloadedTitle": "„{folder}“ entlasten",
  "organize.rec.overloadedWhy":
    "{detail} Ein Ordner mit weniger als 80 Dateien bleibt schnell zu durchsuchen.",
  "organize.rec.cta.openFolder": "Ordner öffnen",
  "organize.rec.overloadedPlanDesc":
    "Gruppen von Dateien auswählen, um sie manuell zu verschieben.",
  "organize.rec.misplacedTitle": "Nicht zu „{folder}“ passende Dateien verschieben",
  "organize.rec.misplacedWhy":
    "{detail} Jede Datei ist leichter zu finden, wenn sie in einem konsistenten Ordner gespeichert ist.",
  "organize.action.moveReason": "Nach {category} verschieben — besser geeignet für den Inhalt.",
  "organize.rec.misplacedPlanTitle_one": "{count} Datei verschieben",
  "organize.rec.misplacedPlanTitle_other": "{count} Dateien verschieben",
  "organize.rec.misplacedPlanDesc":
    "Verschiebt Dateien in einen für ihren Typ besser geeigneten Ordner.",
  "organize.rec.unclearTitle_one": "{count} generische Datei umbenennen",
  "organize.rec.unclearTitle_other": "{count} generische Dateien umbenennen",
  "organize.rec.unclearWhy":
    "{detail} Ein klarer Name lässt dich eine Datei finden, ohne sie zu öffnen.",
  "organize.rec.cta.renamePreview": "Umbenennungsvorschau",
  "organize.rec.unclearPlanDesc": "Schlägt lesbare Namen vor.",
  "organize.rec.isolatedTitle_one": "{count} Datei „{category}“ gruppieren",
  "organize.rec.isolatedTitle_other": "{count} Dateien „{category}“ gruppieren",
  "organize.rec.isolatedWhy":
    "{detail} Ein eigener Unterordner macht die gesamte Sammlung sofort sichtbar.",
  "organize.rec.isolatedPlanTitle": "„{category}“ erstellen",
  "organize.rec.isolatedPlanDesc":
    "Erstellt einen eigenen Unterordner und verschiebt die Dateien hinein.",
  "organize.action.isolatedReason_one": "Unterordner „{category}“ für {count} Datei.",
  "organize.action.isolatedReason_other": "Unterordner „{category}“ für {count} Dateien.",
  "organize.rec.hardTitle": "Vollständige Reorganisation empfohlen",
  "organize.rec.hardWhy":
    "{detail} Das Sortieren nach Hauptkategorie reduziert den täglichen Aufwand.",
  "organize.rec.cta.priorities": "Prioritäten anzeigen",
  "organize.rec.hardPlanTitle": "Vollständige Reorganisation",
  "organize.rec.hardPlanDesc": "Ein Überblick über die wirkungsvollsten Aktionen.",
  "organize.rec.summaryTitle": "Etwa {size} könnten besser organisiert werden",
  "organize.rec.summaryWhy":
    "Diese Schätzung summiert den von den folgenden Empfehlungen abgedeckten Speicherplatz.",
  "organize.rec.cta.seeRecs": "Empfehlungen ansehen",
  "organize.rec.summaryPlanTitle": "Vorschau",
  "organize.rec.summaryPlanDesc": "Eine Zusammenfassung des Organisationspotenzials.",

  "organize.scanner.root": "Stamm",
  "organize.scanner.overloadedDetail_one":
    "{count} Datei in diesem Ordner — er wird zunehmend schwer zu durchsuchen.",
  "organize.scanner.overloadedDetail_other":
    "{count} Dateien in diesem Ordner — er wird zunehmend schwer zu durchsuchen.",
  "organize.scanner.messyDetail":
    "Eine Mischung aus {count} Dateitypen — eine Sortierung nach Kategorie verbessert die Navigation.",
  "organize.scanner.misplacedDetail_one": "{count} Datei passt nicht zu einem {kind}-Ordner.",
  "organize.scanner.misplacedDetail_other": "{count} Dateien passen nicht zu einem {kind}-Ordner.",
  "organize.scanner.unclearDetail_one": "{count} Datei hat einen unklaren Namen.",
  "organize.scanner.unclearDetail_other": "{count} Dateien haben unklare Namen.",
  "organize.scanner.isolatedDetail_one":
    "{count} isolierte Datei „{category}“ — gruppiere sie in einem eigenen Unterordner.",
  "organize.scanner.isolatedDetail_other":
    "{count} isolierte Dateien „{category}“ — gruppiere sie in einem eigenen Unterordner.",
  "organize.scanner.hardDetail":
    "Mehrere Ordner sind groß. Eine vollständige Reorganisation wird empfohlen.",
  "organize.kind.audio": "Audio",
  "organize.kind.video": "Video",
  "organize.kind.image": "Bild",

  "organize.renamer.artistTitle": "Titel und Interpret in den Metadaten erkannt.",
  "organize.renamer.titleOnly": "Titel in den Metadaten erkannt.",
  "organize.renamer.docType": "Dokumenttyp erkannt: {type}.",
  "organize.renamer.receipt": "Kassenbon im Bild erkannt.",
  "organize.renamer.invoice": "Rechnung im Bild erkannt.",
  "organize.renamer.businessCard": "Visitenkarte erkannt.",
  "organize.renamer.screenshot": "Screenshot erkannt.",
  "organize.renamer.document": "Gescanntes Dokument erkannt.",
  "organize.renamer.genericName": "Generischer Name durch einen lesbaren Titel ersetzt.",
  "organize.renamer.receiptName": "Kassenbon {date}",
  "organize.renamer.invoiceName": "Rechnung {date}",
  "organize.renamer.businessCardName": "Visitenkarte {date}",
  "organize.renamer.screenshotName": "Screenshot {date}",
  "organize.renamer.documentName": "Gescanntes Dokument {date}",
  "organize.renamer.photoName": "Foto {date}",
  "organize.renamer.videoName": "Video {date}",
  "organize.renamer.fileName": "Datei {date}",

  "organize.apps.title": "Apps",
  "organize.apps.subtitleLoading": "Deine Apps werden analysiert…",
  "organize.apps.count_one": "{count} App",
  "organize.apps.count_other": "{count} Apps",
  "organize.apps.refreshAria": "Liste aktualisieren",
  "organize.apps.sectionAll": "Alle Apps",
  "organize.apps.searchPlaceholder": "Nach einer App suchen…",
  "organize.apps.clearSearchAria": "Suche löschen",
  "organize.apps.filter.user": "Benutzer",
  "organize.apps.filter.system": "System",
  "organize.apps.filter.all": "Alle",
  "organize.apps.sortAria": "Sortieren: {label}",
  "organize.apps.layoutGridAria": "Rasteransicht",
  "organize.apps.layoutListAria": "Listenansicht",
  "organize.apps.pluginError.title": "App-Liste nicht verfügbar",
  "organize.apps.pluginError.desc":
    "GeniusFiles konnte die auf diesem Gerät installierten Apps nicht lesen. Schließe die App und öffne sie erneut, oder versuche es später noch einmal.",
  "organize.apps.emptySearch.title": "Keine App gefunden",
  "organize.apps.emptyNone.title": "Keine App anzuzeigen",
  "organize.apps.emptySearch.desc":
    "Versuche einen anderen Namen oder ändere den Filter, um Systemapps einzuschließen.",
  "organize.apps.emptyNone.desc": "Ändere den Filter, um Systemapps oder alle Apps anzuzeigen.",
  "organize.apps.sectionRecommendations": "Empfehlungen",
  "organize.apps.sectionRecommendationsHint": "Nur Information, keine automatische Aktion",
  "organize.apps.sort.name": "Name",
  "organize.apps.sort.size": "Größe",
  "organize.apps.sort.installed": "Installiert",
  "organize.apps.sort.updated": "Aktualisiert",
  "organize.apps.sort.used": "Zuletzt verwendet",
  "organize.apps.badgeSystem": "System",
  "organize.apps.sortBy": "Sortieren nach",
  "organize.apps.sortActive": "Aktiv",
  "organize.apps.usage.grantTitle": "Echte Größen anzeigen",
  "organize.apps.usage.descPartial":
    "Deine Apps werden aufgelistet. Der Android-Nutzungszugriff fügt die echte Größe (Code, Daten, Cache) und den letzten Öffnungszeitpunkt jeder App hinzu.",
  "organize.apps.usage.descFull":
    "Der Android-Nutzungszugriff ermöglicht es GeniusFiles, die echte Größe jeder App zu berechnen und diejenigen zu erkennen, die du nicht mehr öffnest.",
  "organize.apps.usage.opening": "Wird geöffnet…",
  "organize.apps.usage.openSettings": "Einstellungen öffnen",
  "organize.apps.usage.recheck": "Ich habe die Berechtigung erteilt — erneut versuchen",
  "organize.apps.usage.toast":
    "Aktiviere „GeniusFiles“ unter „Nutzungszugriffsdaten“ und kehre dann hierher zurück.",
  "organize.apps.usage.available": "Echte Größen und letzte Nutzungsdaten sind verfügbar.",
  "organize.apps.usage.unavailable":
    "Geschätzte Größen: Der Nutzungszugriff wurde noch nicht erteilt.",
  "organize.apps.stats.totalLabel": "Verwendeter Speicher",
  "organize.apps.stats.totalCount": "{count} insgesamt",
  "organize.apps.stats.user": "Benutzer",
  "organize.apps.stats.system": "System",
  "organize.apps.stats.userCount": "{count} Benutzer",
  "organize.apps.stats.systemCount": "{count} System",
  "organize.apps.reclaimable": "Bis zu {size} zurückgewinnbar",
  "organize.apps.reclaimableDesc":
    "Durch Archivieren selten genutzter Apps oder Leeren großer Caches. Nichts wird automatisch gelöscht.",
  "organize.apps.unusedTitle": "Selten genutzt",
  "organize.apps.heavyTitle": "Große Apps",
  "organize.apps.recEmpty":
    "Momentan nichts zu melden. GeniusFiles behält Nutzung und Speicher im Blick.",

  "organize.apps.detail.type": "Typ",
  "organize.apps.detail.typeSystem": "System",
  "organize.apps.detail.typeUser": "Benutzer",
  "organize.apps.detail.state": "Status",
  "organize.apps.detail.enabled": "Aktiviert",
  "organize.apps.detail.disabled": "Deaktiviert",
  "organize.apps.detail.installed": "Installiert",
  "organize.apps.detail.updated": "Aktualisiert",
  "organize.apps.detail.totalSize": "Gesamtgröße",
  "organize.apps.detail.apk": "APK",
  "organize.apps.detail.data": "Daten",
  "organize.apps.detail.cache": "Cache",
  "organize.apps.detail.targetSdk": "Ziel-SDK",
  "organize.apps.detail.lastUsed": "Zuletzt geöffnet",
  "organize.apps.detail.location": "Speicherort",
  "organize.apps.action.open": "Öffnen",
  "organize.apps.action.systemInfo": "Systeminfo",
  "organize.apps.action.share": "Teilen",
  "organize.apps.action.backup": "APK sichern",
  "organize.apps.action.backingUp": "Wird gesichert…",
  "organize.apps.action.permissions": "Berechtigungen",
  "organize.apps.action.storage": "Speicher",
  "organize.apps.permissions.title": "Erteilte Berechtigungen",
  "organize.apps.permissions.loading": "Wird geladen…",
  "organize.apps.permissions.none": "Keine gefährliche Berechtigung erteilt.",
  "organize.apps.permissions.moreDeclared":
    "{count} weitere deklarierte, aber nicht erteilte Berechtigungen.",
  "organize.apps.storage.title": "Speicheraktivität",
  "organize.apps.storage.loading": "Wird geladen…",
  "organize.apps.storage.unavailable":
    "Aufschlüsselung nach Kategorie ist auf diesem Gerät nicht verfügbar.",
  "organize.apps.storage.app": "App",
  "organize.apps.storage.data": "Daten",
  "organize.apps.storage.cache": "Cache",
  "organize.apps.storage.total": "Gesamt",
  "organize.apps.uninstall": "Deinstallieren",
  "organize.apps.systemNotice":
    "Diese App ist Teil des Android-Systems: Sie kann nicht deinstalliert werden.",

  "organize.apps.toast.openFailed.title": "Diese App konnte nicht geöffnet werden",
  "organize.apps.toast.openFailed.desc":
    "Sie könnte auf deinem Gerät deaktiviert sein. Prüfe dies in den Android-Einstellungen.",
  "organize.apps.toast.settingsFailed.title":
    "Die Einstellungen dieser App konnten nicht geöffnet werden",
  "organize.apps.toast.settingsFailed.desc":
    "Öffne Android-Einstellungen › Apps und wähle diese App aus.",
  "organize.apps.toast.shareFailed.title": "Teilen nicht möglich",
  "organize.apps.toast.shareFailed.desc": "Auf diesem Gerät ist keine Freigabe-App verfügbar.",
  "organize.apps.toast.backupDone.title": "Sicherung abgeschlossen",
  "organize.apps.toast.backupDone.desc":
    "Eine Kopie von „{name}“ ({size}) wurde in deinen Dateien gespeichert.",
  "organize.apps.toast.backupFailed.title": "Sicherung fehlgeschlagen",
  "organize.apps.toast.backupFailed.desc":
    "Prüfe den freien Speicherplatz auf deinem Gerät und versuche es erneut.",
  "organize.apps.confirm.backupTitle": "„{name}“ sichern?",
  "organize.apps.confirm.backupDesc":
    "Eine Kopie der App wird in deinen Dateien gespeichert. So kannst du sie später auch offline erneut installieren.",
  "organize.apps.confirm.backupConfirm": "Sichern",
  "organize.apps.systemUninstall.title": "Diese App ist Teil des Systems",
  "organize.apps.systemUninstall.desc":
    "Android erlaubt keine Deinstallation. Du kannst sie in den Einstellungen deaktivieren.",
  "organize.apps.confirm.uninstallTitle": "„{name}“ deinstallieren?",
  "organize.apps.confirm.uninstallDesc":
    "Die App und ihre Daten werden von deinem Gerät entfernt. Android fragt zur Bestätigung noch einmal nach.",
  "organize.apps.confirm.uninstallConfirm": "Deinstallieren",
  "organize.apps.toast.uninstallFailed.title": "Deinstallation fehlgeschlagen",
  "organize.apps.toast.uninstallFailed.desc":
    "Diese App kann nicht über GeniusFiles entfernt werden. Versuche es über die Android-Einstellungen.",
  "organize.apps.share.template":
    "{name}\nVersion: {version} ({code})\nGröße: {size}\nInstalliert am: {installed}\nAktualisiert am: {updated}",
  "organize.apps.backupUnavailable": "Auf dieser Plattform nicht verfügbar",

  // Ajouts génération automatique (i18n complet)
  "organize.capturesDEcran": "Screenshots",
  "organize.documentsNumerises": "Gescannte Dokumente",
} as const;
