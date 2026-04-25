"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AiUsageRecentRow,
  AiUsageSummaryRow,
  getAiUsageRecent,
  getAiUsageSummary,
} from "@/lib/ai";
import { Callout } from "@/components/ui/callout";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/layout/page-shell";

function formatCents(cents: string | null): string {
  if (cents == null) return "—";
  const n = Number(cents);
  if (!isFinite(n)) return "—";
  return `$${(n / 100).toFixed(4)}`;
}

function providerLabel(id: string): string {
  const m: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Claude",
    zerobounce: "ZeroBounce",
    apollo: "Apollo",
    platform: "Other",
  };
  return m[id] ?? id;
}

export default function AiUsagePage() {
  const [summary, setSummary] = useState<AiUsageSummaryRow[]>([]);
  const [recent, setRecent] = useState<AiUsageRecentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [s, r] = await Promise.all([getAiUsageSummary(days), getAiUsageRecent(100)]);
      setSummary(s);
      setRecent(r);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [days]);

  const totalCost = summary.reduce((acc, row) => acc + Number(row.cost_cents ?? 0), 0);
  const totalCalls = summary.reduce((acc, row) => acc + row.calls, 0);
  const totalTokens = summary.reduce((acc, row) => acc + (row.total_tokens ?? 0), 0);

  return (
    <PageShell narrow>
      <PageHeader
        title="AI & enrichment usage"
        description="AI generation, email verification, and enrichment usage for this workspace. Organization and workspace keys are labeled so you can see what ran where."
        action={
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <Button key={d} variant={days === d ? "default" : "outline"} size="sm" onClick={() => setDays(d)}>
                {d}d
              </Button>
            ))}
          </div>
        }
      />

      {error ? <Callout variant="destructive">{error}</Callout> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Total calls</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{totalCalls.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Total tokens</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{totalTokens.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Estimated spend</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">${(totalCost / 100).toFixed(4)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>By service, model, and action</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : summary.length === 0 ? (
            <div className="text-sm text-muted-foreground">No AI usage in this window.</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table min-w-[800px]">
                <thead>
                  <tr>
                    <th className="pr-4">Service</th>
                    <th className="pr-4">Model</th>
                    <th className="pr-4">Operation</th>
                    <th className="pr-4">Billing</th>
                    <th className="pr-4">Calls</th>
                    <th className="pr-4">Tokens</th>
                    <th className="pr-4">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row, idx) => (
                    <tr key={idx}>
                      <td className="pr-4">{providerLabel(row.provider)}</td>
                      <td className="pr-4">{row.model}</td>
                      <td className="pr-4">{row.operation}</td>
                      <td className="pr-4">
                        <Badge variant={row.byok ? "secondary" : "outline"}>
                          {row.byok ? "Your key" : "Organization"}
                        </Badge>
                      </td>
                      <td className="pr-4">{row.calls}</td>
                      <td className="pr-4">{row.total_tokens ?? 0}</td>
                      <td className="pr-4">{formatCents(row.cost_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent calls</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : recent.length === 0 ? (
            <div className="text-sm text-muted-foreground">No recent AI calls.</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table min-w-[900px]">
                <thead>
                  <tr>
                    <th className="pr-4">When</th>
                    <th className="pr-4">Service</th>
                    <th className="pr-4">Model</th>
                    <th className="pr-4">Operation</th>
                    <th className="pr-4">Tokens</th>
                    <th className="pr-4">Cost</th>
                    <th className="pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap pr-4">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="pr-4">{providerLabel(row.provider)}</td>
                      <td className="pr-4">{row.model}</td>
                      <td className="pr-4">{row.operation}</td>
                      <td className="pr-4">{row.total_tokens ?? 0}</td>
                      <td className="pr-4">{formatCents(row.cost_cents)}</td>
                      <td className="pr-4">
                        {row.status === "ok" ? (
                          <Badge variant="success">Ok</Badge>
                        ) : (
                          <Badge variant="outline">{row.status}</Badge>
                        )}
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
