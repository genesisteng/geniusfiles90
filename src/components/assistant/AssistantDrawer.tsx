/**
 * Panneau latéral (menu hamburger) de Genius AI.
 *
 * Ouverture par glissement depuis la gauche, animation courte et
 * naturelle. Il regroupe toute la gestion des conversations : nouvelle
 * conversation, recherche, historique daté, renommage et suppression.
 * Chaque action agit réellement sur le stockage local des conversations.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MessageSquare, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Portal } from "@/components/common/Portal";
import { BACK_PRIORITY, registerBackHandler } from "@/lib/navigation/back-stack";
import {
  deleteConversation,
  formatDay,
  listConversations,
  renameConversation,
  type ConversationMeta,
} from "@/lib/ai/conversations";
import { kbSearch, kbText } from "@/lib/keyboard-props";
import { useT, type TFunction } from "@/lib/i18n";

function groupLabel(ts: number, t: TFunction): string {
  const day = 86400000;
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= midnight) return t("assistant.drawer.today");
  if (ts >= midnight - day) return t("assistant.drawer.yesterday");
  if (ts >= midnight - 7 * day) return t("assistant.drawer.last7");
  if (ts >= midnight - 30 * day) return t("assistant.drawer.last30");
  return t("assistant.drawer.older");
}

export function AssistantDrawer({
  open,
  onClose,
  activeId,
  onOpenConversation,
  onNewConversation,
}: {
  open: boolean;
  onClose: () => void;
  activeId: string;
  onOpenConversation: (id: string) => void;
  onNewConversation: () => void;
}) {
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const t = useT();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), 240);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setEditingId(null);
    setTick((t) => t + 1);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    const unregister = registerBackHandler(() => {
      onCloseRef.current();
      return true;
    }, BACK_PRIORITY.overlay);
    return () => {
      document.removeEventListener("keydown", onKey);
      unregister();
    };
  }, [open]);

  const groups = useMemo(() => {
    if (!open) return [] as { label: string; items: ConversationMeta[] }[];
    void tick;
    const q = query.trim().toLowerCase();
    const all = listConversations().filter(
      (c) => !q || c.title.toLowerCase().includes(q) || (c.preview ?? "").toLowerCase().includes(q),
    );
    const out: { label: string; items: ConversationMeta[] }[] = [];
    for (const c of all) {
      const label = groupLabel(c.updatedAt, t);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(c);
      else out.push({ label, items: [c] });
    }
    return out;
  }, [open, query, tick, t]);

  if (!mounted) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50"
        role="dialog"
        aria-modal="true"
        aria-label={t("assistant.drawer.ariaLabel")}
      >
        <button
          type="button"
          aria-label={t("assistant.drawer.closeAria")}
          onClick={onClose}
          className="absolute inset-0 bg-background/60 backdrop-blur-[6px] transition-opacity duration-200"
          style={{ opacity: visible ? 1 : 0 }}
        />
        <aside
          className="absolute inset-y-0 left-0 flex w-[86%] max-w-[340px] flex-col bg-surface-elevated shadow-[0_0_40px_-8px_rgba(0,0,0,0.55)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            transform: visible ? "translateX(0)" : "translateX(-100%)",
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            paddingLeft: "env(safe-area-inset-left, 0px)",
          }}
        >
          <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
            <p className="font-display truncate text-[17px] font-bold tracking-tight text-foreground">
              {t("assistant.drawer.title")}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("action.close")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted-foreground transition-transform duration-150 active:scale-95"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="space-y-2.5 px-4 pb-3">
            <button
              type="button"
              onClick={() => {
                onNewConversation();
                onClose();
              }}
              className="flex h-12 w-full items-center gap-2.5 rounded-2xl bg-primary px-4 text-[14.5px] font-semibold text-primary-foreground transition-transform duration-150 active:scale-[0.98]"
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
              {t("assistant.drawer.newChat")}
            </button>

            <div className="flex h-11 items-center gap-2.5 rounded-2xl bg-surface-2 px-3.5">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                {...kbSearch}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("assistant.drawer.searchPlaceholder")}
                aria-label={t("assistant.drawer.searchAria")}
                className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6">
            {groups.length === 0 ? (
              <p className="px-2 py-10 text-center text-[13px] leading-relaxed text-muted-foreground">
                {query ? t("assistant.drawer.emptySearch") : t("assistant.drawer.emptyAll")}
              </p>
            ) : (
              groups.map((g) => (
                <section key={g.label} className="mb-3">
                  <p className="px-2 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {g.label}
                  </p>
                  <ul className="space-y-1">
                    {g.items.map((c) => {
                      const editing = editingId === c.id;
                      const active = c.id === activeId;
                      return (
                        <li
                          key={c.id}
                          className={`rounded-2xl px-2 py-1.5 transition-colors duration-150 ${
                            active ? "bg-primary/10" : "bg-transparent"
                          }`}
                        >
                          {editing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                {...kbText}
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                aria-label={t("assistant.drawer.renameLabel")}
                                className="min-w-0 flex-1 rounded-xl bg-surface-2 px-3 py-2 text-[14px] text-foreground focus:outline-none"
                              />
                              <button
                                type="button"
                                aria-label={t("action.confirm")}
                                onClick={() => {
                                  renameConversation(c.id, draft);
                                  setEditingId(null);
                                  setTick((t) => t + 1);
                                }}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary active:scale-95"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                aria-label={t("action.cancel")}
                                onClick={() => setEditingId(null)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground active:scale-95"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenConversation(c.id);
                                  onClose();
                                }}
                                className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 text-left transition-transform duration-150 active:scale-[0.99]"
                              >
                                <span
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                    active
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-surface-2 text-muted-foreground"
                                  }`}
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span
                                    className={`block truncate text-[14px] text-foreground ${
                                      active ? "font-semibold" : "font-medium"
                                    }`}
                                  >
                                    {c.title}
                                  </span>
                                  <span className="block truncate text-[12px] text-muted-foreground">
                                    {formatDay(c.updatedAt)}
                                    {c.preview ? ` \u00b7 ${c.preview}` : ""}
                                  </span>
                                </span>
                              </button>
                              <button
                                type="button"
                                aria-label={t("assistant.drawer.renameAria", { title: c.title })}
                                onClick={() => {
                                  setEditingId(c.id);
                                  setDraft(c.title);
                                }}
                                className="flex h-10 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors duration-150 hover:text-foreground active:scale-95"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                aria-label={t("assistant.drawer.deleteAria", { title: c.title })}
                                onClick={() => {
                                  deleteConversation(c.id);
                                  setTick((t) => t + 1);
                                }}
                                className="flex h-10 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors duration-150 hover:text-destructive active:scale-95"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
        </aside>
      </div>
    </Portal>
  );
}
