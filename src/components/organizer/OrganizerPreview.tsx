/**
 * Aperçu avant/après d'un plan d'organisation.
 *
 * Reçoit un `OrgPreview` et affiche par dossier concerné :
 * - ce qui est ajouté, retiré, renommé ;
 * - un état visuel « avant → après » avec badges de diff.
 */
import { ArrowRight, FolderPlus, MinusCircle, PlusCircle, PencilLine } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { OrgPreview } from "@/lib/organizer";

function displayPath(segments: string[]): string {
  return segments.length ? "/" + segments.join("/") : "/";
}

export function OrganizerPreview({ preview }: { preview: OrgPreview }) {
  const t = useT();
  if (preview.nodes.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground">{t("organize.preview.noChangesGlobal")}</p>
    );
  }
  return (
    <div className="space-y-3">
      {preview.createdFolders.length > 0 ? (
        <div className="rounded-xl border border-border bg-secondary/40 p-3">
          <div className="flex items-center gap-1.5 text-[12px] font-medium">
            <FolderPlus className="h-3.5 w-3.5 text-primary" />{" "}
            {t("organize.preview.createdFolders")}
          </div>
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
            {preview.createdFolders.map((p) => (
              <li key={displayPath(p.segments)} className="truncate font-mono">
                {displayPath(p.segments)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview.nodes.map((n) => (
        <div key={displayPath(n.parent.segments)} className="rounded-xl border border-border p-3">
          <p className="mb-2 truncate font-mono text-[11px] text-muted-foreground">
            {displayPath(n.parent.segments)}
          </p>
          <div className="space-y-1 text-[12px]">
            {n.renames.map((r) => (
              <div key={r.from} className="flex items-center gap-2">
                <PencilLine className="h-3.5 w-3.5 text-primary" />
                <span className="truncate line-through opacity-60">{r.from}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="truncate font-medium">{r.to}</span>
              </div>
            ))}
            {n.removals.map((name) => (
              <div key={"r" + name} className="flex items-center gap-2 text-muted-foreground">
                <MinusCircle className="h-3.5 w-3.5 text-red-400" />
                <span className="truncate">{name}</span>
              </div>
            ))}
            {n.additions.map((name) => (
              <div key={"a" + name} className="flex items-center gap-2">
                <PlusCircle className="h-3.5 w-3.5 text-emerald-400" />
                <span className="truncate">{name}</span>
              </div>
            ))}
            {n.additions.length + n.removals.length + n.renames.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {t("organize.preview.noChangesNode")}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
