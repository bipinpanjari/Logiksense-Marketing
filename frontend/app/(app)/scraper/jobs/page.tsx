"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listScraperJobs, ScraperJobRow } from "@/lib/scraper";
import { JobAiDigestActions } from "@/components/scraper/job-ai-digest-actions";
import { useAiDigestFlight } from "@/hooks/use-ai-digest-flight";
import { Callout } from "@/components/ui/callout";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/layout/page-shell";

function statusVariant(status: ScraperJobRow["status"]) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "running":
    case "queued":
      return "secondary" as const;
    case "failed":
    case "skipped":
      return "outline" as const;
    default:
      return "default" as const;
  }
}

export default function ScraperJobsPage() {
  const [jobs, setJobs] = useState<ScraperJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { markFlight, isInFlight, anyInFlight } = useAiDigestFlight(jobs);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await listScraperJobs(100);
      setJobs(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load scraper jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const ms = anyInFlight ? 3_000 : 10_000;
    const id = setInterval(() => void load(), ms);
    return () => clearInterval(id);
  }, [anyInFlight, load]);

  return (
    <PageShell>
      <PageHeader
        title="Scraper jobs"
        description="Every scrape execution and its outcome."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
            <Link href="/scraper">
              <Button variant="outline">Profiles</Button>
            </Link>
          </div>
        }
      />

      {error ? <Callout variant="destructive">{error}</Callout> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table min-w-[1100px]">
                <thead>
                  <tr>
                    <th className="pr-4">Query</th>
                    <th className="pr-4">Location</th>
                    <th className="pr-4">Status</th>
                    <th className="pr-4">AI digest</th>
                    <th className="pr-4">Leads</th>
                    <th className="pr-4">w/ email</th>
                    <th className="pr-4">Created</th>
                    <th className="pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="pr-4">{job.query}</td>
                      <td className="pr-4">{[job.city, job.country].filter(Boolean).join(", ") || "-"}</td>
                      <td className="pr-4">
                        <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                      </td>
                      <td className="pr-4 align-middle">
                        <JobAiDigestActions
                          job={job}
                          digestInFlight={isInFlight(job.id, job)}
                          onDigestFlightStarted={markFlight}
                          onDone={async () => {
                            setError("");
                            await load();
                          }}
                          onError={setError}
                          compact
                        />
                      </td>
                      <td className="pr-4">{job.leads_found}</td>
                      <td className="pr-4">{job.leads_with_email}</td>
                      <td className="pr-4">{new Date(job.created_at).toLocaleString()}</td>
                      <td className="pr-4">
                        <Link href={`/scraper/jobs/${job.id}`}>
                          <Button size="sm" variant="outline">Open</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
