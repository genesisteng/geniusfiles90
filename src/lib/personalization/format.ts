/**
 * Formatage tailles / dates / heures selon les préférences.
 *
 * Ces helpers sont facultatifs — le code existant peut continuer à
 * utiliser ses propres formatteurs. Ils sont branchés en priorité par
 * l'aperçu du centre de personnalisation.
 */
import { loadPrefs } from "./store";
import type { DateFormat, PersonalizationPrefs, SizeUnitFormat, TimeFormat } from "./types";

export function formatSize(bytes: number, mode: SizeUnitFormat = loadPrefs().files.sizeUnit) {
  const decimal = mode === "decimal" || (mode === "auto" && false);
  const base = decimal ? 1000 : 1024;
  const units = decimal ? ["o", "ko", "Mo", "Go", "To"] : ["o", "Kio", "Mio", "Gio", "Tio"];
  if (!Number.isFinite(bytes)) return "—";
  let i = 0;
  let n = bytes;
  while (n >= base && i < units.length - 1) {
    n /= base;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDate(ts: number, prefs?: PersonalizationPrefs) {
  const p = prefs ?? loadPrefs();
  const fmt: DateFormat = p.files.dateFormat;
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  switch (fmt) {
    case "iso":
      return `${y}-${m}-${day}`;
    case "eu":
      return `${day}/${m}/${y}`;
    case "us":
      return `${m}/${day}/${y}`;
    case "relative": {
      const diff = Date.now() - ts;
      const day = 86400_000;
      if (diff < day) return "Aujourd'hui";
      if (diff < 2 * day) return "Hier";
      if (diff < 7 * day) return `Il y a ${Math.round(diff / day)} j`;
      return d.toLocaleDateString("fr-FR");
    }
    case "auto":
    default:
      return d.toLocaleDateString("fr-FR");
  }
}

export function formatTime(ts: number, prefs?: PersonalizationPrefs) {
  const p = prefs ?? loadPrefs();
  const fmt: TimeFormat = p.files.timeFormat;
  const d = new Date(ts);
  if (fmt === "24h") {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  if (fmt === "12h") {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
