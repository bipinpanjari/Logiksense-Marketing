"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listScraperJobs, ScraperJobRow } from "@/lib/scraper";

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

  async function load() {
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
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scraper jobs</h1>
          <p className="text-sm text-muted-foreground">Every scrape execution and its outcome.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Link href="/scraper">
            <Button>Back to profiles</Button>
          </Link>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
            <div className="overflow-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">Query</th>
                    <th className="px-3 py-2 text-left font-medium">Location</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Leads</th>
                    <th className="px-3 py-2 text-left font-medium">w/ Email</th>
                    <th className="px-3 py-2 text-left font-medium">Created</th>
                    <th className="px-3 py-2 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b">
                      <td className="px-3 py-2">{job.query}</td>
                      <td className="px-3 py-2">{[job.city, job.country].filter(Boolean).join(", ") || "-"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                      </td>
                      <td className="px-3 py-2">{job.leads_found}</td>
                      <td className="px-3 py-2">{job.leads_with_email}</td>
                      <td className="px-3 py-2">{new Date(job.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">
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
    </div>
  );
}
