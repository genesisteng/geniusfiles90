/**
 * Banner shown on the dashboard when interrupted long-running operations
 * are found in the journal (crash / force-close / OS eviction).
 *
 * Users can resume or dismiss each job. The banner auto-hides when the
 * journal is empty.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, PlayCircle, X } from "lucide-react";
import { dismissJob, listResumableJobs, subscribeJobs, type JobRecord } from "@/lib/jobs/journal";
import { resumeJob } from "@/lib/jobs/resume";
import { formatCount } from "@/lib/copy";
import { useT } from "@/lib/i18n";

const KIND_KEY: Record<JobRecord["kind"], string> = {
  copy: "home.resume.kind.copy",
  move: "home.resume.kind.move",
  compress: "home.resume.kind.compress",
  extract: "home.resume.kind.extract",
  clean: "home.resume.kind.clean",
  delete: "home.resume.kind.delete",
};

export function ResumeBanner() {
  const t = useT();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setJobs(listResumableJobs());
    return subscribeJobs(() => setJobs(listResumableJobs()));
  }, []);

  if (jobs.length === 0) return null;

  const handleResume = async (job: JobRecord) => {
    setBusy(job.id);
    toast.info(t("home.resume.resuming", { kind: t(KIND_KEY[job.kind] as never).toLowerCase() }));
    try {
      await resumeJob(job);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      className="card-surface mb-3 flex flex-col gap-2 border-primary/30 bg-primary/5 p-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
        <AlertTriangle className="h-4 w-4 text-primary" />
        {t("home.resume.title")}
      </div>
      <ul className="space-y-2">
        {jobs.map((job) => {
          const pct =
            job.total > 0 ? Math.min(100, Math.round((job.completed / job.total) * 100)) : 0;
          return (
            <li key={job.id} className="rounded-xl bg-surface px-3 py-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium">
                    {t(KIND_KEY[job.kind] as never)} — {job.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t("home.resume.progress", {
                      pct,
                      done: formatCount(job.completed),
                      total:
                        job.total > 0
                          ? t("count.items", { count: job.total })
                          : t("home.resume.unknownTotal"),
                    })}
                  </p>
                  {job.total > 0 ? (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleResume(job)}
                  disabled={busy === job.id}
                  className="flex h-8 items-center gap-1 rounded-full bg-primary px-2.5 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  {busy === job.id ? "…" : t("home.resume.resume")}
                </button>
                <button
                  type="button"
                  aria-label={t("home.resume.dismiss")}
                  onClick={() => dismissJob(job.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
