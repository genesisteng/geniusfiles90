/**
 * Coffre-fort sécurisé — main route.
 *
 * Three UI states, resolved in this order:
 *   1. Not configured → setup wizard (choose method, set secret, biometric opt-in).
 *   2. Configured + locked → lock screen (secret input + optional biometric).
 *   3. Configured + unlocked → vault browser (folders, favorites, search, sort,
 *      inline previewer, add / restore / permanent delete).
 *
 * The physical file storage lives under a dot-prefixed `.GeniusFilesVault`
 * folder on native devices — the shared `listDirectory` filter in
 * `src/lib/files/fs.ts` already hides dot-prefixed entries from every
 * public listing, so nothing extra is needed to make protected files
 * disappear from Fichiers, Galerie, Recherche or Nettoyeur.
 */
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useT, t, t as translate } from "@/lib/i18n";
import { ArrowDownAZ, ArrowLeft, ChevronRight, FolderPlus, Grid3X3, X } from "lucide-react";
import {
  GfSort as ArrowUpDown,
  GfRecent as Clock,
  GfDocument as FileTextIcon,
  GfBiometric as Fingerprint,
  GfFolder as Folder,
  GfKey as KeyRound,
  GfLocked as Lock,
  GfVault as LockKeyhole,
  GfPlus as Plus,
  GfRestore as RotateCcw,
  GfSearch as Search,
  GfSettings as Settings,
  GfVaultOpen as Shield,
  GfShieldCheck as ShieldCheck,
  GfRename as SquarePen,
  GfFavorite as Star,
  GfTrash as Trash2,
  GfRestore as Undo2,
  type AppIcon,
} from "@/components/icons";
import { AppShell } from "@/components/AppShell";
import { usePullToRefresh } from "@/lib/gestures/pull-refresh";
import { PageHeader } from "@/components/common/PageHeader";
import { BackButton } from "@/components/navigation/BackButton";
import { BACK_PRIORITY, useBackHandler } from "@/lib/navigation/back-stack";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IllustratedEmptyState } from "@/components/ui/IllustratedEmptyState";
import { useConfirm } from "@/components/common/useConfirm";
import { confirmCopy, countLabel } from "@/lib/copy";
import { errorMessage } from "@/lib/errors/humanize";
import {
  BottomSheet,
  ConfirmDialog,
  NamePrompt,
  PrimaryButton,
} from "@/components/files/BottomSheet";
import { FileIcon } from "@/components/files/FileIcon";
import { DestinationPicker } from "@/components/files/DestinationPicker";
import { ProgressDialog } from "@/components/files/ProgressDialog";
import { VaultAddPicker } from "@/components/vault/VaultAddPicker";
import { VaultPreview } from "@/components/vault/VaultPreview";
import { PatternLock, PATTERN_MIN, patternLength } from "@/components/vault/PatternLock";
import { formatDate, formatSize } from "@/lib/files/format";
import {
  addFromPublic,
  createFolder,
  deleteEmptyFolder,
  favorites as vaultFavorites,
  findFolder,
  folderPath,
  listVault,
  moveItemsToFolder,
  permanentDelete,
  renameFolder,
  restoreItems,
  searchAll,
  sortItems,
  toggleFavorite,
  usageVault,
  wipeVault,
} from "@/lib/vault/api";
import {
  biometricStatusMessage,
  getBiometricAvailability,
  getVaultMethod,
  isVaultConfigured,
  isBiometricAvailable,
  isBiometricEnabled,
  resetCredential,
  setBiometricEnabled,
  setupVault,
  verifyBiometric,
  verifySecret,
} from "@/lib/vault/auth";
import type { BiometricStatus } from "@/lib/vault/auth";
import {
  autoLockOptions,
  loadAutoLockMs,
  loadLockOnBackground,
  loadVaultSort,
  saveAutoLockMs,
  saveLockOnBackground,
  saveVaultSort,
} from "@/lib/vault/preferences";
import {
  bumpActivity,
  isVaultUnlocked,
  lockSession,
  markUnlocked,
  subscribeSession,
} from "@/lib/vault/session";
import type {
  PublicSource,
  VaultAuthMethod,
  VaultFolder,
  VaultItem,
  VaultProgress,
  VaultSortKey,
  VaultSortOrder,
} from "@/lib/vault/types";
import type { PathRef } from "@/lib/files/types";

export const Route = createFileRoute("/coffre-fort")({
  head: () => ({
    meta: [
      { title: "Coffre-fort — GeniusFiles" },
      {
        name: "description",
        content: translate("meta.vault.description"),
      },
      { property: "og:title", content: "Coffre-fort — GeniusFiles" },
      {
        property: "og:description",
        content: translate("meta.vault.ogDescription"),
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VaultRoute,
});

function VaultRoute() {
  /* Position de la liste restituée au retour depuis un aperçu. */
  useListScrollMemory("vault", true);

  const t = useT();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState<boolean>(false);

  useEffect(() => {
    setConfigured(isVaultConfigured());
    setUnlocked(isVaultUnlocked());
    const unsub = subscribeSession((v) => setUnlocked(v));
    return unsub;
  }, []);

  // Lock as soon as the user leaves the vault route.
  useEffect(() => {
    return () => {
      lockSession("manual");
    };
  }, []);

  if (configured === null) {
    return (
      <AppShell>
        <div className="pt-10 text-center text-[12px] text-muted-foreground">
          {t("vault.loading")}
        </div>
      </AppShell>
    );
  }

  if (!configured) {
    return (
      <SetupWizard
        onDone={() => {
          setConfigured(true);
          markUnlocked();
        }}
      />
    );
  }

  if (!unlocked) {
    return (
      <LockScreen
        onUnlocked={() => {
          markUnlocked();
        }}
        onReset={() => {
          setConfigured(false);
        }}
      />
    );
  }

  return <VaultBrowser />;
}

/* ============================================================
 *  Écran plein écran (configuration / déverrouillage)
 * ==========================================================*/

/**
 * Les écrans de configuration et de déverrouillage sont **plein écran** :
 * pas de navigation basse, pas d'en-tête d'application — uniquement le
 * coffre-fort, comme sur un écran de verrouillage système. L'inset haut est
 * absorbé ici (`pt-safe`) et le bas via `env(safe-area-inset-bottom)`.
 */
function VaultFullScreen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background pt-safe">
      <div className="flex items-center gap-1 px-2 pt-2">
        <Link
          to="/"
          aria-label={t("vault.exit")}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {t("vault.title")}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6">{children}</div>
      {footer ? (
        <div className="border-t border-border/60 bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================
 *  Setup wizard
 * ==========================================================*/

function methodLabel(t: ReturnType<typeof useT>, m: VaultAuthMethod): string {
  return m === "pin"
    ? t("vault.method.pin")
    : m === "password"
      ? t("vault.method.password")
      : t("vault.method.pattern");
}

function SetupWizard({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [step, setStep] = useState<"method" | "secret" | "confirm">("method");
  const [method, setMethod] = useState<VaultAuthMethod>("pin");
  const [secret, setSecret] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus>("unknown");
  const [biometricOpt, setBiometricOpt] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBiometricAvailability().then((r) => {
      setBiometricAvailable(r.available);
      setBiometricStatus(r.status);
    });
  }, []);

  const validSecret =
    method === "pin"
      ? secret.length >= 4 && /^\d+$/.test(secret)
      : method === "password"
        ? secret.length >= 6
        : patternLength(secret) >= PATTERN_MIN;
  const matches = secret === confirmValue && validSecret;

  const finish = async () => {
    if (!matches || busy) return;
    setBusy(true);
    try {
      await setupVault(method, secret, biometricOpt && biometricAvailable);
      toast.success(t("vault.setup.done"));
      onDone();
    } catch (e) {
      toast.error(errorMessage(e, t("vault.setup.failed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <VaultFullScreen>
      <div className="flex flex-col gap-4 pt-3">
        <div className="flex flex-col items-center gap-3 pb-1 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-xs">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
              {t("vault.setup.title")}
            </h1>
            <p className="mx-auto mt-1 max-w-[34ch] text-[12.5px] leading-snug text-muted-foreground">
              {t("vault.setup.desc")}
            </p>
          </div>
        </div>

        <ol className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <StepPill
            n={1}
            label={t("vault.setup.step.method")}
            active={step === "method"}
            done={step !== "method"}
          />
          <StepPill
            n={2}
            label={t("vault.setup.step.secret")}
            active={step === "secret"}
            done={step === "confirm"}
          />
          <StepPill
            n={3}
            label={t("vault.setup.step.confirm")}
            active={step === "confirm"}
            done={false}
          />
        </ol>

        {step === "method" ? (
          <div className="flex flex-col gap-2">
            <MethodOption
              icon={KeyRound}
              label={t("vault.setup.method.pin.label")}
              description={t("vault.setup.method.pin.desc")}
              selected={method === "pin"}
              onSelect={() => setMethod("pin")}
            />
            <MethodOption
              icon={Grid3X3}
              label={t("vault.setup.method.pattern.label")}
              description={t("vault.setup.method.pattern.desc")}
              selected={method === "pattern"}
              onSelect={() => setMethod("pattern")}
            />
            <MethodOption
              icon={LockKeyhole}
              label={t("vault.setup.method.password.label")}
              description={t("vault.setup.method.password.desc")}
              selected={method === "password"}
              onSelect={() => setMethod("password")}
            />
            <label
              className={`gf-card flex items-start gap-3 p-3.5 transition-colors ${
                biometricAvailable
                  ? "cursor-pointer hover:!border-primary/40"
                  : "cursor-not-allowed opacity-60"
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Fingerprint className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{t("vault.biometric.label")}</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                  {biometricStatusMessage(biometricStatus)}
                </p>
              </div>
              <input
                type="checkbox"
                checked={biometricOpt}
                disabled={!biometricAvailable}
                onChange={(e) => setBiometricOpt(e.target.checked)}
                className="mt-1"
              />
            </label>
            <PrimaryButton
              onClick={() => {
                setSecret("");
                setConfirmValue("");
                setStep("secret");
              }}
            >
              {t("action.continue")}
            </PrimaryButton>
          </div>
        ) : null}

        {step === "secret" ? (
          <div className="gf-card flex flex-col items-center gap-3 p-4">
            <label className="text-[11px] font-medium text-muted-foreground">
              {method === "pattern"
                ? t("vault.setup.secret.pattern.label")
                : t("vault.setup.secret.choose", { method: methodLabel(t, method) })}
            </label>
            {method === "pattern" ? (
              <>
                <PatternLock onComplete={(v) => setSecret(v)} />
                <p className="text-[11px] text-muted-foreground">
                  {secret
                    ? t("vault.setup.pattern.recorded", { count: patternLength(secret) })
                    : t("vault.setup.pattern.hint")}
                </p>
              </>
            ) : (
              <>
                <SecretInput
                  method={method}
                  value={secret}
                  onChange={setSecret}
                  autoFocus
                  placeholder={method === "pin" ? "••••" : "••••••"}
                />
                <p className="text-[11px] text-muted-foreground">
                  {method === "pin" ? t("vault.setup.hint.pin") : t("vault.setup.hint.password")}
                </p>
              </>
            )}
            <div className="flex w-full justify-end gap-2">
              <PrimaryButton variant="ghost" onClick={() => setStep("method")}>
                {t("action.back")}
              </PrimaryButton>
              <PrimaryButton
                onClick={() => {
                  setConfirmValue("");
                  setStep("confirm");
                }}
                disabled={!validSecret}
              >
                {t("action.continue")}
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {step === "confirm" ? (
          <div className="gf-card flex flex-col items-center gap-3 p-4">
            <label className="text-[11px] font-medium text-muted-foreground">
              {t("vault.setup.confirm.label", { method: methodLabel(t, method) })}
            </label>
            {method === "pattern" ? (
              <PatternLock
                onComplete={(v) => setConfirmValue(v)}
                error={!!confirmValue && !matches}
              />
            ) : (
              <SecretInput
                method={method}
                value={confirmValue}
                onChange={setConfirmValue}
                autoFocus
                placeholder={method === "pin" ? "••••" : "••••••"}
              />
            )}
            {confirmValue && !matches ? (
              <p className="text-[11px] text-destructive">{t("vault.setup.mismatch")}</p>
            ) : null}
            <div className="flex w-full justify-end gap-2">
              <PrimaryButton variant="ghost" onClick={() => setStep("secret")}>
                {t("action.back")}
              </PrimaryButton>
              <PrimaryButton onClick={finish} disabled={!matches || busy}>
                {busy ? "…" : t("vault.setup.activate")}
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </div>
    </VaultFullScreen>
  );
}

function StepPill({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${
        active
          ? "border-primary text-primary"
          : done
            ? "border-primary/40 text-muted-foreground"
            : "border-border text-muted-foreground"
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold ${
          active || done ? "bg-primary text-primary-foreground" : "bg-secondary"
        }`}
      >
        {n}
      </span>
      {label}
    </li>
  );
}

function MethodOption({
  icon: Icon,
  label,
  description,
  selected,
  onSelect,
}: {
  icon: AppIcon;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`gf-card flex items-start gap-3 p-3.5 text-left transition-all ${
        selected ? "!border-primary/60 ring-1 ring-primary/40" : ""
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-[13px] font-medium">{label}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

function SecretInput({
  method,
  value,
  onChange,
  autoFocus,
  placeholder,
}: {
  method: VaultAuthMethod;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      autoFocus={autoFocus}
      type={method === "pin" ? "tel" : "password"}
      inputMode={method === "pin" ? "numeric" : "text"}
      pattern={method === "pin" ? "[0-9]*" : undefined}
      autoComplete="new-password"
      value={value}
      onChange={(e) =>
        onChange(
          method === "pin" ? e.target.value.replace(/\D+/g, "").slice(0, 12) : e.target.value,
        )
      }
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-center text-[16px] tracking-[0.4em] text-foreground outline-none transition-colors focus:border-primary"
    />
  );
}

/* ============================================================
 *  Lock screen
 * ==========================================================*/

function LockScreen({ onUnlocked, onReset }: { onUnlocked: () => void; onReset: () => void }) {
  const t = useT();
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricReady, setBiometricReady] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const method: VaultAuthMethod = useMemo(() => getVaultMethod() ?? "pin", []);

  useEffect(() => {
    (async () => {
      if (!isBiometricEnabled()) return;
      const ok = await isBiometricAvailable();
      if (ok) setBiometricReady(true);
    })();
  }, []);

  const attempt = useCallback(
    async (value: string) => {
      if (busy || !value) return;
      setBusy(true);
      setError(null);
      const ok = await verifySecret(value);
      setBusy(false);
      if (!ok) {
        setAttempts((n) => n + 1);
        setError(method === "pattern" ? t("vault.lock.error.pattern") : t("vault.lock.error.code"));
        setSecret("");
        try {
          navigator.vibrate?.([12, 60, 12]);
        } catch {
          /* ignore */
        }
        return;
      }
      onUnlocked();
    },
    [busy, method, onUnlocked, t],
  );

  const tryBiometric = async () => {
    const r = await verifyBiometric();
    if (r.ok) {
      onUnlocked();
      return;
    }
    if (r.status === "cancelled") {
      setError(null);
      return;
    }
    setError(biometricStatusMessage(r.status));
  };

  return (
    <VaultFullScreen>
      <div className="flex min-h-full flex-col items-center justify-center gap-5 py-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/12 text-primary shadow-xs">
          <Lock className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
            {t("vault.lock.title")}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {method === "pattern"
              ? t("vault.lock.subtitle.pattern")
              : t("vault.lock.subtitle.secret", { method: methodLabel(t, method) })}
          </p>
        </div>

        {method === "pattern" ? (
          <div className="flex flex-col items-center gap-3">
            <PatternLock
              onComplete={(v) => void attempt(v)}
              disabled={busy}
              error={!!error}
              size={272}
            />
            {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
          </div>
        ) : (
          <div className="w-full max-w-xs">
            <SecretInput
              method={method}
              value={secret}
              onChange={setSecret}
              autoFocus
              placeholder={method === "pin" ? "••••" : "••••••"}
            />
            {error ? <p className="mt-2 text-[12px] text-destructive">{error}</p> : null}
            <div className="mt-3">
              <PrimaryButton onClick={() => void attempt(secret)} disabled={busy || !secret}>
                {busy ? t("vault.lock.verifying") : t("vault.lock.unlock")}
              </PrimaryButton>
            </div>
          </div>
        )}

        {biometricReady ? (
          <button
            type="button"
            onClick={tryBiometric}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground active:scale-95"
          >
            <Fingerprint className="h-4 w-4" /> {t("vault.lock.useBiometric")}
          </button>
        ) : null}

        {attempts >= 3 ? (
          <p className="text-[11px] text-muted-foreground">
            {t("vault.lock.attempts", { count: attempts })}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setShowReset(true)}
          className="mt-2 text-[11.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t("vault.lock.forgot")}
        </button>

        <ConfirmDialog
          open={showReset}
          title={t("vault.reset.title")}
          description={
            <>
              {t("vault.reset.descBefore")} <strong>{t("vault.reset.descBold")}</strong>{" "}
              {t("vault.reset.descAfter")}
            </>
          }
          confirmLabel={t("vault.reset.confirmAll")}
          danger
          onCancel={() => setShowReset(false)}
          onConfirm={async () => {
            await wipeVault();
            resetCredential();
            setShowReset(false);
            toast.info(t("vault.reset.done"));
            onReset();
          }}
        />
      </div>
    </VaultFullScreen>
  );
}

/* ============================================================
 *  Browser
 * ==========================================================*/

function VaultBrowser() {
  const t = useT();
  const router = useRouter();
  const [folderId, setFolderId] = useState<string | null>(null);

  /* Retour Android : remonte d'un dossier du coffre avant de quitter la
     page (comportement identique à l'explorateur de fichiers). */
  useBackHandler(
    folderId != null,
    () => {
      setFolderId((id) => (id == null ? id : (findFolder(id)?.parentId ?? null)));
      return true;
    },
    BACK_PRIORITY.page,
  );
  const [tick, setTick] = useState(0);
  const [sort, setSort] = useState(() => loadVaultSort());
  const [query, setQuery] = useState("");
  const [showFavorites, setShowFavorites] = useState(false);
  const [selected, setSelected] = useState<Record<string, VaultItem>>({});

  // Sheets / dialogs
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [progress, setProgress] = useState<VaultProgress | null>(null);
  const [progressTitle, setProgressTitle] = useState("");
  const [renameTarget, setRenameTarget] = useState<VaultFolder | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [actionItem, setActionItem] = useState<VaultItem | null>(null);
  const [previewItem, setPreviewItem] = useState<VaultItem | null>(null);
  const [restoreCandidates, setRestoreCandidates] = useState<VaultItem[] | null>(null);
  const [restoreTargetOpen, setRestoreTargetOpen] = useState(false);
  const [deleteCandidates, setDeleteCandidates] = useState<VaultItem[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  /* Tirer pour actualiser : relit réellement l'index du coffre déverrouillé
     (éléments, dossiers, favoris, usage) sans démonter la page — seuls les
     mémos dépendant de `tick` sont recalculés, le layout reste stable. */
  const pullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      refresh();
      /* Laisse React appliquer le recalcul avant de retirer l'indicateur. */
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  usePullToRefresh(pullRefresh);

  useEffect(() => {
    const on = () => refresh();
    window.addEventListener("gf:vault-changed", on);
    return () => window.removeEventListener("gf:vault-changed", on);
  }, [refresh]);

  // Any click / key press within the vault refreshes the inactivity timer.
  useEffect(() => {
    const bump = () => bumpActivity();
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, []);

  /* eslint-disable react-hooks/exhaustive-deps */
  const listing = useMemo(() => listVault(folderId), [folderId, tick]);
  const path = useMemo(() => folderPath(folderId), [folderId, tick]);
  const current = folderId ? findFolder(folderId) : null;
  const usage = useMemo(() => usageVault(), [tick]);

  const searchResults = useMemo(() => (query.trim() ? searchAll(query) : []), [query, tick]);
  const favs = useMemo(() => vaultFavorites(), [tick]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const visibleItems = useMemo(() => {
    if (query.trim()) return sortItems(searchResults, sort.key, sort.order);
    if (showFavorites) return sortItems(favs, sort.key, sort.order);
    return sortItems(listing.items, sort.key, sort.order);
  }, [query, searchResults, showFavorites, favs, listing.items, sort]);

  const visibleFolders = query.trim() || showFavorites ? [] : listing.folders;

  const clearSelection = () => setSelected({});
  const toggleSelect = (item: VaultItem) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item;
      return next;
    });
  };
  const selectionCount = Object.keys(selected).length;
  const selectionArray = Object.values(selected);

  /* Retour Android dans le coffre : sélection → favoris → recherche, avant
     toute navigation. Les feuilles se ferment d'elles-mêmes. */
  useBackHandler(
    selectionCount > 0,
    () => {
      clearSelection();
      return true;
    },
    BACK_PRIORITY.mode,
  );
  useBackHandler(
    showFavorites,
    () => {
      setShowFavorites(false);
      return true;
    },
    BACK_PRIORITY.mode,
  );
  useBackHandler(
    query.length > 0,
    () => {
      setQuery("");
      return true;
    },
    BACK_PRIORITY.mode,
  );

  /* ---------------- add ---------------- */

  const confirm = useConfirm();

  const performAdd = async (sources: PublicSource[]) => {
    setProgressTitle(t("vault.add.encrypting", { count: sources.length }));
    setProgress({
      completed: 0,
      total: sources.length,
      bytes: 0,
      totalBytes: sources.reduce((s, x) => s + x.size, 0),
      currentName: sources[0].name,
      elapsedMs: 0,
    });
    const res = await addFromPublic(sources, {
      folderId,
      onProgress: (p) => setProgress(p),
    });
    setProgress(null);
    if (res.added > 0) {
      toast.success(t("vault.add.success", { count: res.added }));
    }
    if (res.failed.length > 0) {
      toast.error(
        res.failed.length === 1
          ? t("vault.add.failed.one", { name: res.failed[0].name })
          : t("vault.add.failed.many", { count: res.failed.length }),
      );
    }
  };

  const doAdd = (sources: PublicSource[]) => {
    setAddPickerOpen(false);
    if (sources.length === 0) return;
    confirm.ask(confirmCopy.encrypt(sources.length), () => performAdd(sources));
  };

  /* ---------------- restore ---------------- */

  const askRestore = (items: VaultItem[]) => {
    setRestoreCandidates(items);
  };

  const runRestore = async (items: VaultItem[], target?: PathRef) => {
    setProgressTitle(t("vault.restore.progress"));
    setProgress({
      completed: 0,
      total: items.length,
      bytes: 0,
      totalBytes: items.reduce((s, i) => s + (i.size || 0), 0),
      currentName: items[0]?.name ?? "",
      elapsedMs: 0,
    });
    const res = await restoreItems(items, {
      targetPath: target,
      onProgress: (p) => setProgress(p),
    });
    setProgress(null);
    setRestoreCandidates(null);
    setRestoreTargetOpen(false);
    clearSelection();
    if (res.restored > 0) toast.success(t("vault.restore.success", { count: res.restored }));
    if (res.failed.length > 0) toast.error(t("vault.restore.failed", { count: res.failed.length }));
  };

  /* ---------------- delete forever ---------------- */

  const askDelete = (items: VaultItem[]) => setDeleteCandidates(items);

  const runDelete = async (items: VaultItem[]) => {
    const res = await permanentDelete(items);
    setDeleteCandidates(null);
    clearSelection();
    if (res.deleted > 0) toast.success(t("vault.delete.success", { count: res.deleted }));
  };

  /* ---------------- folders ---------------- */

  const doCreateFolder = async (name: string) => {
    const res = createFolder(name, folderId);
    setNewFolderOpen(false);
    if (!res.ok) toast.error(res.error ?? t("vault.folder.create.error"));
    else toast.success(t("vault.folder.create.done"));
  };

  const doRenameFolder = async (name: string) => {
    if (!renameTarget) return;
    const res = renameFolder(renameTarget.id, name);
    setRenameTarget(null);
    if (!res.ok) toast.error(res.error ?? t("vault.folder.rename.error"));
  };

  const doDeleteFolder = (folder: VaultFolder) => {
    const res = deleteEmptyFolder(folder.id);
    if (!res.ok) toast.error(res.error ?? t("vault.folder.delete.error"));
    else toast.success(t("vault.folder.delete.done"));
  };

  /* ---------------- render ---------------- */

  return (
    <AppShell>
      {/* En-tête soudé : enfant direct de `.gf-page`, donc jamais tiré par
          le geste « tirer pour actualiser » (voir ScrollFeel). */}
      <PageHeader
        title={current ? current.name : t("vault.title")}
        subtitle={
          selectionCount > 0
            ? t("unit.selected", { count: selectionCount })
            : t("vault.usage.summary", { count: usage.count, size: formatSize(usage.bytes) })
        }
        eyebrow={current ? t("vault.title") : undefined}
        leading={
          <BackButton className="gf-press flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground hover:text-foreground" />
        }
        action={
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label={t("vault.folder.new.title")}
              onClick={() => setNewFolderOpen(true)}
              className="gf-press flex h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <FolderPlus className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              aria-label={t("vault.settings.aria")}
              onClick={() => setSettingsOpen(true)}
              className="gf-press flex h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Settings className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              aria-label={t("vault.lockAria")}
              onClick={() => {
                lockSession("manual");
              }}
              className="gf-press flex h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Lock className="h-[18px] w-[18px]" />
            </button>
          </div>
        }
      />

      {/* Contenu défilable — commence strictement sous l'en-tête. */}
      <div className="flex flex-col gap-3 pt-3">
        {/* Bandeau d'état du coffre */}
        <div className="gf-card flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs">
            <Shield className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-foreground">{t("vault.banner.title")}</p>
            <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
              {t("vault.usage.summary", { count: usage.count, size: formatSize(usage.bytes) })}
              {refreshing ? t("vault.banner.refreshing") : ""}
            </p>
          </div>
        </div>

        {/* Fil d'Ariane */}
        {path.length > 0 ? (
          <div className="flex items-center gap-0.5 overflow-x-auto text-[12.5px] text-muted-foreground">
            <button
              type="button"
              onClick={() => setFolderId(null)}
              className="gf-press shrink-0 rounded-xl px-2 py-1.5 hover:text-foreground"
            >
              {t("vault.title")}
            </button>
            {path.map((f) => (
              <span key={f.id} className="flex shrink-0 items-center gap-0.5">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <button
                  type="button"
                  onClick={() => setFolderId(f.id)}
                  className="gf-press rounded-xl px-2 py-1.5 hover:text-foreground"
                >
                  {f.name}
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {/* Recherche + tri */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoCorrect="on"
              autoCapitalize="sentences"
              spellCheck
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("vault.search.placeholder")}
              className="h-11 w-full rounded-2xl bg-surface-2 pl-10 pr-10 text-[14px] text-foreground outline-none ring-1 ring-inset ring-transparent transition-shadow focus:ring-primary/60 placeholder:text-muted-foreground/70"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("cleaner.trash.clearSearch.aria")}
                className="gf-press absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <SortMenu
            sort={sort}
            onChange={(s) => {
              setSort(s);
              saveVaultSort(s);
            }}
          />
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2">
          <FilterChip
            active={!showFavorites && !query}
            icon={Folder}
            label={t("home.scopePicker.all")}
            onClick={() => {
              setShowFavorites(false);
              setQuery("");
            }}
          />
          <FilterChip
            active={showFavorites && !query}
            icon={Star}
            label={t("vault.filter.favorites", { count: favs.length })}
            onClick={() => {
              setShowFavorites(true);
              setQuery("");
            }}
          />
        </div>

        {/* Contenu */}
        {visibleFolders.length === 0 && visibleItems.length === 0 ? (
          <div className="gf-appear flex min-h-[46vh] flex-col justify-center">
            {query || showFavorites ? (
              <IllustratedEmptyState
                id={query ? "search" : "favorites"}
                description={query ? t("vault.empty.searchHint") : t("vault.empty.favoritesHint")}
              />
            ) : (
              <EmptyState
                icon={LockKeyhole}
                title={t("vault.empty.title")}
                description={t("vault.empty.desc")}
                action={
                  <button
                    type="button"
                    onClick={() => setAddPickerOpen(true)}
                    className="gf-press inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-soft"
                  >
                    <Plus className="h-[18px] w-[18px]" /> {t("vault.add.cta")}
                  </button>
                }
              />
            )}
          </div>
        ) : (
          <div className="gf-appear flex flex-col gap-3">
            {visibleFolders.length > 0 ? (
              <div className="flex flex-col gap-2">
                <SectionHeader title={t("files.archive.info.folders")} />
                <ul className="grid grid-cols-2 gap-2">
                  {visibleFolders.map((f) => (
                    <li key={f.id}>
                      <FolderTile
                        folder={f}
                        onOpen={() => setFolderId(f.id)}
                        onRename={() => setRenameTarget(f)}
                        onDelete={() => doDeleteFolder(f)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {visibleItems.length > 0 ? (
              <div className="flex flex-col gap-2">
                <SectionHeader
                  title={
                    query
                      ? t("vault.section.results")
                      : showFavorites
                        ? t("vault.section.favorites")
                        : t("vault.section.files")
                  }
                  hint={`${visibleItems.length} ${t("unit.item", { count: visibleItems.length })}`}
                />
                <ul className="gf-card flex flex-col divide-y divide-border/60 overflow-hidden">
                  {visibleItems.map((item) => (
                    <li key={item.id}>
                      <ItemRow
                        item={item}
                        selected={!!selected[item.id]}
                        anySelected={selectionCount > 0}
                        onOpen={() => setPreviewItem(item)}
                        onLongPress={() => toggleSelect(item)}
                        onToggleSelect={() => toggleSelect(item)}
                        onMore={() => setActionItem(item)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* FAB — ajout de fichiers (masqué pendant la sélection pour ne pas
          chevaucher la barre d'actions). */}
      {selectionCount === 0 ? (
        <button
          type="button"
          onClick={() => setAddPickerOpen(true)}
          aria-label={t("vault.add.aria")}
          className="gf-press fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated"
        >
          <Plus className="h-6 w-6" />
        </button>
      ) : null}

      {/* Selection bar */}
      {selectionCount > 0 ? (
        <SelectionBar
          count={selectionCount}
          onClear={clearSelection}
          onRestore={() => askRestore(selectionArray)}
          onDelete={() => askDelete(selectionArray)}
        />
      ) : null}

      {/* Sheets */}
      <VaultAddPicker
        open={addPickerOpen}
        onCancel={() => setAddPickerOpen(false)}
        onConfirm={doAdd}
      />

      <NamePrompt
        open={newFolderOpen}
        title={t("vault.folder.new.title")}
        label={t("vault.folder.new.label")}
        initial=""
        cta={t("vault.folder.new.cta")}
        onCancel={() => setNewFolderOpen(false)}
        onSubmit={doCreateFolder}
      />

      <NamePrompt
        open={!!renameTarget}
        title={t("vault.folder.rename.title")}
        label={t("vault.folder.rename.label")}
        initial={renameTarget?.name ?? ""}
        cta={t("action.rename")}
        onCancel={() => setRenameTarget(null)}
        onSubmit={doRenameFolder}
      />

      <ProgressDialog
        open={progress !== null}
        title={progressTitle}
        progress={progress}
        onCancel={() => {
          /* No hard-cancel: individual moves are atomic and the pipeline
             stops after each item finishes, which is safe enough for the
             volumes handled by a personal vault. */
        }}
      />

      <ItemActionSheet
        item={actionItem}
        onClose={() => setActionItem(null)}
        onRestore={(it) => {
          setActionItem(null);
          askRestore([it]);
        }}
        onDelete={(it) => {
          setActionItem(null);
          askDelete([it]);
        }}
        onFavorite={(it) => {
          toggleFavorite(it.id);
          setActionItem(null);
        }}
        onMove={(it) => {
          setActionItem(null);
          const target = prompt(t("vault.move.prompt"), current?.name ?? "");
          if (target === null) return;
          const targetName = target.trim();
          if (!targetName) {
            moveItemsToFolder([it.id], null);
            toast.success(t("vault.move.root"));
            return;
          }
          // find/create folder by name at the current parent (folderId)
          const existing = listVault(folderId).folders.find(
            (f) => f.name.toLowerCase() === targetName.toLowerCase(),
          );
          if (existing) {
            moveItemsToFolder([it.id], existing.id);
            toast.success(t("vault.move.into", { name: existing.name }));
          } else {
            const created = createFolder(targetName, folderId);
            if (created.ok && created.folder) {
              moveItemsToFolder([it.id], created.folder.id);
              toast.success(t("vault.move.into", { name: created.folder.name }));
            } else {
              toast.error(created.error ?? t("vault.action.impossible"));
            }
          }
        }}
      />

      <VaultPreview
        open={!!previewItem}
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onRestore={(it) => {
          setPreviewItem(null);
          askRestore([it]);
        }}
        onDelete={(it) => {
          setPreviewItem(null);
          askDelete([it]);
        }}
        onToggleFavorite={(it) => {
          toggleFavorite(it.id);
          setPreviewItem((prev) => (prev ? { ...prev, favorite: !prev.favorite } : null));
        }}
      />

      <RestorePrompt
        items={restoreCandidates}
        onCancel={() => setRestoreCandidates(null)}
        onOriginal={() => restoreCandidates && runRestore(restoreCandidates)}
        onPickTarget={() => setRestoreTargetOpen(true)}
      />

      <DestinationPicker
        open={restoreTargetOpen}
        title={t("vault.restore.destinationTitle")}
        initial={null}
        onCancel={() => setRestoreTargetOpen(false)}
        onConfirm={(dest) => {
          if (restoreCandidates) runRestore(restoreCandidates, dest);
        }}
      />

      <ConfirmDialog
        open={!!deleteCandidates}
        title={t("vault.delete.confirmTitle")}
        description={
          <>
            {t("vault.delete.confirmDescBefore")}{" "}
            <strong>
              {deleteCandidates?.length === 1
                ? t("vault.delete.target.one", { name: deleteCandidates[0].name })
                : t("vault.delete.target.many", { count: deleteCandidates?.length ?? 0 })}
            </strong>{" "}
            {t("vault.delete.confirmDescAfter")}
          </>
        }
        confirmLabel={t("automations.card.delete")}
        danger
        onCancel={() => setDeleteCandidates(null)}
        onConfirm={() => {
          if (deleteCandidates) return runDelete(deleteCandidates);
        }}
      />

      <VaultSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onWipe={async () => {
          await wipeVault();
          resetCredential();
          lockSession("manual");
          router.navigate({ to: "/" });
        }}
      />

      {confirm.dialog}
    </AppShell>
  );
}

/* ---------------- pieces ---------------- */

function FilterChip({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: AppIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`gf-press inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
        active
          ? "border-primary/60 bg-primary/12 text-primary"
          : "border-border bg-surface text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function SortMenu({
  sort,
  onChange,
}: {
  sort: { key: VaultSortKey; order: VaultSortOrder };
  onChange: (s: { key: VaultSortKey; order: VaultSortOrder }) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const options: { key: VaultSortKey; label: string; icon: AppIcon }[] = [
    { key: "date", label: t("vault.sort.date"), icon: Clock },
    { key: "name", label: t("automations.summaryStep.name"), icon: ArrowDownAZ },
    { key: "size", label: t("files.details.size"), icon: ArrowUpDown },
    { key: "type", label: t("vault.sort.type"), icon: FileTextIcon },
  ];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t("action.sort")}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="gf-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-muted-foreground hover:text-foreground"
      >
        <ArrowUpDown className="h-[18px] w-[18px]" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft"
        >
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="menuitemradio"
              aria-checked={sort.key === o.key}
              onClick={() => {
                onChange({
                  key: o.key,
                  order: sort.key === o.key ? (sort.order === "asc" ? "desc" : "asc") : "asc",
                });
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-[13.5px] hover:bg-secondary/60 ${
                sort.key === o.key ? "text-primary" : "text-foreground"
              }`}
            >
              <o.icon className="h-4 w-4" /> {o.label}
              {sort.key === o.key ? (
                <span className="ml-auto text-[10px] uppercase tracking-wide">{sort.order}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FolderTile({
  folder,
  onOpen,
  onRename,
  onDelete,
}: {
  folder: VaultFolder;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="gf-card relative flex flex-col p-2.5">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Folder className="h-[18px] w-[18px]" />
        </span>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-label={t("vault.folder.renameAria", { name: folder.name })}
            onClick={onRename}
            className="gf-press flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
          >
            <SquarePen className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={t("vault.folder.deleteAria", { name: folder.name })}
            onClick={onDelete}
            className="gf-press flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="gf-press mt-1.5 min-h-11 w-full rounded-xl px-1 text-left"
      >
        <p className="truncate text-[14px] font-medium">{folder.name}</p>
        <p className="truncate text-[12px] text-muted-foreground">
          {t("vault.folder.privateLabel")}
        </p>
      </button>
    </div>
  );
}

function ItemRow({
  item,
  selected,
  anySelected,
  onOpen,
  onLongPress,
  onToggleSelect,
  onMore,
}: {
  item: VaultItem;
  selected: boolean;
  anySelected: boolean;
  onOpen: () => void;
  onLongPress: () => void;
  onToggleSelect: () => void;
  onMore: () => void;
}) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPress = () => {
    pressTimer.current = setTimeout(() => onLongPress(), 450);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 transition-colors ${
        selected ? "bg-primary/10" : "hover:bg-secondary/40"
      }`}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
    >
      <button
        type="button"
        onClick={() => (anySelected ? onToggleSelect() : onOpen())}
        className="gf-press flex min-h-14 flex-1 items-center gap-3 rounded-xl px-1.5 text-left"
      >
        <FileIcon kind={item.kind} path={item.vaultAbsolutePath ?? item.originalPath} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">
            {item.name}
            {item.favorite ? (
              <Star className="ml-1 inline h-3.5 w-3.5 text-amber-400" fill="currentColor" />
            ) : null}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {formatSize(item.size)} · {formatDate(item.addedAt)}
          </p>
        </div>
      </button>
      <button
        type="button"
        aria-label={t("vault.item.actionsAria")}
        onClick={onMore}
        className="gf-press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

function SelectionBar({
  count,
  onClear,
  onRestore,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2">
      <div className="glass-panel pointer-events-auto flex items-center gap-2 rounded-3xl border border-border-strong px-2.5 py-2 shadow-soft animate-in-up">
        <button
          type="button"
          onClick={onClear}
          aria-label={t("ops.selection.exit")}
          className="gf-press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-muted-foreground hover:text-foreground"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
        <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">
          {t("unit.selected", { count })}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRestore}
            className="gf-press inline-flex h-11 items-center gap-1.5 rounded-2xl border border-border bg-surface px-3.5 text-[13px] font-medium text-foreground"
          >
            <Undo2 className="h-4 w-4" /> {t("action.restore")}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="gf-press inline-flex h-11 items-center gap-1.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-3.5 text-[13px] font-medium text-destructive"
          >
            <Trash2 className="h-4 w-4" /> {t("action.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemActionSheet({
  item,
  onClose,
  onRestore,
  onDelete,
  onFavorite,
  onMove,
}: {
  item: VaultItem | null;
  onClose: () => void;
  onRestore: (it: VaultItem) => void;
  onDelete: (it: VaultItem) => void;
  onFavorite: (it: VaultItem) => void;
  onMove: (it: VaultItem) => void;
}) {
  return (
    <BottomSheet open={!!item} onClose={onClose}>
      {item ? (
        <>
          <div className="mb-3 flex items-center gap-3 px-1">
            <FileIcon kind={item.kind} path={item.vaultAbsolutePath ?? item.originalPath} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{item.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {formatSize(item.size)} ·{" "}
                {t("vault.item.addedOn", { date: formatDate(item.addedAt) })}
              </p>
            </div>
          </div>
          <div className="flex flex-col">
            <ActionRow
              icon={Star}
              label={item.favorite ? t("vault.item.favoriteRemove") : t("vault.item.favoriteAdd")}
              onClick={() => onFavorite(item)}
            />
            <ActionRow icon={Folder} label={t("vault.item.moveTo")} onClick={() => onMove(item)} />
            <ActionRow
              icon={Undo2}
              label={t("vault.item.restoreEllipsis")}
              onClick={() => onRestore(item)}
            />
            <ActionRow
              icon={Trash2}
              label={t("action.deleteForever")}
              onClick={() => onDelete(item)}
              danger
            />
          </div>
        </>
      ) : null}
    </BottomSheet>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: AppIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-2 py-2.5 text-left text-[13px] transition-colors hover:bg-secondary/60 ${
        danger ? "text-red-400" : "text-foreground"
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          danger ? "bg-red-500/12 text-red-400" : "bg-primary/12 text-primary"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span>{label}</span>
    </button>
  );
}

function RestorePrompt({
  items,
  onCancel,
  onOriginal,
  onPickTarget,
}: {
  items: VaultItem[] | null;
  onCancel: () => void;
  onOriginal: () => void;
  onPickTarget: () => void;
}) {
  return (
    <BottomSheet open={!!items} onClose={onCancel} title={t("vault.restore.title")}>
      {items ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-muted-foreground">
            {items.length === 1 ? t("vault.restore.where_one") : t("vault.restore.where_other")}
          </p>
          <button
            type="button"
            onClick={onOriginal}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left hover:!border-primary/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <RotateCcw className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-medium">{t("vault.restore.original.label")}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("vault.restore.original.desc")}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={onPickTarget}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left hover:!border-primary/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Folder className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-medium">{t("vault.restore.choose.label")}</p>
              <p className="text-[11px] text-muted-foreground">{t("vault.restore.choose.desc")}</p>
            </div>
          </button>
        </div>
      ) : null}
    </BottomSheet>
  );
}

function VaultSettings({
  open,
  onClose,
  onWipe,
}: {
  open: boolean;
  onClose: () => void;
  onWipe: () => Promise<void>;
}) {
  const t = useT();
  const [autoLock, setAutoLock] = useState(() => loadAutoLockMs());
  const [background, setBackground] = useState(() => loadLockOnBackground());
  const [bioOn, setBioOn] = useState(() => isBiometricEnabled());
  const [bioReady, setBioReady] = useState(false);
  const [bioStatus, setBioStatus] = useState<BiometricStatus>("unknown");
  const [askWipe, setAskWipe] = useState(false);
  useEffect(() => {
    if (open) {
      setAutoLock(loadAutoLockMs());
      setBackground(loadLockOnBackground());
      setBioOn(isBiometricEnabled());
      getBiometricAvailability().then((r) => {
        setBioReady(r.available);
        setBioStatus(r.status);
      });
    }
  }, [open]);
  return (
    <>
      <BottomSheet open={open && !askWipe} onClose={onClose} title={t("vault.settings.aria")}>
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">
              {t("vault.settings.autoLock.label")}
            </p>
            <select
              value={autoLock}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10);
                setAutoLock(v);
                saveAutoLockMs(v);
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px]"
            >
              {autoLockOptions().map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
            <div>
              <p className="text-[13px] font-medium">{t("vault.settings.background.label")}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("vault.settings.background.desc")}
              </p>
            </div>
            <input
              type="checkbox"
              checked={background}
              onChange={(e) => {
                setBackground(e.target.checked);
                saveLockOnBackground(e.target.checked);
              }}
            />
          </label>
          <label
            className={`flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 ${
              bioReady ? "" : "opacity-60"
            }`}
          >
            <div>
              <p className="text-[13px] font-medium">{t("vault.biometric.label")}</p>
              <p className="text-[11px] text-muted-foreground">
                {biometricStatusMessage(bioStatus)}
              </p>
            </div>
            <input
              type="checkbox"
              checked={bioOn}
              disabled={!bioReady}
              onChange={(e) => {
                setBioOn(e.target.checked);
                setBiometricEnabled(e.target.checked);
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => setAskWipe(true)}
            className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-medium text-red-400 hover:bg-red-500/20"
          >
            {t("vault.reset.title")}
          </button>
        </div>
      </BottomSheet>
      <ConfirmDialog
        open={askWipe}
        title={t("vault.wipe.confirmTitle")}
        description={t("vault.wipe.confirmDesc")}
        confirmLabel={t("action.reset")}
        danger
        onCancel={() => setAskWipe(false)}
        onConfirm={async () => {
          await onWipe();
          setAskWipe(false);
        }}
      />
    </>
  );
}

/* ---------------- home shortcut ---------------- */

// Note : un export au niveau module empêche le code-splitting automatique
// du composant de route (le compilateur ne peut pas extraire le composant
// dans un chunk séparé si un autre symbole du même fichier est exporté).
// Ce raccourci est donc rendu directement via <Link to="/coffre-fort" />
// depuis l'accueil — pas besoin d'un composant dédié ici.
