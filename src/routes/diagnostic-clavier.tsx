/**
 * Écran de diagnostic clavier.
 *
 * Affiche en temps réel les propriétés clavier appliquées au champ actif
 * et les événements reçus, pour vérifier depuis l'APK / AAB Android que
 * Gboard (ou tout autre IME) reçoit bien les indices attendus :
 * suggestions, correction, majuscule automatique, ponctuation
 * intelligente, langue, etc.
 *
 * Route accessible via /diagnostic-clavier.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { useT, t as translate } from "@/lib/i18n";

export const Route = createFileRoute("/diagnostic-clavier")({
  component: KeyboardDiagnosticsPage,
  head: () => ({
    meta: [
      { title: translate("meta.keyboard.title") },
      {
        name: "description",
        content: translate("meta.keyboard.description"),
      },
      { property: "og:title", content: translate("meta.keyboard.title") },
      {
        property: "og:description",
        content: translate("meta.keyboard.ogDescription"),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type FieldKind = "text" | "search" | "sentence" | "words" | "multiline" | "password";

const PRESET_CONFIG: Record<
  FieldKind,
  {
    labelKey: string;
    autoCorrect: string;
    autoCapitalize: "off" | "sentences" | "words" | "characters" | "none";
    spellCheck: boolean;
    enterKeyHint: string;
    inputMode: string;
    type: string;
  }
> = {
  text: {
    labelKey: "copy.keyboardDiag.preset.text",
    autoCorrect: "on",
    autoCapitalize: "sentences",
    spellCheck: true,
    enterKeyHint: "done",
    inputMode: "text",
    type: "text",
  },
  search: {
    labelKey: "copy.keyboardDiag.preset.search",
    autoCorrect: "on",
    autoCapitalize: "sentences",
    spellCheck: true,
    enterKeyHint: "search",
    inputMode: "search",
    type: "text",
  },
  sentence: {
    labelKey: "copy.keyboardDiag.preset.sentence",
    autoCorrect: "on",
    autoCapitalize: "sentences",
    spellCheck: true,
    enterKeyHint: "send",
    inputMode: "text",
    type: "text",
  },
  words: {
    labelKey: "copy.keyboardDiag.preset.words",
    autoCorrect: "on",
    autoCapitalize: "words",
    spellCheck: true,
    enterKeyHint: "done",
    inputMode: "text",
    type: "text",
  },
  multiline: {
    labelKey: "copy.keyboardDiag.preset.multiline",
    autoCorrect: "on",
    autoCapitalize: "sentences",
    spellCheck: true,
    enterKeyHint: "enter",
    inputMode: "text",
    type: "textarea",
  },
  password: {
    labelKey: "copy.keyboardDiag.preset.password",
    autoCorrect: "off",
    autoCapitalize: "none",
    spellCheck: false,
    enterKeyHint: "done",
    inputMode: "text",
    type: "password",
  },
};

function KeyboardDiagnosticsPage() {
  const t = useT();
  const [kind, setKind] = useState<FieldKind>("sentence");
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const [lang, setLang] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const preset = { ...PRESET_CONFIG[kind], label: t(PRESET_CONFIG[kind].labelKey) };

  useEffect(() => {
    setLang(navigator.language || (navigator.languages && navigator.languages[0]) || "?");
  }, []);

  const log = (label: string) =>
    setEvents((e) => [`${new Date().toLocaleTimeString()} · ${label}`, ...e].slice(0, 40));

  const commonHandlers = {
    onFocus: () => {
      setFocused(true);
      log(t("copy.keyboardDiag.event.focus"));
    },
    onBlur: () => {
      setFocused(false);
      log(t("copy.keyboardDiag.event.blur"));
    },
    onKeyDown: (e: React.KeyboardEvent) =>
      log(t("copy.keyboardDiag.event.keydown", { key: e.key })),
    onCompositionStart: () => log(t("copy.keyboardDiag.event.compositionStart")),
    onCompositionEnd: (e: React.CompositionEvent) =>
      log(t("copy.keyboardDiag.event.compositionEnd", { data: e.data })),
    onBeforeInput: (e: React.FormEvent) => {
      const ie = e as unknown as InputEvent;
      log(
        t("copy.keyboardDiag.event.beforeInput", {
          inputType: ie.inputType ?? "",
          data: ie.data ?? "",
        }),
      );
    },
  };

  return (
    <AppShell>
      <PageHeader title={t("copy.keyboardDiag.title")} subtitle={t("copy.keyboardDiag.subtitle")} />

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {t("copy.keyboardDiag.fieldTypeLabel")}
          </label>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as FieldKind);
              setValue("");
              setEvents([]);
            }}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
          >
            {(Object.keys(PRESET_CONFIG) as FieldKind[]).map((k) => (
              <option key={k} value={k}>
                {t(PRESET_CONFIG[k].labelKey)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {t("copy.keyboardDiag.testFieldLabel")}
          </label>
          {preset.type === "textarea" ? (
            <textarea
              ref={(n) => {
                inputRef.current = n;
              }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoCorrect={preset.autoCorrect}
              autoCapitalize={preset.autoCapitalize}
              spellCheck={preset.spellCheck}
              enterKeyHint={
                preset.enterKeyHint as React.HTMLAttributes<HTMLElement>["enterKeyHint"]
              }
              inputMode={preset.inputMode as React.HTMLAttributes<HTMLElement>["inputMode"]}
              rows={4}
              placeholder={t("copy.keyboardDiag.placeholder")}
              {...commonHandlers}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
            />
          ) : (
            <input
              ref={(n) => {
                inputRef.current = n;
              }}
              type={preset.type}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoCorrect={preset.autoCorrect}
              autoCapitalize={preset.autoCapitalize}
              spellCheck={preset.spellCheck}
              enterKeyHint={
                preset.enterKeyHint as React.HTMLAttributes<HTMLElement>["enterKeyHint"]
              }
              inputMode={preset.inputMode as React.HTMLAttributes<HTMLElement>["inputMode"]}
              placeholder={t("copy.keyboardDiag.placeholder")}
              {...commonHandlers}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
            />
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-3 text-[12px] leading-relaxed">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {t("copy.keyboardDiag.expectedBehavior")}
          </div>
          <Row k={t("copy.keyboardDiag.row.fieldType")} v={preset.label} />
          <Row
            k={t("copy.keyboardDiag.row.autoCorrect")}
            v={
              preset.autoCorrect === "on"
                ? t("copy.keyboardDiag.row.autoCorrect.on")
                : t("copy.keyboardDiag.row.autoCorrect.off")
            }
          />
          <Row
            k={t("copy.keyboardDiag.row.autoCapitalize")}
            v={
              preset.autoCapitalize === "none"
                ? t("copy.keyboardDiag.row.autoCapitalize.off")
                : t("copy.keyboardDiag.row.autoCapitalize.on")
            }
          />
          <Row
            k={t("copy.keyboardDiag.row.suggestions")}
            v={preset.spellCheck ? t("copy.keyboardDiag.row.yes") : t("copy.keyboardDiag.row.no")}
          />
          <Row
            k={t("copy.keyboardDiag.row.detectedLanguage")}
            v={lang || t("copy.keyboardDiag.row.notDetected")}
          />
          <Row
            k={t("copy.keyboardDiag.row.activeField")}
            v={focused ? t("copy.keyboardDiag.row.yes") : t("copy.keyboardDiag.row.no")}
          />
          <Row k={t("copy.keyboardDiag.row.typedChars")} v={String(value.length)} />
        </div>

        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {t("copy.keyboardDiag.activityTitle")}
            </div>
            <button
              type="button"
              onClick={() => setEvents([])}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              {t("copy.keyboardDiag.clear")}
            </button>
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto text-[11px] font-mono text-muted-foreground">
            {events.length === 0 ? (
              <div className="opacity-60">{t("copy.keyboardDiag.noEvents")}</div>
            ) : (
              events.map((e, i) => <div key={i}>{e}</div>)
            )}
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t("copy.keyboardDiag.hint")}
        </p>
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate font-mono text-foreground">{v}</span>
    </div>
  );
}
