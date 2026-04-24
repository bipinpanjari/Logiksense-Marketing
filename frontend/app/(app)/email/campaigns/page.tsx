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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Campaigns</h1>
          <p className="text-sm text-muted-foreground">Manage campaigns with deliverability and performance controls.</p>
        </div>
        <div className="flex w-full max-w-2xl gap-2">
          <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          <Input placeholder="New campaign name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button onClick={onCreateCampaign} disabled={saving || !newName.trim()}>
            {saving ? "Creating..." : "Create"}
          </Button>
          <Link href="/email/calendar" className={cn(buttonVariants({ variant: "outline" }))}>
            Open Calendar
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Search</CardTitle>
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
          <CardTitle className="text-base">Campaign List</CardTitle>
          <CardDescription>Operational view for outbound execution and optimization.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="mb-3 text-sm text-muted-foreground">Loading campaigns...</p> : null}
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          <div className="overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Campaign</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Audience</th>
                  <th className="px-3 py-2 text-left font-medium">Scheduled</th>
                  <th className="px-3 py-2 text-left font-medium">Open Rate</th>
                  <th className="px-3 py-2 text-left font-medium">Click Rate</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b">
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/email/campaigns/${campaign.id}`} className="underline-offset-4 hover:underline">
                        {campaign.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={campaign.status === "active" || campaign.status === "running" ? "success" : "secondary"}>
                        {campaign.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{campaign.audience.toLocaleString()}</td>
                    <td className="px-3 py-2">{campaign.scheduledAt}</td>
                    <td className="px-3 py-2">{campaign.openRate ? `${campaign.openRate}%` : "-"}</td>
                    <td className="px-3 py-2">{campaign.clickRate ? `${campaign.clickRate}%` : "-"}</td>
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

