"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Sequences</h1>
          <p className="text-sm text-muted-foreground">Automated multi-step outbound flows with status control.</p>
        </div>
        <Link href="/email/new" className={cn(buttonVariants({ variant: "default" }))}>
          Build New Sequence
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sequence List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p className="mb-3 text-sm text-muted-foreground">Loading sequences...</p> : null}
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          <div className="overflow-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Sequence</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Steps</th>
                  <th className="px-3 py-2 text-left font-medium">Active Leads</th>
                </tr>
              </thead>
              <tbody>
                {sequences.map((seq) => (
                  <tr key={seq.id} className="border-b">
                    <td className="px-3 py-2 font-medium">{seq.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant={seq.status === "active" ? "success" : "secondary"}>{seq.status}</Badge>
                    </td>
                    <td className="px-3 py-2">{Array.isArray(seq.steps) ? seq.steps.length : 0}</td>
                    <td className="px-3 py-2">{seq.active_leads ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

