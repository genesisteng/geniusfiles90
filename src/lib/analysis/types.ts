/**
 * GeniusFiles — Moteur d'analyse intelligente.
 *
 * Contrats de types partagés par tous les analyseurs, la file d'attente,
 * le cache et les providers de recherche. Volontairement dénué d'imports
 * navigateur/Capacitor pour être utilisable côté SSR et natif.
 *
 * Réservations (champs vides mais typés) pour évolutions futures sans
 * casser la surface : reconnaissance faciale, transcription audio/vidéo,
 * traduction, résumé vidéo, doublons visuels avancés, recherche
 * multimodale, recommandations d'organisation.
 */
import type { FileEntry, FileKind, PathRef, StorageRootId } from "@/lib/files/types";

/** Empreinte stable d'un fichier — invalide le cache quand elle change. */
export type FileFingerprint = {
  rootId: StorageRootId;
  segments: string[];
  size?: number;
  mtime?: number;
  ext?: string;
};

export type FileKey = string; // `${rootId}::${segments.join("/")}`

export function keyOf(fp: { rootId: StorageRootId; segments: string[] }): FileKey {
  return `${fp.rootId}::${fp.segments.join("/")}`;
}

export function fingerprintOf(
  rootId: StorageRootId,
  segments: string[],
  e: FileEntry,
): FileFingerprint {
  return { rootId, segments, size: e.size, mtime: e.mtime, ext: e.ext };
}

export function fingerprintEquals(a?: FileFingerprint, b?: FileFingerprint): boolean {
  if (!a || !b) return false;
  return (
    a.rootId === b.rootId &&
    a.segments.length === b.segments.length &&
    a.segments.every((s, i) => s === b.segments[i]) &&
    (a.size ?? -1) === (b.size ?? -1) &&
    (a.mtime ?? -1) === (b.mtime ?? -1)
  );
}

/** Analyse contenu texte / document / PDF. */
export type ContentAnalysis = {
  /** Texte extrait, tronqué si nécessaire. */
  text: string;
  /** Longueur brute avant troncature. */
  rawLength: number;
  /** Truncated ? */
  truncated: boolean;
  /** Origine du texte. */
  source: "plain" | "pdf" | "ocr" | "docx" | "csv" | "code";
  /** Langue devinée (heuristique bigrammes). */
  lang?: "fr" | "en" | "unknown";
  /** Mots-clés proposés (top-N, sans stopwords). */
  keywords: string[];
  /** Résumé (premières phrases significatives). */
  summary?: string;
  /** Type de document deviné (facture, contrat, cv, reçu, note, article...). */
  docType?: DocType;
  /** Catégories de classement suggérées. */
  categories?: string[];
};

export type DocType =
  | "facture"
  | "recu"
  | "contrat"
  | "cv"
  | "carte_visite"
  | "note"
  | "article"
  | "rapport"
  | "tableau"
  | "code"
  | "inconnu";

/** Analyse visuelle d'une image. */
export type ImageAnalysis = {
  width?: number;
  height?: number;
  aspect?: number;
  /** aHash 64 bits (hex) pour détection de similarité. */
  aHash?: string;
  /** Palette dominante (hex). */
  palette?: string[];
  /** Booléens de détection heuristique. */
  isScreenshot?: boolean;
  isDocument?: boolean;
  isBusinessCard?: boolean;
  isReceipt?: boolean;
  isInvoice?: boolean;
  /** Objets détectés (réservé — remplira quand un modèle local sera dispo). */
  objects?: string[];
  /** Texte OCR extrait (rempli par l'analyseur OCR si activé). */
  ocrText?: string;
  /** Empreinte de visage — réservé pour reconnaissance locale future. */
  faceHashes?: string[];
  /** Groupe visuel (partagé entre images très similaires). */
  similarityGroup?: string;
};

/** Métadonnées audio/vidéo. */
export type MediaMetadata = {
  durationMs?: number;
  width?: number;
  height?: number;
  bitrate?: number;
  channels?: number;
  sampleRate?: number;
  /** Titre/artiste/album si connus (id3 réservé). */
  title?: string;
  artist?: string;
  album?: string;
  /** Réservé : transcription audio, résumé vidéo. */
  transcript?: string;
  videoSummary?: string;
};

/** Enregistrement d'analyse pour un fichier — persisté. */
export type AnalysisRecord = {
  key: FileKey;
  fingerprint: FileFingerprint;
  analyzedAt: number;
  version: number; // permet d'invalider en cas de refonte
  kind: FileKind;
  content?: ContentAnalysis;
  image?: ImageAnalysis;
  media?: MediaMetadata;
  /** Erreur non bloquante (partial failure). */
  errors?: string[];
  /** Réservé : embeddings pour recherche sémantique/multimodale. */
  embedding?: number[];
};

/** Priorité / statut d'un job d'analyse. */
export type JobPriority = "high" | "normal" | "low";
export type JobStatus = "queued" | "running" | "done" | "cancelled" | "failed" | "skipped"; // déjà analysé

export type JobKind =
  | "content" // texte/doc/pdf/csv/code
  | "ocr"
  | "image"
  | "media_meta"
  | "index"; // (re)indexation seule

export type AnalysisJob = {
  id: string;
  key: FileKey;
  fingerprint: FileFingerprint;
  entry: FileEntry;
  path: PathRef; // dossier parent
  jobKind: JobKind;
  priority: JobPriority;
  status: JobStatus;
  enqueuedAt: number;
  startedAt?: number;
  finishedAt?: number;
  message?: string;
};

/** Capacités déclarées — inspectées par la couche UI/planner. */
export type Capability = {
  id:
    | "text"
    | "pdf"
    | "ocr"
    | "image"
    | "media_meta"
    | "face"
    | "transcription"
    | "video_summary"
    | "translation"
    | "visual_dedup"
    | "multimodal";
  label: string;
  available: boolean;
  needsOnline: boolean;
  fallback?: string;
};

/** Snapshot public de l'état de la file, exposé aux composants. */
export type QueueSnapshot = {
  queued: number;
  running: number;
  done: number;
  failed: number;
  skipped: number;
  cancelled: number;
  paused: boolean;
  currentLabel?: string;
};

/** Ping indexation — utilisé par la recherche par contenu. */
export type IndexHit = {
  key: FileKey;
  fingerprint: FileFingerprint;
  score: number;
  matches: string[]; // extraits contenant les tokens
  source: ContentAnalysis["source"] | "image_ocr";
};
