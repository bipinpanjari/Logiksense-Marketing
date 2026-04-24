"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CampaignSummary,
  DashboardKpis,
  getDashboardKpis,
  getSendsByDay,
  getTopCampaigns,
  SendsByDay,
} from "@/lib/analytics";

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [byDay, setByDay] = useState<SendsByDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [k, c, d] = await Promise.all([
        getDashboardKpis(),
        getTopCampaigns(20),
        getSendsByDay(days),
      ]);
      setKpis(k);
      setCampaigns(c);
      setByDay(d);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [days]);

  const totals = byDay.reduce(
    (acc, d) => ({
      sent: acc.sent + d.sent,
      opened: acc.opened + d.opened,
      clicked: acc.clicked + d.clicked,
      bounced: acc.bounced + d.bounced,
    }),
    { sent: 0, opened: 0, clicked: 0, bounced: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Real email send + engagement data for this workspace.
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Sent" value={loading ? "…" : totals.sent.toLocaleString()} description={`Open rate ${kpis?.openRate ?? 0}%`} />
        <KpiCard label="Opens" value={loading ? "…" : totals.opened.toLocaleString()} description={`Click rate ${kpis?.clickRate ?? 0}%`} />
        <KpiCard label="Clicks" value={loading ? "…" : totals.clicked.toLocaleString()} description={`Reply rate ${kpis?.replyRate ?? 0}%`} />
        <KpiCard label="Bounces" value={loading ? "…" : totals.bounced.toLocaleString()} description={`Bounce rate ${kpis?.bounceRate ?? 0}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily sends</CardTitle>
          <CardDescription>Sent vs opened over the last {days} days</CardDescription>
        </CardHeader>
        <CardContent>
          {byDay.length === 0 ? (
            <div className="text-sm text-muted-foreground">No sends in this window yet.</div>
          ) : (
            <DailyChart data={byDay} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign performance</CardTitle>
          <CardDescription>All campaigns, most sent first</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-sm text-muted-foreground">No campaigns yet.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Campaign</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Sent</th>
                    <th className="py-2 pr-4">Opened</th>
                    <th className="py-2 pr-4">Clicked</th>
                    <th className="py-2 pr-4">Replied</th>
                    <th className="py-2 pr-4">Bounced</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="py-2 pr-4">
                        <Link href={`/email/campaigns/${c.id}`} className="font-medium hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-4"><Badge variant={c.status === "running" ? "success" : "outline"}>{c.status}</Badge></td>
                      <td className="py-2 pr-4">{c.sent}</td>
                      <td className="py-2 pr-4">{c.opened}</td>
                      <td className="py-2 pr-4">{c.clicked}</td>
                      <td className="py-2 pr-4">{c.replied}</td>
                      <td className="py-2 pr-4">{c.bounced}</td>
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

function KpiCard({ label, value, description }: { label: string; value: string; description?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function DailyChart({ data }: { data: SendsByDay[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.sent, d.opened, d.clicked)));
  return (
    <div className="flex h-56 items-end gap-1">
      {data.map((d) => {
        const sentPct = Math.max(2, Math.round((d.sent / max) * 100));
        const openedPct = Math.max(0, Math.round((d.opened / max) * 100));
        const label = new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${label}: ${d.sent} sent · ${d.opened} opened · ${d.clicked} clicked · ${d.bounced} bounced`}>
            <div className="flex w-full flex-col justify-end rounded bg-muted" style={{ height: "100%" }}>
              <div className="w-full rounded-t bg-emerald-400" style={{ height: `${openedPct}%`, opacity: 0.6 }} />
              <div className="w-full bg-primary" style={{ height: `${Math.max(0, sentPct - openedPct)}%` }} />
            </div>
            <div className="truncate text-[10px] text-muted-foreground">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
