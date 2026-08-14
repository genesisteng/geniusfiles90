/**
 * Vérification des autorisations nécessaires à l'exécution.
 *
 * Sur Android, l'accès au stockage requiert `MANAGE_EXTERNAL_STORAGE`.
 * Sur le web (preview), aucune permission n'est requise — le moteur
 * opère sur le dataset mock. Les commandes purement calculatoires
 * (`sort`, `filter`) n'ont pas besoin d'autorisation.
 */
import { isAndroidNative } from "@/lib/native/geniusfiles-native";
import { promptStorageAccess, refreshStorageAccess } from "@/lib/native/storage-access";
import { EngineExecutionError } from "./errors";
import { t } from "@/lib/i18n";

export type PermissionScope = "none" | "storage.read" | "storage.write";

const CACHE_TTL_MS = 5_000;
let cached: { at: number; granted: boolean } | null = null;

async function isStorageGranted(): Promise<boolean> {
  if (!isAndroidNative()) return true;
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.granted;
  const state = await refreshStorageAccess(true);
  const granted = state === "granted" || state === "unavailable";
  cached = { at: now, granted };
  return granted;
}

export async function ensurePermission(scope: PermissionScope): Promise<void> {
  if (scope === "none") return;
  const ok = await isStorageGranted();
  if (!ok) {
    // Demande contextuelle : l'utilisateur voit le dialogue léger au moment
    // exact où la fonctionnalité en a besoin, sans boucle ni page bloquante.
    promptStorageAccess(t("system.permission.contextualPrompt"));
    throw new EngineExecutionError("PERMISSION_DENIED", t("system.permission.notGranted"));
  }
}

/** Vidé après une modification de permission (utile pour les tests). */
export function invalidatePermissionCache(): void {
  cached = null;
}
