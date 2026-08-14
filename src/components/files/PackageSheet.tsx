/**
 * Fiche « paquet Android » (APK / AAB / XAPK).
 *
 * Montée une seule fois dans l'AppShell : tous les écrans qui listent des
 * fichiers ouvrent la même fiche via `openPackageSheet`, donc un .apk se
 * comporte exactement de la même façon depuis l'accueil, un dossier, une
 * catégorie, les récents ou la recherche.
 *
 * L'installation est une action Android réelle : l'installateur système est
 * lancé via un content:// (FileProvider). Rien n'est simulé — si Android
 * refuse, l'utilisateur voit la raison exacte.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Boxes, PackageCheck, PackageOpen, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet, PrimaryButton } from "./BottomSheet";
import { FileIcon } from "./FileIcon";
import { formatDate, formatSize } from "@/lib/files/format";
import {
  packageKindOf,
  packageLabel,
  packageLongLabel,
  type PackageKind,
} from "@/lib/files/package";
import {
  closePackageSheet,
  usePackageRequest,
  type PackageRequest,
} from "@/lib/files/package-sheet-store";
import { absolutePathOf } from "@/lib/viewer/source";
import { useT } from "@/lib/i18n";
import { openWithSystem } from "@/lib/viewer/openWith";
import {
  canInstallPackages,
  installNativePackage,
  isAndroidNative,
  openInstallPermissionSettings,
  readPackageInfo,
  type NativePackageInfo,
} from "@/lib/native/geniusfiles-native";

type Phase = "idle" | "preparing" | "permission" | "launching" | "handoff" | "error";

export function PackageSheetHost() {
  const req = usePackageRequest();
  return <PackageSheet req={req} />;
}

function PackageSheet({ req }: { req: PackageRequest | null }) {
  const t = useT();
  const [info, setInfo] = useState<NativePackageInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const entry = req?.entry ?? null;
  const kind: PackageKind | null = entry ? packageKindOf(entry) : null;
  const path = req && entry ? absolutePathOf(req.parent, entry) : null;

  /* Métadonnées : lecture du seul manifeste du paquet, en arrière-plan.
     L'interface reste utilisable pendant ce temps. */
  useEffect(() => {
    setInfo(null);
    setPhase("idle");
    setMessage(null);
    pendingRef.current = false;
    if (!path || kind !== "apk" || !isAndroidNative()) return;
    let alive = true;
    void readPackageInfo(path).then((res) => {
      if (alive) setInfo(res);
    });
    return () => {
      alive = false;
    };
  }, [path, kind]);

  const launchInstall = useCallback(async () => {
    if (!path) return;
    setPhase("launching");
    setMessage(null);
    const res = await installNativePackage(path);
    if (res.ok) {
      setPhase("handoff");
      return;
    }
    if (res.reason === "needs_permission") {
      pendingRef.current = true;
      setPhase("permission");
      return;
    }
    setPhase("error");
    setMessage(res.message);
  }, [path]);

  const onInstall = useCallback(async () => {
    if (!path) return;
    setPhase("preparing");
    setMessage(null);
    const allowed = await canInstallPackages();
    if (!allowed) {
      pendingRef.current = true;
      setPhase("permission");
      return;
    }
    await launchInstall();
  }, [path, launchInstall]);

  /* Retour depuis les réglages Android : l'autorisation est revérifiée et
     l'installation reprend automatiquement — le fichier n'est pas perdu. */
  useEffect(() => {
    if (phase !== "permission") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !pendingRef.current) return;
      void canInstallPackages().then((allowed) => {
        if (!allowed || !pendingRef.current) return;
        pendingRef.current = false;
        void launchInstall();
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase, launchInstall]);

  if (!req || !entry || !kind)
    return <BottomSheet open={false} onClose={closePackageSheet} children={null} />;

  const invalid = kind === "apk" && info !== null && info.valid === false;
  const incompatible = kind === "apk" && info?.valid === true && info.compatible === false;

  return (
    <BottomSheet open onClose={closePackageSheet} title={packageLongLabel(kind)}>
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <FileIcon kind={entry.kind ?? "other"} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">{entry.name}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {packageLabel(kind)} · {formatSize(entry.size ?? info?.size)} ·{" "}
            {formatDate(entry.mtime ?? info?.mtime)}
          </p>
        </div>
      </div>

      {info?.valid ? (
        <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
          {info.label ? (
            <Info label={t("files.package.label.application")} value={info.label} />
          ) : null}
          {info.packageName ? (
            <Info label={t("files.package.label.package")} value={info.packageName} />
          ) : null}
          {info.versionName ? (
            <Info label={t("files.package.label.version")} value={info.versionName} />
          ) : null}
          {info.minSdk ? (
            <Info label={t("files.package.label.minSdk")} value={`API ${info.minSdk}`} />
          ) : null}
          {info.installed ? (
            <Info
              label={t("files.package.label.installed")}
              value={info.installedVersionName || t("files.package.value.yes")}
            />
          ) : null}
        </div>
      ) : null}

      {kind === "apk" ? (
        <ApkBody
          phase={phase}
          message={message}
          invalid={invalid}
          incompatible={incompatible}
          native={isAndroidNative()}
          onInstall={() => void onInstall()}
          onOpenSettings={() => void openInstallPermissionSettings()}
        />
      ) : (
        <PackageNotice kind={kind} />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {req.onExplore ? (
          <PrimaryButton
            variant="ghost"
            onClick={() => {
              const fn = req.onExplore;
              closePackageSheet();
              fn?.(entry);
            }}
          >
            {t("files.package.exploreContent")}
          </PrimaryButton>
        ) : null}
        <PrimaryButton
          variant="ghost"
          onClick={() => {
            void openWithSystem(req.parent, entry).catch(() => {
              toast.error(t("files.package.noCompatibleApp"));
            });
          }}
        >
          {t("files.package.openWith")}
        </PrimaryButton>
        <PrimaryButton variant="ghost" onClick={closePackageSheet}>
          {t("files.package.close")}
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}

function ApkBody({
  phase,
  message,
  invalid,
  incompatible,
  native,
  onInstall,
  onOpenSettings,
}: {
  phase: Phase;
  message: string | null;
  invalid: boolean;
  incompatible: boolean;
  native: boolean;
  onInstall: () => void;
  onOpenSettings: () => void;
}) {
  const t = useT();
  if (invalid) {
    return (
      <Notice tone="danger" icon={AlertTriangle} title={t("files.package.invalid.title")}>
        {t("files.package.invalid.desc")}
      </Notice>
    );
  }

  if (phase === "permission") {
    return (
      <>
        <Notice tone="warn" icon={ShieldAlert} title={t("files.package.permission.title")}>
          {t("files.package.permission.desc")}
        </Notice>
        <div className="mt-3">
          <PrimaryButton onClick={onOpenSettings}>
            {t("files.package.permission.openSettings")}
          </PrimaryButton>
        </div>
      </>
    );
  }

  if (phase === "handoff") {
    return (
      <Notice tone="ok" icon={PackageCheck} title={t("files.package.handoff.title")}>
        {t("files.package.handoff.desc")}
      </Notice>
    );
  }

  if (phase === "error") {
    return (
      <Notice tone="danger" icon={AlertTriangle} title={t("files.package.error.title")}>
        {message ?? t("files.package.error.unknown")}
      </Notice>
    );
  }

  return (
    <>
      {incompatible ? (
        <Notice tone="warn" icon={AlertTriangle} title={t("files.package.incompatible.title")}>
          {t("files.package.incompatible.desc")}
        </Notice>
      ) : null}
      {!native ? (
        <Notice tone="warn" icon={PackageOpen} title={t("files.package.webPreview.title")}>
          {t("files.package.webPreview.desc")}
        </Notice>
      ) : null}
      <div className="mt-3">
        <PrimaryButton
          onClick={onInstall}
          disabled={!native || phase === "preparing" || phase === "launching"}
        >
          {phase === "preparing"
            ? t("ops.progress.phase.preparing")
            : phase === "launching"
              ? t("files.package.launching")
              : t("files.actions.installApp")}
        </PrimaryButton>
      </div>
    </>
  );
}

function PackageNotice({ kind }: { kind: PackageKind }) {
  const t = useT();
  if (kind === "aab") {
    return (
      <Notice tone="warn" icon={Boxes} title={t("files.package.aab.title")}>
        {t("files.package.aab.desc")}
      </Notice>
    );
  }
  return (
    <Notice tone="warn" icon={Boxes} title={t("files.package.xapk.title")}>
      {t("files.package.xapk.desc")}
    </Notice>
  );
}

function Notice({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "ok" | "warn" | "danger";
  icon: typeof AlertTriangle;
  title: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "bg-primary-softer text-primary"
      : tone === "danger"
        ? "bg-destructive/10 text-destructive"
        : "bg-surface-2 text-muted-foreground";
  return (
    <div className={`mt-3 flex gap-2.5 rounded-2xl p-3 ${cls}`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[12px] leading-snug opacity-90">{children}</p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 px-2.5 py-1.5">
      <span className="block text-[10px] uppercase tracking-wide opacity-70">{label}</span>
      <span className="block truncate text-[12px] text-foreground">{value}</span>
    </div>
  );
}
