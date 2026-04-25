"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchItemDetailDialog } from "@/components/scraper/search-item-detail-dialog";
import { getScraperJob, ScraperJobRow, SearchItem } from "@/lib/scraper";
import { JobAiDigestActions } from "@/components/scraper/job-ai-digest-actions";

function asList(v: string[] | string | null | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ScraperJobDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [data, setData] = useState<{ job: ScraperJobRow; items: SearchItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(() => Date.now());
  const [detailItem, setDetailItem] = useState<SearchItem | null>(null);

  async function load() {
    if (!id) return;
    const first = !data;
    if (first) {
      setLoading(true);
    }
    setError("");
    try {
      setData(await getScraperJob(id));
    } catch (e: any) {
      setError(e?.message || "Failed to load job");
    } finally {
      if (first) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    setData(null);
    void load();
    const timer = setInterval(() => void load(), 5_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const jobRunning = data?.job && (data.job.status === "running" || data.job.status === "queued");
  useEffect(() => {
    if (!jobRunning) return;
    const t = setInterval(() => setTick(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [jobRunning]);

  if (loading && !data) return <p className="text-sm text-muted-foreground">Loading job...</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return null;

  const { job, items } = data;
  const running = job.status === "running" || job.status === "queued";
  const t0 = (job.started_at || job.created_at) && !Number.isNaN(new Date(job.started_at || job.created_at).getTime())
    ? new Date(job.started_at || job.created_at).getTime()
    : 0;
  const startedMs = t0 > 0 ? tick - t0 : 0;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Scraper job</h1>
            <p className="text-sm text-muted-foreground">{job.query}</p>
          </div>
          {job.status === "completed" ? (
            <div className="rounded-xl border border-border/80 bg-gradient-to-b from-muted/40 to-muted/10 px-4 py-3.5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
              <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:gap-6 lg:gap-8">
                <div className="min-w-0 flex-1">
                  <JobAiDigestActions
                    job={job}
                    onDone={async () => {
                      setError("");
                      await load();
                    }}
                    onError={setError}
                  />
                </div>
                {typeof job.digest_items_total === "number" && job.digest_items_total > 0 ? (
                  <p className="shrink-0 text-xs leading-snug text-muted-foreground sm:max-w-[220px] sm:text-right sm:leading-relaxed">
                    <span className="font-medium text-foreground">
                      {job.digest_items_ai ?? 0}/{job.digest_items_total}
                    </span>{" "}
                    businesses have an AI research summary (Maps, contacts, crawl).
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        <Link href="/scraper/jobs">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      {running ? (
        <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          {/* <p>
            Live browser: Google Maps discovery, then website passes to find emails. A full run can take{" "}
            <span className="font-medium">5–20+ minutes</span>. Progress below updates about every 5s.
            {running && t0 > 0 ? (
              <span className="ml-1 text-muted-foreground">
                (elapsed {Math.max(0, Math.floor(startedMs / 60_000))}m {Math.max(0, Math.floor((startedMs % 60_000) / 1000))}s)
              </span>
            ) : null}
          </p> */}
          {(job.progress_label != null && job.progress_label !== "") || job.progress_pct != null ? (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="line-clamp-2 font-medium text-foreground">{job.progress_label || "…"}</span>
                {typeof job.progress_pct === "number" ? <span>{job.progress_pct}%</span> : null}
              </div>
              {typeof job.progress_pct === "number" ? (
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-500/90 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, job.progress_pct))}%` }}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Warming up — step labels appear once the first map interaction starts.</p>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Status" value={<Badge>{job.status}</Badge>} />
        <Stat title="Leads found" value={String(job.leads_found)} />
        <Stat title="With email" value={String(job.leads_with_email)} />
        <Stat
          title="Duration"
          value={
            job.started_at && job.completed_at
              ? `${Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)}s`
              : "-"
          }
        />
      </div>

      {job.error ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{job.error}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extracted businesses</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each row combines Google Maps intel with a same-origin site crawl (sitemap seeds, internal links, schema.org, social links, and a large text digest). Click a row for the full dossier.
          </p>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">Business</th>
                    <th className="px-3 py-2 text-left font-medium">Category</th>
                    <th className="px-3 py-2 text-left font-medium">Website</th>
                    <th className="px-3 py-2 text-left font-medium">Emails</th>
                    <th className="px-3 py-2 text-left font-medium">Phone</th>
                    <th className="px-3 py-2 text-left font-medium">Lead</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const emails = asList(it.emails);
                    const phones = asList(it.phones);
                    return (
                      <tr
                        key={it.id}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer border-b align-top transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setDetailItem(it)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDetailItem(it);
                          }
                        }}
                      >
                        <td className="px-3 py-2">
                          <p className="font-medium">{it.business_name || "-"}</p>
                          <p className="text-xs text-muted-foreground">{[it.city, it.country].filter(Boolean).join(", ")}</p>
                        </td>
                        <td className="px-3 py-2">{it.category || "-"}</td>
                        <td className="px-3 py-2">
                          {it.website_url ? (
                            <a
                              className="underline-offset-4 hover:underline"
                              href={it.website_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Visit
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-2">{emails.length ? emails.join(", ") : "-"}</td>
                        <td className="px-3 py-2">{it.phone || phones[0] || "-"}</td>
                        <td className="px-3 py-2">
                          {it.lead_id ? (
                            <Badge variant="success">{it.lead_status || "created"}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <SearchItemDetailDialog item={detailItem} open={detailItem != null} onOpenChange={(o) => !o && setDetailItem(null)} />
    </div>
  );
}

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
