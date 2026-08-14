import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Portal } from "@/components/common/Portal";
import { useInPickLayer } from "@/components/files/pick-layer-context";
import { BACK_PRIORITY, registerBackHandler } from "@/lib/navigation/back-stack";
import { useT } from "@/lib/i18n";

// Shared stack of currently-open BottomSheet ids. Only the topmost entry
// consumes hardware-back / Escape events so nested sheets do not
// cascade-close their parents.
const overlayStack: string[] = [];

const BottomSheetDefaultsContext = createContext({ fullScreen: false });

export function BottomSheetDefaultsProvider({
  fullScreen,
  children,
}: {
  fullScreen: boolean;
  children: ReactNode;
}) {
  return (
    <BottomSheetDefaultsContext.Provider value={{ fullScreen }}>
      {children}
    </BottomSheetDefaultsContext.Provider>
  );
}

/**
 * Unified modal used across GeniusFiles.
 *
 * Centered compact dialog (Android-style) that:
 *  - preserves the underlying page context (subtle backdrop dim + blur);
 *  - opens/closes with a very short fade + zoom animation;
 *  - integrates with the hardware back button via le registre unifié de
 *    navigation (aucune entrée d'historique n'est empilée, donc la pile
 *    de navigation reste exacte) ;
 *  - closes on backdrop tap, Escape, or the always-visible close button;
 *  - scrolls the panel body independently of the page underneath.
 *
 * Every dialog / picker / confirmation / context menu in the app uses
 * this component, so tweaking it here is the single source of truth for
 * all "secondary window" behaviour.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  fullScreen,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  fullScreen?: boolean;
}) {
  const tr = useT();
  const ref = useRef<HTMLDivElement>(null);
  const stateId = useId();
  const defaults = useContext(BottomSheetDefaultsContext);
  const isFullScreen = fullScreen ?? defaults.fullScreen;

  // Keep the element mounted briefly while the exit animation plays.
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      // next tick so the enter animation actually plays.
      requestAnimationFrame(() => setVisible(true));
    } else if (mounted) {
      setVisible(false);
      const t = window.setTimeout(() => setMounted(false), 140);
      return () => window.clearTimeout(t);
    }
  }, [open, mounted]);

  // Escape + retour matériel + verrou de défilement.
  //
  // Le retour passe par le registre unifié : la feuille la plus récemment
  // ouverte absorbe le retour (LIFO), sans jamais empiler d'entrée
  // d'historique. Les anciennes entrées « fantômes » (poussées à
  // l'ouverture puis jamais dépilées lors d'une fermeture programmatique)
  // faussaient la pile et donnaient l'impression d'un retour vers
  // l'accueil : elles n'existent plus.
  //
  // `onClose` est souvent une fonction fléchée recréée à chaque rendu :
  // on garde une référence stable pour ne pas ré-enregistrer l'effet.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /* Une feuille ouverte pendant une session de sélection doit passer
     au-dessus de la couche de sélection (elle en fait partie). */
  const inPick = useInPickLayer();

  useEffect(() => {
    if (!open) return;

    const isTop = () => overlayStack[overlayStack.length - 1] === stateId;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTop()) {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    overlayStack.push(stateId);

    // Retour matériel / geste système : seule la feuille du dessus ferme.
    const unregister = registerBackHandler(() => {
      if (!isTop()) return false;
      onCloseRef.current();
      return true;
    }, BACK_PRIORITY.overlay);

    // Prevent background scroll while any overlay is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      unregister();
      document.body.style.overflow = prevOverflow;
      const idx = overlayStack.lastIndexOf(stateId);
      if (idx >= 0) overlayStack.splice(idx, 1);
    };
  }, [open, stateId]);

  if (!mounted) return null;

  const hasHeader = Boolean(title);

  return (
    <Portal>
      <div
        className={`fixed inset-0 ${inPick ? "z-[3800]" : "z-[3000]"} flex transition-opacity duration-150 ease-out ${
          visible ? "opacity-100" : "opacity-0"
        } ${isFullScreen ? "items-stretch justify-stretch" : "items-center justify-center px-4"}`}
        style={{
          paddingTop: isFullScreen ? 0 : "max(1.5rem, env(safe-area-inset-top, 0px))",
          paddingBottom: isFullScreen ? 0 : "max(1.5rem, env(safe-area-inset-bottom, 0px))",
        }}
        role="presentation"
      >
        <button
          aria-label={tr("action.close")}
          onClick={onClose}
          className="absolute inset-0 h-full w-full cursor-default bg-background/60 backdrop-blur-[6px]"
          tabIndex={-1}
        />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`relative z-10 flex w-full flex-col overflow-hidden bg-surface transition-all duration-150 ease-out ${
            visible ? "scale-100 opacity-100" : "scale-[0.97] opacity-0"
          } ${
            isFullScreen
              ? "h-full max-h-none max-w-none rounded-none border-0 bg-background shadow-none"
              : "max-h-full max-w-[440px] rounded-[28px] border border-border shadow-elevated"
          }`}
        >
          {hasHeader ? (
            <div
              className="flex items-center justify-between gap-3 px-6 pb-3 pt-5"
              style={
                isFullScreen
                  ? { paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }
                  : undefined
              }
            >
              <h3 className="min-w-0 truncate text-[18px] font-semibold text-foreground">
                {title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label={tr("action.close")}
                className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-150 active:scale-95 hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            // Floating close button when there is no title, so every dialog
            // consistently exposes a visible way out.
            <button
              type="button"
              onClick={onClose}
              aria-label={tr("action.close")}
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted-foreground transition-all duration-150 active:scale-95 hover:bg-surface-3 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            {children}
          </div>
          {footer ? (
            <div
              className="flex flex-wrap items-center justify-end gap-3 border-t border-border/60 bg-surface px-6 py-4"
              style={
                isFullScreen
                  ? { paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }
                  : undefined
              }
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
  variant = "primary",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
}) {
  const cls =
    variant === "primary"
      ? "bg-primary text-primary-foreground shadow-soft hover:brightness-105"
      : variant === "danger"
        ? "bg-destructive text-destructive-foreground shadow-soft hover:brightness-105"
        : "text-primary hover:bg-primary-softer";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center rounded-2xl px-5 text-[14px] font-semibold transition-all duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  autoFocus,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      // Clavier Android natif : suggestions + correction + majuscule auto.
      // Voir src/lib/keyboard-props.ts pour la logique complète.
      autoCorrect="on"
      autoCapitalize="sentences"
      spellCheck
      enterKeyHint={onSubmit ? "done" : undefined}
      inputMode="text"
      onKeyDown={(e) => {
        if (e.key === "Enter" && onSubmit) {
          e.preventDefault();
          onSubmit();
        }
      }}
      className="w-full rounded-2xl border border-transparent bg-input px-4 h-[52px] text-[15px] text-foreground outline-none transition-all duration-150 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/20 placeholder:text-muted-foreground-2"
    />
  );
}

/** Controlled name-input dialog used for "new folder" and "rename". */
export function NamePrompt({
  open,
  title,
  label,
  initial,
  cta,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  initial: string;
  cta: string;
  onCancel: () => void;
  onSubmit: (name: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const t = useT();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setValue(initial);
      setBusy(false);
    }
  }, [open, initial]);
  const submit = async () => {
    if (busy || !value.trim()) return;
    setBusy(true);
    await onSubmit(value.trim());
    setBusy(false);
  };
  return (
    <BottomSheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <PrimaryButton variant="ghost" onClick={onCancel}>
            {t("action.cancel")}
          </PrimaryButton>
          <PrimaryButton onClick={submit} disabled={busy || !value.trim()}>
            {cta}
          </PrimaryButton>
        </>
      }
    >
      <label className="mb-2 block text-[13px] font-medium text-muted-foreground">{label}</label>
      <TextField
        value={value}
        onChange={setValue}
        autoFocus
        onSubmit={submit}
        placeholder={t("files.nom")}
      />
    </BottomSheet>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmer",
  danger,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const t = useT();
  useEffect(() => {
    if (open) setBusy(false);
  }, [open]);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    await onConfirm();
    setBusy(false);
  };
  return (
    <BottomSheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <PrimaryButton variant="ghost" onClick={onCancel}>
            {t("action.cancel")}
          </PrimaryButton>
          <PrimaryButton variant={danger ? "danger" : "primary"} onClick={go} disabled={busy}>
            {confirmLabel}
          </PrimaryButton>
        </>
      }
    >
      <div className="text-[15px] leading-relaxed text-muted-foreground">{description}</div>
    </BottomSheet>
  );
}
