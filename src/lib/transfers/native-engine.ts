/**
 * Pont vers le moteur natif de copie / déplacement (`FileOpsService`).
 *
 * Quand il est disponible (build Android), toute l'opération s'exécute en
 * Kotlin dans un service au premier plan : la WebView n'écrit plus un seul
 * octet. Conséquences directes :
 *
 *  - interface toujours fluide, même sur 50 000 fichiers ;
 *  - la tâche survit à la mise en arrière-plan, à l'écran éteint et à la
 *    fermeture de l'application depuis les applications récentes ;
 *  - notification système native avec progression, vitesse, temps restant,
 *    fichier courant, bouton Annuler puis « Ouvrir le dossier » ;
 *  - reprise d'affichage instantanée au retour dans l'app via `listNativeTasks`.
 *
 * En l'absence du moteur natif (aperçu web, ancien build), l'appelant
 * bascule automatiquement sur la boucle JavaScript existante.
 */
import { isAndroidNative, nativePlugin } from "@/lib/native/geniusfiles-native";

export type NativeTaskSnapshot = {
  id: string;
  mode: "copy" | "move";
  status: "running" | "done" | "failed" | "cancelled";
  title: string;
  destination: string;
  total: number;
  completed: number;
  bytes: number;
  totalBytes: number;
  speedBps: number;
  etaMs: number;
  currentName: string;
  startedAt: number;
  endedAt: number;
  failures: { name: string; reason: string }[];
};

type FileOpsPlugin = {
  fileOpStart?: (o: {
    id: string;
    mode: "copy" | "move";
    sources: string[];
    destination: string;
    title?: string;
  }) => Promise<NativeTaskSnapshot>;
  fileOpCancel?: (o: { id: string }) => Promise<void>;
  fileOpList?: () => Promise<{ tasks: NativeTaskSnapshot[] }>;
  consumePendingOpenPath?: () => Promise<{ path: string }>;
  addListener?: (
    event: string,
    cb: (payload: unknown) => void,
  ) => Promise<{ remove: () => void }> | { remove: () => void };
};

function plugin(): FileOpsPlugin | null {
  return nativePlugin() as unknown as FileOpsPlugin | null;
}

export function isNativeTransferAvailable(): boolean {
  return isAndroidNative() && typeof plugin()?.fileOpStart === "function";
}

export async function startNativeTask(input: {
  id: string;
  mode: "copy" | "move";
  sources: string[];
  destination: string;
  title?: string;
}): Promise<boolean> {
  const p = plugin();
  if (!p?.fileOpStart) return false;
  try {
    await p.fileOpStart(input);
    return true;
  } catch {
    return false;
  }
}

export function cancelNativeTask(id: string) {
  void plugin()?.fileOpCancel?.({ id });
}

export async function listNativeTasks(): Promise<NativeTaskSnapshot[]> {
  const p = plugin();
  if (!p?.fileOpList) return [];
  try {
    return (await p.fileOpList()).tasks ?? [];
  } catch {
    return [];
  }
}

export async function consumePendingOpenPath(): Promise<string | null> {
  const p = plugin();
  if (!p?.consumePendingOpenPath) return null;
  try {
    const { path } = await p.consumePendingOpenPath();
    return path || null;
  } catch {
    return null;
  }
}

export function onNativeTaskEvent(
  cb: (event: "progress" | "done", task: NativeTaskSnapshot) => void,
): () => void {
  const p = plugin();
  if (!p?.addListener) return () => {};
  const handles: { remove: () => void }[] = [];
  const wire = (name: string, kind: "progress" | "done") => {
    const h = p.addListener!(name, (payload) => cb(kind, payload as NativeTaskSnapshot));
    if (h instanceof Promise) void h.then((x) => handles.push(x));
    else handles.push(h);
  };
  wire("fileOpProgress", "progress");
  wire("fileOpDone", "done");
  return () => {
    for (const h of handles) {
      try {
        h.remove();
      } catch {
        /* ignore */
      }
    }
  };
}
