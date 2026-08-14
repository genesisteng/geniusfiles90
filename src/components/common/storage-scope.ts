/**
 * Résolution d'une portée de stockage vers la liste concrète de racines.
 *
 * Séparé de `StorageScopePicker` pour que ce fichier de composants
 * n'exporte que des composants (rechargement à chaud).
 */
import type { StorageRoot, StorageRootId } from "@/lib/files/types";
import type { StorageScope } from "@/components/common/StorageScopePicker";

/** Resolve a scope value into the concrete list of roots to iterate on. */
export function resolveScope(scope: StorageScope, roots: StorageRoot[]): StorageRootId[] {
  const available = roots
    .filter((r) => r.available && (r.id === "internal" || r.id.startsWith("ext:")))
    .map((r) => r.id);
  if (scope === "all") return available.length ? available : ["internal"];
  return available.includes(scope) ? [scope] : ["internal"];
}
