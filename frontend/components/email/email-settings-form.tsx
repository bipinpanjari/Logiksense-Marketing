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

export function EmailSettingsForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [message, setMessage] = useState<string>("");
  const [testTo, setTestTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

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
      } catch {
        // keep empty defaults
      }
    })();
  }, []);

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
    </div>
  );
}

