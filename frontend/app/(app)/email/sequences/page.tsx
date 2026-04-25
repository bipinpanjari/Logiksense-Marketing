"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Callout } from "@/components/ui/callout";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { listSequences } from "@/lib/marketing-email";

export default function SequencesPage() {
  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await listSequences();
        setSequences(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load sequences");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PageShell>
      <PageHeader
        title="Email sequences"
        description="Automated multi-step outbound flows with status control."
        action={
          <Link href="/email/new" className={cn(buttonVariants({ variant: "default" }))}>
            New sequence
          </Link>
        }
      />

      {error ? <Callout variant="destructive">{error}</Callout> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All sequences</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p className="mb-3 text-sm text-muted-foreground">Loading sequences...</p> : null}
          <div className="table-wrap">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th className="pr-4">Sequence</th>
                  <th className="pr-4">Status</th>
                  <th className="pr-4">Steps</th>
                  <th className="pr-4">Active leads</th>
                </tr>
              </thead>
              <tbody>
                {sequences.map((seq) => (
                  <tr key={seq.id}>
                    <td className="pr-4 font-medium">
                      <Link href={`/email/sequences/${seq.id}`} className="underline-offset-4 hover:underline">
                        {seq.name}
                      </Link>
                    </td>
                    <td className="pr-4">
                      <Badge variant={seq.status === "active" ? "success" : "secondary"}>{seq.status}</Badge>
                    </td>
                    <td className="pr-4">
                      {Array.isArray(seq.steps)
                        ? seq.steps.length
                        : typeof seq.steps === "string"
                        ? (() => {
                            try { return JSON.parse(seq.steps).length ?? 0; } catch { return 0; }
                          })()
                        : 0}
                    </td>
                    <td className="pr-4">{seq.active_leads ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

