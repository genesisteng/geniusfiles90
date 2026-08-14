/**
 * Post-creation action sheet displayed after a PDF is successfully
 * created by one of the "Créer" tools (Images → PDF, Scanner,
 * Texte → PDF, Convertir en PDF).
 *
 * Offers the five actions required by the product spec:
 *   Ouvrir · Partager · Renommer · Déplacer · Supprimer
 *
 * Uses the native GeniusFiles plugin directly when running on Android
 * (bypassing PathRef/FileEntry plumbing since we already know the
 * absolute path of the freshly written PDF). On the web preview all
 * actions degrade gracefully (open in new tab via a blob URL, Web
 * Share API when available, in-memory rename/delete).
 */
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors/humanize";
import { ExternalLink, Share2, Pencil, FolderInput, Trash2, FileText } from "lucide-react";
import { BottomSheet, PrimaryButton, TextField } from "@/components/files/BottomSheet";
import { DestinationPicker } from "@/components/files/DestinationPicker";
import { isAndroidNative, nativePlugin } from "@/lib/native/geniusfiles-native";
import { toAbsolutePath } from "@/lib/files/fs";
import { readPdfBlobUrl } from "@/lib/pdf/api";
import { useT } from "@/lib/i18n/react";

function basename(p: string) {
  return p.split("/").pop() ?? p;
}
function dirname(p: string) {
  const i = p.lastIndexOf("/");
  return i > 0 ? p.slice(0, i) : "";
}

export function PostCreateActions({
  path,
  onClose,
  onPathChanged,
}: {
  path: string;
  onClose: () => void;
  /** Called when the file has been renamed or moved so the caller can
   *  update its recorded path. */
  onPathChanged?: (newPath: string) => void;
}) {
  const t = useT();
  const [currentPath, setCurrentPath] = useState(path);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(basename(path));
  const [moveOpen, setMoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = async () => {
    const p = nativePlugin();
    if (isAndroidNative() && p) {
      try {
        await p.openFile({ path: currentPath });
      } catch (e) {
        toast.error(t("pdf.post.openFailed"), {
          description: errorMessage(e, t("pdf.post.openFailedDesc")),
        });
      }
      return;
    }
    // Web fallback
    try {
      const url = await readPdfBlobUrl(currentPath);
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error(t("pdf.post.previewUnavailable"), {
        description: t("pdf.post.previewUnavailableDesc"),
      });
    }
  };

  const share = async () => {
    const p = nativePlugin();
    if (isAndroidNative() && p) {
      try {
        await p.shareFiles({ paths: [currentPath] });
      } catch (e) {
        toast.error(t("pdf.post.shareFailed"), {
          description: errorMessage(e, t("pdf.post.shareFailedDesc")),
        });
      }
      return;
    }
    // Web fallback
    try {
      const url = await readPdfBlobUrl(currentPath);
      const nav = navigator as Navigator & {
        share?: (d: ShareData) => Promise<void>;
      };
      if (nav.share) {
        await nav.share({ title: basename(currentPath), url });
      } else {
        window.open(url, "_blank", "noopener");
      }
    } catch {
      toast.error(t("pdf.post.shareUnavailable"), {
        description: t("pdf.post.shareUnavailableDesc"),
      });
    }
  };

  const rename = async () => {
    const clean = newName.trim();
    if (!clean || /[\\/]/.test(clean)) {
      toast.error(t("pdf.post.badName"), {
        description: t("pdf.post.badNameDesc"),
      });
      return;
    }
    const finalName = clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
    setBusy(true);
    const p = nativePlugin();
    try {
      if (isAndroidNative() && p) {
        const res = await p.renamePath({ path: currentPath, newName: finalName });
        const nextPath = res.path ?? `${dirname(currentPath)}/${finalName}`;
        setCurrentPath(nextPath);
        onPathChanged?.(nextPath);
      } else {
        const nextPath = `${dirname(currentPath)}/${finalName}`;
        setCurrentPath(nextPath);
        onPathChanged?.(nextPath);
      }
      toast.success(t("pdf.post.renamed"), {
        description: t("pdf.post.renamedDesc", { name: finalName }),
      });
      setRenameOpen(false);
    } catch (e) {
      toast.error(t("pdf.post.renameFailed"), {
        description: errorMessage(e, t("pdf.post.renameFailedDesc")),
      });
    } finally {
      setBusy(false);
    }
  };

  const move = async (dest: { rootId: string; segments: string[] }) => {
    setMoveOpen(false);
    setBusy(true);
    const destDir = toAbsolutePath({ rootId: dest.rootId as never, segments: dest.segments });
    const destPath = `${destDir}/${basename(currentPath)}`;
    const p = nativePlugin();
    try {
      if (isAndroidNative() && p) {
        await p.moveFile({ source: currentPath, destination: destPath, overwrite: false });
      }
      setCurrentPath(destPath);
      onPathChanged?.(destPath);
      toast.success(t("pdf.post.moved"), {
        description: t("pdf.post.movedDesc", {
          name: basename(currentPath),
          folder: destDir.split("/").pop() || t("pdf.post.chosenFolder"),
        }),
      });
    } catch (e) {
      toast.error(t("pdf.post.moveFailed"), {
        description: errorMessage(e, t("pdf.post.moveFailedDesc")),
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(t("pdf.post.confirmTrash"))) return;
    setBusy(true);
    const p = nativePlugin();
    try {
      if (isAndroidNative() && p) {
        const res = await p.moveToTrash({ paths: [currentPath] });
        if (res.failed.length) throw new Error(t("pdf.post.trashFailedItem"));
      }
      toast.success(t("pdf.post.trashed"), {
        description: t("pdf.post.trashedDesc"),
      });
      onClose();
    } catch (e) {
      toast.error(t("pdf.post.deleteFailed"), {
        description: errorMessage(e, t("pdf.post.deleteFailedDesc")),
      });
    } finally {
      setBusy(false);
    }
  };

  const Action = ({
    icon: Icon,
    label,
    onClick,
    danger,
  }: {
    icon: typeof ExternalLink;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }) => (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left text-[13px] disabled:opacity-50 ${
        danger ? "hover:border-red-500 hover:text-red-500" : "hover:border-primary"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
    </button>
  );

  return (
    <>
      <BottomSheet
        open={!renameOpen && !moveOpen}
        onClose={onClose}
        title={t("pdf.post.title")}
        footer={
          <PrimaryButton variant="ghost" onClick={onClose}>
            {t("pdf.post.done")}
          </PrimaryButton>
        }
      >
        <div className="space-y-2">
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface p-2 text-[12px]">
            <FileText className="h-4 w-4 text-primary" />
            <span className="flex-1 truncate">{basename(currentPath)}</span>
          </div>
          <p className="mb-2 text-[11px] text-muted-foreground truncate">{dirname(currentPath)}</p>
          <Action icon={ExternalLink} label={t("pdf.post.open")} onClick={open} />
          <Action icon={Share2} label={t("pdf.post.share")} onClick={share} />
          <Action
            icon={Pencil}
            label={t("pdf.post.rename")}
            onClick={() => {
              setNewName(basename(currentPath));
              setRenameOpen(true);
            }}
          />
          <Action icon={FolderInput} label={t("pdf.post.move")} onClick={() => setMoveOpen(true)} />
          <Action icon={Trash2} label={t("pdf.post.delete")} onClick={remove} danger />
        </div>
      </BottomSheet>

      <BottomSheet
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title={t("pdf.post.renameTitle")}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={() => setRenameOpen(false)}>
              {t("pdf.post.cancel")}
            </PrimaryButton>
            <PrimaryButton onClick={rename} disabled={busy || !newName.trim()}>
              {t("pdf.post.rename")}
            </PrimaryButton>
          </>
        }
      >
        <TextField value={newName} onChange={setNewName} placeholder="document.pdf" />
      </BottomSheet>

      <DestinationPicker
        open={moveOpen}
        title={t("pdf.post.moveTitle")}
        initial={null}
        onCancel={() => setMoveOpen(false)}
        onConfirm={move}
      />
    </>
  );
}
