/**
 * Home screen: greeting, storage, categories, tools, recent files and
 * file-manager actions exposed from this screen.
 */
export default {
  "home.greeting.night": "Good night",
  "home.greeting.morning": "Good morning",
  "home.greeting.afternoon": "Good afternoon",
  "home.greeting.evening": "Good evening",
  "home.subtitle.default": "Manage your files faster.",
  "home.subtitle.pick": "Open a storage or a category below to select.",

  "home.title.files": "Files",

  "home.section.categories": "Categories",
  "home.section.tools": "Tools",

  "home.category.documents": "Documents",
  "home.category.images": "Images",
  "home.category.videos": "Videos",
  "home.category.audio": "Music",
  "home.category.downloads": "Downloads",
  "home.category.apps": "Apps",

  "home.tool.cleaner": "Cleaner",
  "home.tool.pdfTools": "PDF tools",
  "home.tool.vault": "Vault",
  "home.tool.imageEditor": "Image editor",
  "home.tool.audioEditor": "Audio editor",
  "home.tool.trash": "Trash",

  "home.editorPicker.audioTitle": "Pick an audio file to edit",
  "home.editorPicker.imageTitle": "Pick an image to edit",

  "home.pickHowTo.aria": "How to select",
  "home.pickHowTo.title": "How to select?",
  "home.pickHowTo.step1": "Open a storage or a category.",
  "home.pickHowTo.step2Multi": "Tap each file to add it to your selection.",
  "home.pickHowTo.step2Single": "Tap the file you want to select.",
  "home.pickHowTo.step3": "Tap its icon to preview or open it.",
  "home.pickHowTo.step4": "Finish with “Confirm”, or “Cancel” to go back.",

  "home.folder.newTitle": "New folder",
  "home.folder.nameLabel": "Folder name",
  "home.folder.createCta": "Create",
  "home.folder.created": "Folder created",
  "home.folder.createFailed": "Couldn't create the folder",

  "home.rename.title": "Rename",
  "home.rename.nameLabel": "New name",
  "home.rename.cta": "Rename",
  "home.rename.done": "Renamed",
  "home.rename.failed": "Couldn't rename",

  "home.destination.copyTitle": "Copy to…",
  "home.destination.moveTitle": "Move to…",

  "home.transfer.rootLabel": "Storage root",
  "home.transfer.cancelled": "Operation cancelled",
  "home.transfer.cancelledDetail": "{count} {unit}(s) processed before cancelling.",
  "home.transfer.copyLabel": "Copy",
  "home.transfer.moveLabel": "Move",
  "home.transfer.toLabel": "To “{dest}”",
  "home.transfer.mixedResult": "{succeeded} succeeded, {failed} failed",

  "home.delete.label": "Deleting",
  "home.delete.subtitle": "Moving to trash",
  "home.delete.cancelledWithCount": "Deletion cancelled — {count} {unit} already moved",
  "home.delete.cancelled": "Deletion cancelled",
  "home.delete.doneSingle": "“{name}” moved to trash",
  "home.delete.doneMultiple": "{count} {unit}s moved to trash",
  "home.delete.failed": "{count} deletion(s) failed",

  "home.share.failed": "Couldn't share",

  "home.archive.creatingTitle": "Creating the archive…",
  "home.archive.creatingSubtitle": "Compressing the selected items",
  "home.archive.cancelled": "Compression cancelled",
  "home.archive.created": "Archive created",
  "home.archive.createdWithSize": "Archive created · {size}",
  "home.archive.failed": "Couldn't compress",

  "home.extract.title": "Extracting…",
  "home.extract.subtitle": "Extracting to the current folder",
  "home.extract.cancelled": "Extraction cancelled",
  "home.extract.done": "Extraction complete ({count})",
  "home.extract.failed": "Couldn't extract",

  "home.editor.fileNotFound": "File not found",
  "home.editor.fileNotFoundDesc": "Its location is no longer accessible.",
  "home.editor.fileGone": "“{name}” is no longer available",

  "home.recent.aria": "Recent files",
  "home.recent.title": "Recent files",
  "home.recent.viewMore": "See more",
  "home.recent.empty": "New files added to your storage will appear here.",

  "home.storage.aria": "Storage",
  "home.storage.title": "Storage",
  "home.storage.internal": "Internal storage",
  "home.storage.usb": "USB device",
  "home.storage.sd": "SD card",
  "home.storage.readingSpace": "Reading space…",
  "home.storage.usage": "{used} / {total} · {free} free",
  "home.storage.open": "Open {label}",

  "home.scopePicker.label": "Storage",
  "home.scopePicker.all": "All",

  "home.confirm.working": "One moment…",

  "home.exit.title": "Quit GeniusFiles?",
  "home.exit.description":
    "All running tasks are finished. You can reopen the app any time, your folders and settings will be restored.",
  "home.exit.confirm": "Quit",

  "home.resume.kind.copy": "copy",
  "home.resume.kind.move": "move",
  "home.resume.kind.compress": "compression",
  "home.resume.kind.extract": "extraction",
  "home.resume.kind.clean": "cleanup",
  "home.resume.kind.delete": "deletion",
  "home.resume.title": "Operations to resume",
  "home.resume.resuming": "Resuming the {kind}…",
  "home.resume.progress": "Interrupted at {pct}% — {done} of {total} processed",
  "home.resume.unknownTotal": "an unknown number of items",
  "home.resume.resume": "Resume",
  "home.resume.dismiss": "Dismiss",

  "home.states.noResultsDesc": "Try another word or change the filters.",
  "home.states.errorDesc": "This content can't be shown right now.",

  "home.nav.aria": "Main navigation",
} as const;
