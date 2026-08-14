/**
 * Accès complet au stockage — état partagé, non bloquant.
 *
 * GeniusFiles démarre TOUJOURS sur son accueil réel. Cette couche ne
 * bloque rien : elle observe l'état réel de l'autorisation Android,
 * l'expose au reste de l'application, et permet d'ouvrir un dialogue
 * contextuel léger quand une fonctionnalité en a réellement besoin.
 *
 * Garde-fous de performance :
 *  - une seule vérification au démarrage ;
 *  - une vérification au retour d'avant-plan (throttlée), utilisée pour
 *    détecter le retour depuis les paramètres Android ;
 *  - aucun polling permanent, aucun timer résident ;
 *  - dès que l'accès est accordé, tout écouteur natif suffit et les
 *    vérifications s'arrêtent.
 */
import {
  checkAllFilesAccess,
  isAndroidNative,
  onStoragePermissionChanged,
  requestAllFilesAccess,
  type StoragePermissionState,
} from "./geniusfiles-native";

export type StorageAccessState = "unknown" | StoragePermissionState;

let state: StorageAccessState = isAndroidNative() ? "unknown" : "unavailable";
const listeners = new Set<(s: StorageAccessState) => void>();
let started = false;
let lastCheck = 0;
const CHECK_THROTTLE_MS = 800;

/** L'utilisateur a répondu « Plus tard » : on ne le relance pas tout seul. */
const DEFER_KEY = "gf.storage-access.deferred";

export function isStorageAccessGranted(): boolean {
  return state === "granted" || state === "unavailable";
}

export function getStorageAccessState(): StorageAccessState {
  return state;
}

function emit() {
  for (const l of Array.from(listeners)) l(state);
}

function apply(next: StorageAccessState) {
  if (next === state) return;
  const wasGranted = isStorageAccessGranted();
  state = next;
  emit();
  if (!wasGranted && isStorageAccessGranted() && typeof window !== "undefined") {
    // Une seule invalidation ciblée : les écrans déjà montés rechargent
    // leurs données sans reconstruire l'application.
    window.dispatchEvent(new CustomEvent("gf:storage-changed"));
  }
}

export function subscribeStorageAccess(cb: (s: StorageAccessState) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function refreshStorageAccess(force = false): Promise<StorageAccessState> {
  if (!isAndroidNative()) {
    apply("unavailable");
    return state;
  }
  if (state === "granted") return state;
  const now = Date.now();
  if (!force && now - lastCheck < CHECK_THROTTLE_MS) return state;
  lastCheck = now;
  apply(await checkAllFilesAccess());
  return state;
}

/**
 * Démarre l'observation. Idempotent, appelé une fois depuis la racine
 * après la première peinture.
 */
export function startStorageAccessWatch(): () => void {
  if (!isAndroidNative()) {
    apply("unavailable");
    return () => {};
  }
  if (started) return () => {};
  started = true;

  void refreshStorageAccess(true);
  const unsubNative = onStoragePermissionChanged((s) => apply(s));

  let unsubApp: (() => void) | null = null;
  void import("@capacitor/app")
    .then(({ App }) => {
      const handle = App.addListener("appStateChange", (s) => {
        // Retour d'avant-plan : c'est le seul moment où l'utilisateur peut
        // revenir des paramètres Android. Aucun timer résident.
        if (s.isActive && state !== "granted") void refreshStorageAccess(true);
      });
      unsubApp = () => {
        void Promise.resolve(handle).then((h) => h?.remove?.());
      };
    })
    .catch(() => {});

  return () => {
    started = false;
    unsubNative();
    unsubApp?.();
  };
}

export function isStorageAccessDeferred(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(DEFER_KEY) === "1";
  } catch {
    return false;
  }
}

export function deferStorageAccess(): void {
  try {
    localStorage?.setItem(DEFER_KEY, "1");
  } catch {
    /* stockage indisponible : on garde le comportement en mémoire */
  }
}

/**
 * Ouvre le véritable écran Android d'accès à tous les fichiers.
 * Aucune simulation : l'état est ensuite relu depuis le système.
 */
export async function requestStorageAccess(): Promise<{
  ok: boolean;
  granted: boolean;
  openedSettings: boolean;
  message?: string;
}> {
  if (!isAndroidNative()) return { ok: true, granted: true, openedSettings: false };
  const res = await requestAllFilesAccess();
  if (res.state) apply(res.state);
  return {
    ok: res.ok,
    granted: res.state === "granted",
    openedSettings: Boolean(res.openedSettings),
    message: res.message,
  };
}

/** Demande d'ouverture du dialogue contextuel (fonctionnalité bloquée). */
export function promptStorageAccess(reason?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("gf:ask-storage-access", { detail: { reason } }));
}
