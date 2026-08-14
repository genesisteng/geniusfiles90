/**
 * Session de sélection GeniusFiles.
 *
 * Il n'existe plus d'« écran de sélection » séparé : quand une
 * fonctionnalité (outils PDF, transfert, coffre-fort, automatisations…)
 * a besoin de fichiers ou de dossiers, elle ouvre une *session de
 * sélection*. L'interface officielle de GeniusFiles (accueil, stockages,
 * catégories, dossiers, fichiers récents, recherche, tri) est alors
 * présentée telle quelle, en mode sélection, par-dessus la
 * fonctionnalité appelante — qui reste montée et conserve donc tout son
 * contexte (fichiers déjà chargés, annotations en cours, options…).
 *
 * La session vit dans un store module (hors React) : elle survit à
 * toute navigation interne et n'est résolue qu'à la validation ou à
 * l'annulation.
 */
import { t } from "@/lib/i18n";
import { useSyncExternalStore } from "react";

import type { CategoryKind } from "@/lib/files/categories";

import { toAbsolutePath } from "./fs";
import { clearSelectionStore, selectionGroups } from "./selection-store";
import type { FileEntry, PathRef } from "./types";

/** Ce que la fonctionnalité appelante accepte. */
export type PickAccept = "files" | "folders" | "both";

/** Élément réellement sélectionné, transmis à la fonctionnalité. */
export type PickedDetail = {
  key: string;
  entry: FileEntry;
  absolutePath: string;
  /** Dossier réel contenant l'élément. */
  parent: PathRef | null;
};

/** Écran officiel affiché pendant la sélection. */
export type PickScreen =
  | { kind: "home" }
  | { kind: "category"; category: CategoryKind }
  | { kind: "apps" }
  | { kind: "recents" }
  | { kind: "search" };

export type PickRequest = {
  id: number;
  accept: PickAccept;
  multi: boolean;
  /** Extensions minuscules sans point ; vide = tout accepter. */
  extensions: string[];
  /** Intitulé affiché en tête du mode sélection. */
  title: string;
};

type Session = PickRequest & {
  resolve: (result: PickedDetail[] | null) => void;
};

let session: Session | null = null;
let request: PickRequest | null = null;
let stack: PickScreen[] = [{ kind: "home" }];
let nextId = 1;

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getPickRequest(): PickRequest | null {
  return request;
}
export function isPickActive(): boolean {
  return request !== null;
}
export function getPickStack(): PickScreen[] {
  return stack;
}
export function getPickScreen(): PickScreen {
  return stack[stack.length - 1] ?? { kind: "home" };
}

/**
 * Démarre une session de sélection et renvoie les éléments validés
 * (`null` si l'utilisateur annule).
 */
export function requestPick(opts: {
  accept?: PickAccept;
  multi: boolean;
  extensions?: string[];
  /** Message affiché à l'utilisateur (« Sélectionnez les PDF à importer »). */
  title?: string;
}): Promise<PickedDetail[] | null> {
  // Une nouvelle demande annule proprement la précédente.
  if (session) session.resolve(null);
  clearSelectionStore();
  stack = [{ kind: "home" }];
  return new Promise<PickedDetail[] | null>((resolve) => {
    const id = nextId++;
    const accept = opts.accept ?? "files";
    const multi = opts.multi;
    session = {
      id,
      accept,
      multi,
      extensions: (opts.extensions ?? []).map((e) => e.toLowerCase()),
      title: opts.title?.trim() || defaultPickTitle(accept, multi),
      resolve,
    };
    request = {
      id,
      accept: session.accept,
      multi: session.multi,
      extensions: session.extensions,
      title: session.title,
    };
    emit();
  });
}

function finish(result: PickedDetail[] | null) {
  const current = session;
  session = null;
  request = null;
  stack = [{ kind: "home" }];
  clearSelectionStore();
  emit();
  current?.resolve(result);
}

export function cancelPick(): void {
  if (session) finish(null);
}

function defaultPickTitle(accept: PickAccept, multi: boolean): string {
  if (accept === "folders")
    return multi ? t("files.pick.titleFolders") : t("files.pick.titleFolder");
  if (accept === "both") return multi ? t("files.pick.titleItems") : t("files.pick.titleItem");
  return multi ? t("files.pick.titleFiles") : t("files.pick.titleFile");
}

/** Vrai si la session peut recevoir des APK (tuile « Applications »). */
export function pickAllowsApk(req: PickRequest): boolean {
  if (req.accept === "folders") return false;
  return req.extensions.length === 0 || req.extensions.includes("apk");
}

/** Vrai si l'élément correspond à ce que la fonctionnalité accepte. */
export function pickAccepts(entry: FileEntry, req: PickRequest): boolean {
  if (entry.isDirectory) return req.accept !== "files";
  if (req.accept === "folders") return false;
  if (req.extensions.length === 0) return true;
  const ext = (entry.ext ?? entry.name.split(".").pop() ?? "").toLowerCase();
  return req.extensions.includes(ext);
}

function detailOf(parent: PathRef, entry: FileEntry): PickedDetail {
  return {
    key: `${parent.rootId}:${parent.segments.join("/")}\u0000${entry.name}`,
    entry,
    absolutePath: entry.path ?? `${toAbsolutePath(parent)}/${entry.name}`,
    parent,
  };
}

/** Valide la sélection courante (ou un élément précis pour une sélection unique). */
export function confirmPick(single?: { parent: PathRef; entry: FileEntry }): PickedDetail[] {
  const req = request;
  if (!req) return [];
  const details: PickedDetail[] = [];
  if (single) {
    details.push(detailOf(single.parent, single.entry));
  } else {
    for (const group of selectionGroups()) {
      for (const entry of group.entries) details.push(detailOf(group.parent, entry));
    }
  }
  const kept = details.filter((d) => pickAccepts(d.entry, req));
  finish(kept);
  return kept;
}

/* ── Navigation interne de la session ───────────────────────────── */

export function pushPickScreen(screen: PickScreen): void {
  stack = [...stack, screen];
  emit();
}

/** Revient à l'écran précédent ; `false` s'il n'y a plus rien à dépiler. */
export function popPickScreen(): boolean {
  if (stack.length <= 1) return false;
  stack = stack.slice(0, -1);
  emit();
  return true;
}

/* ── Abonnements React ──────────────────────────────────────────── */

export function usePickRequest(): PickRequest | null {
  return useSyncExternalStore(subscribe, getPickRequest, () => null);
}

export function usePickScreen(): PickScreen {
  return useSyncExternalStore(subscribe, getPickScreen, () => stack[0]);
}
