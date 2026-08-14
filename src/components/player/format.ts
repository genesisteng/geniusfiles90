export function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = m.toString().padStart(h > 0 ? 2 : 1, "0");
  const ss = sec.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Best-effort parsing of "Artist - Title" style filenames.
 * Never throws; always returns a title.
 */
export function parseTrackName(filename: string): { title: string; artist?: string } {
  const base = filename.replace(/\.[^.]+$/, "");
  // "Artist - Title" or "01 - Artist - Title" etc.
  const parts = base.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    const first = parts[0].replace(/^\s*\d+\s*[.)-]?\s*/, "").trim();
    const rest = parts.slice(1).join(" - ").trim();
    if (first && rest) {
      // Numeric-only first token means it was a track number, not an artist.
      if (/^\d+$/.test(parts[0].trim())) return { title: rest };
      return { title: rest, artist: first };
    }
  }
  return { title: base.replace(/[_]+/g, " ").trim() || filename };
}
