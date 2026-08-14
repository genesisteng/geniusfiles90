import { CheckSquare, ChevronRight, FolderPlus, HardDrive } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { PathRef } from "@/lib/files/types";
import { createFolder, listDirectory, toAbsolutePath } from "@/lib/files/fs";
import { useRoots } from "@/lib/fs/useRoots";
import { FileIcon } from "./FileIcon";
import { useT } from "@/lib/i18n";
import { BottomSheet, NamePrompt, PrimaryButton } from "./BottomSheet";

/**
 * Destination picker used by "Copier vers…" and "Déplacer vers…".
 * Navigates the same storage tree with folder-only rendering.
 */
export function DestinationPicker({
  open,
  title,
  initial,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  initial: PathRef | null;
  onCancel: () => void;
  onConfirm: (dest: PathRef) => void;
}) {
  const t = useT();
  const [path, setPath] = useState<PathRef | null>(initial);
  const { roots } = useRoots();
  const [folders, setFolders] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  useEffect(() => {
    if (open) setPath(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open || !path) {
      setFolders([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listDirectory(path).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok)
        setFolders(res.entries.filter((e) => e.isDirectory).map((e) => ({ name: e.name })));
      else setFolders([]);
    });
    return () => {
      cancelled = true;
    };
  }, [open, path, reloadTick]);

  return (
    <BottomSheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <PrimaryButton variant="ghost" onClick={onCancel}>
            {t("action.cancel")}
          </PrimaryButton>
          <PrimaryButton variant="ghost" onClick={() => setNewFolderOpen(true)} disabled={!path}>
            <FolderPlus className="mr-1 h-4 w-4" /> {t("files.destination.new")}
          </PrimaryButton>
          <PrimaryButton onClick={() => path && onConfirm(path)} disabled={!path}>
            {t("files.destination.choose")}
          </PrimaryButton>
        </>
      }
    >
      <div className="mb-2 flex items-center gap-1 overflow-x-auto text-[11px] text-muted-foreground">
        <button
          type="button"
          onClick={() => setPath(null)}
          className="rounded px-1.5 py-0.5 transition-colors hover:text-foreground"
        >
          {t("files.destination.locations")}
        </button>
        {path ? (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <button
              type="button"
              onClick={() => setPath({ rootId: path.rootId, segments: [] })}
              className="rounded px-1.5 py-0.5 transition-colors hover:text-foreground"
            >
              {roots.find((r) => r.id === path.rootId)?.label ?? path.rootId}
            </button>
            {path.segments.map((seg, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 shrink-0" />
                <button
                  type="button"
                  onClick={() =>
                    setPath({ rootId: path.rootId, segments: path.segments.slice(0, i + 1) })
                  }
                  className="rounded px-1.5 py-0.5 transition-colors hover:text-foreground"
                >
                  {seg}
                </button>
              </span>
            ))}
          </>
        ) : null}
      </div>

      <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-border">
        {!path ? (
          <ul className="divide-y divide-border">
            {roots
              .filter((r) => r.available)
              .map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setPath({ rootId: r.id, segments: [] })}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
                      <HardDrive className="h-4 w-4" />
                    </span>
                    <span className="flex-1 truncate text-[13px] font-medium">{r.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                  </button>
                </li>
              ))}
          </ul>
        ) : loading ? (
          <div className="py-6 text-center text-[12px] text-muted-foreground">
            {t("state.loading")}
          </div>
        ) : folders.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-muted-foreground">
            {t("files.destination.noSubfolder")}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {folders.map((f) => (
              <li key={f.name}>
                <button
                  type="button"
                  onClick={() =>
                    setPath({ rootId: path.rootId, segments: [...path.segments, f.name] })
                  }
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary/40"
                >
                  <FileIcon kind="folder" />
                  <span className="flex-1 truncate text-[13px]">{f.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        <CheckSquare className="h-3 w-3" /> {t("files.destination.hint")}
      </p>

      <NamePrompt
        open={newFolderOpen}
        title={t("action.newFolder")}
        label={t("files.destination.folderName")}
        initial=""
        cta={t("files.destination.create")}
        onCancel={() => setNewFolderOpen(false)}
        onSubmit={async (name) => {
          if (!path) return;
          const res = await createFolder(path, name);
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
          setNewFolderOpen(false);
          setPath({ rootId: path.rootId, segments: [...path.segments, name.trim()] });
          setReloadTick((t) => t + 1);
        }}
      />
    </BottomSheet>
  );
}
