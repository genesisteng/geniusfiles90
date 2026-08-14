/**
 * Liste des dossiers d'une catégorie (onglet « Dossiers »).
 * Même gabarit de ligne que le gestionnaire de fichiers : icône dossier,
 * nom, nombre exact d'éléments de la catégorie.
 */
import { FileIcon } from "./FileIcon";
import { useWindowVirtualList } from "@/hooks/use-virtual-list";
import type { StorageRootId } from "@/lib/files/types";

export type CategoryFolder = {
  rootId: StorageRootId;
  segments: string[];
  name: string;
  count: number;
  /** Chemin d'une image représentative (albums) : miniature réelle. */
  coverPath?: string;
};

const ROW_HEIGHT = 62;

export function CategoryFolderList({
  folders,
  describeCount,
  onOpen,
}: {
  folders: CategoryFolder[];
  /** Formatte le nombre d'éléments du dossier (« 3 photos », « 3 files »…). */
  describeCount: (count: number) => string;
  onOpen: (folder: CategoryFolder) => void;
}) {
  const { enabled, parentRef, virtualizer, scrollMargin } = useWindowVirtualList({
    count: folders.length,
    estimateSize: ROW_HEIGHT,
    overscan: 10,
  });

  const row = (f: CategoryFolder) => (
    <button
      type="button"
      onClick={() => onOpen(f)}
      className="flex h-full min-h-[62px] w-full items-center gap-3 overflow-hidden px-4 py-2 text-left transition-colors duration-150 active:bg-secondary/60 hover:bg-secondary/35"
    >
      {f.coverPath ? (
        <FileIcon kind="image" path={f.coverPath} />
      ) : (
        <FileIcon kind="folder" path={`${f.rootId}/${f.segments.join("/")}`} />
      )}
      <div className="min-w-0 flex-1">
        <p className="gf-row-title truncate">{f.name}</p>
        <p className="gf-row-meta mt-0.5 truncate">{describeCount(f.count)}</p>
      </div>
    </button>
  );

  if (!enabled) {
    return (
      <div className="divide-y divide-border/45">
        {folders.map((f) => (
          <div key={`${f.rootId}/${f.segments.join("/")}`}>{row(f)}</div>
        ))}
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();
  return (
    <div
      ref={parentRef}
      className="divide-y divide-border/45"
      style={{ position: "relative", height: `${virtualizer.getTotalSize()}px` }}
    >
      {items.map((v) => {
        const f = folders[v.index];
        return (
          <div
            key={`${f.rootId}/${f.segments.join("/")}`}
            data-index={v.index}
            className="border-b border-border/45"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${ROW_HEIGHT}px`,
              transform: `translateY(${v.start - scrollMargin}px)`,
              contain: "layout paint style",
            }}
          >
            {row(f)}
          </div>
        );
      })}
    </div>
  );
}
