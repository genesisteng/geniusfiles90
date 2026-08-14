/**
 * String normalization helpers for search — accent-insensitive, case-insensitive,
 * cheap enough to run on every entry name in a very large tree.
 */

/** Lowercase + strip diacritics + trim. Safe with empty strings. */
export function normalize(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Split a query into tokens on whitespace so "foo bar" matches any name
 * containing both "foo" and "bar", in any order.
 */
export function tokenize(query: string): string[] {
  const q = normalize(query);
  if (!q) return [];
  return q.split(/\s+/).filter(Boolean);
}

/**
 * Score a candidate name against a normalized query. Higher is better; 0 means no match.
 * - exact match: 1000
 * - starts-with: 700
 * - word-boundary hit: 500
 * - substring: 200
 * - fuzzy in-order chars: 50 (multi-token fallback)
 *
 * Multi-token queries score as the sum of the per-token scores, requiring every
 * token to be present (returns 0 if any token is missing).
 */
export function scoreName(rawName: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const name = normalize(rawName);
  if (!name) return 0;
  let total = 0;
  for (const t of tokens) {
    const s = scoreToken(name, t);
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

function scoreToken(name: string, token: string): number {
  if (!token) return 0;
  if (name === token) return 1000;
  if (name.startsWith(token)) return 700;
  // word boundary: preceded by separator
  const wb = new RegExp(`(^|[\\s._\\-\\(\\[])${escapeRe(token)}`);
  if (wb.test(name)) return 500;
  if (name.includes(token)) return 200;
  return fuzzyInOrder(name, token) ? 50 : 0;
}

function fuzzyInOrder(haystack: string, needle: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return false;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
