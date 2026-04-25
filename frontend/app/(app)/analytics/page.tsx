"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/layout/page-shell";
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
    <PageShell>
      <PageHeader
        title="Analytics"
        description="Real email send and engagement data for this workspace."
        action={
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>
                {d}d
              </Button>
            ))}
          </div>
        }
      />

      {error ? <Callout variant="destructive">{error}</Callout> : null}

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
            <div className="table-wrap">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th className="pr-4">Campaign</th>
                    <th className="pr-4">Status</th>
                    <th className="pr-4">Sent</th>
                    <th className="pr-4">Opened</th>
                    <th className="pr-4">Clicked</th>
                    <th className="pr-4">Replied</th>
                    <th className="pr-4">Bounced</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td className="pr-4">
                        <Link href={`/email/campaigns/${c.id}`} className="font-medium underline-offset-4 hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="pr-4">
                        <Badge variant={c.status === "running" ? "success" : "outline"}>{c.status}</Badge>
                      </td>
                      <td className="pr-4">{c.sent}</td>
                      <td className="pr-4">{c.opened}</td>
                      <td className="pr-4">{c.clicked}</td>
                      <td className="pr-4">{c.replied}</td>
                      <td className="pr-4">{c.bounced}</td>
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
              <div className="w-full rounded-t bg-chart-2/75" style={{ height: `${openedPct}%` }} />
              <div className="w-full bg-primary" style={{ height: `${Math.max(0, sentPct - openedPct)}%` }} />
            </div>
            <div className="truncate text-[10px] text-muted-foreground">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
