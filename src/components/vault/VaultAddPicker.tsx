/**
 * Coffre-fort — sélection des fichiers ET dossiers à déplacer dans le
 * coffre, effectuée dans l'interface officielle de GeniusFiles.
 */
import { FileSourcePicker } from "@/components/files/FileSourcePicker";
import type { PublicSource } from "@/lib/vault/types";

export function VaultAddPicker({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (sources: PublicSource[]) => void;
}) {
  return (
    <FileSourcePicker
      open={open}
      extensions={[]}
      multi
      accept="both"
      onCancel={onCancel}
      onConfirm={(_paths, _entries, details) => {
        const sources: PublicSource[] = [];
        for (const d of details) {
          if (!d.parent) continue;
          sources.push({
            parent: d.parent,
            name: d.entry.name,
            isDirectory: d.entry.isDirectory,
            size: d.entry.size ?? 0,
          });
        }
        onConfirm(sources);
      }}
    />
  );
}
