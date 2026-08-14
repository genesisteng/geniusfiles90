/**
 * Feuille de revue d'une catégorie du Nettoyeur.
 *
 * Chaque élément proposé est présenté avec sa miniature réelle, son
 * chemin complet, sa taille, sa date et surtout le MOTIF de la
 * proposition. Un appui sur la miniature ouvre le fichier dans le
 * lecteur intégré : l'utilisateur peut vérifier avant de décider.
 *
 * Cas particulier des doublons : les éléments sont regroupés, la copie
 * conservée est affichée en tête, verrouillée, et « tout sélectionner »
 * ne peut jamais la cocher.
 */
import { useMemo, useState } from "react";
import { ArrowLeft, ShieldCheck, Lock } from "lucide-react";
import { BottomSheet, PrimaryButton } from "@/components/files/BottomSheet";
import { FileIcon } from "@/components/files/FileIcon";
import { UniversalViewer } from "@/components/viewer/UniversalViewer";
import { formatDate, formatSize } from "@/lib/files/format";
import type { CleanCategory, CleanItem } from "@/lib/cleaner/types";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { useT } from "@/lib/i18n";

function evidenceLabel(t: ReturnType<typeof useT>, key: string): string {
  switch (key) {
    case "content":
      return t("cleaner.evidence.content");
    case "size-name":
      return t("cleaner.evidence.sizeName");
    case "location":
      return t("cleaner.evidence.location");
    case "measured":
      return t("cleaner.evidence.measured");
    default:
      return key;
  }
}

function pathOf(parent: PathRef): string {
  return parent.segments.length > 0 ? `/${parent.segments.join("/")}` : "/";
}

type Group = { id: string; keeper: CleanItem | null; items: CleanItem[] };

export function CategorySheet({
  open,
  category,
  selection,
  onToggle,
  onSelectAll,
  onClose,
}: {
  open: boolean;
  category: CleanCategory | null;
  selection: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (all: boolean) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const items = useMemo(() => category?.items ?? [], [category]);

  /* Fichiers réellement ouvrables dans le lecteur intégré. */
  const viewable = useMemo(() => items.filter((i) => !i.entry.isDirectory), [items]);
  const viewerEntries = useMemo<FileEntry[]>(() => viewable.map((i) => i.entry), [viewable]);
  const parentById = useMemo(() => {
    const map = new Map<string, PathRef>();
    for (const i of viewable) map.set(i.entry.path || i.id, i.parent);
    return map;
  }, [viewable]);

  const groups = useMemo<Group[]>(() => {
    if (!category) return [];
    if (category.key !== "duplicates") {
      return [{ id: "all", keeper: null, items }];
    }
    const byGroup = new Map<string, Group>();
    for (const it of items) {
      const gid = it.group ?? it.id;
      const g = byGroup.get(gid) ?? { id: gid, keeper: null, items: [] };
      if (it.keeper) g.keeper = it;
      else g.items.push(it);
      byGroup.set(gid, g);
    }
    return [...byGroup.values()].filter((g) => g.items.length > 0);
  }, [category, items]);

  const selectable = useMemo(() => items.filter((i) => !i.keeper), [items]);
  const allSelected = selectable.length > 0 && selection.size >= selectable.length;

  if (!category) {
    return (
      <BottomSheet open={open} onClose={onClose} title={t("cleaner.sheet.title.fallback")}>
        <div className="text-[12px] text-muted-foreground">{t("cleaner.sheet.noData")}</div>
      </BottomSheet>
    );
  }

  const renderItem = (item: CleanItem, locked = false) => {
    const checked = !locked && selection.has(item.id);
    const idx = viewable.findIndex((v) => v.id === item.id);
    return (
      <li key={item.id}>
        <div
          className={`flex w-full items-center gap-2.5 rounded-2xl border p-2 text-left transition-colors ${
            locked
              ? "border-border/60 bg-surface-2/70"
              : checked
                ? "border-primary/50 bg-primary/10"
                : "border-border bg-surface/60"
          }`}
        >
          {locked ? (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-surface-3 text-muted-foreground"
              aria-label={t("cleaner.sheet.lockedAria")}
            >
              <Lock className="h-3 w-3" />
            </span>
          ) : (
            <button
              type="button"
              role="checkbox"
              aria-checked={checked}
              aria-label={t("cleaner.sheet.selectAria", { name: item.entry.name })}
              onClick={() => onToggle(item.id)}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface"
              }`}
            >
              {checked ? "✓" : ""}
            </button>
          )}

          <button
            type="button"
            disabled={idx < 0}
            aria-label={t("cleaner.sheet.previewAria", { name: item.entry.name })}
            onClick={() => idx >= 0 && setViewerIndex(idx)}
            className="gf-press shrink-0 disabled:opacity-60"
          >
            <FileIcon kind={item.entry.kind} size="sm" path={item.entry.path} />
          </button>

          <button
            type="button"
            onClick={() => (locked ? undefined : onToggle(item.id))}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-[13px] font-medium">{item.entry.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{pathOf(item.parent)}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {item.reason}
              {item.entry.mtime ? ` · ${formatDate(item.entry.mtime)}` : ""}
            </p>
          </button>

          <span className="shrink-0 text-right">
            <span className="block text-[12px] font-semibold">{formatSize(item.entry.size)}</span>
            {item.evidence ? (
              <span className="block text-[10px] text-muted-foreground">
                {evidenceLabel(t, item.evidence)}
              </span>
            ) : null}
          </span>
        </div>
      </li>
    );
  };

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={category.label}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={onClose}>
              <span className="flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> {t("action.back")}
              </span>
            </PrimaryButton>
            <PrimaryButton
              disabled={selectable.length === 0}
              onClick={() => onSelectAll(!allSelected)}
            >
              {allSelected ? t("action.deselectAll") : t("action.selectAll")}
            </PrimaryButton>
          </>
        }
      >
        <p className="mb-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {category.description}
        </p>

        <div
          className={`mb-3 flex items-start gap-2 rounded-2xl p-2.5 text-[11.5px] leading-relaxed ${
            category.safety === "safe"
              ? "bg-primary-softer text-foreground"
              : "border border-warning/30 bg-warning/10 text-foreground"
          }`}
        >
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            {category.safety === "safe" ? t("cleaner.sheet.safe") : t("cleaner.sheet.review")}
          </span>
        </div>

        <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{t("cleaner.sheet.proposed", { count: selectable.length })}</span>
          <span>{t("cleaner.sheet.recoverable", { amount: formatSize(category.bytes) })}</span>
        </div>

        {items.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 p-4 text-center text-[12.5px] text-muted-foreground">
            {t("cleaner.sheet.emptyCategory")}
          </p>
        ) : category.key === "duplicates" ? (
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {groups.map((g) => (
              <div key={g.id} className="rounded-2xl bg-surface-2/60 p-2">
                <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("cleaner.sheet.group", { count: g.items.length + (g.keeper ? 1 : 0) })}
                </p>
                <ul className="space-y-1.5">
                  {g.keeper ? renderItem(g.keeper, true) : null}
                  {g.items.map((it) => renderItem(it))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
            {items.map((it) => renderItem(it))}
          </ul>
        )}
      </BottomSheet>

      <UniversalViewer
        open={viewerIndex !== null}
        parent={viewerIndex !== null ? (viewable[viewerIndex]?.parent ?? null) : null}
        entries={viewerEntries}
        index={viewerIndex ?? 0}
        onIndexChange={(i) => setViewerIndex(i)}
        onClose={() => setViewerIndex(null)}
        onAction={() => setViewerIndex(null)}
        parentOf={(entry) => parentById.get(entry.path) ?? null}
      />
    </>
  );
}
