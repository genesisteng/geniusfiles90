/**
 * Pipeline de travail de Genius AI — une seule ligne, compacte et stable.
 *
 * Les étapes déjà terminées sont réduites à de petites pastilles ; seule
 * l'étape en cours est écrite en toutes lettres, avec le détail réel publié
 * par le moteur d'exécution. L'état vient d'un magasin persistant : la
 * ligne ne disparaît jamais tant que le travail n'est pas terminé, et
 * aucune étape ne revient en arrière.
 */
import { Check, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { TaskSnapshot } from "@/lib/ai/session";

export function PipelineTrace({ task }: { task: TaskSnapshot }) {
  const t = useT();
  if (task.phase === "idle" || task.steps.length === 0) return null;

  const activeIndex = task.steps.findIndex((s) => s.state === "active" || s.state === "failed");
  const current = activeIndex >= 0 ? task.steps[activeIndex] : task.steps[task.steps.length - 1];
  const done = task.steps.slice(0, activeIndex >= 0 ? activeIndex : task.steps.length);
  const remaining = activeIndex >= 0 ? task.steps.length - activeIndex - 1 : 0;

  return (
    <div
      className={`gf-chat-safe gf-pipeline-line ${task.phase === "closing" ? "gf-pipeline-out" : ""}`}
      aria-live="polite"
      aria-label={t("assistant.pipeline.ariaLabel", { label: current.label })}
    >
      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface/80 py-1.5 pl-2 pr-3.5">
        {done.map((s) => (
          <span
            key={s.id}
            title={s.label}
            className="gf-pipeline-pop flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-primary/85 text-primary-foreground"
          >
            <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
          </span>
        ))}

        <Marker state={current.state} />

        <span key={current.id} className="gf-pipeline-swap min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium leading-[16px] text-foreground">
            {current.detail ?? current.label}
          </span>
        </span>

        {remaining > 0 ? (
          <span aria-hidden className="flex shrink-0 items-center gap-1">
            {Array.from({ length: remaining }).map((_, i) => (
              <span key={i} className="h-[5px] w-[5px] rounded-full bg-muted-foreground/30" />
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Marker({ state }: { state: "pending" | "active" | "done" | "failed" }) {
  if (state === "failed") {
    return (
      <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
        <X className="h-2.5 w-2.5" strokeWidth={3.5} />
      </span>
    );
  }
  if (state === "done") {
    return (
      <span className="gf-pipeline-pop flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
      </span>
    );
  }
  return (
    <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-primary/15">
      <span className="gf-pipeline-spin h-[10px] w-[10px] rounded-full border-2 border-primary/30 border-t-primary" />
    </span>
  );
}
