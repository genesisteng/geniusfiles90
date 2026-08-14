/**
 * Dialogue contextuel d'accès aux fichiers.
 *
 * Monté une seule fois à la racine. Il n'empêche JAMAIS l'affichage de
 * l'accueil : il apparaît en surcouche, brièvement après que la première
 * page est peinte, uniquement si l'accès complet n'est pas encore
 * accordé et que l'utilisateur n'a pas déjà répondu « Plus tard ».
 *
 * Il peut aussi être rouvert à la demande par une fonctionnalité qui a
 * réellement besoin de l'accès (`promptStorageAccess()`).
 */
import { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";
import { BottomSheet, PrimaryButton } from "@/components/files/BottomSheet";
import {
  deferStorageAccess,
  isStorageAccessDeferred,
  isStorageAccessGranted,
  requestStorageAccess,
  startStorageAccessWatch,
  subscribeStorageAccess,
} from "@/lib/native/storage-access";
import { onStartupReady } from "@/lib/startup/boot";
import { useT } from "@/lib/i18n";

/** Laisse à l'accueil le temps d'être découvert avant la demande. */
const FIRST_PROMPT_DELAY_MS = 1400;

export function StorageAccessDialog() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const stop = startStorageAccessWatch();
    let timer: number | undefined;

    // Première demande : après le démarrage, une seule fois.
    const off = onStartupReady(() => {
      timer = window.setTimeout(() => {
        if (!isStorageAccessGranted() && !isStorageAccessDeferred()) setOpen(true);
      }, FIRST_PROMPT_DELAY_MS);
    });

    // Fermeture automatique dès que l'accès est réellement accordé.
    const unsub = subscribeStorageAccess(() => {
      if (isStorageAccessGranted()) {
        setOpen(false);
        setNotice(null);
        setBusy(false);
      }
    });

    const onAsk = (e: Event) => {
      if (isStorageAccessGranted()) return;
      const detail = (e as CustomEvent<{ reason?: string }>).detail;
      setReason(detail?.reason ?? null);
      setOpen(true);
    };
    window.addEventListener("gf:ask-storage-access", onAsk);

    return () => {
      off();
      unsub();
      stop();
      window.removeEventListener("gf:ask-storage-access", onAsk);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  const onAllow = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const res = await requestStorageAccess();
    if (res.granted) {
      setOpen(false);
      setBusy(false);
      return;
    }
    if (!res.ok) {
      setNotice(res.message ?? t("storage.access.fallbackError"));
    } else if (res.openedSettings) {
      setNotice(t("files.storageAccess.settingsHint"));
    }
    setBusy(false);
  };

  const onLater = () => {
    deferStorageAccess();
    setOpen(false);
    setNotice(null);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onLater}
      fullScreen={false}
      footer={
        <>
          <PrimaryButton variant="ghost" onClick={onLater} disabled={busy}>
            {t("files.storageAccess.later")}
          </PrimaryButton>
          <PrimaryButton variant="primary" onClick={onAllow} disabled={busy}>
            {busy ? t("files.storageAccess.opening") : t("files.storageAccess.allow")}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4 pr-8">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-softer text-primary">
            <FolderOpen className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 space-y-1.5">
            <p className="text-[17px] font-semibold leading-snug text-foreground">
              {t("files.storageAccess.title")}
            </p>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              {reason ?? t("storage.access.defaultReason")}
            </p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {t("files.storageAccess.privacy")}
            </p>
          </div>
        </div>
        {notice ? (
          <p className="rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted-foreground">
            {notice}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
