/**
 * Vault (English): setup, lock screen, protected-file browser and vault
 * settings.
 */
export default {
  "vault.title": "Vault",
  "vault.exit": "Exit vault",
  "vault.loading": "Loading…",

  "vault.method.pin": "PIN code",
  "vault.method.password": "password",
  "vault.method.pattern": "pattern",

  "vault.setup.title": "Set up the vault",
  "vault.setup.desc":
    "Your sensitive files stay offline and hidden from the rest of GeniusFiles as long as they're protected.",
  "vault.setup.done": "Vault set up",
  "vault.setup.failed": "Setup failed",
  "vault.setup.step.method": "Method",
  "vault.setup.step.secret": "Code",
  "vault.setup.step.confirm": "Confirmation",
  "vault.setup.method.pin.label": "PIN code",
  "vault.setup.method.pin.desc": "At least 4 digits — quick to type on mobile.",
  "vault.setup.method.pattern.label": "Pattern",
  "vault.setup.method.pattern.desc": "Connect at least 4 dots on a 3×3 grid.",
  "vault.setup.method.password.label": "Password",
  "vault.setup.method.password.desc": "At least 6 characters — for maximum strength.",
  "vault.setup.secret.pattern.label": "Draw your pattern",
  "vault.setup.secret.choose": "Choose your {method}",
  "vault.setup.pattern.recorded": "Pattern recorded ({count} dots)",
  "vault.setup.pattern.hint": "Connect at least 4 dots without lifting your finger.",
  "vault.setup.hint.pin": "At least 4 digits. Avoid obvious sequences like 0000 or 1234.",
  "vault.setup.hint.password": "At least 6 characters. Mix letters, digits and symbols.",
  "vault.setup.confirm.label": "Confirm your {method}",
  "vault.setup.mismatch": "The values don't match.",
  "vault.setup.activate": "Enable the vault",

  "vault.biometric.label": "Biometric unlock",
  "vault.biometric.reason": "Unlock the vault",
  "vault.biometric.useCode": "Use code",
  "vault.biometric.status.available": "Use your fingerprint or face as a shortcut.",
  "vault.biometric.status.none_enrolled": "No fingerprint enrolled — add one in Android settings.",
  "vault.biometric.status.no_hardware":
    "This device has no biometric sensor — the code stays required.",
  "vault.biometric.status.hw_unavailable":
    "Biometric sensor temporarily unavailable — try again later.",
  "vault.biometric.status.security_update_required":
    "An Android security update is required for biometrics.",
  "vault.biometric.status.unsupported": "Biometrics not supported on this Android version.",
  "vault.biometric.status.lockout":
    "Too many attempts — biometrics is temporarily locked by Android.",
  "vault.biometric.status.cancelled": "Biometric authentication cancelled.",
  "vault.biometric.status.failed": "Biometric authentication failed — use your code.",
  "vault.biometric.status.web": "Only available in the Android app.",
  "vault.biometric.status.unknown": "Unknown biometric status — the code stays required.",

  "vault.auth.error.oldCode": "Incorrect previous code",
  "vault.auth.error.notFound": "Vault not found",

  "vault.lock.title": "Vault locked",
  "vault.lock.subtitle.pattern": "Draw your pattern to unlock.",
  "vault.lock.subtitle.secret": "Enter your {method} to unlock.",
  "vault.lock.error.pattern": "Incorrect pattern",
  "vault.lock.error.code": "Incorrect code",
  "vault.lock.verifying": "Verifying…",
  "vault.lock.unlock": "Unlock",
  "vault.lock.useBiometric": "Use biometrics",
  "vault.lock.attempts_one": "{count} failed attempt. Take your time — no data is ever sent.",
  "vault.lock.attempts_other": "{count} failed attempts. Take your time — no data is ever sent.",
  "vault.lock.forgot": "I forgot my code",

  "vault.reset.title": "Reset the vault",
  "vault.reset.descBefore": "This will",
  "vault.reset.descBold": "permanently",
  "vault.reset.descAfter": "delete all vault files and your access settings. No recovery possible.",
  "vault.reset.confirmAll": "Erase everything",
  "vault.reset.done": "Vault reset",

  "vault.settings.aria": "Vault settings",
  "vault.settings.title": "Vault settings",
  "vault.settings.autoLock.label": "Auto-lock",
  "vault.settings.background.label": "Lock in background",
  "vault.settings.background.desc": "Closes the vault as soon as GeniusFiles goes to background.",

  "vault.autoLock.30s": "30 seconds",
  "vault.autoLock.1m": "1 minute",
  "vault.autoLock.5m": "5 minutes",
  "vault.autoLock.15m": "15 minutes",
  "vault.autoLock.30m": "30 minutes",
  "vault.autoLock.never": "Never",

  "vault.wipe.confirmTitle": "Erase everything?",
  "vault.wipe.confirmDesc": "This permanently deletes all vault content and the access code.",
  "vault.wipe.confirmCta": "Reset",

  "vault.usage.summary_one": "{count} item · {size}",
  "vault.usage.summary_other": "{count} items · {size}",
  "vault.restore.title": "Restore",

  "vault.lockAria": "Lock the vault",
  "vault.banner.title": "Encrypted private space",
  "vault.banner.refreshing": " · refreshing…",

  "vault.search.placeholder": "Search inside the vault…",
  "vault.search.clearAria": "Clear search",

  "vault.filter.all": "All",
  "vault.filter.favorites": "Favorites ({count})",

  "vault.empty.title": "Vault is empty",
  "vault.empty.desc":
    "Add sensitive files to encrypt them and hide them from the rest of the app. They stay on this device.",
  "vault.empty.searchHint": "Try another term, or check the spelling.",
  "vault.empty.favoritesHint": "Star a vault file to find it here.",

  "vault.add.cta": "Add files",
  "vault.add.aria": "Add to vault",
  "vault.add.encrypting_one": "Encrypting {count} file…",
  "vault.add.encrypting_other": "Encrypting {count} files…",
  "vault.add.success_one": "{count} file protected in the vault",
  "vault.add.success_other": "{count} files protected in the vault",
  "vault.add.failed.one": "“{name}” couldn't be protected — try again, or check available space.",
  "vault.add.failed.many_one":
    "{count} file couldn't be protected — try again, or check available space.",
  "vault.add.failed.many_other":
    "{count} files couldn't be protected — try again, or check available space.",

  "vault.section.folders": "Folders",
  "vault.section.results": "Results",
  "vault.section.favorites": "Favorites",
  "vault.section.files": "Files",

  "vault.folder.new.title": "New folder",
  "vault.folder.new.label": "Folder name",
  "vault.folder.new.cta": "Create",
  "vault.folder.rename.title": "Rename folder",
  "vault.folder.rename.label": "New name",
  "vault.folder.renameAria": "Rename {name}",
  "vault.folder.deleteAria": "Delete {name}",
  "vault.folder.privateLabel": "Private folder",
  "vault.folder.create.done": "Folder created",
  "vault.folder.create.error": "Couldn't create this folder — the name may already be in use.",
  "vault.folder.rename.error": "Couldn't rename this folder — the name may already be in use.",
  "vault.folder.delete.done": "Folder deleted",
  "vault.folder.delete.error": "This folder isn't empty — move or delete its contents first.",

  "vault.move.prompt": "Move to an existing vault folder (leave empty for the root)",
  "vault.move.root": "Moved to root",
  "vault.move.into": "Moved to “{name}”",
  "vault.action.impossible": "Not possible",

  "vault.restore.progress": "Restoring",
  "vault.restore.success_one": "{count} item restored to its original location",
  "vault.restore.success_other": "{count} items restored to their original location",
  "vault.restore.failed_one":
    "{count} item couldn't be restored — check available space and try again.",
  "vault.restore.failed_other":
    "{count} items couldn't be restored — check available space and try again.",
  "vault.restore.where_one": "Where do you want to restore this item?",
  "vault.restore.where_other": "Where do you want to restore these items?",
  "vault.restore.original.label": "Original location",
  "vault.restore.original.desc": "Back to where the files were before protection.",
  "vault.restore.choose.label": "Choose a location…",
  "vault.restore.choose.desc": "Restore to a public folder on your device.",
  "vault.restore.destinationTitle": "Restore to…",

  "vault.delete.success_one": "Item permanently deleted",
  "vault.delete.success_other": "{count} items permanently deleted",
  "vault.delete.confirmTitle": "Delete permanently?",
  "vault.delete.confirmDescBefore": "This permanently deletes",
  "vault.delete.confirmDescAfter": "from the vault. No restore will be possible.",
  "vault.delete.target.one": "“{name}”",
  "vault.delete.target.many": "{count} item(s)",

  "vault.item.actionsAria": "Actions",
  "vault.item.favoriteAdd": "Add to favorites",
  "vault.item.favoriteRemove": "Remove from favorites",
  "vault.item.moveTo": "Move to a folder…",
  "vault.item.restoreEllipsis": "Restore…",
  "vault.item.addedOn": "Added {date}",
  "vault.item.favoriteAria": "Favorite",

  "vault.selection.exitAria": "Exit selection",

  "vault.sort.date": "Date added",
  "vault.sort.name": "Name",
  "vault.sort.size": "Size",
  "vault.sort.type": "Type",

  "vault.preview.subtitle": "{size} · Vault",
  "vault.preview.noDirPreview": "Folder preview not available",
  "vault.preview.webOnly":
    "Preview available on device. The real content loads on mobile to preserve privacy.",
  "vault.preview.unsupported": "Preview not available for this format.",
  "vault.preview.unavailable": "Preview unavailable",
  "vault.preview.unreadable": "File not readable",

  "vault.pattern.grid": "Pattern grid",

  "vault.error.invalidName": "Invalid name",
  "vault.error.nameExists": "This name already exists",
  "vault.error.folderNotFound": "Folder not found",
  "vault.error.folderNotEmpty": "The folder isn't empty",
  "vault.error.pluginUnavailable": "Plugin unavailable",
  "vault.error.locationNotFound": "Location not found",
  "vault.error.fileNotFound": "File not found",
  "vault.error.originUnknown": "Original location unknown",
  "vault.error.destNotFound": "Destination folder not found",
} as const;
