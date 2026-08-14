/**
 * Paramètres — version essentielle.
 *
 * Cinq catégories seulement (Apparence, Stockage, Notifications,
 * Corbeille, À propos), présentées en cartes repliables. Aucun réglage
 * technique, expérimental ou destiné aux développeurs.
 *
 * Tous les textes proviennent de `@/lib/i18n` : l'écran est identique
 * en français et en anglais, y compris le sélecteur de langue.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  Eraser,
  FileText,
  HardDrive,
  Info,
  Check,
  Mail,
  MonitorSmartphone,
  Moon,
  Palette,
  Shield,
  Sun,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  SettingsAction,
  SettingsCard,
  SettingsItem,
  SettingsLink,
} from "@/components/settings/SettingsCard";
import { SelectRow, Toggle } from "@/components/settings/controls";
import {
  trashRetentionOptions,
  loadTrashRetention,
  saveTrashRetention,
  type TrashRetentionDays,
} from "@/lib/files/preferences";
import { DEFAULT_PREFS, usePrefs, type ThemeMode } from "@/lib/personalization";
import {
  LOCALES,
  LOCALE_LABELS,
  formatBytes,
  translate,
  t as tr,
  resolveLocale,
  useLocalePreference,
  useT,
  type LocalePreference,
} from "@/lib/i18n";
import { clearThumbnailCache } from "@/lib/native/thumbnails";
import { sweepTempFiles } from "@/lib/native/temp-sweep";

const APP_VERSION = "0.1.0";

/** Drapeaux associés à chaque option de langue (système = globe). */
const LOCALE_FLAGS: Record<LocalePreference, string> = {
  system: "🌐",
  fr: "🇫🇷",
  en: "🇺🇸",
  es: "🇪🇸",
  de: "🇩🇪",
  pt: "🇵🇹",
  it: "🇮🇹",
  tr: "🇹🇷",
};

export const Route = createFileRoute("/parametres")({
  head: () => ({
    meta: [
      { title: tr("meta.settings.title") },
      {
        name: "description",
        content: tr("meta.settings.description"),
      },
      { property: "og:title", content: tr("meta.settings.title") },
      {
        property: "og:description",
        content: tr("meta.settings.ogDescription"),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const t = useT();
  const [localePref, changeLocalePref] = useLocalePreference();
  const [prefs, setPrefs] = usePrefs();
  const [hydrated, setHydrated] = useState(false);
  const [retention, setRetention] = useState<TrashRetentionDays>(30);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setRetention(loadTrashRetention());
  }, []);

  const setShowHidden = (showHidden: boolean) =>
    setPrefs((p) => ({ ...p, files: { ...p.files, showHidden } }));

  const setNotifications = (enabled: boolean) =>
    setPrefs((p) => ({ ...p, notifications: { ...p.notifications, enabled } }));

  const clearCache = async () => {
    setClearing(true);
    try {
      const thumbs = await clearThumbnailCache().catch(() => ({ deleted: 0, bytesFreed: 0 }));
      const temp = await sweepTempFiles(0).catch(() => null);
      const bytes = thumbs.bytesFreed + (temp?.bytesReclaimed ?? 0);
      toast.success(t("settings.cache.done"), {
        description:
          bytes > 0
            ? t("settings.cache.freed", { size: formatBytes(bytes) })
            : t("settings.cache.nothing"),
      });
    } finally {
      setClearing(false);
    }
  };

  const retentionLabel = (value: TrashRetentionDays) =>
    value === -1
      ? t("settings.trash.option.manual")
      : t("settings.trash.option.days", { count: value });

  return (
    <AppShell>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div className="animate-page-in flex flex-col gap-3 pb-6">
        <SettingsCard
          icon={Palette}
          title={t("settings.appearance.title")}
          description={t("settings.appearance.desc")}
        >
          <SettingsItem label={t("settings.theme.label")} desc={t("settings.theme.desc")} stacked>
            <ThemePicker
              value={hydrated ? prefs.appearance.theme : DEFAULT_PREFS.appearance.theme}
              onChange={(theme) => {
                setPrefs((p) => ({ ...p, appearance: { ...p.appearance, theme } }));
              }}
            />
          </SettingsItem>
          <SettingsItem
            label={t("settings.language.label")}
            desc={t("settings.language.desc")}
            stacked
          >
            <LanguagePicker
              value={localePref}
              onChange={(next) => {
                changeLocalePref(next);
                // Confirmation immédiatement dans la nouvelle langue.
                toast.success(translate(resolveLocale(next), "settings.language.applied"));
              }}
            />
          </SettingsItem>
        </SettingsCard>

        <SettingsCard
          icon={HardDrive}
          title={t("settings.storage.title")}
          description={t("settings.storage.desc")}
          defaultOpen={false}
        >
          <SettingsItem label={t("settings.hidden.label")} desc={t("settings.hidden.desc")}>
            <Toggle
              checked={prefs.files.showHidden}
              onChange={setShowHidden}
              ariaLabel={t("settings.hidden.label")}
            />
          </SettingsItem>
          <SettingsItem label={t("settings.cache.label")} desc={t("settings.cache.desc")}>
            <SettingsAction icon={Eraser} onClick={clearCache} disabled={clearing}>
              {clearing ? t("settings.cache.working") : t("settings.cache.action")}
            </SettingsAction>
          </SettingsItem>
        </SettingsCard>

        <SettingsCard
          icon={Bell}
          title={t("settings.notifications.title")}
          description={t("settings.notifications.desc")}
          defaultOpen={false}
        >
          <SettingsItem
            label={t("settings.notifications.label")}
            desc={t("settings.notifications.hint")}
          >
            <Toggle
              checked={prefs.notifications.enabled}
              onChange={setNotifications}
              ariaLabel={t("settings.notifications.label")}
            />
          </SettingsItem>
        </SettingsCard>

        <SettingsCard
          icon={Trash2}
          title={t("settings.trash.title")}
          description={t("settings.trash.desc")}
          defaultOpen={false}
        >
          <SettingsItem label={t("settings.trash.label")} desc={t("settings.trash.hint")}>
            <SelectRow
              ariaLabel={t("settings.trash.aria")}
              value={retention}
              onChange={(v) => {
                setRetention(v as TrashRetentionDays);
                saveTrashRetention(v as TrashRetentionDays);
                toast.success(t("settings.trash.updated"));
              }}
              options={trashRetentionOptions().map((o) => ({
                value: o.value,
                label: retentionLabel(o.value),
              }))}
            />
          </SettingsItem>
        </SettingsCard>

        <SettingsCard
          icon={Info}
          title={t("settings.about.title")}
          description={t("settings.about.version", { version: APP_VERSION })}
          defaultOpen={false}
        >
          <SettingsItem label={t("settings.about.versionLabel")}>
            <span className="text-[13px] text-muted-foreground">v{APP_VERSION}</span>
          </SettingsItem>
          <SettingsLink
            icon={Shield}
            label={t("settings.about.privacy")}
            desc={t("settings.about.privacyDesc")}
            href="https://geniusfiles.lovable.app/confidentialite"
          />
          <SettingsLink
            icon={FileText}
            label={t("settings.about.terms")}
            href="https://geniusfiles.lovable.app/conditions"
          />
          <SettingsLink
            icon={Mail}
            label={t("settings.about.contact")}
            desc="support@geniusfiles.app"
            href="mailto:support@geniusfiles.app"
          />
        </SettingsCard>
      </div>

      <p className="pb-4 text-center text-[11px] text-muted-foreground/70">
        {t("settings.footer", { version: APP_VERSION })}
      </p>
    </AppShell>
  );
}

/**
 * Sélecteur de thème — trois modes, retour visuel immédiat.
 * Le changement est appliqué instantanément par l'applier (aucun
 * rechargement, aucun écran noir).
 */
function ThemePicker({
  value,
  onChange,
}: {
  value: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}) {
  const t = useT();
  const options: { value: ThemeMode; label: string; icon: typeof Moon }[] = [
    { value: "system", label: t("settings.theme.system"), icon: MonitorSmartphone },
    { value: "light", label: t("settings.theme.light"), icon: Sun },
    { value: "dark", label: t("settings.theme.dark"), icon: Moon },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={t("settings.theme.aria")}
      suppressHydrationWarning
      className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-surface-2 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            suppressHydrationWarning
            aria-checked={active}
            onClick={() => {
              if (!active) {
                onChange(o.value);
                toast.success(t("settings.theme.applied", { theme: o.label.toLowerCase() }));
              }
            }}
            className={`gf-press flex h-9 min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-[12px] font-semibold transition-colors ${
              active ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground"
            }`}
          >
            <o.icon className="h-3.5 w-3.5" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Sélecteur de langue — chaque langue est écrite dans sa propre langue,
 * afin d'être reconnaissable même quand l'interface est incompréhensible
 * pour l'utilisateur. Le changement est immédiat, sans redémarrage.
 * L'option automatique indique la langue réellement appliquée.
 */
function LanguagePicker({
  value,
  onChange,
}: {
  value: LocalePreference;
  onChange: (pref: LocalePreference) => void;
}) {
  const t = useT();
  const systemLocale = resolveLocale("system");
  return (
    <div
      role="radiogroup"
      aria-label={t("settings.language.label")}
      suppressHydrationWarning
      className="flex flex-col gap-1 rounded-2xl border border-border bg-surface-2 p-1"
    >
      {(["system", ...LOCALES] as const).map((code) => {
        const active = code === value;
        const label =
          code === "system"
            ? `${t("settings.language.system")} · ${LOCALE_LABELS[systemLocale]}`
            : LOCALE_LABELS[code];
        return (
          <button
            key={code}
            type="button"
            role="radio"
            suppressHydrationWarning
            aria-checked={active}
            onClick={() => {
              if (!active) onChange(code);
            }}
            className={`gf-press flex h-10 min-w-0 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition-colors ${
              active ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground"
            }`}
          >
            <span aria-hidden="true" className="shrink-0 text-base leading-none">
              {LOCALE_FLAGS[code]}
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            {active ? <Check className="h-4 w-4 shrink-0" /> : null}
          </button>
        );
      })}
    </div>
  );
}
