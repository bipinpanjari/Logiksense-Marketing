"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getInboundWebhookToken,
  listInboundReplies,
  rotateInboundWebhookToken,
} from "@/lib/pipeline";
import { apiUrl } from "@/lib/api-client";

interface InboundRow {
  id: string;
  from_email: string;
  to_email: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: string;
  matched: boolean;
  classification: string | null;
  lead_id: string | null;
  campaign_id: string | null;
  lead_first_name: string | null;
  lead_last_name: string | null;
  lead_email: string | null;
}

function classificationVariant(c: string | null) {
  switch (c) {
    case "positive":
      return "success" as const;
    case "negative":
    case "unsubscribe":
      return "outline" as const;
    case "auto_reply":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export default function InboxPage() {
  const [rows, setRows] = useState<InboundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<InboundRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [replies, t] = await Promise.all([listInboundReplies(200), getInboundWebhookToken()]);
      setRows(replies);
      setToken(t.token);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function onRotate() {
    if (!confirm("Rotate the inbound webhook token? Your email provider will need to be updated with the new URL.")) return;
    setBusy(true);
    try {
      const t = await rotateInboundWebhookToken();
      setToken(t.token);
      setMessage("New webhook token issued.");
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  const webhookUrl = token ? apiUrl(`/inbound/${token}`) : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Inbound replies matched against your sent emails. Replies automatically move the lead to
          &quot;Replied&quot; and pause any active sequence enrollment.
        </p>
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">{message}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inbound webhook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Point your email provider's inbound parse webhook here. Works with Mailgun, Postmark, SES and
            Cloudflare Email Routing.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} />
            <Button variant="outline" disabled={busy} onClick={onRotate}>
              Rotate
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Replies</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No inbound replies yet.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">From</th>
                    <th className="py-2 pr-4">Subject</th>
                    <th className="py-2 pr-4">Class</th>
                    <th className="py-2 pr-4">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-t hover:bg-muted"
                      onClick={() => setSelected(r)}
                    >
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {new Date(r.received_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 max-w-[220px] truncate">{r.from_email}</td>
                      <td className="py-2 pr-4 max-w-[320px] truncate">{r.subject ?? "(no subject)"}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={classificationVariant(r.classification)}>
                          {r.classification ?? "neutral"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        {r.matched ? <Badge variant="success">matched</Badge> : <Badge variant="outline">unmatched</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setSelected(null)}>
          <div className="h-full w-full max-w-xl overflow-y-auto border-l bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold break-all">{selected.subject ?? "(no subject)"}</div>
                <div className="text-sm text-muted-foreground">From: {selected.from_email}</div>
                {selected.to_email && <div className="text-sm text-muted-foreground">To: {selected.to_email}</div>}
                <div className="text-xs text-muted-foreground mt-1">
                  Received {new Date(selected.received_at).toLocaleString()}
                </div>
              </div>
              <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </div>
            <div className="mt-4 whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
              {selected.snippet ?? "(no body captured)"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
