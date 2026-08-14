/**
 * "copy" domain vocabulary: confirmation messages, illustrated empty
 * states, keyboard diagnostics screen and not-found page.
 */
export default {
  // Confirmations before a sensitive action (src/lib/copy/index.ts)
  "copy.confirm.moveToTrash.title_one": "Delete {count} file?",
  "copy.confirm.moveToTrash.title_other": "Delete {count} files?",
  "copy.confirm.moveToTrash.description_one":
    "This file will be moved to trash. You can restore it as long as the trash hasn't been emptied.",
  "copy.confirm.moveToTrash.description_other":
    "These files will be moved to trash. You can restore them as long as the trash hasn't been emptied.",
  "copy.confirm.moveToTrash.confirmLabel": "Move to trash",

  "copy.confirm.deleteForever.title_one": "Permanently delete {count} item?",
  "copy.confirm.deleteForever.title_other": "Permanently delete {count} items?",
  "copy.confirm.deleteForever.description":
    "This deletion is permanent: these items can't be recovered afterwards.",
  "copy.confirm.deleteForever.confirmLabel": "Delete permanently",

  "copy.confirm.emptyTrash.title": "Empty the trash?",
  "copy.confirm.emptyTrash.description_one":
    "{count} item will be permanently deleted from your device. This action can't be undone.",
  "copy.confirm.emptyTrash.description_other":
    "{count} items will be permanently deleted from your device. This action can't be undone.",
  "copy.confirm.emptyTrash.confirmLabel": "Empty trash",

  "copy.confirm.move.title_one": "Move {count} item?",
  "copy.confirm.move.title_other": "Move {count} items?",
  "copy.confirm.move.description_one":
    "This item will be removed from its current location and placed in \u201c{destination}\u201d.",
  "copy.confirm.move.description_other":
    "These items will be removed from their current location and placed in \u201c{destination}\u201d.",
  "copy.confirm.move.confirmLabel": "Move",

  "copy.confirm.encrypt.title_one": "Move {count} file to the vault?",
  "copy.confirm.encrypt.title_other": "Move {count} files to the vault?",
  "copy.confirm.encrypt.description":
    "The files will be encrypted and will no longer appear in the gallery or other apps. Only your vault code will unlock them again.",
  "copy.confirm.encrypt.confirmLabel": "Encrypt and move",

  "copy.confirm.restore.title_one": "Restore {count} item?",
  "copy.confirm.restore.title_other": "Restore {count} items?",
  "copy.confirm.restore.description":
    "Items will be restored to their original location. If a file with the same name already exists, GeniusFiles will offer to rename it.",
  "copy.confirm.restore.confirmLabel": "Restore",

  "copy.confirm.clean.title": "Start cleanup?",
  "copy.confirm.clean.description_one":
    "{count} item will be deleted and about {freed} will be freed up. Only the items you checked are affected.",
  "copy.confirm.clean.description_other":
    "{count} items will be deleted and about {freed} will be freed up. Only the items you checked are affected.",
  "copy.confirm.clean.confirmLabel": "Clean up",

  "copy.confirm.overwriteFile.title": "Replace \u201c{name}\u201d?",
  "copy.confirm.overwriteFile.description":
    "A file already has this name at this location. It will be permanently replaced by the new file.",
  "copy.confirm.overwriteFile.confirmLabel": "Replace",

  "copy.confirm.deletePages.title_one": "Delete {count} page?",
  "copy.confirm.deletePages.title_other": "Delete {count} pages?",
  "copy.confirm.deletePages.description_one":
    "This page will be removed from the new PDF being created. The original file stays unchanged.",
  "copy.confirm.deletePages.description_other":
    "These pages will be removed from the new PDF being created. The original file stays unchanged.",
  "copy.confirm.deletePages.confirmLabel": "Delete",

  "copy.confirm.runAutomation.title": "Run \u201c{name}\u201d?",
  "copy.confirm.runAutomation.description":
    "GeniusFiles will apply this rule to your files right now. You'll see the details of the changes afterwards.",
  "copy.confirm.runAutomation.confirmLabel": "Run now",

  // Shared vocabulary (list joining)
  "copy.joinList.and": "and",

  // Illustrated empty states (src/lib/copy/empty-illustrations.ts)
  "copy.empty.files.title": "No files",
  "copy.empty.files.description": "There is nothing to show here yet.",
  "copy.empty.documents.title": "No documents",
  "copy.empty.documents.description": "Your documents will show up here.",
  "copy.empty.images.title": "No images",
  "copy.empty.images.description": "Your photos and images will show up here.",
  "copy.empty.videos.title": "No videos",
  "copy.empty.videos.description": "Your videos will show up here.",
  "copy.empty.audio.title": "No music",
  "copy.empty.audio.description": "Your music and recordings will show up here.",
  "copy.empty.downloads.title": "No downloads",
  "copy.empty.downloads.description": "Files you download will show up here.",
  "copy.empty.favorites.title": "No favourites",
  "copy.empty.favorites.description": "Star a file to find it here.",
  "copy.empty.trash.title": "Trash is empty",
  "copy.empty.trash.description": "Deleted items appear here before being erased for good.",
  "copy.empty.search.title": "No results",
  "copy.empty.search.description": "Try another keyword or adjust your filters.",
  "copy.empty.folder.title": "Empty folder",
  "copy.empty.folder.description": "This folder does not contain anything yet.",
  "copy.empty.storage.title": "Storage unavailable",
  "copy.empty.storage.description": "This storage location can't be reached.",
  "copy.empty.permission.title": "Permission denied",
  "copy.empty.permission.description": "Allow GeniusFiles to access your files.",
  "copy.empty.network.title": "Network error",
  "copy.empty.network.description": "Check your Internet connection and try again.",
  "copy.empty.notFound.title": "File not found",
  "copy.empty.notFound.description": "This file no longer exists or has been moved.",
  "copy.empty.openFailed.title": "Can't open",
  "copy.empty.openFailed.description": "This file could not be opened.",
  "copy.empty.lowSpace.title": "Not enough storage",
  "copy.empty.lowSpace.description":
    "There isn't enough free space to finish this operation. Free up some space, then try again.",
  "copy.empty.unknownError.title": "Unknown error",
  "copy.empty.unknownError.description":
    "Something unexpected happened. Please try again in a moment.",
  "copy.empty.operationFailed.title": "Operation failed",
  "copy.empty.operationFailed.description":
    "The requested action could not be completed. Check the details, then try again.",

  // Illustrated-state action labels
  "copy.emptyAction.retry": "Try again",
  "copy.emptyAction.allow": "Allow",
  "copy.emptyAction.back": "Back",
  "copy.emptyAction.openWith": "Choose another app",
  "copy.emptyAction.freeSpace": "Free up space",

  // Chat offline state
  "copy.chatOffline.title": "No Internet connection",
  "copy.chatOffline.description":
    "Your message can't be sent right now. Check your connection, then try again.",
  "copy.chatOffline.retry": "Try again",

  // Not-found page (src/routes/__root.tsx)
  "copy.notFound.title": "Page not found",
  "copy.notFound.description": "This page doesn't exist or has been moved.",
  "copy.notFound.backHome": "Back to home",

  // Keyboard diagnostics screen (src/routes/diagnostic-clavier.tsx)
  "copy.keyboardDiag.title": "Keyboard test",
  "copy.keyboardDiag.subtitle":
    "Check that the Android keyboard reacts correctly for each field type",
  "copy.keyboardDiag.preset.text": "Text (folder name, rename)",
  "copy.keyboardDiag.preset.search": "Search",
  "copy.keyboardDiag.preset.sentence": "Conversation (notes, comments)",
  "copy.keyboardDiag.preset.words": "Proper name / short title",
  "copy.keyboardDiag.preset.multiline": "Multiline comment",
  "copy.keyboardDiag.preset.password": "Password (comparison)",
  "copy.keyboardDiag.fieldTypeLabel": "Field type",
  "copy.keyboardDiag.testFieldLabel": "Test field",
  "copy.keyboardDiag.placeholder": "Type here to test the keyboard…",
  "copy.keyboardDiag.expectedBehavior": "Expected behaviour for this field",
  "copy.keyboardDiag.row.fieldType": "Field type",
  "copy.keyboardDiag.row.autoCorrect": "Autocorrect",
  "copy.keyboardDiag.row.autoCorrect.on": "on",
  "copy.keyboardDiag.row.autoCorrect.off": "off",
  "copy.keyboardDiag.row.autoCapitalize": "Auto-capitalisation",
  "copy.keyboardDiag.row.autoCapitalize.on": "on",
  "copy.keyboardDiag.row.autoCapitalize.off": "off",
  "copy.keyboardDiag.row.suggestions": "Suggestions expected",
  "copy.keyboardDiag.row.yes": "yes",
  "copy.keyboardDiag.row.no": "no",
  "copy.keyboardDiag.row.detectedLanguage": "Detected language",
  "copy.keyboardDiag.row.notDetected": "not detected",
  "copy.keyboardDiag.row.activeField": "Active field",
  "copy.keyboardDiag.row.typedChars": "Characters typed",
  "copy.keyboardDiag.activityTitle": "Keyboard activity",
  "copy.keyboardDiag.clear": "Clear",
  "copy.keyboardDiag.noEvents": "No events yet.",
  "copy.keyboardDiag.hint":
    "Tip: if suggestions or auto-capitalisation don't show up on this screen, the issue comes from the system keyboard itself (Gboard/SwiftKey settings), not the app.",
  "copy.keyboardDiag.event.focus": "focus",
  "copy.keyboardDiag.event.blur": "blur",
  "copy.keyboardDiag.event.keydown": 'keydown "{key}"',
  "copy.keyboardDiag.event.compositionStart": "input in progress (predictive keyboard active)",
  "copy.keyboardDiag.event.compositionEnd": 'compositionend "{data}"',
  "copy.keyboardDiag.event.beforeInput": 'beforeinput {inputType} "{data}"',
  // Countable units (src/lib/copy/index.ts)
  "copy.unit.file_one": "file",
  "copy.unit.file_other": "files",
  "copy.unit.folder_one": "folder",
  "copy.unit.folder_other": "folders",
  "copy.unit.item_one": "item",
  "copy.unit.item_other": "items",
  "copy.unit.video_one": "video",
  "copy.unit.video_other": "videos",
  "copy.unit.photo_one": "photo",
  "copy.unit.photo_other": "photos",
  "copy.unit.song_one": "song",
  "copy.unit.song_other": "songs",
  "copy.unit.action_one": "action",
  "copy.unit.action_other": "actions",
  "copy.unit.page_one": "page",
  "copy.unit.page_other": "pages",
  "copy.unit.result_one": "result",
  "copy.unit.result_other": "results",
  "copy.unit.app_one": "app",
  "copy.unit.app_other": "apps",

  // Progress and action summaries
  "copy.progress.withDone": "{action} {done} of {total}…",
  "copy.progress.total": "{action} {total}…",
  "copy.progress.ongoing": "{action} in progress…",
  "copy.summary.detail": "{base}.",
  "copy.summary.detailTo": "{base} to {destination}.",
} as const;
