"use client";

import { useEffect, useMemo, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface FormState {
  sendingEmail: string;
  smtpFromName: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  hourlySendLimit: number;
}

const initialState: FormState = {
  sendingEmail: "",
  smtpFromName: "",
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpPassword: "",
  hourlySendLimit: 25,
};

const SMTP_PRESETS: { label: string; smtpHost: string; smtpPort: string; smtpUserHint?: string }[] = [
  { label: "Gmail", smtpHost: "smtp.gmail.com", smtpPort: "587", smtpUserHint: "Use an App Password, not your login password" },
  { label: "Google Workspace", smtpHost: "smtp.gmail.com", smtpPort: "587" },
  { label: "SendGrid", smtpHost: "smtp.sendgrid.net", smtpPort: "587", smtpUserHint: "User is literally apikey" },
  { label: "Mailgun", smtpHost: "smtp.mailgun.org", smtpPort: "587" },
  { label: "Mailtrap", smtpHost: "sandbox.smtp.mailtrap.io", smtpPort: "587" },
  { label: "Postmark", smtpHost: "smtp.postmarkapp.com", smtpPort: "587" },
  { label: "SES (SMTP)", smtpHost: "email-smtp.us-east-1.amazonaws.com", smtpPort: "587" },
  { label: "Microsoft 365", smtpHost: "smtp.office365.com", smtpPort: "587" },
  { label: "Outlook", smtpHost: "smtp-mail.outlook.com", smtpPort: "587" },
];

interface DnsTile {
  status: "idle" | "checking" | "ok" | "fail";
  detail?: string;
  recordName?: string;
  policy?: string | null;
}

export function EmailSettingsForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [message, setMessage] = useState<string>("");
  const [testTo, setTestTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [dkimTile, setDkimTile] = useState<DnsTile>({ status: "idle" });
  const [spfTile, setSpfTile] = useState<DnsTile>({ status: "idle" });
  const [dmarcTile, setDmarcTile] = useState<DnsTile>({ status: "idle" });

  const domain = useMemo(() => form.sendingEmail.split("@")[1] || "", [form.sendingEmail]);

  useEffect(() => {
    (async () => {
      try {
        const res = await authedFetch("/email/config");
        const data = await res.json();
        if (!data) return;
        setForm((prev) => ({
          ...prev,
          sendingEmail: data.sendingEmail || "",
          smtpFromName: data.smtpFromName || "",
          smtpHost: data.smtpHost || "",
          smtpPort: String(data.smtpPort || 587),
          smtpUser: data.smtpUser || "",
          hourlySendLimit: data.hourlySendLimit || 25,
        }));
        setHasPassword(Boolean(data.hasPassword));
        if (typeof data.dkimValid === "boolean") {
          setDkimTile({ status: data.dkimValid ? "ok" : "fail", detail: data.dkimValid ? "DKIM valid" : "DKIM record missing or invalid" });
        }
        if (typeof data.spfValid === "boolean") {
          setSpfTile({ status: data.spfValid ? "ok" : "fail", detail: data.spfValid ? "SPF valid" : "SPF record missing or invalid" });
        }
        if (typeof data.dmarcValid === "boolean") {
          setDmarcTile({
            status: data.dmarcValid ? "ok" : "fail",
            detail: data.dmarcValid ? "DMARC valid" : "DMARC record missing or invalid",
            policy: data.dmarcPolicy ?? null,
          });
        }
      } catch {
        // keep empty defaults
      }
    })();
  }, []);

  async function runCheck(kind: "dkim" | "spf" | "dmarc") {
    if (!domain) {
      setMessage("Set a sender email first to infer your domain.");
      return;
    }
    const setTile = kind === "dkim" ? setDkimTile : kind === "spf" ? setSpfTile : setDmarcTile;
    setTile({ status: "checking" });
    try {
      const path =
        kind === "dkim" ? "/email/validate-dkim" : kind === "spf" ? "/email/validate-spf" : "/email/validate-dmarc";
      const res = await authedFetch(path, { method: "POST", body: JSON.stringify({ domain }) });
      const data = await res.json();
      setTile({
        status: data?.ok ? "ok" : "fail",
        detail: data?.ok ? `${kind.toUpperCase()} looks good` : `${kind.toUpperCase()} not found or invalid`,
        recordName: data?.recordName,
        policy: data?.policy ?? null,
      });
    } catch (e: any) {
      setTile({ status: "fail", detail: e?.message || "Check failed" });
    }
  }

  async function saveConfig() {
    setLoading(true);
    setMessage("");
    try {
      const payload: Record<string, unknown> = {
        sendingEmail: form.sendingEmail,
        domain,
        smtpHost: form.smtpHost,
        smtpPort: Number(form.smtpPort || 587),
        smtpUser: form.smtpUser || undefined,
        smtpFromName: form.smtpFromName || undefined,
        hourlySendLimit: form.hourlySendLimit,
      };
      if (form.smtpPassword.trim()) payload.smtpPassword = form.smtpPassword;

      await authedFetch("/email/config", { method: "PUT", body: JSON.stringify(payload) });
      setHasPassword(hasPassword || Boolean(form.smtpPassword.trim()));
      setForm((prev) => ({ ...prev, smtpPassword: "" }));
      setMessage("Configuration saved");
    } catch (err: any) {
      setMessage(err?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    setLoading(true);
    setMessage("");
    try {
      await authedFetch("/email/test-connection", { method: "POST" });
      setMessage("SMTP connection verified");
    } catch (err: any) {
      setMessage(err?.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    if (!testTo) return;
    setLoading(true);
    setMessage("");
    try {
      await authedFetch("/email/send-test", {
        method: "POST",
        body: JSON.stringify({ to: testTo }),
      });
      setMessage(`Test email sent to ${testTo}`);
    } catch (err: any) {
      setMessage(err?.message || "Failed to send test");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>SMTP Configuration</CardTitle>
          <CardDescription>Connect Gmail, Mailgun SMTP, Mailtrap, SendGrid, SES SMTP, Office365, or any standard SMTP server.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Sender Email</label>
            <Input value={form.sendingEmail} onChange={(e) => setForm((s) => ({ ...s, sendingEmail: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Sender Name</label>
            <Input value={form.smtpFromName} onChange={(e) => setForm((s) => ({ ...s, smtpFromName: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Quick fill (provider)</span>
            <div className="flex flex-wrap gap-2">
              {SMTP_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    setForm((s) => ({
                      ...s,
                      smtpHost: p.smtpHost,
                      smtpPort: p.smtpPort,
                    }))
                  }
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {form.smtpHost ? (
              <p className="text-xs text-muted-foreground">
                {SMTP_PRESETS.find((p) => p.smtpHost === form.smtpHost && p.smtpPort === form.smtpPort)?.smtpUserHint ||
                  "Port 465 uses implicit TLS; 587 uses STARTTLS (set in saved config)."}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">SMTP Host</label>
            <Input value={form.smtpHost} onChange={(e) => setForm((s) => ({ ...s, smtpHost: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">SMTP Port</label>
              <Input value={form.smtpPort} onChange={(e) => setForm((s) => ({ ...s, smtpPort: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">SMTP Username</label>
              <Input value={form.smtpUser} onChange={(e) => setForm((s) => ({ ...s, smtpUser: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">SMTP Password</label>
            <Input
              type="password"
              placeholder={hasPassword ? "Password saved. Enter to overwrite." : ""}
              value={form.smtpPassword}
              onChange={(e) => setForm((s) => ({ ...s, smtpPassword: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Send test email to</label>
            <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={saveConfig} disabled={loading}>
              Save Configuration
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={loading}>
              Test Connection
            </Button>
            <Button variant="secondary" onClick={sendTest} disabled={loading || !testTo}>
              Send Test Email
            </Button>
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deliverability DNS</CardTitle>
          <CardDescription>
            Check DKIM, SPF, and DMARC records for {domain || "your sending domain"}. Recipients without these will
            route your mail to spam.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <DnsTileView
            title="DKIM"
            description="Signs outbound mail with your domain."
            tile={dkimTile}
            onCheck={() => runCheck("dkim")}
            disabled={loading || !domain}
          />
          <DnsTileView
            title="SPF"
            description="Authorizes your SMTP provider to send on your behalf."
            tile={spfTile}
            onCheck={() => runCheck("spf")}
            disabled={loading || !domain}
          />
          <DnsTileView
            title="DMARC"
            description="Tells mailbox providers what to do when DKIM/SPF fail."
            tile={dmarcTile}
            onCheck={() => runCheck("dmarc")}
            disabled={loading || !domain}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function DnsTileView({
  title,
  description,
  tile,
  onCheck,
  disabled,
}: {
  title: string;
  description: string;
  tile: DnsTile;
  onCheck: () => void;
  disabled?: boolean;
}) {
  const badge =
    tile.status === "ok"
      ? "bg-positive-bg text-positive-fg"
      : tile.status === "fail"
      ? "bg-destructive/12 text-destructive"
      : tile.status === "checking"
      ? "bg-caution-bg text-caution-fg"
      : "bg-muted text-muted-foreground";
  const label =
    tile.status === "ok" ? "Passing" : tile.status === "fail" ? "Missing" : tile.status === "checking" ? "Checking..." : "Unknown";
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>{label}</span>
      </div>
      {tile.detail ? <p className="mt-3 text-xs text-muted-foreground">{tile.detail}</p> : null}
      {tile.recordName ? <p className="mt-1 text-xs font-mono text-muted-foreground">{tile.recordName}</p> : null}
      {tile.policy ? <p className="mt-1 text-xs text-muted-foreground">Policy: {tile.policy}</p> : null}
      <Button onClick={onCheck} disabled={disabled} className="mt-3 h-8 text-xs" variant="outline">
        Re-check
      </Button>
    </div>
  );
}

