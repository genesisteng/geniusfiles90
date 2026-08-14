/**
 * Session Genius AI — la tâche vit en dehors de l'écran.
 *
 * L'instance de conversation (`Chat`) et l'état de la pipeline sont
 * conservés au niveau du module : quitter la page Genius AI n'interrompt
 * ni le traitement du modèle, ni l'exécution du moteur local. Au retour,
 * l'écran se rebranche simplement sur l'état réel en cours.
 *
 * La pipeline est strictement monotone : une étape terminée ne redevient
 * jamais active, et aucune étape n'est affichée sans travail réel derrière.
 */
import { Chat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import { chatApiUrl } from "./api-url";
import { aiLog, chatFetch } from "./diagnostics";
import { runEngineTool } from "./tools/execute";
import { getEngineStage } from "./tools/stage";
import { errorMessage } from "@/lib/errors/humanize";
import { getConversation, newId, saveConversation, setActiveId } from "./conversations";
import { t } from "@/lib/i18n";

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

export type PipelineState = "pending" | "active" | "done" | "failed";
export type StepId = "understand" | "plan" | "execute" | "verify" | "respond";

export type TaskStep = {
  id: StepId;
  label: string;
  /** Détail réel publié par le moteur (jamais de chemin ni de nom de fichier). */
  detail?: string;
  state: PipelineState;
};

export type TaskSnapshot = {
  /** `closing` = travail terminé, disparition en cours. */
  phase: "idle" | "running" | "closing";
  steps: TaskStep[];
  failed: boolean;
};

const ORDER: StepId[] = ["understand", "plan", "execute", "verify", "respond"];

const LABEL_KEYS: Record<StepId, string> = {
  understand: "assistant.pipeline.understand",
  plan: "assistant.pipeline.plan",
  execute: "assistant.pipeline.execute",
  verify: "assistant.pipeline.verify",
  respond: "assistant.pipeline.respond",
};

/** Libellé de l'étape (langue active), calculé à l'appel — jamais figé. */
function stepLabel(id: StepId): string {
  return t(LABEL_KEYS[id]);
}

const IDLE: TaskSnapshot = { phase: "idle", steps: [], failed: false };

let phase: TaskSnapshot["phase"] = "idle";
let currentId: StepId = "understand";
let failed = false;
let detail: string | null = null;
let snapshot: TaskSnapshot = IDLE;
/** Commandes moteur en cours : tant qu'il en reste, la tâche n'est pas finie. */
let pendingTools = 0;
/** Horodatage du dernier signe de vie du modèle (anti-clôture prématurée). */
let lastActivity = 0;

const taskListeners = new Set<() => void>();
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function rank(id: StepId): number {
  return ORDER.indexOf(id);
}

function build(): TaskSnapshot {
  if (phase === "idle") return IDLE;
  const cur = rank(currentId);
  const steps: TaskStep[] = ORDER.map((id) => {
    const r = rank(id);
    let state: PipelineState;
    if (phase === "closing") state = failed && r === cur ? "failed" : "done";
    else if (r < cur) state = "done";
    else if (r === cur) state = failed ? "failed" : "active";
    else state = "pending";
    return { id, label: stepLabel(id), state, detail: r === cur && detail ? detail : undefined };
  });
  return { phase, steps, failed };
}

function emit() {
  snapshot = build();
  for (const l of taskListeners) l();
}

export function subscribeTask(listener: () => void): () => void {
  taskListeners.add(listener);
  return () => taskListeners.delete(listener);
}

export function getTask(): TaskSnapshot {
  return snapshot;
}

export function getServerTask(): TaskSnapshot {
  return IDLE;
}

/** Avance la pipeline — jamais en arrière. */
function advance(id: StepId) {
  lastActivity = Date.now();
  if (rank(id) <= rank(currentId)) return;
  currentId = id;
  detail = null;
  emit();
}

function startTask() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  phase = "running";
  currentId = "understand";
  failed = false;
  detail = null;
  pendingTools = 0;
  lastActivity = Date.now();
  emit();
  // La compréhension est immédiate : on bascule tout de suite sur l'analyse
  // dès que la requête part réellement vers le modèle.
  setTimeout(() => {
    if (phase === "running") advance("plan");
  }, 160);
  startPolling();
}

function endTask(withFailure = false) {
  if (phase === "idle") return;
  failed = withFailure;
  if (!withFailure) currentId = "respond";
  phase = "closing";
  detail = null;
  pendingTools = 0;
  emit();
  stopPolling();
  persist();
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    phase = "idle";
    emit();
  }, 460);
}

/**
 * Rafraîchissement léger de l'état réel pendant qu'une tâche tourne :
 * étape publiée par le moteur, apparition du texte de réponse et
 * sauvegarde continue. Cette boucle vit hors de React, donc elle continue
 * si l'utilisateur quitte l'écran.
 */
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (phase !== "running") return;
    const stage = getEngineStage();
    if (stage && stage !== detail && (currentId === "execute" || currentId === "verify")) {
      detail = stage;
      lastActivity = Date.now();
      emit();
    }
    const messages = chat?.messages ?? [];
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      const parts = Array.isArray(last.parts) ? last.parts : [];
      const hasText = parts.some(
        (p) =>
          (p as { type?: string; text?: string }).type === "text" &&
          !!(p as { text?: string }).text,
      );
      if (hasText) advance("respond");
    }
    // Sauvegarde continue : quitter l'application pendant le travail ne
    // fait plus disparaître le message ni la réponse partielle.
    persist();

    // Filet de sécurité : si plus rien ne bouge et qu'aucune commande
    // moteur n'est en cours, on clôt proprement au lieu de tourner à vide.
    const status = chat?.status;
    if (
      pendingTools === 0 &&
      (status === "ready" || status === "error") &&
      Date.now() - lastActivity > 1200
    ) {
      endTask(status === "error");
    }
  }, 140);
}

function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

/* ------------------------------------------------------------------ */
/* Conversation persistante                                            */
/* ------------------------------------------------------------------ */

export type StorageHint = {
  rootId: string;
  label: string;
  hint: string | null;
  available: boolean;
};

let rootsProvider: () => StorageHint[] = () => [];

export function setStorageProvider(fn: () => StorageHint[]) {
  rootsProvider = fn;
}

let chat: Chat<UIMessage> | null = null;
let conversationId = "";

const idListeners = new Set<() => void>();
/** Abonnés à l'instance de conversation elle-même (nouvelle conversation…). */
const chatListeners = new Set<() => void>();

export function subscribeConversationId(listener: () => void): () => void {
  idListeners.add(listener);
  return () => idListeners.delete(listener);
}

/**
 * Abonnement à l'instance de conversation active. Indispensable pour que
 * « Nouvelle conversation » et l'ouverture d'un échange enregistré
 * remplacent réellement la conversation affichée.
 */
export function subscribeChat(listener: () => void): () => void {
  chatListeners.add(listener);
  return () => chatListeners.delete(listener);
}

export function getConversationId(): string {
  return conversationId;
}

function emitId() {
  for (const l of idListeners) l();
  for (const l of chatListeners) l();
}

function persist() {
  if (!chat || !chat.messages.length) return;
  saveConversation(conversationId, chat.messages);
  setActiveId(conversationId);
}

function createChat(id: string, messages: UIMessage[]): Chat<UIMessage> {
  const instance: Chat<UIMessage> = new Chat<UIMessage>({
    id,
    messages,
    transport: new DefaultChatTransport({
      api: chatApiUrl(),
      fetch: (_input, init) => chatFetch(chatApiUrl(), init),
      body: () => ({ storages: rootsProvider() }),
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (err) => {
      aiLog("erreur assistant", err);
      endTask(true);
    },
    onToolCall: ({ toolCall }) => {
      const startedAt = Date.now();
      pendingTools += 1;
      advance("execute");
      lastActivity = Date.now();
      aiLog("commande moteur", { tool: toolCall.toolName, input: toolCall.input });
      const send = (output: unknown) => {
        aiLog("résultat moteur", { tool: toolCall.toolName, ms: Date.now() - startedAt });
        pendingTools = Math.max(0, pendingTools - 1);
        instance.addToolOutput({
          tool: toolCall.toolName as never,
          toolCallId: toolCall.toolCallId,
          output: output as never,
        });
        advance("verify");
        persist();
      };
      void runEngineTool(toolCall.toolName, toolCall.input)
        .then(send)
        .catch((err: unknown) => {
          console.error("[assistant] tool error", err);
          send({ ok: false, error: errorMessage(err, t("system.ai.actionFailed")) });
        });
    },
    onFinish: () => {
      // Un tour peut enchaîner plusieurs échanges (commande moteur puis
      // reprise du modèle) : on ne clôt la pipeline qu'au dernier.
      lastActivity = Date.now();
      persist();
      const willContinue =
        pendingTools > 0 ||
        lastAssistantMessageIsCompleteWithToolCalls({ messages: instance.messages });
      if (willContinue) {
        advance("verify");
        return;
      }
      endTask(false);
    },
  });
  return instance;
}

/** Instance de conversation vivante (créée à la demande). */
export function getChat(): Chat<UIMessage> {
  if (!chat) {
    const activeId = typeof window !== "undefined" ? getConversationIdFromStorage() : null;
    const stored = activeId ? getConversation(activeId) : null;
    conversationId = stored?.id ?? newId();
    chat = createChat(conversationId, stored?.messages ?? []);
  }
  return chat;
}

function getConversationIdFromStorage(): string | null {
  try {
    return window.localStorage.getItem("gf.assistant.active");
  } catch {
    return null;
  }
}

export function sendUserMessage(text: string) {
  const c = getChat();
  startTask();
  void c.sendMessage({ text }).finally(persist);
  // Le message utilisateur est enregistré immédiatement : quitter
  // l'application juste après l'envoi ne le fait plus disparaître.
  setTimeout(persist, 60);
}

export function stopTask() {
  void chat?.stop();
  endTask(false);
}

export function retryTask() {
  const c = getChat();
  startTask();
  void c.regenerate();
}

/** Bascule vers une autre instance de conversation, proprement. */
function swapChat(id: string, messages: UIMessage[]) {
  if (chat && chat.messages.length) persist();
  void chat?.stop();
  stopPolling();
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  phase = "idle";
  failed = false;
  detail = null;
  pendingTools = 0;
  currentId = "understand";
  emit();
  conversationId = id;
  chat = createChat(id, messages);
  setActiveId(id);
  emitId();
}

export function startNewConversation() {
  swapChat(newId(), []);
}

export function openStoredConversation(id: string) {
  const conv = getConversation(id);
  if (!conv) return;
  swapChat(conv.id, conv.messages);
}

// Sauvegarde de sécurité quand l'application passe en arrière-plan.
if (typeof window !== "undefined") {
  const save = () => persist();
  window.addEventListener("pagehide", save);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
}

/** Réinitialisation complète après une erreur de rendu. */
export function resetSession() {
  void chat?.stop();
  chat = null;
  conversationId = "";
  phase = "idle";
  emit();
  emitId();
}
