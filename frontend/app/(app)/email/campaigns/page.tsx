"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createCampaign, listCampaigns } from "@/lib/marketing-email";
import { cn } from "@/lib/utils";
import { Callout } from "@/components/ui/callout";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/layout/page-shell";

export default function EmailCampaignsPage() {
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [campaignsRaw, setCampaignsRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadCampaigns() {
    setLoading(true);
    setError("");
    try {
      const data = await listCampaigns();
      setCampaignsRaw(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function onCreateCampaign() {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createCampaign({
        name: newName.trim(),
        status: scheduledDate ? "scheduled" : "draft",
        scheduledAt: scheduledDate ? new Date(`${scheduledDate}T09:00:00`).toISOString() : undefined,
      });
      setNewName("");
      setScheduledDate("");
      await loadCampaigns();
    } catch (e: any) {
      setError(e?.message || "Failed to create campaign");
    } finally {
      setSaving(false);
    }
  }

  const mappedCampaigns = campaignsRaw.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    scheduledAt: c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : "-",
    audience: Number(c.audience_count || 0),
    openRate: Number(c.open_rate || 0),
    clickRate: Number(c.click_rate || 0),
  }));

  const campaigns = useMemo(
    () => mappedCampaigns.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [query, mappedCampaigns]
  );

  return (
    <PageShell>
      <PageHeader
        title="Email campaigns"
        description="Manage campaigns with deliverability and performance controls."
        action={
          <Link href="/email/calendar" className={cn(buttonVariants({ variant: "outline" }))}>
            Calendar
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New campaign</CardTitle>
          <CardDescription>Optional first send date — leave empty to create a draft.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="w-full space-y-1.5 sm:w-auto sm:min-w-[11rem]">
            <span className="text-xs font-medium text-muted-foreground">Schedule</span>
            <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <Input placeholder="Campaign name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <Button className="w-full sm:w-auto" onClick={onCreateCampaign} disabled={saving || !newName.trim()}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </CardContent>
      </Card>

      {error ? <Callout variant="destructive">{error}</Callout> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search campaigns" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All campaigns</CardTitle>
          <CardDescription>Operational view for outbound execution and optimization.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="mb-3 text-sm text-muted-foreground">Loading campaigns...</p> : null}
          <div className="table-wrap">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th className="pr-4">Campaign</th>
                  <th className="pr-4">Status</th>
                  <th className="pr-4">Audience</th>
                  <th className="pr-4">Scheduled</th>
                  <th className="pr-4">Open rate</th>
                  <th className="pr-4">Click rate</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="pr-4 font-medium">
                      <Link href={`/email/campaigns/${campaign.id}`} className="underline-offset-4 hover:underline">
                        {campaign.name}
                      </Link>
                    </td>
                    <td className="pr-4">
                      <Badge variant={campaign.status === "active" || campaign.status === "running" ? "success" : "secondary"}>
                        {campaign.status}
                      </Badge>
                    </td>
                    <td className="pr-4">{campaign.audience.toLocaleString()}</td>
                    <td className="pr-4">{campaign.scheduledAt}</td>
                    <td className="pr-4">{campaign.openRate ? `${campaign.openRate}%` : "-"}</td>
                    <td className="pr-4">{campaign.clickRate ? `${campaign.clickRate}%` : "-"}</td>
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

