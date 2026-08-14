/**
 * Cache persistant + index inversé pour le moteur d'analyse.
 *
 * Stockage : localStorage (portable web + WebView Android). Le format est
 * versionné pour permettre des migrations sans perte des futurs modules.
 *
 * L'index inversé (token → clés de fichiers) est reconstruit à la demande
 * si absent, à partir des records existants. Cela évite tout retraitement
 * coûteux tant que les empreintes n'ont pas changé.
 */
import {
  fingerprintEquals,
  keyOf,
  type AnalysisRecord,
  type FileFingerprint,
  type FileKey,
  type IndexHit,
} from "./types";
import { tokenizeContent } from "./tokenize";

const RECORDS_KEY = "gf.analysis.records.v1";
const INDEX_KEY = "gf.analysis.index.v1";
const CURRENT_VERSION = 1;

type RecordsMap = Record<FileKey, AnalysisRecord>;
type InvIndex = Record<string, FileKey[]>;

let recordsCache: RecordsMap | null = null;
let indexCache: InvIndex | null = null;
let dirty = false;
let flushTimer: number | null = null;

function readJSON<T>(k: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function writeJSON(k: string, v: unknown) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* quota — silencieux */
  }
}

function ensureLoaded() {
  if (recordsCache && indexCache) return;
  recordsCache = readJSON<RecordsMap>(RECORDS_KEY, {});
  indexCache = readJSON<InvIndex>(INDEX_KEY, {});
  // Reconstruire l'index si vide mais records présents
  if (Object.keys(indexCache).length === 0 && Object.keys(recordsCache).length > 0) {
    for (const rec of Object.values(recordsCache)) reindex(rec);
    scheduleFlush();
  }
}

function scheduleFlush() {
  dirty = true;
  if (flushTimer != null || typeof window === "undefined") return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    if (!dirty) return;
    dirty = false;
    writeJSON(RECORDS_KEY, recordsCache ?? {});
    writeJSON(INDEX_KEY, indexCache ?? {});
  }, 400);
}

/** Retourne le record si l'empreinte correspond exactement. */
export function getFreshRecord(key: FileKey, fp: FileFingerprint): AnalysisRecord | null {
  ensureLoaded();
  const rec = recordsCache![key];
  if (!rec) return null;
  if (rec.version !== CURRENT_VERSION) return null;
  if (!fingerprintEquals(rec.fingerprint, fp)) return null;
  return rec;
}

export function getRecord(key: FileKey): AnalysisRecord | null {
  ensureLoaded();
  return recordsCache![key] ?? null;
}

export function saveRecord(rec: AnalysisRecord) {
  ensureLoaded();
  const previous = recordsCache![rec.key];
  if (previous) deindex(previous);
  rec.version = CURRENT_VERSION;
  recordsCache![rec.key] = rec;
  reindex(rec);
  scheduleFlush();
}

export function forgetRecord(key: FileKey) {
  ensureLoaded();
  const prev = recordsCache![key];
  if (!prev) return;
  deindex(prev);
  delete recordsCache![key];
  scheduleFlush();
}

/** Invalide un record dont l'empreinte a changé (déplacement/modif). */
export function invalidateIfStale(key: FileKey, fp: FileFingerprint): boolean {
  ensureLoaded();
  const rec = recordsCache![key];
  if (!rec) return false;
  if (fingerprintEquals(rec.fingerprint, fp)) return false;
  forgetRecord(key);
  return true;
}

/** Migration lors d'un renommage/déplacement. Réutilise l'analyse existante. */
export function migrateKey(oldKey: FileKey, newFp: FileFingerprint) {
  ensureLoaded();
  const rec = recordsCache![oldKey];
  if (!rec) return;
  const newKey = keyOf(newFp);
  if (newKey === oldKey) return;
  deindex(rec);
  delete recordsCache![oldKey];
  rec.key = newKey;
  rec.fingerprint = newFp;
  recordsCache![newKey] = rec;
  reindex(rec);
  scheduleFlush();
}

export function allRecords(): AnalysisRecord[] {
  ensureLoaded();
  return Object.values(recordsCache!);
}

export function recordCount(): number {
  ensureLoaded();
  return Object.keys(recordsCache!).length;
}

export function clearAll() {
  recordsCache = {};
  indexCache = {};
  writeJSON(RECORDS_KEY, {});
  writeJSON(INDEX_KEY, {});
}

/* ---------- index inversé ---------- */

function tokensOf(rec: AnalysisRecord): string[] {
  const parts: string[] = [];
  if (rec.content?.text) parts.push(rec.content.text);
  if (rec.content?.keywords?.length) parts.push(rec.content.keywords.join(" "));
  if (rec.content?.summary) parts.push(rec.content.summary);
  if (rec.content?.docType) parts.push(rec.content.docType);
  if (rec.image?.ocrText) parts.push(rec.image.ocrText);
  if (rec.image?.objects?.length) parts.push(rec.image.objects.join(" "));
  const flags: string[] = [];
  if (rec.image?.isScreenshot) flags.push("capture ecran screenshot");
  if (rec.image?.isReceipt) flags.push("recu ticket");
  if (rec.image?.isInvoice) flags.push("facture");
  if (rec.image?.isBusinessCard) flags.push("carte visite contact");
  if (rec.image?.isDocument) flags.push("document scan numerise");
  if (flags.length) parts.push(flags.join(" "));
  if (rec.media?.title) parts.push(rec.media.title);
  if (rec.media?.artist) parts.push(rec.media.artist);
  if (rec.media?.album) parts.push(rec.media.album);
  return tokenizeContent(parts.join(" "));
}

function reindex(rec: AnalysisRecord) {
  const seen = new Set<string>();
  for (const t of tokensOf(rec)) {
    if (seen.has(t)) continue;
    seen.add(t);
    const list = (indexCache![t] ??= []);
    if (!list.includes(rec.key)) list.push(rec.key);
  }
}
function deindex(rec: AnalysisRecord) {
  const seen = new Set<string>();
  for (const t of tokensOf(rec)) {
    if (seen.has(t)) continue;
    seen.add(t);
    const list = indexCache![t];
    if (!list) continue;
    const i = list.indexOf(rec.key);
    if (i >= 0) list.splice(i, 1);
    if (list.length === 0) delete indexCache![t];
  }
}

/** Recherche par tokens. Score = nombre de tokens matchés × 100 + bonus phrase. */
export function queryIndex(tokens: string[]): IndexHit[] {
  ensureLoaded();
  if (tokens.length === 0) return [];
  const counts = new Map<FileKey, number>();
  for (const t of tokens) {
    // match exact + préfixe
    const keys = new Set<FileKey>();
    if (indexCache![t]) for (const k of indexCache![t]) keys.add(k);
    // préfixe (limite à 32 pour éviter d'exploser)
    let scanned = 0;
    for (const [idxTok, list] of Object.entries(indexCache!)) {
      if (scanned++ > 4000) break;
      if (idxTok !== t && idxTok.startsWith(t)) for (const k of list) keys.add(k);
    }
    for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const hits: IndexHit[] = [];
  const phrase = tokens.join(" ");
  for (const [key, matched] of counts) {
    if (matched < Math.min(tokens.length, 1)) continue;
    const rec = recordsCache![key];
    if (!rec) continue;
    const excerpts = extractExcerpts(rec, tokens);
    let score = matched * 100;
    const hay = (rec.content?.text ?? rec.image?.ocrText ?? "").toLowerCase();
    if (hay.includes(phrase)) score += 300;
    if (matched === tokens.length) score += 150;
    hits.push({
      key,
      fingerprint: rec.fingerprint,
      score,
      matches: excerpts,
      source:
        rec.image?.ocrText && !rec.content?.text ? "image_ocr" : (rec.content?.source ?? "plain"),
    });
  }
  return hits;
}

function extractExcerpts(rec: AnalysisRecord, tokens: string[]): string[] {
  const src = rec.content?.text ?? rec.image?.ocrText ?? "";
  if (!src) return [];
  const lower = src.toLowerCase();
  const out: string[] = [];
  for (const t of tokens) {
    const i = lower.indexOf(t);
    if (i < 0) continue;
    const start = Math.max(0, i - 40);
    const end = Math.min(src.length, i + t.length + 60);
    out.push(
      (start > 0 ? "…" : "") +
        src.slice(start, end).replace(/\s+/g, " ").trim() +
        (end < src.length ? "…" : ""),
    );
    if (out.length >= 3) break;
  }
  return out;
}

/** Force le flush immédiat (utile avant un unload / pour tests). */
export function flushNow() {
  if (flushTimer != null && typeof window !== "undefined") {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!dirty) return;
  dirty = false;
  writeJSON(RECORDS_KEY, recordsCache ?? {});
  writeJSON(INDEX_KEY, indexCache ?? {});
}
