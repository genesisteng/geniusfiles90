/**
 * Genius AI — assistant screen, conversations drawer, execution pipeline
 * and related diagnostics messages.
 */
export default {
  "assistant.header.menuLabel": "Open the conversations menu",
  "assistant.header.title": "Genius AI",
  "assistant.header.newChat": "New conversation",

  "assistant.input.placeholder": "Type your request…",
  "assistant.input.ariaLabel": "Message",
  "assistant.input.stop": "Stop the response",
  "assistant.input.send": "Send",

  "assistant.error.title": "Genius AI couldn't load",
  "assistant.error.desc":
    "A saved conversation seems unreadable. You can try again or start a new conversation.",

  "assistant.welcome.title": "Welcome to Genius AI",
  "assistant.welcome.desc":
    "Chat naturally with your assistant and manage your files through simple conversation.",
  "assistant.welcome.privacyTitle": "Privacy guaranteed",
  "assistant.welcome.privacy1": "Your files stay exclusively on your device.",
  "assistant.welcome.privacy2":
    "Genius AI never accesses your storage directly. It simply understands your request and passes it to GeniusFiles' local execution engine, which performs the requested actions.",
  "assistant.welcome.privacy3": "No file is ever sent to a server or an external AI.",

  "assistant.message.copied": "Copied",
  "assistant.message.copy": "Copy",
  "assistant.message.copyAria": "Copy the message",
  "assistant.message.copiedAria": "Message copied",

  "assistant.templates.ariaLabel": "Suggestions",
  "assistant.templates.classifyPhotos": "Sort all photos by year, then by month.",
  "assistant.templates.moveLargeVideos":
    "Move all videos larger than 500 MB to a Large videos folder.",
  "assistant.templates.findRecentPdfs": "Find every PDF modified in the last 30 days.",
  "assistant.templates.biggestFolders":
    "Show which folders take up the most space on internal storage.",
  "assistant.templates.weekVideos": "Find all videos recorded this week.",
  "assistant.templates.sortDownloads": "Sort the Downloads folder by file type.",
  "assistant.templates.renamePhotosByDate": "Rename all images using their capture date.",
  "assistant.templates.archiveWorkDocs": "Move all work documents into an Archives folder.",
  "assistant.templates.findUnusedFiles": "Find files unused for more than two years.",
  "assistant.templates.analyzeStorage":
    "Analyze my entire storage and explain what's taking up the most space.",
  "assistant.templates.listShortAudio": "List all audio files shorter than two minutes.",
  "assistant.templates.todayScreenshots": "Find all screenshots taken today.",
  "assistant.templates.compressDocuments": "Compress the Documents folder into a ZIP archive.",
  "assistant.templates.countPdfs": "How many PDF files do I have on my phone?",

  "assistant.drawer.ariaLabel": "Genius AI menu",
  "assistant.drawer.closeAria": "Close the menu",
  "assistant.drawer.title": "Conversations",
  "assistant.drawer.newChat": "New chat",
  "assistant.drawer.searchPlaceholder": "Search a conversation…",
  "assistant.drawer.searchAria": "Search a conversation",
  "assistant.drawer.emptySearch": "No conversation matches this search.",
  "assistant.drawer.emptyAll": "No conversations yet. Write to Genius AI to start one.",
  "assistant.drawer.today": "Today",
  "assistant.drawer.yesterday": "Yesterday",
  "assistant.drawer.last7": "Last 7 days",
  "assistant.drawer.last30": "Last 30 days",
  "assistant.drawer.older": "Older",
  "assistant.drawer.renameAria": "Rename {title}",
  "assistant.drawer.deleteAria": "Delete {title}",
  "assistant.drawer.renameLabel": "New name",
  "assistant.drawer.defaultTitle": "New conversation",

  "assistant.pipeline.ariaLabel": "Genius AI: {label}",
  "assistant.pipeline.understand": "Understanding",
  "assistant.pipeline.plan": "Analysis",
  "assistant.pipeline.execute": "Execution",
  "assistant.pipeline.verify": "Verification",
  "assistant.pipeline.respond": "Writing the response",

  "assistant.stage.list_storage_roots": "Reading locations…",
  "assistant.stage.list": "Reading your folders…",
  "assistant.stage.search": "Searching files…",
  "assistant.stage.analyze": "Analyzing storage…",
  "assistant.stage.properties": "Reading details…",
  "assistant.stage.create": "Creating the folder…",
  "assistant.stage.rename": "Renaming…",
  "assistant.stage.delete": "Deleting…",
  "assistant.stage.copy": "Copying files…",
  "assistant.stage.move": "Moving files…",
  "assistant.stage.organize": "Organizing files…",
  "assistant.stage.compress": "Compressing…",
  "assistant.stage.extract": "Extracting…",
  "assistant.stage.share": "Preparing to share…",
  "assistant.stage.sort": "Sorting files…",
  "assistant.stage.filter": "Filtering files…",
  "assistant.stage.default": "The execution engine is processing your request…",
  "assistant.stage.searchProgress_one": "Searching files… {count} found",
  "assistant.stage.searchProgress_other": "Searching files… {count} found",
  "assistant.stage.analyzeProgress_one": "Analyzing storage… {count} item read",
  "assistant.stage.analyzeProgress_other": "Analyzing storage… {count} items read",
  "assistant.stage.batchProgressTotal": "{base} {processed} / {total}…",
  "assistant.stage.batchProgressCount": "{base} {processed}…",

  "assistant.diag.offline":
    "No internet connection — Genius AI needs the network to understand your request.",
  "assistant.diag.network":
    "Couldn't reach Genius AI. Check your internet connection, then try again.",
  "assistant.diag.timeout": "Genius AI is taking too long to respond. Try again.",
  "assistant.diag.config":
    "Genius AI isn't properly configured on this server (AI service unavailable on the app side).",
  "assistant.diag.rateLimit":
    "Too many requests sent in a row. Wait a few seconds, then try again.",
  "assistant.diag.credits": "The AI usage quota is currently exhausted.",
  "assistant.diag.unavailable": "The AI service is temporarily unavailable. Try again in a moment.",
  "assistant.diag.internal":
    "Processing was interrupted before the final response. Completed steps are kept — try again to resume.",

  "assistant.analysis.title": "Smart analysis",
  "assistant.analysis.resumeAria": "Resume",
  "assistant.analysis.pauseAria": "Pause",
  "assistant.analysis.clear": "Clear",
  "assistant.analysis.progressNamed_one": "Analyzing “{name}”… ({count} remaining)",
  "assistant.analysis.progressNamed_other": "Analyzing “{name}”… ({count} remaining)",
  "assistant.analysis.queued": "Analyzing {files} in queue…",
  "assistant.analysis.done_one": "{count} file analyzed",
  "assistant.analysis.done_other": "{count} files analyzed",
  "assistant.analysis.statRunning": "{count} running",
  "assistant.analysis.statQueued": "{count} queued",
  "assistant.analysis.statDone": "{count} analyzed",
  "assistant.analysis.statSkipped": "{count} already known",
  "assistant.analysis.statFailed": "{count} failed",
  "assistant.analysis.statPaused": "Paused",

  // Ajouts génération automatique (i18n complet)
  "assistant.executeReellementUneCommandeSurLe":
    "ACTUALLY runs a command on GeniusFiles' local file engine (real Android APIs, real files). This is the only allowed channel to act on storage: list, search, analyse, read properties, create a folder, rename, move, copy, delete, tidy, compress, extract, share, sort, filter. Call this tool immediately as soon as an order is given, without asking for confirmation — except for permanent deletion or overwriting data. NEVER invent a result: only this tool's output reflects the real state of storage.",
} as const;
