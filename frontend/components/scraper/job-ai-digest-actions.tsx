"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock,
  Inbox,
  Layers,
  Loader2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstantTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { backfillScraperJobAiDigest, type ScraperJobRow } from "@/lib/scraper";

export function jobNeedsAiDigest(job: ScraperJobRow): boolean {
  if (job.status !== "completed") return false;
  const t = job.digest_items_total ?? 0;
  const a = job.digest_items_ai ?? 0;
  return t > 0 && a < t;
}

/** Every row already has a brief — offer regenerate (new prompt/model/data). */
export function jobCanRerunAiDigest(job: ScraperJobRow): boolean {
  if (job.status !== "completed") return false;
  const t = job.digest_items_total ?? 0;
  const a = job.digest_items_ai ?? 0;
  return t > 0 && a >= t;
}

/** Table column: icon + native tooltip only (no labels). */
function digestAiColumnState(job: ScraperJobRow): {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
} {
  if (job.status === "running" || job.status === "queued") {
    return {
      icon: Clock,
      iconClassName: "text-muted-foreground",
      title: "Awaiting completion — AI digest runs after the job finishes",
    };
  }
  if (job.status === "failed" || job.status === "skipped") {
    return {
      icon: Ban,
      iconClassName: "text-muted-foreground",
      title: "Not available — no extraction to summarize",
    };
  }
  if (job.status !== "completed") {
    return {
      icon: Ban,
      iconClassName: "text-muted-foreground",
      title: "Unknown status",
    };
  }
  const t = job.digest_items_total ?? 0;
  const a = job.digest_items_ai ?? 0;
  if (t === 0) {
    return {
      icon: Inbox,
      iconClassName: "text-muted-foreground",
      title: "No businesses — this job returned zero rows",
    };
  }
  if (a >= t) {
    return {
      icon: CheckCircle2,
      iconClassName: "text-emerald-600 dark:text-emerald-400",
      title: `AI research brief complete — ${a} of ${t} businesses`,
    };
  }
  if (a > 0) {
    return {
      icon: Layers,
      iconClassName: "text-amber-600 dark:text-amber-400",
      title: `Partially briefed — ${a} of ${t} businesses have a rep-style brief`,
    };
  }
  return {
    icon: CircleDashed,
    iconClassName: "text-muted-foreground",
    title: `Ready for AI research brief — ${t} businesses (Maps, contacts, crawl)`,
  };
}

function StatusChip({
  icon: Icon,
  iconClassName,
  label,
  sub,
  tone,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  sub?: string;
  tone: "neutral" | "success" | "warning" | "muted" | "pending";
}) {
  const tones = {
    neutral: "border-border/70 bg-card text-foreground shadow-sm",
    success: "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
    warning: "border-amber-500/30 bg-amber-500/[0.08] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-50",
    muted: "border-border/60 bg-muted/25 text-muted-foreground",
    pending: "border-primary/20 bg-primary/[0.06] text-foreground",
  } as const;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-2",
        tones[tone],
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 opacity-90", iconClassName)} strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[11px] font-semibold tracking-tight">{label}</p>
        {sub ? <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p> : null}
      </div>
    </div>
  );
}

export function JobAiDigestBadge({ job }: { job: ScraperJobRow }) {
  if (job.status === "running" || job.status === "queued") {
    return (
      <StatusChip
        icon={Clock}
        label="Awaiting completion"
        sub="AI summary runs after the job finishes"
        tone="pending"
      />
    );
  }
  if (job.status === "failed" || job.status === "skipped") {
    return (
      <StatusChip
        icon={Ban}
        label="Not available"
        sub="No extraction to summarize"
        tone="muted"
      />
    );
  }
  if (job.status !== "completed") {
    return (
      <StatusChip icon={Ban} label="—" sub="Unknown status" tone="muted" />
    );
  }

  const t = job.digest_items_total ?? 0;
  const a = job.digest_items_ai ?? 0;
  if (t === 0) {
    return (
      <StatusChip
        icon={Inbox}
        label="No businesses"
        sub="This job returned zero rows"
        tone="muted"
      />
    );
  }
  if (a >= t) {
    return (
      <StatusChip
        icon={CheckCircle2}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        label="Research brief complete"
        sub={`${a} of ${t} · rep-style research briefs complete`}
        tone="success"
      />
    );
  }
  if (a > 0) {
    return (
      <StatusChip
        icon={Layers}
        iconClassName="text-amber-600 dark:text-amber-400"
        label="Partially briefed"
        sub={`${a} of ${t} businesses · finish the rest below`}
        tone="warning"
      />
    );
  }
  return (
    <StatusChip
      icon={CircleDashed}
      iconClassName="text-muted-foreground"
      label="Ready for research brief"
      sub={`${t} businesses · Maps + crawl + contacts`}
      tone="neutral"
    />
  );
}

const runButtonClass =
  "h-9 shrink-0 gap-2 border-primary/30 bg-gradient-to-b from-primary/[0.07] to-transparent font-medium shadow-sm transition-colors hover:border-primary/45 hover:bg-primary/[0.1]";

const BUSY_MIN_MS = 520;

export function JobAiDigestActions({
  job,
  onDone,
  onError,
  compact,
}: {
  job: ScraperJobRow;
  onDone: () => void | Promise<void>;
  onError: (msg: string) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [queuedNote, setQueuedNote] = useState(false);

  async function submit(options: { force: boolean }) {
    setBusy(true);
    const started = Date.now();
    try {
      const out = await backfillScraperJobAiDigest(job.id, { force: options.force });
      if (out.queued) {
        setQueuedNote(true);
        window.setTimeout(() => setQueuedNote(false), 14_000);
      }
      await Promise.resolve(onDone());
      const elapsed = Date.now() - started;
      if (elapsed < BUSY_MIN_MS) {
        await new Promise((r) => setTimeout(r, BUSY_MIN_MS - elapsed));
      }
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "AI personalization failed");
    } finally {
      setBusy(false);
    }
  }

  const showRun = jobNeedsAiDigest(job);
  const showRerun = jobCanRerunAiDigest(job);
  const showAiButton = showRun || showRerun;
  /** All briefs already exist → same button, server overwrites every row. */
  const forceRegenerate = showRerun && !showRun;
  const aiButtonTip = busy
    ? "Queuing on server…"
    : forceRegenerate
      ? "Run AI again for every business (overwrites current briefs). Same as a fresh run — safe to switch pages."
      : "Run AI for businesses missing a brief. Continues in the background — safe to switch pages.";

  if (compact) {
    const { icon: StatusIcon, iconClassName, title: statusTitle } = digestAiColumnState(job);
    return (
      <div className="inline-flex items-center gap-1">
        <InstantTooltip label={statusTitle} side="bottom">
          <span
            className="inline-flex h-8 w-8 cursor-default items-center justify-center rounded-md border border-border/60 bg-muted/20"
            aria-label={statusTitle}
          >
            <StatusIcon className={cn("h-4 w-4 shrink-0", iconClassName)} strokeWidth={1.75} aria-hidden />
          </span>
        </InstantTooltip>
        {showAiButton ? (
          <InstantTooltip label={aiButtonTip} side="bottom">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              className="h-8 w-8 shrink-0 border-primary/30 bg-gradient-to-b from-primary/[0.07] to-transparent p-0 shadow-sm"
              onClick={() => void submit({ force: forceRegenerate })}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
              ) : (
                <Wand2 className="h-4 w-4 text-primary" aria-hidden />
              )}
              <span className="sr-only">{busy ? "Starting" : "Run AI"}</span>
            </Button>
          </InstantTooltip>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 max-w-lg">
        <JobAiDigestBadge job={job} />
      </div>
      {showAiButton ? (
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-start">
          <div className="flex flex-wrap items-center gap-2">
            <InstantTooltip label={aiButtonTip} side="top" className="shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                className={cn(runButtonClass, "transition-colors hover:border-primary/45 hover:bg-primary/[0.1]")}
                onClick={() => void submit({ force: forceRegenerate })}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
                ) : (
                  <Wand2 className="h-3.5 w-3.5 text-primary" aria-hidden />
                )}
                {busy ? "Starting…" : "Run AI"}
              </Button>
            </InstantTooltip>
          </div>
          {queuedNote ? (
            <p className="max-w-[280px] text-[11px] leading-snug text-muted-foreground">
              Queued on the server — safe to leave this page. Lists refresh on a short interval.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
