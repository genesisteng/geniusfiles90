/**
 * "cleaner" domain (English): Smart Cleaner and Trash.
 */
export default {
  "cleaner.title": "Cleaner",
  "cleaner.subtitle": "Local scan · nothing is deleted without your approval",
  "cleaner.refresh.aria": "Restart the scan",

  "cleaner.stats.reclaimable": "Reclaimable space",
  "cleaner.stats.scanning": "Scanning…",
  "cleaner.stats.ready": "Ready",
  "cleaner.stats.proposed_one": "{count} item proposed",
  "cleaner.stats.proposed_other": "{count} items proposed",
  "cleaner.stats.foldersRead": "folders read",
  "cleaner.stats.filesRead": "files read",

  "cleaner.phase.starting": "Preparing the scan…",
  "cleaner.phase.walking": "Reading storage…",
  "cleaner.phase.matching": "Comparing duplicates…",
  "cleaner.phase.done": "Scan complete",

  "cleaner.permission.denied":
    "Full file access hasn't been granted yet. Some categories stay incomplete until the permission is given.",

  "cleaner.issues.count_one": "{count} location couldn't be read",
  "cleaner.issues.count_other": "{count} locations couldn't be read",

  "cleaner.categories.title": "Categories",
  "cleaner.categories.hint": "Review before acting",

  "cleaner.empty.title": "Nothing to clean up right now",
  "cleaner.empty.description":
    "No duplicate, cache or unused file was found in this location. Restart the scan after adding files, or switch to another location.",

  "cleaner.category.count_one": "{count} item",
  "cleaner.category.count_other": "{count} items",
  "cleaner.category.safe": "no known risk",
  "cleaner.category.review": "to review",
  "cleaner.category.toFree": "to free up",

  "cleaner.category.duplicates.label": "Duplicates",
  "cleaner.category.duplicates.description":
    "Files of identical size found in several places. The oldest copy is always kept; only the extra copies are proposed.",
  "cleaner.category.large.label": "Large files",
  "cleaner.category.large.description":
    "Files larger than {sizeMb} MB. Nothing is assumed useless: open them before deciding.",
  "cleaner.category.old_downloads.label": "Old downloads",
  "cleaner.category.old_downloads.description":
    'Files in the "Downloads" folder unchanged for more than {days} days. An old file isn\'t necessarily useless.',
  "cleaner.category.empty_folders.label": "Empty folders",
  "cleaner.category.empty_folders.description":
    "Folders containing strictly nothing, even hidden files. Standard Android folders are preserved.",
  "cleaner.category.temp.label": "Temporary files",
  "cleaner.category.temp.description":
    "Work files sitting in a confirmed cache folder, or interrupted downloads, untouched for several days.",
  "cleaner.category.extracted_archives.label": "Already-extracted archives",
  "cleaner.category.extracted_archives.description":
    "Archives with a same-named folder next to them that already contains files: the archive is redundant.",
  "cleaner.category.apk.label": "APK installers",
  "cleaner.category.apk.description":
    "APK files older than {days} days. The app is probably already installed, but the installer stays usable offline.",
  "cleaner.category.messaging_media.label": "Messaging media",
  "cleaner.category.messaging_media.description":
    "Photos, videos and audio received via a messaging app. These files may hold personal value: check them one by one.",

  "cleaner.reason.emptyFolder": "Nothing inside, not even hidden files",
  "cleaner.reason.cacheUnused": "Unused cache file for {days} days",
  "cleaner.reason.interruptedDownload": "Interrupted download (.{ext}), {days} days",
  "cleaner.reason.editorBackup": "Editor auto-save backup",
  "cleaner.reason.extractedArchive": '"{name}" folder extracted alongside',
  "cleaner.reason.apkKept": "Installer kept for {days} days",
  "cleaner.reason.messagingMedia": "Media received via a messaging app",
  "cleaner.reason.oldDownload": "Unchanged for {days} days",
  "cleaner.reason.largeFile": "Takes up {sizeMb} MB",
  "cleaner.reason.duplicateKeeper": "Kept copy (the oldest)",
  "cleaner.reason.duplicateContent": "Content identical to the kept copy",
  "cleaner.reason.duplicateSizeName": "Same size and name as the kept copy",
  "cleaner.issue.unreadable": "Unreadable location (permission or volume unavailable)",

  "cleaner.selection.count_one": "{count} item selected",
  "cleaner.selection.count_other": "{count} items selected",
  "cleaner.selection.toFree": "{amount} to free up · trash, restorable",
  "cleaner.selection.deselect": "Deselect",
  "cleaner.selection.clean": "Clean up · {amount}",

  "cleaner.progress.title": "Cleaning up…",
  "cleaner.progress.preparing": "Preparing the cleanup…",
  "cleaner.progress.preparingShort": "Preparing…",
  "cleaner.progress.processed_one": "{count} item out of {total}",
  "cleaner.progress.processed_other": "{count} items out of {total}",

  "cleaner.confirm.clean.title": "Start the cleanup?",
  "cleaner.confirm.clean.desc_one":
    "{count} item will be deleted and about {freed} will be freed up. Only the items you checked are affected.",
  "cleaner.confirm.clean.desc_other":
    "{count} items will be deleted and about {freed} will be freed up. Only the items you checked are affected.",
  "cleaner.confirm.clean.confirm": "Clean up",

  "cleaner.toast.partial.title": "Partial cleanup",
  "cleaner.toast.partial.desc": "{removed} moved to trash, {failed} failed. {detail}",
  "cleaner.toast.nothing.title": "Nothing was deleted",
  "cleaner.toast.nothing.missing": "{missing} had already disappeared from storage.",
  "cleaner.toast.nothing.none": "No item could be processed.",
  "cleaner.toast.done.title": "Cleanup complete",
  "cleaner.toast.done.desc":
    "{freed} freed up — {removed} moved to trash. You can restore them until it's emptied.",
  "cleaner.toast.failed.title": "The cleanup failed",
  "cleaner.toast.failed.desc": "Something went wrong during the cleanup.",

  "cleaner.sheet.title.fallback": "Category",
  "cleaner.sheet.noData": "No data.",
  "cleaner.sheet.lockedAria": "Kept copy, cannot be deleted",
  "cleaner.sheet.selectAria": "Select {name}",
  "cleaner.sheet.previewAria": "Preview {name}",
  "cleaner.sheet.safe": "No known risk. Items are moved to trash and remain restorable.",
  "cleaner.sheet.review":
    "Check them one by one: tap a thumbnail to open the file before selecting it.",
  "cleaner.sheet.proposed_one": "{count} proposed",
  "cleaner.sheet.proposed_other": "{count} proposed",
  "cleaner.sheet.recoverable": "{amount} recoverable",
  "cleaner.sheet.emptyCategory": "Nothing proposed in this category.",
  "cleaner.sheet.group": "Group of {count} copies",

  "cleaner.evidence.content": "Content compared",
  "cleaner.evidence.sizeName": "Same size and name",
  "cleaner.evidence.location": "Location and age",
  "cleaner.evidence.measured": "Direct measurement",

  "cleaner.trash.title": "Trash",
  "cleaner.trash.selectHint": "Tap an item to add or remove it from the selection",
  "cleaner.trash.noItems": "No items",
  "cleaner.trash.summary_one": "{count} item · {size}",
  "cleaner.trash.summary_other": "{count} items · {size}",
  "cleaner.trash.search.aria": "Search in trash",
  "cleaner.trash.moreActions.aria": "More actions",
  "cleaner.trash.sortBy": "Sort by",
  "cleaner.trash.sort.recent": "Recently deleted",
  "cleaner.trash.sort.name": "Name (A → Z)",
  "cleaner.trash.sort.size": "Size (largest first)",
  "cleaner.trash.emptyAction": "Empty entirely",
  "cleaner.trash.searchPlaceholder": "Search a deleted item…",
  "cleaner.trash.clearSearch.aria": "Clear search",
  "cleaner.trash.emptyState.searchDesc": "No deleted item matches this search.",
  "cleaner.trash.emptyState.desc":
    "Files deleted from GeniusFiles will appear here, ready to preview and restore.",
  "cleaner.trash.sortedCount_one": "{count} shown",
  "cleaner.trash.sortedCount_other": "{count} shown",
  "cleaner.trash.orphanBadge": "No location",
  "cleaner.trash.countdown.permanent": "Kept permanently",
  "cleaner.trash.countdown.imminent": "About to be deleted",
  "cleaner.trash.countdown.days_one": "{count} day left",
  "cleaner.trash.countdown.days_other": "{count} days left",
  "cleaner.trash.countdown.hours": "{count}h left",
  "cleaner.trash.item.deselectAria": "Remove from selection",
  "cleaner.trash.item.previewAria": "Preview {name}",

  "cleaner.trash.preview.unavailable.title": "Preview unavailable",
  "cleaner.trash.preview.unavailable.folder": "Restore the folder to browse its contents.",
  "cleaner.trash.preview.unavailable.file": "This file can only be read after being restored.",

  "cleaner.trash.restore.success_one": "Item restored",
  "cleaner.trash.restore.success_other": "{count} items restored",
  "cleaner.trash.restore.partial": "{restored} restored, {failed} failed",

  "cleaner.trash.purge.success_one": "Item deleted",
  "cleaner.trash.purge.success_other": "{count} items deleted",
  "cleaner.trash.purge.desc": "Permanently deleted · {freed} freed up.",
  "cleaner.trash.purge.partial": "{deleted} deleted, {failed} failed",

  "cleaner.trash.emptied.title": "Trash emptied",
  "cleaner.trash.emptied.desc_one": "{count} item permanently deleted · {freed} freed up.",
  "cleaner.trash.emptied.desc_other": "{count} items permanently deleted · {freed} freed up.",

  "cleaner.trash.destPicker.title": "Choose a restore location",
  "cleaner.trash.restoreOutcome.title": "Restore complete",
  "cleaner.trash.restoreOutcome.summary": "{restored} restored, {failed} failed.",
  "cleaner.trash.restoreOutcome.reason.parentMissing": "Location missing",
  "cleaner.trash.restoreOutcome.reason.missing": "Not found",
  "cleaner.trash.restoreOutcome.reason.noTarget": "Unknown destination",
  "cleaner.trash.restoreOutcome.reason.failed": "Failed",

  "cleaner.trash.actionUnavailable.title": "Action unavailable from Trash",
  "cleaner.trash.actionUnavailable.desc": "Restore the item to edit it.",

  "cleaner.trash.confirm.empty.title": "Empty trash?",
  "cleaner.trash.confirm.empty.desc_one":
    "{count} item will be permanently deleted from your device. This action cannot be undone.",
  "cleaner.trash.confirm.empty.desc_other":
    "{count} items will be permanently deleted from your device. This action cannot be undone.",
  "cleaner.trash.confirm.empty.confirm": "Empty trash",

  "cleaner.trash.confirm.purge.title_one": "Permanently delete {count} item?",
  "cleaner.trash.confirm.purge.title_other": "Permanently delete {count} items?",
  "cleaner.trash.confirm.purge.desc":
    "This deletion is permanent: the items can no longer be recovered.",

  "cleaner.trash.confirm.restore.title_one": "Restore {count} item?",
  "cleaner.trash.confirm.restore.title_other": "Restore {count} items?",
  "cleaner.trash.confirm.restore.desc":
    "Items will be placed back in their original folder. If a file with the same name already exists, GeniusFiles will offer to rename it.",
} as const;
