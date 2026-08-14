/**
 * Selection Actions — centralized rules engine.
 *
 * Analyzes a selection (count, mix of files/folders, host capabilities) and
 * emits the ordered list of contextual actions to render inside the
 * "Plus" sheet. Primary actions (Copier/Déplacer/Supprimer/Renommer)
 * remain in the bottom bar and are NOT computed here.
 *
 * Rules:
 *  - Any action whose callback is absent is silently omitted (no disabled
 *    state — the spec forbids showing options the user cannot use).
 *  - Actions valid only on a single item disappear as soon as the
 *    selection grows.
 *  - Actions valid only on files (Ouvrir avec, Ouvrir en tant que,
 *    Coffre-fort) disappear when at least one folder is selected.
 *  - Actions valid only on folders (Épingler) disappear
 *    when at least one file is selected.
 */
import { t } from "@/lib/i18n";
import type { FileEntry } from "./types";

export type MoreActionId =
  | "share"
  | "openWith"
  | "compress"
  | "moveToVault"
  | "openAs"
  | "properties"
  | "cut"
  | "pin"
  | "hide"
  | "addToHome";

export type MoreActionCallbacks = {
  onShare?: () => void;
  onOpenWith?: () => void;
  onCompress?: () => void;
  onMoveToVault?: () => void;
  onOpenAs?: () => void;
  onProperties?: () => void;
  onCut?: () => void;
  onTogglePin?: () => void;
  onHide?: () => void;
  onAddToHome?: () => void;
};

export type MoreActionFlags = {
  /** Only meaningful when count === 1. */
  isPinned?: boolean;
};

export type MoreAction = {
  id: MoreActionId;
  label: string;
  onClick: () => void;
  danger?: boolean;
};

export type SelectionComposition = {
  count: number;
  hasFile: boolean;
  hasFolder: boolean;
  single: boolean;
  singleFile: boolean;
  singleFolder: boolean;
  onlyFiles: boolean;
  onlyFolders: boolean;
  mixed: boolean;
};

export function analyzeSelection(entries: FileEntry[]): SelectionComposition {
  const count = entries.length;
  const hasFile = entries.some((e) => !e.isDirectory);
  const hasFolder = entries.some((e) => e.isDirectory);
  const single = count === 1;
  return {
    count,
    hasFile,
    hasFolder,
    single,
    singleFile: single && hasFile,
    singleFolder: single && hasFolder,
    onlyFiles: hasFile && !hasFolder,
    onlyFolders: hasFolder && !hasFile,
    mixed: hasFile && hasFolder,
  };
}

/**
 * Compute the "Plus" menu for the given selection. Order is stable so
 * users build muscle memory.
 */
export function buildMoreActions(
  entries: FileEntry[],
  cb: MoreActionCallbacks,
  flags: MoreActionFlags = {},
): MoreAction[] {
  const s = analyzeSelection(entries);
  if (s.count === 0) return [];
  const out: MoreAction[] = [];

  const push = (
    id: MoreActionId,
    label: string,
    handler: (() => void) | undefined,
    when: boolean,
    danger?: boolean,
  ) => {
    if (!when || !handler) return;
    out.push({ id, label, onClick: handler, danger });
  };

  // 1. Share — everything (single or many, files or folders).
  push("share", t("action.share"), cb.onShare, true);

  // 3. Open with — single file only.
  push("openWith", t("files.selection.openWith"), cb.onOpenWith, s.singleFile);

  // 4. Compress — any selection.
  push("compress", t("action.compress"), cb.onCompress, true);

  // 5. Vault — files only (any count).
  push("moveToVault", t("files.selection.moveToVault"), cb.onMoveToVault, s.onlyFiles);

  // 6. Open as… — single file only.
  push("openAs", t("files.selection.openAs"), cb.onOpenAs, s.singleFile);

  // 7. Properties — always available.
  push("properties", t("action.properties"), cb.onProperties, true);

  // 8. Cut (== move) — always available; kept for parity with reference UX.
  push("cut", t("action.cut"), cb.onCut, true);

  // 9. Pin / Unpin — folders only, single selection.
  push(
    "pin",
    flags.isPinned ? t("files.selection.unpin") : t("files.selection.pin"),
    cb.onTogglePin,
    s.singleFolder,
  );

  // 10. Hide — any selection.
  push("hide", t("action.hide"), cb.onHide, true);

  // 11. Add to home screen — single item only (file or folder).
  push("addToHome", t("files.selection.addToHome"), cb.onAddToHome, s.single);

  return out;
}
