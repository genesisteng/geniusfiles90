/**
 * « Ouvrir avec… » entrant (Android).
 *
 * Quand une autre application confie un fichier à GeniusFiles
 * (ACTION_VIEW / ACTION_EDIT / ACTION_SEND), le plugin natif
 * `GeniusFilesIntent` mémorise l'URI puis la résout à la demande :
 * chemin réel quand le fichier est directement lisible, sinon copie
 * unique dans le cache de l'application.
 *
 * Web / SSR : toutes les fonctions renvoient `null` ou des no-op, la
 * prévisualisation Lovable reste identique.
 */
import { registerPlugin } from "@capacitor/core";

import { isAndroidNative } from "./geniusfiles-native";
import { kindOf } from "@/lib/files/format";
import type { FileEntry, PathRef, StorageRootId } from "@/lib/files/types";

export type IncomingAction = "view" | "edit";

export type IncomingFile = {
  /** Dossier réel du fichier (racine `abs:` — hors arborescence utilisateur). */
  parent: PathRef;
  entry: FileEntry;
  action: IncomingAction;
  /** Copie de travail dans le cache : à purger après fermeture. */
  temporary: boolean;
  mime?: string;
};

type ConsumeResult = {
  available: boolean;
  path?: string;
  name?: string;
  size?: number;
  mime?: string | null;
  action?: IncomingAction;
  temporary?: boolean;
  error?: string;
};

type IntentPlugin = {
  hasPending: () => Promise<{ pending: boolean }>;
  consume: () => Promise<ConsumeResult>;
  finishToCaller: () => Promise<void>;
  clearTemp: () => Promise<{ removed: number }>;
  addListener?: (
    event: "incomingFile",
    cb: (payload: { action: IncomingAction }) => void,
  ) => Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
};

const proxy = registerPlugin<IntentPlugin>("GeniusFilesIntent");

function plugin(): IntentPlugin | null {
  if (!isAndroidNative()) return null;
  return proxy;
}

/** Consomme le fichier entrant, ou `null` s'il n'y en a pas. */
export async function consumeIncomingFile(): Promise<IncomingFile | null> {
  const p = plugin();
  if (!p) return null;
  let res: ConsumeResult;
  try {
    res = await p.consume();
  } catch {
    return null;
  }
  if (!res?.available || !res.path || !res.name) return null;
  const dir = res.path.slice(0, res.path.lastIndexOf("/")) || "/";
  const parent: PathRef = { rootId: `abs:${dir}` as StorageRootId, segments: [] };
  const name = res.name;
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : undefined;
  const entry: FileEntry = {
    name,
    path: res.path,
    isDirectory: false,
    size: typeof res.size === "number" && res.size >= 0 ? res.size : undefined,
    mtime: Date.now(),
    kind: kindOf(name, false),
    ext,
  };
  return {
    parent,
    entry,
    action: res.action === "edit" ? "edit" : "view",
    temporary: res.temporary === true,
    mime: res.mime ?? undefined,
  };
}

/** S'abonne aux fichiers reçus pendant que l'application tourne déjà. */
export function onIncomingFile(cb: () => void): () => void {
  const p = plugin();
  if (!p?.addListener) return () => {};
  let handle: { remove: () => Promise<void> } | null = null;
  let cancelled = false;
  void (async () => {
    const h = await p.addListener!("incomingFile", () => cb());
    if (cancelled) void h.remove();
    else handle = h;
  })();
  return () => {
    cancelled = true;
    void handle?.remove();
  };
}

/** Revient à l'application appelante (ferme GeniusFiles). */
export async function finishToCaller(): Promise<void> {
  const p = plugin();
  if (!p) return;
  try {
    await p.finishToCaller();
  } catch {
    /* activité déjà détruite */
  }
}

/** Purge les copies de travail créées pour des URI non lisibles. */
export async function clearIncomingTemp(): Promise<void> {
  const p = plugin();
  if (!p) return;
  try {
    await p.clearTemp();
  } catch {
    /* cache indisponible */
  }
}
