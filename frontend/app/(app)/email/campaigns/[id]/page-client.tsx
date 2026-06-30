"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getCampaignDetail,
  launchCampaignAction,
  pauseCampaignAction,
} from "@/lib/marketing-email";
import { Callout } from "@/components/ui/callout";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/layout/page-shell";

interface CampaignDetail {
  campaign: {
    id: string;
    name: string;
    status: string;
    template_id: string | null;
    template_name: string | null;
    segment_id: string | null;
    segment_name: string | null;
    audience_count: number;
    sent_count: number;
    opened_count: number;
    clicked_count: number;
    bounced_count: number;
    unsubscribed_count: number;
    launched_at: string | null;
    scheduled_at: string | null;
    error: string | null;
  };
  logs: Array<{
    id: string;
    lead_id: string;
    status: string;
    subject: string | null;
    sent_at: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    bounced_at: string | null;
    bounce_reason: string | null;
  }>;
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();
  const [data, setData] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getCampaignDetail(id);
      if (res?.error) throw new Error(res.error);
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load campaign");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function onLaunch() {
    setWorking(true);
    try {
      await launchCampaignAction(id);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to launch campaign");
    } finally {
      setWorking(false);
    }
  }

  async function onPause() {
    setWorking(true);
    try {
      await pauseCampaignAction(id);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to pause campaign");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Loading campaign…</p>
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell>
        <Callout variant="destructive">{error}</Callout>
      </PageShell>
    );
  }
  if (!data) {
    return (
      <PageShell>
        <Callout variant="warning">Campaign not found.</Callout>
      </PageShell>
    );
  }

  const c = data.campaign;
  const openRate = c.sent_count > 0 ? ((c.opened_count / c.sent_count) * 100).toFixed(1) : "0.0";
  const clickRate = c.sent_count > 0 ? ((c.clicked_count / c.sent_count) * 100).toFixed(1) : "0.0";
  const bounceRate = c.sent_count > 0 ? ((c.bounced_count / c.sent_count) * 100).toFixed(1) : "0.0";

  return (
    <PageShell>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <Link href="/email/campaigns" className="underline-offset-4 hover:underline">
              Campaigns
            </Link>
            <span>/</span>
            <span className="truncate">{c.name}</span>
          </span>
        }
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={c.status === "running" ? "success" : "secondary"}>{c.status}</Badge>
            {c.template_name ? <span>Template: {c.template_name}</span> : null}
            {c.segment_name ? <span>Segment: {c.segment_name}</span> : null}
          </span>
        }
        action={
          <div className="flex gap-2">
            {c.status === "running" ? (
              <Button variant="outline" onClick={onPause} disabled={working}>
                {working ? "…" : "Pause"}
              </Button>
            ) : (
              <Button onClick={onLaunch} disabled={working || !c.template_id}>
                {working ? "…" : "Launch"}
              </Button>
            )}
          </div>
        }
      />

      {c.error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">Last error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-xs">{c.error}</pre>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Audience" value={c.audience_count} />
        <StatCard label="Sent" value={c.sent_count} />
        <StatCard label="Open rate" value={`${openRate}%`} hint={`${c.opened_count} opens`} />
        <StatCard label="Click rate" value={`${clickRate}%`} hint={`${c.clicked_count} clicks`} />
        <StatCard label="Bounce rate" value={`${bounceRate}%`} hint={`${c.bounced_count} bounces`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent sends</CardTitle>
          <CardDescription>Last 200 sends for this campaign.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="table-wrap">
            <table className="data-table min-w-[840px]">
              <thead>
                <tr>
                  <th className="pr-4">Status</th>
                  <th className="pr-4">Subject</th>
                  <th className="pr-4">Sent</th>
                  <th className="pr-4">Opened</th>
                  <th className="pr-4">Clicked</th>
                  <th className="pr-4">Bounced</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((row) => (
                  <tr key={row.id}>
                    <td className="pr-4">
                      <Badge variant={row.status === "sent" ? "success" : row.status === "bounced" ? "outline" : "secondary"}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="pr-4">{row.subject ?? "-"}</td>
                    <td className="pr-4">{fmt(row.sent_at)}</td>
                    <td className="pr-4">{fmt(row.opened_at)}</td>
                    <td className="pr-4">{fmt(row.clicked_at)}</td>
                    <td className="pr-4">{row.bounced_at ? `${fmt(row.bounced_at)} (${row.bounce_reason ?? ""})` : "-"}</td>
                  </tr>
                ))}
                {data.logs.length === 0 ? (
                  <tr>
                    <td className="py-8 text-center text-sm text-muted-foreground" colSpan={6}>
                      No sends yet. Launch the campaign to start delivery.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function fmt(value: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wide">{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-semibold">{value}</div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}
