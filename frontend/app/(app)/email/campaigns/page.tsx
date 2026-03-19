"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const seedCampaigns = [
  { id: "c-1", name: "Q2 Outbound Launch", status: "active", audience: 1240, openRate: 41.2, clickRate: 8.3 },
  { id: "c-2", name: "SaaS Founder Sequence", status: "scheduled", audience: 640, openRate: 0, clickRate: 0 },
  { id: "c-3", name: "Warm Re-engagement", status: "paused", audience: 350, openRate: 36.1, clickRate: 6.8 },
];

export default function EmailCampaignsPage() {
  const [query, setQuery] = useState("");
  const campaigns = useMemo(
    () => seedCampaigns.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Campaigns</h1>
          <p className="text-sm text-muted-foreground">Manage campaigns with deliverability and performance controls.</p>
        </div>
        <Button>Create Campaign</Button>
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
          <div className="overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Campaign</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Audience</th>
                  <th className="px-3 py-2 text-left font-medium">Open Rate</th>
                  <th className="px-3 py-2 text-left font-medium">Click Rate</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b">
                    <td className="px-3 py-2 font-medium">{campaign.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant={campaign.status === "active" ? "success" : "secondary"}>{campaign.status}</Badge>
                    </td>
                    <td className="px-3 py-2">{campaign.audience.toLocaleString()}</td>
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

