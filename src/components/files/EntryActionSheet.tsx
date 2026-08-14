import {
  GfCopyFiles as Copy,
  GfExternalApp as ExternalLink,
  GfEyeOpen as Eye,
  GfCompress as FileArchive,
  GfMoveTo as FolderInput,
  GfInfo as Info,
  GfApk as Package,
  GfExtract as PackageOpen,
  GfShareNodes as Share2,
  GfRename as SquarePen,
  GfTrash as Trash2,
  GfAudioEditor as Waves,
} from "@/components/icons";
import type { FileEntry } from "@/lib/files/types";
import { FileIcon } from "./FileIcon";
import { BottomSheet } from "./BottomSheet";
import { canReadArchive } from "@/lib/files/archive";
import { packageKindOf } from "@/lib/files/package";
import { canOpenInViewer, canPreview } from "@/lib/viewer/kinds";
import { useT } from "@/lib/i18n";

export type EntryAction =
  | "info"
  | "rename"
  | "share"
  | "copy"
  | "move"
  | "delete"
  | "compress"
  | "openArchive"
  | "extract"
  | "open"
  | "openWith"
  | "editAudio";

/**
 * Long-press / more-menu action sheet for a single entry.
 *
 * Canonical action order (identical across the app so users build muscle
 * memory) : Ouvrir · Ouvrir avec… · Partager · Renommer · Copier ·
 * Déplacer · Compresser · Informations · Supprimer. Archive-specific
 * actions are grouped at the top when the entry is an archive.
 */
export function EntryActionSheet({
  open,
  entry,
  onClose,
  onAction,
}: {
  open: boolean;
  entry: FileEntry | null;
  onClose: () => void;
  onAction: (action: EntryAction) => void;
}) {
  const t = useT();
  const pkgKind = entry ? packageKindOf(entry) : null;
  const isArchive = entry ? canReadArchive(entry) && !pkgKind : false;
  const showOpen = entry ? !pkgKind && canOpenInViewer(entry) && canPreview(entry) : false;
  const showOpenWith = entry ? !entry.isDirectory : false;
  const showEditAudio = entry ? !entry.isDirectory && entry.kind === "audio" : false;
  return (
    <BottomSheet open={open && !!entry} onClose={onClose}>
      {entry ? (
        <>
          <div className="mb-3 flex items-center gap-3">
            <FileIcon kind={entry.kind} path={entry.path} />
            <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{entry.name}</p>
          </div>
          <div className="flex flex-col">
            {pkgKind ? (
              <>
                <ActionRow
                  icon={Package}
                  label={
                    pkgKind === "apk"
                      ? t("files.actions.installApp")
                      : t("files.actions.openPackage")
                  }
                  onClick={() => onAction("open")}
                />
                {canReadArchive(entry) ? (
                  <>
                    <ActionRow
                      icon={PackageOpen}
                      label={t("files.actions.exploreContent")}
                      onClick={() => onAction("openArchive")}
                    />
                    <ActionRow
                      icon={Package}
                      label={t("files.actions.extractEllipsis")}
                      onClick={() => onAction("extract")}
                    />
                  </>
                ) : null}
                <div className="my-1 h-px bg-border/40" />
              </>
            ) : null}
            {isArchive ? (
              <>
                <ActionRow
                  icon={PackageOpen}
                  label={t("files.actions.openArchive")}
                  onClick={() => onAction("openArchive")}
                />
                <ActionRow
                  icon={Package}
                  label={t("files.actions.extractEllipsis")}
                  onClick={() => onAction("extract")}
                />
                <div className="my-1 h-px bg-border/40" />
              </>
            ) : null}
            {showOpen ? (
              <ActionRow
                icon={Eye}
                label={t("files.actions.openWithApp")}
                onClick={() => onAction("open")}
              />
            ) : null}
            {showOpenWith ? (
              <ActionRow
                icon={ExternalLink}
                label={t("files.actions.openWithOther")}
                onClick={() => onAction("openWith")}
              />
            ) : null}
            {showEditAudio ? (
              <ActionRow
                icon={Waves}
                label={t("files.actions.editAudio")}
                onClick={() => onAction("editAudio")}
              />
            ) : null}
            {!entry.isDirectory ? (
              <ActionRow
                icon={Share2}
                label={t("action.share")}
                onClick={() => onAction("share")}
              />
            ) : null}
            <ActionRow
              icon={SquarePen}
              label={t("action.rename")}
              onClick={() => onAction("rename")}
            />
            <ActionRow
              icon={Copy}
              label={t("files.actions.copyTo")}
              onClick={() => onAction("copy")}
            />
            <ActionRow
              icon={FolderInput}
              label={t("files.actions.moveTo")}
              onClick={() => onAction("move")}
            />
            <ActionRow
              icon={FileArchive}
              label={t("files.actions.compressEllipsis")}
              onClick={() => onAction("compress")}
            />
            <ActionRow icon={Info} label={t("action.details")} onClick={() => onAction("info")} />
            <div className="my-1 h-px bg-border/40" />
            <ActionRow
              icon={Trash2}
              label={t("action.delete")}
              onClick={() => onAction("delete")}
              danger
            />
          </div>
        </>
      ) : null}
    </BottomSheet>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Info;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-left text-[13.5px] transition-colors active:bg-secondary/60 hover:bg-secondary/60 ${
        danger ? "text-red-400" : "text-foreground"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          danger ? "bg-red-500/12 text-red-400" : "bg-secondary/60 text-muted-foreground"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
