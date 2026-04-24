"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import {
  LinkedInAccount,
  LinkedInCampaignRow,
  LinkedInStatus,
  createLinkedInCampaign,
  deleteLinkedInCampaign,
  getLinkedInStatus,
  listLinkedInAccounts,
  listLinkedInCampaigns,
  pauseLinkedInCampaign,
  startLinkedInCampaign,
} from "@/lib/linkedin";

function statusVariant(status: LinkedInCampaignRow["status"]) {
  switch (status) {
    case "running":
      return "success" as const;
    case "paused":
    case "draft":
      return "secondary" as const;
    case "completed":
      return "default" as const;
    default:
      return "outline" as const;
  }
}

export default function LinkedInCampaignsPage() {
  const [status, setStatus] = useState<LinkedInStatus | null>(null);
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [campaigns, setCampaigns] = useState<LinkedInCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    linkedinAccountId: "",
    jobTitleFilter: "",
    industryFilter: "",
    location: "",
    maxPerDay: 20,
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [s, a, c] = await Promise.all([
        getLinkedInStatus(),
        listLinkedInAccounts(),
        listLinkedInCampaigns(),
      ]);
      setStatus(s);
      setAccounts(a);
      setCampaigns(c);
    } catch (e: any) {
      setError(e?.message || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const tosRequired = !status?.enabled || !status?.tosAcceptedAt;
  const globalKill = !!status?.globalKillSwitch;

  async function onCreate() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await createLinkedInCampaign({
        name: form.name.trim(),
        linkedinAccountId: form.linkedinAccountId || null,
        jobTitleFilter: form.jobTitleFilter || null,
        industryFilter: form.industryFilter || null,
        location: form.location || null,
        maxPerDay: Number(form.maxPerDay) || 20,
      });
      setMessage("Campaign created in draft. Configure messages then launch.");
      setOpen(false);
      setForm({ name: "", linkedinAccountId: "", jobTitleFilter: "", industryFilter: "", location: "", maxPerDay: 20 });
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to create campaign");
    } finally {
      setBusy(false);
    }
  }

  async function onStart(id: string) {
    setBusy(true);
    try {
      await startLinkedInCampaign(id);
      setMessage("Campaign started. First run enqueued.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to start");
    } finally {
      setBusy(false);
    }
  }
  async function onPause(id: string) {
    setBusy(true);
    try {
      await pauseLinkedInCampaign(id, "manual");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to pause");
    } finally {
      setBusy(false);
    }
  }
  async function onDelete(id: string) {
    if (!confirm("Delete this campaign?")) return;
    setBusy(true);
    try {
      await deleteLinkedInCampaign(id);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">LinkedIn campaigns</h1>
          <p className="text-sm text-muted-foreground">Connection requests + DM sequences with per-account rate limits and auto-pause.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/linkedin/accounts">
            <Button variant="outline">Accounts</Button>
          </Link>
          <Button onClick={() => setOpen(true)} disabled={tosRequired || globalKill}>New campaign</Button>
        </div>
      </div>

      {tosRequired || globalKill ? (
        <Card className={globalKill ? "border-destructive/60" : "border-amber-500/60"}>
          <CardHeader><CardTitle className="text-base">Cannot run campaigns</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {globalKill
              ? "LinkedIn automation is disabled globally by the operator kill-switch."
              : "Accept the LinkedIn automation ToS in the Accounts page before running campaigns."}
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <Card>
        <CardHeader><CardTitle className="text-base">Campaigns</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Account</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Prospects</th>
                    <th className="px-3 py-2 text-left font-medium">Sent</th>
                    <th className="px-3 py-2 text-left font-medium">Replies</th>
                    <th className="px-3 py-2 text-left font-medium">Last run</th>
                    <th className="px-3 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b">
                      <td className="px-3 py-2">
                        <Link className="font-medium underline-offset-4 hover:underline" href={`/linkedin/${c.id}`}>
                          {c.name}
                        </Link>
                        {c.paused_reason ? <p className="text-xs text-muted-foreground">{c.paused_reason}</p> : null}
                      </td>
                      <td className="px-3 py-2">{c.account_email || "-"}</td>
                      <td className="px-3 py-2"><Badge variant={statusVariant(c.status)}>{c.status}</Badge></td>
                      <td className="px-3 py-2">{String(c.sequence_count)}</td>
                      <td className="px-3 py-2">{String(c.sent_count)}</td>
                      <td className="px-3 py-2">{String(c.reply_count)}</td>
                      <td className="px-3 py-2">{c.last_run_at ? new Date(c.last_run_at).toLocaleString() : "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {c.status === "running" ? (
                            <Button size="sm" variant="outline" onClick={() => onPause(c.id)} disabled={busy}>Pause</Button>
                          ) : (
                            <Button size="sm" onClick={() => onStart(c.id)} disabled={busy || tosRequired || globalKill}>Start</Button>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => onDelete(c.id)} disabled={busy}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="New LinkedIn campaign"
        description="Create a draft. You can edit messages and launch from the detail page."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Campaign name" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
          <select
            className="h-10 rounded-md border bg-background px-2 text-sm"
            value={form.linkedinAccountId}
            onChange={(e) => setForm((s) => ({ ...s, linkedinAccountId: e.target.value }))}
          >
            <option value="">Select LinkedIn account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.email}</option>
            ))}
          </select>
          <Input placeholder="Job titles (comma separated)" value={form.jobTitleFilter} onChange={(e) => setForm((s) => ({ ...s, jobTitleFilter: e.target.value }))} />
          <Input placeholder="Industries (comma separated)" value={form.industryFilter} onChange={(e) => setForm((s) => ({ ...s, industryFilter: e.target.value }))} />
          <Input placeholder="Location" value={form.location} onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))} />
          <Input type="number" placeholder="Max per day" value={form.maxPerDay} onChange={(e) => setForm((s) => ({ ...s, maxPerDay: Number(e.target.value) }))} />
          <div className="md:col-span-2 mt-2 flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || !form.name} onClick={onCreate}>{busy ? "Creating..." : "Create draft"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
