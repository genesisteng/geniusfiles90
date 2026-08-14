/**
 * Points d'ancrage typés pour les fonctionnalités futures.
 *
 * Chaque signature ci-dessous représente une capacité annoncée dans la
 * feuille de route (reconnaissance faciale locale, transcription audio,
 * résumé vidéo, traduction, détection avancée des doublons visuels,
 * recherche multimodale, recommandations d'organisation). Elles sont
 * volontairement exportées comme *stubs* renvoyant `null` afin que
 * l'interface consommatrice (Assistant IA, Galerie, Recherche) puisse
 * déjà les invoquer aujourd'hui — le comportement se remplira sans
 * refonte d'API le jour où un moteur local sera embarqué.
 */
import type { AnalysisRecord } from "./types";

export type FaceCluster = { id: string; members: string[] };
export async function detectFaces(_rec: AnalysisRecord): Promise<FaceCluster[] | null> {
  return null;
}

export async function transcribeAudio(_rec: AnalysisRecord): Promise<string | null> {
  return null;
}

export async function summarizeVideo(_rec: AnalysisRecord): Promise<string | null> {
  return null;
}

export type TranslationResult = { lang: string; text: string };
export async function translateContent(
  _rec: AnalysisRecord,
  _targetLang: string,
): Promise<TranslationResult | null> {
  return null;
}

export type MultimodalHit = { key: string; score: number };
export async function multimodalSearch(_prompt: string): Promise<MultimodalHit[] | null> {
  return null;
}

export type OrganizationSuggestion = {
  key: string;
  suggestedFolder: string;
  reason: string;
};
export async function suggestOrganization(): Promise<OrganizationSuggestion[] | null> {
  return null;
}

export type AdvancedDuplicateGroup = {
  method: "phash" | "dhash" | "embedding";
  members: string[];
};
export async function findAdvancedVisualDuplicates(): Promise<AdvancedDuplicateGroup[] | null> {
  return null;
}
