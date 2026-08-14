/**
 * Petit utilitaire pour demander une confirmation sans dupliquer l'état
 * dans chaque écran.
 *
 *   const confirm = useConfirm();
 *   ...
 *   {confirm.dialog}
 *   <button onClick={() => confirm.ask(confirmCopy.moveToTrash(n), doDelete)} />
 *
 * Isolé du fichier de composants pour préserver le rechargement à chaud.
 */
import { useCallback, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import type { ConfirmCopy } from "@/lib/copy";

export function useConfirm() {
  const [state, setState] = useState<{
    copy: ConfirmCopy;
    extra?: ReactNode;
    action: () => void | Promise<void>;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = useCallback(
    (copy: ConfirmCopy, action: () => void | Promise<void>, extra?: ReactNode) => {
      setState({ copy, action, extra });
    },
    [],
  );

  const close = useCallback(() => {
    setState(null);
    setBusy(false);
  }, []);

  const dialog = state ? (
    <ConfirmDialog
      open
      copy={state.copy}
      extra={state.extra}
      busy={busy}
      onCancel={close}
      onConfirm={async () => {
        setBusy(true);
        try {
          await state.action();
        } finally {
          close();
        }
      }}
    />
  ) : null;

  return { ask, close, dialog };
}
