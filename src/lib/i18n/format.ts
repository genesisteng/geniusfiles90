/**
 * Mise en forme des valeurs selon la langue active.
 *
 * Les données réelles ne sont jamais modifiées : seule leur présentation
 * change (séparateurs de milliers, ordre des dates, unités de taille).
 */
import { getLocale } from "./store";
import { LOCALE_TAGS, type Locale } from "./types";

export function localeTag(locale: Locale = getLocale()): string {
  return LOCALE_TAGS[locale];
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale: Locale = getLocale(),
): string {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(LOCALE_TAGS[locale], options).format(value);
  } catch {
    return String(value);
  }
}

export function formatPercent(ratio: number, digits = 0, locale: Locale = getLocale()): string {
  return formatNumber(
    ratio,
    { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits },
    locale,
  );
}

const UNITS: Record<Locale, { binary: string[]; decimal: string[] }> = {
  fr: {
    binary: ["o", "Kio", "Mio", "Gio", "Tio"],
    decimal: ["o", "Ko", "Mo", "Go", "To"],
  },
  en: {
    binary: ["B", "KiB", "MiB", "GiB", "TiB"],
    decimal: ["B", "KB", "MB", "GB", "TB"],
  },
  es: {
    binary: ["B", "KiB", "MiB", "GiB", "TiB"],
    decimal: ["B", "KB", "MB", "GB", "TB"],
  },
  de: {
    binary: ["B", "KiB", "MiB", "GiB", "TiB"],
    decimal: ["B", "KB", "MB", "GB", "TB"],
  },
  pt: {
    binary: ["B", "KiB", "MiB", "GiB", "TiB"],
    decimal: ["B", "KB", "MB", "GB", "TB"],
  },
  it: {
    binary: ["B", "KiB", "MiB", "GiB", "TiB"],
    decimal: ["B", "KB", "MB", "GB", "TB"],
  },
  tr: {
    binary: ["B", "KiB", "MiB", "GiB", "TiB"],
    decimal: ["B", "KB", "MB", "GB", "TB"],
  },
};

/** Taille de fichier lisible : « 2,4 Go » / “2.4 GB”. */
export function formatBytes(bytes: number, opts?: { decimal?: boolean; locale?: Locale }): string {
  const locale = opts?.locale ?? getLocale();
  const decimal = opts?.decimal ?? false;
  const base = decimal ? 1000 : 1024;
  const units = decimal ? UNITS[locale].decimal : UNITS[locale].binary;
  if (!Number.isFinite(bytes)) return "—";
  let value = Math.max(0, bytes);
  let i = 0;
  while (value >= base && i < units.length - 1) {
    value /= base;
    i += 1;
  }
  const digits = i === 0 ? 0 : value < 10 ? 1 : 0;
  return `${formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits }, locale)} ${units[i]}`;
}

export function formatDateValue(
  ts: number,
  options?: Intl.DateTimeFormatOptions,
  locale: Locale = getLocale(),
): string {
  try {
    return new Intl.DateTimeFormat(LOCALE_TAGS[locale], options).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}
