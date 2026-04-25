"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Callout } from "@/components/ui/callout";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/layout/page-shell";
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
    <PageShell>
      <PageHeader
        title="Inbox"
        description={
          <>
            Inbound replies matched against your sent emails. Replies automatically move the lead to &quot;Replied&quot;
            and pause any active sequence enrollment.
          </>
        }
      />

      {error ? <Callout variant="destructive">{error}</Callout> : null}
      {message ? <Callout variant="success">{message}</Callout> : null}

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
            <div className="table-wrap">
              <table className="data-table min-w-[640px]">
                <thead>
                  <tr>
                    <th className="pr-4">When</th>
                    <th className="pr-4">From</th>
                    <th className="pr-4">Subject</th>
                    <th className="pr-4">Class</th>
                    <th className="pr-4">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(r)}
                    >
                      <td className="pr-4 whitespace-nowrap">
                        {new Date(r.received_at).toLocaleString()}
                      </td>
                      <td className="max-w-[220px] truncate pr-4">{r.from_email}</td>
                      <td className="max-w-[320px] truncate pr-4">{r.subject ?? "(no subject)"}</td>
                      <td className="pr-4">
                        <Badge variant={classificationVariant(r.classification)}>
                          {r.classification ?? "neutral"}
                        </Badge>
                      </td>
                      <td className="pr-4">
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
        <div className="fixed inset-0 z-40 flex justify-end bg-foreground/25 backdrop-blur-[2px]" onClick={() => setSelected(null)}>
          <div
            className="h-full w-full max-w-xl overflow-y-auto border-l border-border/80 bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-section-title break-all">{selected.subject ?? "(no subject)"}</div>
                <div className="text-sm text-muted-foreground">From: {selected.from_email}</div>
                {selected.to_email && <div className="text-sm text-muted-foreground">To: {selected.to_email}</div>}
                <div className="text-xs text-muted-foreground mt-1">
                  Received {new Date(selected.received_at).toLocaleString()}
                </div>
              </div>
              <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </div>
            <div className="mt-4 whitespace-pre-wrap rounded-xl border border-border/80 bg-muted/30 p-4 text-sm leading-relaxed">
              {selected.snippet ?? "(no body captured)"}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
