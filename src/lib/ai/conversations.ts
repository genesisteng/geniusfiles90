/**
 * Historique local des conversations Genius AI.
 *
 * Tout est conservé dans localStorage : l'utilisateur retrouve ses
 * échanges même plusieurs jours plus tard. Le titre est déduit
 * automatiquement du premier message utilisateur (nettoyé et tronqué).
 */
import type { UIMessage } from "ai";
import { t } from "@/lib/i18n";

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Vrai quand l'utilisateur a renommé la conversation à la main. */
  titleLocked?: boolean;
  messages: UIMessage[];
};

export type ConversationMeta = Omit<Conversation, "messages"> & { preview: string };

const KEY = "gf.assistant.conversations";
const ACTIVE_KEY = "gf.assistant.active";
const MAX = 60;

/**
 * Normalise un message issu du stockage local : les anciennes versions (ou
 * une écriture interrompue) peuvent contenir des messages sans `parts`, ce
 * qui faisait planter tout l'écran au rendu. On répare au lieu de crasher.
 */
function sanitizeMessage(m: unknown): UIMessage | null {
  if (!m || typeof m !== "object") return null;
  const raw = m as Partial<UIMessage> & { content?: unknown };
  if (raw.role !== "user" && raw.role !== "assistant" && raw.role !== "system") return null;
  let parts = Array.isArray(raw.parts) ? raw.parts.filter((p) => p && typeof p === "object") : [];
  if (parts.length === 0 && typeof raw.content === "string" && raw.content) {
    parts = [{ type: "text", text: raw.content }] as UIMessage["parts"];
  }
  return {
    ...raw,
    id: typeof raw.id === "string" && raw.id ? raw.id : newId(),
    role: raw.role,
    parts: parts as UIMessage["parts"],
  } as UIMessage;
}

function sanitizeConversation(c: unknown): Conversation | null {
  if (!c || typeof c !== "object") return null;
  const raw = c as Partial<Conversation>;
  if (typeof raw.id !== "string" || !raw.id) return null;
  const messages = Array.isArray(raw.messages)
    ? raw.messages.map(sanitizeMessage).filter((m): m is UIMessage => m !== null)
    : [];
  return {
    id: raw.id,
    title: typeof raw.title === "string" ? raw.title : t("assistant.drawer.defaultTitle"),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    titleLocked: raw.titleLocked === true,
    messages,
  };
}

function read(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeConversation).filter((c): c is Conversation => c !== null);
  } catch {
    return [];
  }
}

function write(items: Conversation[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* quota / mode privé */
  }
}

export function newId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function messageText(m: UIMessage): string {
  const parts = Array.isArray(m?.parts) ? m.parts : [];
  return parts
    .map((p) => (p && p.type === "text" ? p.text : ""))
    .join(" ")
    .trim();
}

export function deriveTitle(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const raw = first ? messageText(first) : "";
  const clean = raw.replace(/\s+/g, " ").trim();
  if (!clean) return t("assistant.drawer.defaultTitle");
  return clean.length > 46 ? `${clean.slice(0, 46).trimEnd()}…` : clean;
}

export function listConversations(): ConversationMeta[] {
  return read()
    .map(({ messages, ...meta }) => {
      const last = [...messages].reverse().find((m) => messageText(m));
      return { ...meta, preview: last ? messageText(last).slice(0, 90) : "" };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): Conversation | null {
  return read().find((c) => c.id === id) ?? null;
}

export function saveConversation(id: string, messages: UIMessage[], title?: string) {
  if (!messages.length) return;
  const items = read();
  const idx = items.findIndex((c) => c.id === id);
  const now = Date.now();
  if (idx >= 0) {
    const existing = items[idx];
    items[idx] = {
      ...existing,
      title: title ?? (existing.titleLocked ? existing.title : deriveTitle(messages)),
      messages,
      updatedAt: now,
    };
  } else {
    items.unshift({
      id,
      title: title ?? deriveTitle(messages),
      createdAt: now,
      updatedAt: now,
      messages,
    });
  }
  write(items);
}

export function renameConversation(id: string, title: string) {
  const items = read();
  const idx = items.findIndex((c) => c.id === id);
  if (idx < 0) return;
  items[idx] = {
    ...items[idx],
    title: title.trim() || items[idx].title,
    titleLocked: true,
  };
  write(items);
}

export function deleteConversation(id: string) {
  write(read().filter((c) => c.id !== id));
}

/** Réinitialisation complète — utilisée en dernier recours après une erreur. */
export function clearConversations() {
  write([]);
  try {
    window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function setActiveId(id: string) {
  try {
    window.localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function getActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function formatDay(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
