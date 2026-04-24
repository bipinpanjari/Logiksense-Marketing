"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  LinkedInCampaignRow,
  LinkedInMessageRow,
  LinkedInSequenceRow,
  getLinkedInCampaign,
  pauseLinkedInCampaign,
  startLinkedInCampaign,
  updateLinkedInCampaign,
} from "@/lib/linkedin";

interface MessageStep {
  step?: number;
  dayOffset?: number;
  tag?: string;
  message: string;
}

export default function LinkedInCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [data, setData] = useState<{
    campaign: LinkedInCampaignRow & { messages?: any };
    sequences: LinkedInSequenceRow[];
    messages: LinkedInMessageRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<MessageStep[]>([]);
  const [maxPerDay, setMaxPerDay] = useState(20);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const d = await getLinkedInCampaign(id);
      setData(d);
      const raw = typeof d.campaign.messages === "string" ? JSON.parse(d.campaign.messages) : d.campaign.messages;
      setSteps(Array.isArray(raw) ? raw : []);
      setMaxPerDay(d.campaign.max_per_day || 20);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function addStep() {
    setSteps((prev) => [...prev, { dayOffset: prev.length === 0 ? 1 : 3, message: "" }]);
  }
  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateStep(idx: number, patch: Partial<MessageStep>) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  async function saveMessages() {
    setBusy(true);
    try {
      await updateLinkedInCampaign(id, { messages: steps, maxPerDay });
      setMessage("Messages saved.");
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function onStart() {
    setBusy(true);
    try {
      await startLinkedInCampaign(id);
      setMessage("Campaign run enqueued.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to start");
    } finally {
      setBusy(false);
    }
  }
  async function onPause() {
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

  if (loading && !data) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error && !data) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return null;
  const { campaign, sequences, messages } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">{campaign.account_email || "no account"} · {campaign.location || "any location"}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/linkedin"><Button variant="outline">Back</Button></Link>
          {campaign.status === "running" ? (
            <Button variant="outline" onClick={onPause} disabled={busy}>Pause</Button>
          ) : (
            <Button onClick={onStart} disabled={busy}>Start</Button>
          )}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Status" value={<Badge>{campaign.status}</Badge>} />
        <Stat title="Prospects" value={String(campaign.sequence_count)} />
        <Stat title="Sent" value={String(campaign.sent_count)} />
        <Stat title="Replies" value={String(campaign.reply_count)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">DM sequence</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Variables: {"{first_name}"}, {"{job_title}"}, {"{company}"}, {"{industry}"}, {"{recent_post}"}
          </p>
          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground">Max sends per day</span>
            <Input type="number" className="w-32" value={maxPerDay} onChange={(e) => setMaxPerDay(Number(e.target.value))} />
          </label>
          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">Step {i + 1}</span>
                  <label className="block text-xs text-muted-foreground">
                    Day offset
                    <Input
                      type="number"
                      className="ml-2 inline-block w-24"
                      value={s.dayOffset ?? 1}
                      onChange={(e) => updateStep(i, { dayOffset: Number(e.target.value) })}
                    />
                  </label>
                  <Button size="sm" variant="destructive" className="ml-auto" onClick={() => removeStep(i)}>
                    Remove
                  </Button>
                </div>
                <textarea
                  className="w-full min-h-[100px] rounded-md border bg-background p-2 text-sm"
                  placeholder="Message body"
                  value={s.message}
                  onChange={(e) => updateStep(i, { message: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={addStep}>Add step</Button>
            <Button onClick={saveMessages} disabled={busy}>Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Prospects ({sequences.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Company</th>
                  <th className="px-3 py-2 text-left font-medium">Step</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Next send</th>
                </tr>
              </thead>
              <tbody>
                {sequences.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="px-3 py-2">{[s.first_name, s.last_name].filter(Boolean).join(" ") || "-"}</td>
                    <td className="px-3 py-2">{s.company || "-"}</td>
                    <td className="px-3 py-2">{s.sequence_step}</td>
                    <td className="px-3 py-2">
                      <Badge variant={s.status === "replied" ? "success" : s.status === "failed" ? "outline" : "secondary"}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{s.next_send_at ? new Date(s.next_send_at).toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent messages</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-auto text-sm">
            {messages.length === 0 ? (
              <p className="text-muted-foreground">No messages yet.</p>
            ) : (
              <ul className="space-y-2">
                {messages.map((m) => (
                  <li key={m.id} className="rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={m.status === "sent" ? "success" : "outline"}>{m.status}</Badge>
                      <span className="text-xs text-muted-foreground">Step {m.step_number}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(m.sent_at || m.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
                    {m.error ? <p className="mt-1 text-xs text-destructive">{m.error}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
