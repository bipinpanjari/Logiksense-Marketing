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

function formatCents(cents: string | null): string {
  if (cents == null) return "—";
  const n = Number(cents);
  if (!isFinite(n)) return "—";
  return `$${(n / 100).toFixed(4)}`;
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI & Enrichment Usage</h1>
          <p className="text-sm text-muted-foreground">
            Every OpenAI, ZeroBounce and Apollo call the workspace makes is metered here, separating platform
            spend from BYOK credits.
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              variant={days === d ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

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
        <CardHeader><CardTitle>By provider / model / operation</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : summary.length === 0 ? (
            <div className="text-sm text-muted-foreground">No AI usage in this window.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Provider</th>
                    <th className="py-2 pr-4">Model</th>
                    <th className="py-2 pr-4">Operation</th>
                    <th className="py-2 pr-4">Mode</th>
                    <th className="py-2 pr-4">Calls</th>
                    <th className="py-2 pr-4">Tokens</th>
                    <th className="py-2 pr-4">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="py-2 pr-4">{row.provider}</td>
                      <td className="py-2 pr-4">{row.model}</td>
                      <td className="py-2 pr-4">{row.operation}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={row.byok ? "secondary" : "outline"}>
                          {row.byok ? "BYOK" : "Platform"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">{row.calls}</td>
                      <td className="py-2 pr-4">{row.total_tokens ?? 0}</td>
                      <td className="py-2 pr-4">{formatCents(row.cost_cents)}</td>
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
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">Provider</th>
                    <th className="py-2 pr-4">Model</th>
                    <th className="py-2 pr-4">Operation</th>
                    <th className="py-2 pr-4">Tokens</th>
                    <th className="py-2 pr-4">Cost</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">{row.provider}</td>
                      <td className="py-2 pr-4">{row.model}</td>
                      <td className="py-2 pr-4">{row.operation}</td>
                      <td className="py-2 pr-4">{row.total_tokens ?? 0}</td>
                      <td className="py-2 pr-4">{formatCents(row.cost_cents)}</td>
                      <td className="py-2 pr-4">
                        {row.status === "ok" ? (
                          <Badge variant="success">ok</Badge>
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
    </div>
  );
}
