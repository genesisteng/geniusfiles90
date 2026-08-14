/**
 * Détection des capacités d'analyse disponibles selon l'environnement.
 *
 * Tout est probing léger — pas de télémétrie, pas de blocage : les
 * fonctions demandant un modèle non embarqué retournent `available: false`
 * et le moteur propose alors l'alternative locale la plus proche.
 */
import { isAndroidNative } from "@/lib/native/geniusfiles-native";
import type { Capability } from "./types";
import { t } from "@/lib/i18n";

let cache: Capability[] | null = null;

export function listCapabilities(): Capability[] {
  if (cache) return cache;
  const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  const native = isAndroidNative();
  cache = [
    { id: "text", label: t("system.cap.text"), available: true, needsOnline: false },
    {
      id: "pdf",
      label: t("system.cap.pdf"),
      // Extraction native : dépend d'un chargement dynamique de pdf.js
      // effectué au premier usage. On l'annonce comme disponible : l'échec
      // au runtime est capturé et remonté proprement.
      available: true,
      needsOnline: false,
      fallback: t("system.cap.pdfFallback"),
    },
    {
      id: "ocr",
      label: t("system.ocrImagesDocumentsNumerises"),
      // Le moteur OCR est chargé à la demande depuis un CDN sur mobile.
      // Sans connexion et sans cache, on retombe sur l'extraction basique.
      available: true,
      needsOnline: !native,
      fallback: t("system.cap.ocrFallback"),
    },
    {
      id: "image",
      label: t("system.cap.image"),
      available: true,
      needsOnline: false,
    },
    {
      id: "media_meta",
      label: t("system.metadonneesAudioVideo"),
      available: true,
      needsOnline: false,
    },
    // Réservations — activables sans changement d'UI :
    {
      id: "face",
      label: t("system.cap.face"),
      available: false,
      needsOnline: false,
      fallback: t("system.cap.faceFallback"),
    },
    {
      id: "transcription",
      label: t("system.cap.transcription"),
      available: false,
      needsOnline: true,
      fallback: t("system.cap.transcriptionFallback"),
    },
    {
      id: "video_summary",
      label: t("system.resumeIntelligentDeVideos"),
      available: false,
      needsOnline: true,
      fallback: t("system.cap.videoFallback"),
    },
    {
      id: "translation",
      label: t("system.cap.translation"),
      available: false,
      needsOnline: true,
      fallback: t("system.cap.translationFallback"),
    },
    {
      id: "visual_dedup",
      label: t("system.detectionAvanceeDesDoublonsVisuels"),
      available: true,
      needsOnline: false,
    },
    {
      id: "multimodal",
      label: t("system.cap.multimodal"),
      available: false,
      needsOnline: true,
      fallback: t("system.cap.multimodalFallback"),
    },
  ];
  // Ajuster selon la connectivité
  cache = cache.map((c) => (c.needsOnline && !online ? { ...c, available: false } : c));
  return cache;
}

export function capabilityAvailable(id: Capability["id"]): boolean {
  return listCapabilities().some((c) => c.id === id && c.available);
}

export function refreshCapabilities() {
  cache = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", refreshCapabilities);
  window.addEventListener("offline", refreshCapabilities);
}
