/**
 * Export / import / réinitialisation des préférences.
 *
 * Le format d'export est un JSON auto-porteur (portable entre versions
 * mineures via `deepMerge` côté import) et lisible par un humain.
 */
import { DEFAULT_PREFS, type PersonalizationPrefs } from "./types";
import { loadPrefs, savePrefs, resetPrefs, resetSection } from "./store";
import { t } from "@/lib/i18n";

export type ExportedPrefs = {
  app: "GeniusFiles";
  kind: "personalization";
  exportedAt: number;
  version: 1;
  prefs: PersonalizationPrefs;
};

export function exportPrefs(): ExportedPrefs {
  return {
    app: "GeniusFiles",
    kind: "personalization",
    exportedAt: Date.now(),
    version: 1,
    prefs: loadPrefs(),
  };
}

export function exportPrefsBlob(): Blob {
  return new Blob([JSON.stringify(exportPrefs(), null, 2)], { type: "application/json" });
}

export function downloadPrefs(filename = "geniusfiles-preferences.json") {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(exportPrefsBlob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ImportOutcome =
  | { ok: true; prefs: PersonalizationPrefs }
  | { ok: false; reason: string };

export function importPrefsFromText(text: string): ImportOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: t("system.backup.invalidJson") };
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { app?: string }).app !== "GeniusFiles" ||
    (parsed as { kind?: string }).kind !== "personalization"
  ) {
    return { ok: false, reason: t("system.io.notAnExport") };
  }
  const incoming = (parsed as { prefs?: unknown }).prefs;
  if (!incoming || typeof incoming !== "object") {
    return { ok: false, reason: "Contenu invalide." };
  }
  // Fusion défensive sur les DEFAULTS pour tolérer les schémas antérieurs.
  const merged = { ...DEFAULT_PREFS, ...(incoming as Partial<PersonalizationPrefs>) };
  savePrefs(merged);
  return { ok: true, prefs: merged };
}

export async function importPrefsFromFile(file: File): Promise<ImportOutcome> {
  try {
    const text = await file.text();
    return importPrefsFromText(text);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export { resetPrefs, resetSection };
