/**
 * WordEditor — édition directe des documents Word (.docx) dans GeniusFiles.
 *
 * Architecture
 * ------------
 * - le document n'est chargé qu'une fois (`openDocxDraft`) : le paquet zip
 *   reste en mémoire côté lib, aucune conversion répétée, aucune copie
 *   supplémentaire du contenu ;
 * - une ligne du champ d'édition = un paragraphe du document : la sauvegarde
 *   réécrit uniquement `word/document.xml` et préserve styles, polices,
 *   images et en-têtes ;
 * - la saisie utilise un vrai champ natif : sélection, copier / couper /
 *   coller et poignées sont ceux d'Android — une seule barre d'actions,
 *   celle du système ;
 * - annuler / rétablir sont gérés par un historique borné (pas de
 *   duplication d'état, pas de re-render du document) ;
 * - le brouillon est persisté (chemin du fichier comme clé) à chaque pause
 *   de frappe et à chaque mise en arrière-plan : verrouillage d'écran,
 *   changement d'application ou interruption ne perdent jamais le travail.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Redo2, Save, SquarePen, Undo2 } from "lucide-react";
import { ReaderHeader, HeaderButton } from "@/components/viewer/ReaderHeader";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { absolutePathOf } from "@/lib/viewer/source";
import { readBytes, writeBytes, resolveAvailablePath } from "@/lib/pdf/native-io";
import { openDocxDraft, type DocxDraft } from "@/lib/office/docx-edit";
import { registerBackHandler, BACK_PRIORITY } from "@/lib/navigation/back-stack";
import { useT } from "@/lib/i18n";

type Load =
  | { status: "loading" }
  | { status: "ready"; draft: DocxDraft }
  | { status: "error"; message: string };

const HISTORY_MAX = 80;
const DRAFT_PREFIX = "gf:word-draft:";

export function WordEditor({
  parent,
  entry,
  onClose,
}: {
  parent: PathRef;
  entry: FileEntry;
  onClose: () => void;
}) {
  const t = useT();
  const abs = useMemo(() => absolutePathOf(parent, entry), [parent, entry]);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [text, setText] = useState("");
  const [baseline, setBaseline] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [restored, setRestored] = useState(false);

  const history = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const [historyTick, setHistoryTick] = useState(0);
  const commitTimer = useRef<number>(0);
  const dirty = text !== baseline;

  const draftKey = `${DRAFT_PREFIX}${abs}`;

  // ---- Chargement (une seule fois par fichier) ----
  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    (async () => {
      try {
        const bytes = await readBytes(abs);
        const draft = await openDocxDraft(bytes);
        if (cancelled) return;
        const original = draft.paragraphs.join("\n");
        setLoad({ status: "ready", draft });
        setBaseline(original);
        let stored: string | null = null;
        try {
          stored = window.localStorage.getItem(draftKey);
        } catch {
          /* stockage indisponible */
        }
        if (stored != null && stored !== original) {
          setText(stored);
          setRestored(true);
        } else {
          setText(original);
        }
      } catch (e) {
        if (!cancelled)
          setLoad({
            status: "error",
            message: (e as Error)?.message ?? t("viewer.word.unreadable"),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [abs, draftKey, t]);

  // ---- Persistance du brouillon : pause de frappe + mise en arrière-plan ----
  const persist = useCallback(
    (value: string) => {
      try {
        if (value === baseline) window.localStorage.removeItem(draftKey);
        else window.localStorage.setItem(draftKey, value);
      } catch {
        /* quota / mode privé : la session reste intacte */
      }
    },
    [baseline, draftKey],
  );

  useEffect(() => {
    if (load.status !== "ready") return;
    const t = window.setTimeout(() => persist(text), 600);
    return () => window.clearTimeout(t);
  }, [text, load.status, persist]);

  useEffect(() => {
    const flush = () => persist(text);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [text, persist]);

  // ---- Historique (annuler / rétablir) ----
  const commit = useCallback((previous: string) => {
    const h = history.current;
    if (h.past[h.past.length - 1] === previous) return;
    h.past.push(previous);
    if (h.past.length > HISTORY_MAX) h.past.shift();
    h.future = [];
    setHistoryTick((v) => v + 1);
  }, []);

  const onChange = useCallback(
    (value: string) => {
      const previous = text;
      setText(value);
      if (commitTimer.current) window.clearTimeout(commitTimer.current);
      commitTimer.current = window.setTimeout(() => {
        commitTimer.current = 0;
        commit(previous);
      }, 400);
    },
    [text, commit],
  );

  const undo = useCallback(() => {
    const h = history.current;
    const prev = h.past.pop();
    if (prev == null) return;
    h.future.push(text);
    setText(prev);
    setHistoryTick((v) => v + 1);
  }, [text]);

  const redo = useCallback(() => {
    const h = history.current;
    const next = h.future.pop();
    if (next == null) return;
    h.past.push(text);
    setText(next);
    setHistoryTick((v) => v + 1);
  }, [text]);

  // ---- Enregistrement ----
  const write = useCallback(
    async (mode: "overwrite" | "copy") => {
      if (load.status !== "ready" || saving) return;
      setSaving(true);
      setMessage(null);
      try {
        const bytes = await load.draft.serialize(text.split("\n"));
        if (mode === "overwrite") {
          await writeBytes(abs, bytes, { overwrite: true });
          setMessage(t("viewer.word.saved"));
        } else {
          const slash = abs.lastIndexOf("/");
          const dir = slash >= 0 ? abs.slice(0, slash) : "";
          const name = entry.name.replace(/(\.docx)$/i, " (copie)$1");
          const target = await resolveAvailablePath(dir, name);
          await writeBytes(target, bytes, { overwrite: false, autoRename: true });
          setMessage(t("viewer.word.copySaved"));
        }
        setBaseline(text);
        setRestored(false);
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
        window.setTimeout(() => setMessage(null), 1800);
      } catch (e) {
        setMessage((e as Error)?.message ?? t("viewer.word.saveFailed"));
      } finally {
        setSaving(false);
      }
    },
    [load, saving, text, abs, entry.name, draftKey, t],
  );

  // ---- Sortie protégée (retour Android + bouton) ----
  const requestClose = useCallback(() => {
    if (dirty) {
      setConfirmExit(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  const closeRef = useRef(requestClose);
  useEffect(() => {
    closeRef.current = requestClose;
  }, [requestClose]);

  useEffect(
    () =>
      registerBackHandler(() => {
        closeRef.current();
        return true;
      }, BACK_PRIORITY.overlay + 10),
    [],
  );

  const canUndo = history.current.past.length > 0;
  const canRedo = history.current.future.length > 0;
  void historyTick; // re-render déclenché par les mutations d'historique

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-reader-surface animate-fade-in"
      role="dialog"
      aria-modal
    >
      <ReaderHeader
        title={entry.name}
        subtitle={`${t("viewer.word.title")}${dirty ? t("viewer.word.modified") : ""}`}
        onBack={requestClose}
        extra={
          <>
            <HeaderButton label={t("viewer.word.undo")} onClick={undo} disabled={!canUndo}>
              <Undo2 className="h-[20px] w-[20px]" />
            </HeaderButton>
            <HeaderButton label={t("viewer.word.redo")} onClick={redo} disabled={!canRedo}>
              <Redo2 className="h-[20px] w-[20px]" />
            </HeaderButton>
          </>
        }
      />

      <div className="flex shrink-0 select-none items-center gap-2 border-b border-border bg-reader-header px-3 py-1.5">
        <SquarePen className="h-4 w-4 shrink-0 text-reader-header-foreground/70" />
        <p className="min-w-0 flex-1 truncate text-[11.5px] text-reader-header-foreground/65">
          {restored
            ? t("viewer.word.draftRestored")
            : dirty
              ? t("viewer.word.unsavedChanges")
              : t("viewer.word.upToDate")}
        </p>
        <button
          type="button"
          onClick={() => void write("copy")}
          disabled={saving || load.status !== "ready"}
          className="flex h-8 shrink-0 items-center rounded-full bg-reader-header-foreground/10 px-3 text-[11.5px] font-medium text-reader-header-foreground disabled:opacity-40 active:scale-95"
        >
          {t("viewer.word.saveAs")}
        </button>
        <button
          type="button"
          onClick={() => setConfirmOverwrite(true)}
          disabled={saving || !dirty || load.status !== "ready"}
          className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-primary px-3 text-[11.5px] font-semibold text-primary-foreground disabled:opacity-40 active:scale-95"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "…" : t("viewer.word.save")}
        </button>
      </div>

      {message ? (
        <div className="shrink-0 bg-reader-header/95 px-3 py-1 text-center text-[11px] text-reader-header-foreground/85">
          {message}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto bg-reader-surface">
        {load.status === "loading" ? (
          <p className="p-6 text-center text-[13px] text-reader-muted">
            {t("viewer.word.opening")}
          </p>
        ) : load.status === "error" ? (
          <p className="p-6 text-center text-[13px] text-red-600">
            {t("viewer.word.error", { message: load.message })}
          </p>
        ) : (
          <textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            data-gf-selectable="true"
            aria-label={t("viewer.word.contentLabel")}
            className="h-full w-full resize-none bg-reader-surface px-5 py-4 text-[14px] leading-relaxed text-reader-ink outline-none"
          />
        )}
      </div>

      {confirmOverwrite ? (
        <Confirm
          title={t("viewer.word.replaceTitle")}
          body={t("viewer.word.replaceBody", { name: entry.name })}
          actions={[
            { label: t("action.cancel"), onSelect: () => setConfirmOverwrite(false) },
            {
              label: t("viewer.word.replace"),
              primary: true,
              onSelect: () => {
                setConfirmOverwrite(false);
                void write("overwrite");
              },
            },
          ]}
        />
      ) : null}

      {confirmExit ? (
        <Confirm
          title={t("viewer.word.exitTitle")}
          body={t("viewer.word.exitBody")}
          actions={[
            { label: t("action.cancel"), onSelect: () => setConfirmExit(false) },
            {
              label: t("viewer.word.exitDiscard"),
              onSelect: () => {
                try {
                  window.localStorage.removeItem(draftKey);
                } catch {
                  /* ignore */
                }
                setConfirmExit(false);
                onClose();
              },
            },
            {
              label: t("viewer.word.save"),
              primary: true,
              onSelect: async () => {
                setConfirmExit(false);
                await write("overwrite");
                onClose();
              },
            },
          ]}
        />
      ) : null}
    </div>
  );
}

function Confirm({
  title,
  body,
  actions,
}: {
  title: string;
  body: string;
  actions: { label: string; primary?: boolean; onSelect: () => void | Promise<void> }[];
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-6">
      <div className="w-full max-w-[340px] rounded-3xl bg-popover p-5 text-popover-foreground shadow-elevated">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-1.5 text-[12.5px] text-popover-foreground/70">{body}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => void a.onSelect()}
              className={`h-9 rounded-full px-4 text-[12.5px] font-medium active:scale-95 ${
                a.primary
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground/8 text-popover-foreground"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
