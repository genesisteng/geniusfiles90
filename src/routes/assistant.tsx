import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  ArrowUp,
  Square,
  Menu,
  PenSquare,
  ShieldCheck,
  MessagesSquare,
  WifiOff,
  Copy,
  Check,
} from "lucide-react";
import { useT, t as translate } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { AssistantMarkdown } from "@/components/assistant/AssistantMarkdown";
import { AssistantDrawer } from "@/components/assistant/AssistantDrawer";
import { PipelineTrace } from "@/components/assistant/PipelineTrace";
import { TemplateMarquee } from "@/components/assistant/TemplateMarquee";
import { describeChatError } from "@/lib/ai/diagnostics";
import {
  getChat,
  getConversationId,
  getServerTask,
  getTask,
  openStoredConversation,
  resetSession,
  retryTask,
  sendUserMessage,
  setStorageProvider,
  startNewConversation,
  stopTask,
  subscribeChat,
  subscribeConversationId,
  subscribeTask,
} from "@/lib/ai/session";
import { clearConversations } from "@/lib/ai/conversations";
import { useRoots } from "@/lib/fs/useRoots";
import { useViewportInset } from "@/hooks/use-viewport-inset";
import { kbSentence } from "@/lib/keyboard-props";
import { chatOfflineCopy } from "@/lib/copy/empty-illustrations";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "Genius AI — GeniusFiles" },
      {
        name: "description",
        content: translate("meta.assistant.description"),
      },
      { property: "og:title", content: "Genius AI — GeniusFiles" },
      {
        property: "og:description",
        content: translate("meta.assistant.ogDescription"),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
  errorComponent: AssistantError,
});

/**
 * Filet de sécurité local : si l'écran plante (conversation corrompue,
 * rendu inattendu), on reste dans Genius AI et on propose de repartir
 * d'une conversation vierge — au lieu de renvoyer vers l'erreur globale.
 */
function AssistantError({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[assistant] render error", error);
  const t = useT();
  return (
    <AppShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-lg font-bold text-foreground">
          {t("assistant.error.title")}
        </h1>
        <p className="max-w-xs text-[13px] text-muted-foreground">{t("assistant.error.desc")}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => reset()} className="btn-secondary gf-press">
            {t("action.retry")}
          </button>
          <button
            type="button"
            onClick={() => {
              clearConversations();
              resetSession();
              reset();
            }}
            className="btn-primary gf-press"
          >
            {t("assistant.header.newChat")}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

/** Connexion réseau de l'appareil, suivie en direct (aucun redémarrage requis). */
function subscribeOnline(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function useIsOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * État « hors connexion » affiché dans la conversation.
 */
function ChatOfflineState({ onRetry }: { onRetry?: () => void }) {
  const copy = chatOfflineCopy();
  return (
    <div className="animate-fade-in flex flex-col items-center px-4 py-2 text-center">
      <WifiOff
        aria-hidden="true"
        strokeWidth={1.5}
        className="h-10 w-10 shrink-0 text-muted-foreground"
      />
      <div className="mt-2 flex max-w-[320px] flex-col items-center gap-1.5">
        <p className="text-[17px] font-semibold leading-snug text-foreground">{copy.title}</p>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">{copy.description}</p>
        {onRetry ? (
          <div className="pt-3">
            <button type="button" onClick={onRetry} className="btn-secondary gf-press">
              {copy.retry}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AssistantPage() {
  const t = useT();
  const [input, setInput] = useState("");
  const isOnline = useIsOnline();
  const [offlineBlocked, setOfflineBlocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const { roots } = useRoots();
  const rootsRef = useRef(roots);
  useEffect(() => {
    rootsRef.current = roots;
  }, [roots]);

  const { keyboardInset } = useViewportInset();

  // Le contexte de stockage est lu au moment de la requête, sans lier la
  // session au cycle de vie de cet écran.
  useEffect(() => {
    setStorageProvider(() =>
      rootsRef.current.map((r) => ({
        rootId: r.id,
        label: r.label,
        hint: r.hint ?? null,
        available: r.available,
      })),
    );
  }, []);

  // Session persistante : l'instance vit hors de React, donc quitter la
  // page n'interrompt jamais la tâche en cours. On s'abonne à l'instance
  // elle-même pour que « Nouvelle conversation » prenne effet aussitôt.
  const chatInstance = useSyncExternalStore(subscribeChat, getChat, getChat);
  const conversationId = useSyncExternalStore(subscribeConversationId, getConversationId, () => "");
  const chat = useChat({ chat: chatInstance });
  const { messages, status, error } = chat;

  const task = useSyncExternalStore(subscribeTask, getTask, getServerTask);
  const isBusy = status === "submitted" || status === "streaming";
  const taskRunning = task.phase !== "idle";

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  }, []);

  const scrollToEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, []);

  const autoSize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  useEffect(() => {
    autoSize();
  }, [input, autoSize]);

  const handleSubmit = (e?: FormEvent) => {
    atBottomRef.current = true;
    e?.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    if (!navigator.onLine) {
      setOfflineBlocked(true);
      requestAnimationFrame(scrollToEnd);
      return;
    }
    setOfflineBlocked(false);
    setInput("");
    sendUserMessage(text);
    requestAnimationFrame(scrollToEnd);
  };

  useEffect(() => {
    if (isOnline) setOfflineBlocked(false);
  }, [isOnline]);

  const pickTemplate = (text: string) => {
    setInput(text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    });
  };

  const startNew = () => {
    startNewConversation();
    setInput("");
  };

  // Pendant la rédaction, la pipeline reste au-dessus de la réponse en
  // cours : la structure « pipeline → réponse » ne bouge plus.
  const lastIsStreamingAssistant =
    taskRunning && messages[messages.length - 1]?.role === "assistant";
  const head = lastIsStreamingAssistant ? messages.slice(0, -1) : messages;
  const tail = lastIsStreamingAssistant ? messages[messages.length - 1] : null;

  // Suivi du flux uniquement si l'utilisateur lit déjà le bas de l'écran.
  useEffect(() => {
    if (!atBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, task]);

  const canSend = Boolean(input.trim()) && !(offlineBlocked && !isOnline);
  const bottomSpace = keyboardInset > 0 ? 12 : undefined;

  return (
    <AppShell>
      <div
        className="flex min-h-0 flex-1 flex-col overflow-x-hidden"
        style={{ marginBottom: keyboardInset || undefined }}
      >
        <header
          className="flex shrink-0 items-center gap-2 border-b border-border/40 px-2.5 pb-2.5"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)",
            paddingLeft: "calc(env(safe-area-inset-left, 0px) + 0.625rem)",
            paddingRight: "calc(env(safe-area-inset-right, 0px) + 0.625rem)",
          }}
        >
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t("assistant.header.menuLabel")}
            aria-expanded={menuOpen}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-foreground transition-all duration-150 hover:bg-surface-2 active:scale-95"
          >
            <Menu className="h-[21px] w-[21px]" strokeWidth={2.1} />
          </button>
          <h1 className="font-display min-w-0 flex-1 truncate text-[19px] font-bold leading-tight tracking-tight text-foreground">
            {t("assistant.header.title")}
          </h1>
          <button
            type="button"
            onClick={startNew}
            aria-label={t("assistant.header.newChat")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-foreground transition-all duration-150 hover:bg-surface-2 active:scale-95"
          >
            <PenSquare className="h-[19px] w-[19px]" strokeWidth={2.1} />
          </button>
        </header>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="gf-chat-safe min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-6"
          style={{
            paddingLeft: "calc(env(safe-area-inset-left, 0px) + 1rem)",
            paddingRight: "calc(env(safe-area-inset-right, 0px) + 1rem)",
          }}
        >
          {messages.length === 0 && !taskRunning ? (
            <Welcome />
          ) : (
            head.map((m) => <MessageBubble key={m.id} message={m} />)
          )}

          {offlineBlocked ? <ChatOfflineState onRetry={() => handleSubmit()} /> : null}

          <PipelineTrace task={task} />

          {tail ? <MessageBubble key={tail.id} message={tail} streaming /> : null}

          {error ? (
            <div className="gf-chat-safe rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
              <p className="mb-2">{describeChatError(error)}</p>
              <button
                type="button"
                onClick={() => retryTask()}
                className="rounded-xl border border-destructive/40 bg-background/40 px-3 py-1.5 text-[12px] font-medium"
              >
                {t("action.retry")}
              </button>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <div
          className="shrink-0 border-t border-border/40 bg-background/95 pt-2 backdrop-blur-sm"
          style={{
            paddingBottom:
              bottomSpace !== undefined
                ? bottomSpace
                : "calc(env(safe-area-inset-bottom) + 6.25rem)",
            paddingLeft: "env(safe-area-inset-left, 0px)",
            paddingRight: "env(safe-area-inset-right, 0px)",
          }}
        >
          <div className="px-3">
            <TemplateMarquee onPick={pickTemplate} />
          </div>

          <form
            onSubmit={handleSubmit}
            className={`mx-3 mt-2 flex items-end gap-2 rounded-[26px] border bg-surface-elevated p-1.5 transition-[border-color,box-shadow] duration-200 ${
              focused
                ? "border-primary/60 shadow-[0_8px_28px_-14px_rgba(0,0,0,0.75)]"
                : "border-border/70 shadow-[0_6px_24px_-16px_rgba(0,0,0,0.7)]"
            }`}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={1}
              placeholder={t("assistant.input.placeholder")}
              aria-label={t("assistant.input.ariaLabel")}
              {...kbSentence}
              className="max-h-32 min-h-[46px] w-full min-w-0 flex-1 resize-none self-center bg-transparent px-3.5 py-[12px] text-[15px] leading-[22px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {isBusy ? (
              <button
                type="button"
                onClick={() => stopTask()}
                aria-label={t("assistant.input.stop")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition-transform duration-100 active:scale-90"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                aria-label={t("assistant.input.send")}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform,opacity] duration-100 active:scale-90 ${
                  canSend
                    ? "bg-primary text-primary-foreground"
                    : "cursor-not-allowed bg-secondary text-muted-foreground opacity-70"
                }`}
              >
                <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.4} />
              </button>
            )}
          </form>
        </div>
      </div>

      <AssistantDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeId={conversationId}
        onOpenConversation={openStoredConversation}
        onNewConversation={startNew}
      />
    </AppShell>
  );
}

function Welcome() {
  const t = useT();
  return (
    <div className="animate-in-up gf-chat-safe flex flex-col items-center pt-8 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-primary/15 blur-xl" />
        <span className="absolute inset-2 rounded-full border border-primary/25" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/15 text-primary">
          <MessagesSquare className="h-7 w-7" strokeWidth={1.9} />
        </span>
      </div>
      <h2 className="font-display mt-5 text-[21px] font-bold leading-tight tracking-tight">
        {t("assistant.welcome.title")}
      </h2>
      <p className="mx-auto mt-2 max-w-[19rem] text-[13.5px] leading-relaxed text-muted-foreground">
        {t("assistant.welcome.desc")}
      </p>

      <div className="mt-6 w-full rounded-3xl bg-primary/8 px-4 py-3.5 text-left">
        <p className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} />
          {t("assistant.welcome.privacyTitle")}
        </p>
        <div className="mt-2 space-y-2 text-[12.5px] leading-relaxed text-muted-foreground">
          <p>{t("assistant.welcome.privacy1")}</p>
          <p>{t("assistant.welcome.privacy2")}</p>
          <p>{t("assistant.welcome.privacy3")}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Bouton « Copier » discret placé sous chaque message. La zone tactile
 * reste confortable (32 px) sans allonger la carte du message.
 */
function CopyButton({ text, align }: { text: string; align: "start" | "end" }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className={`mt-1 flex ${align === "end" ? "justify-end" : "justify-start"}`}>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? t("assistant.message.copiedAria") : t("assistant.message.copyAria")}
        className="flex h-8 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground active:scale-95"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.6} />
        ) : (
          <Copy className="h-3.5 w-3.5" strokeWidth={2.1} />
        )}
        <span>{copied ? t("assistant.message.copied") : t("assistant.message.copy")}</span>
      </button>
    </div>
  );
}

function MessageBubble({ message, streaming }: { message: UIMessage; streaming?: boolean }) {
  const isUser = message.role === "user";
  const parts = Array.isArray(message.parts) ? message.parts : [];
  const text = parts.map((p) => (p?.type === "text" ? p.text : "")).join("");

  if (isUser) {
    return (
      <div className="animate-in-up">
        <div className="flex justify-end">
          <div className="gf-chat-safe max-w-[85%] rounded-[24px] rounded-br-lg bg-primary px-4 py-3 text-[14.5px] leading-relaxed text-primary-foreground">
            <p className="whitespace-pre-wrap">{text}</p>
          </div>
        </div>
        <CopyButton text={text} align="end" />
      </div>
    );
  }

  // Le chat n'affiche que le texte : aucune carte, aucun lien, aucun
  // rendu de fichier. Les résultats du moteur sont reformulés par le modèle.
  if (!text) return null;

  return (
    <div className="animate-in-up gf-chat-safe">
      <div className="gf-chat-safe rounded-[24px] rounded-bl-lg bg-surface px-4 py-4">
        <SmoothText text={text} />
      </div>
      {streaming ? null : <CopyButton text={text} align="start" />}
    </div>
  );
}

/**
 * Nettoie une portion de markdown en cours de frappe.
 */
function stabilizeMarkdown(chunk: string): string {
  let out = chunk;
  out = out.replace(/\n[#*\-\d.]{1,4}\s*$/u, "\n");
  out = out.replace(/(\*{1,2}|`)+$/u, "");
  const bold = (out.match(/\*\*/g) ?? []).length;
  if (bold % 2 === 1) out = out.slice(0, out.lastIndexOf("**"));
  const ticks = (out.match(/`/g) ?? []).length;
  if (ticks % 2 === 1) out = out.slice(0, out.lastIndexOf("`"));
  return out;
}

/**
 * Révélation progressive du texte de l'assistant.
 */
function SmoothText({ text }: { text: string }) {
  const [shown, setShown] = useState(0);
  const target = text.length;

  useEffect(() => {
    if (shown >= target) return;
    const step = Math.max(2, Math.ceil((target - shown) / 18));
    const timer = setTimeout(() => setShown((s) => Math.min(target, s + step)), 16);
    return () => clearTimeout(timer);
  }, [shown, target]);

  useEffect(() => {
    if (target < shown) setShown(target);
  }, [target, shown]);

  const raw = text.slice(0, shown);
  const visible = shown >= target ? text : stabilizeMarkdown(raw);
  return (
    <div className="gf-smooth-text">
      <AssistantMarkdown text={visible} />
    </div>
  );
}
