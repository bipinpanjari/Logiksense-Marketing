"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, BarChart3, MailCheck, MailWarning, MousePointerClick, Send, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CampaignSummary,
  DashboardKpis,
  getDashboardKpis,
  getSendsByDay,
  getTopCampaigns,
  SendsByDay,
} from "@/lib/analytics";

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [byDay, setByDay] = useState<SendsByDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [k, c, d] = await Promise.all([
          getDashboardKpis(),
          getTopCampaigns(5),
          getSendsByDay(14),
        ]);
        setKpis(k);
        setCampaigns(c);
        setByDay(d);
      } catch (e: any) {
        setError(e?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live workspace performance - wired to real data.</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total leads"
          value={loading ? "…" : (kpis?.totalLeads ?? 0).toLocaleString()}
          description={loading ? "" : `${kpis?.leadsAddedLast7d ?? 0} new this week`}
          icon={Users}
        />
        <KpiCard
          label="Emails sent (7d)"
          value={loading ? "…" : (kpis?.sentLast7d ?? 0).toLocaleString()}
          description={loading ? "" : `Bounce rate ${kpis?.bounceRate ?? 0}%`}
          icon={Send}
        />
        <KpiCard
          label="Open rate"
          value={loading ? "…" : `${kpis?.openRate ?? 0}%`}
          description={loading ? "" : `Click rate ${kpis?.clickRate ?? 0}%`}
          icon={MailCheck}
        />
        <KpiCard
          label="Reply rate"
          value={loading ? "…" : `${kpis?.replyRate ?? 0}%`}
          description={loading ? "" : `${kpis?.activeCampaigns ?? 0} campaigns · ${kpis?.activeSequences ?? 0} sequences`}
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" /> Last 14 days
            </CardTitle>
            <CardDescription>Daily sends, opens and clicks</CardDescription>
          </CardHeader>
          <CardContent>
            {byDay.length === 0 ? (
              <div className="text-sm text-muted-foreground">No sends in this window yet.</div>
            ) : (
              <SimpleBars data={byDay} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Top campaigns
            </CardTitle>
            <CardDescription>Most sent in this workspace</CardDescription>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <div className="text-sm text-muted-foreground">No campaigns sent yet.</div>
            ) : (
              <div className="space-y-3">
                {campaigns.map((c) => (
                  <Link
                    href={`/email/campaigns/${c.id}`}
                    key={c.id}
                    className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.sent} sent · {c.opened} opened · {c.clicked} clicked · {c.replied} replied
                      </div>
                    </div>
                    <Badge variant={c.status === "running" ? "success" : "outline"}>{c.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, description, icon: Icon }: { label: string; value: string; description?: string; icon: any }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between pt-0">
        <p className="text-xs text-muted-foreground">{description}</p>
        <Icon className="h-4 w-4 text-primary" />
      </CardContent>
    </Card>
  );
}

function SimpleBars({ data }: { data: SendsByDay[] }) {
  const max = Math.max(1, ...data.map((d) => d.sent));
  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((d) => {
        const pct = Math.max(4, Math.round((d.sent / max) * 100));
        const label = new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.sent} sent · ${d.opened} opened · ${d.clicked} clicked`}>
            <div className="flex w-full flex-col justify-end overflow-hidden rounded bg-muted" style={{ height: "100%" }}>
              <div className="w-full bg-primary/70" style={{ height: `${pct}%` }} />
            </div>
            <div className="truncate text-[10px] text-muted-foreground">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
