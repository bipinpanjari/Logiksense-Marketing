"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import {
  LinkedInAccount,
  LinkedInStatus,
  acceptLinkedInTos,
  deleteLinkedInAccount,
  disableLinkedIn,
  getLinkedInStatus,
  listLinkedInAccounts,
  pairLinkedInAccount,
  pauseLinkedInAccount,
  resumeLinkedInAccount,
} from "@/lib/linkedin";

function statusVariant(status: LinkedInAccount["status"]) {
  switch (status) {
    case "active":
      return "success" as const;
    case "paused":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export default function LinkedInAccountsPage() {
  const [status, setStatus] = useState<LinkedInStatus | null>(null);
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    password: "",
    maxPerDay: 40,
    maxPerHour: 8,
    maxPerWeek: 200,
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [s, list] = await Promise.all([getLinkedInStatus(), listLinkedInAccounts()]);
      setStatus(s);
      setAccounts(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function onAcceptTos() {
    setBusy(true);
    try {
      await acceptLinkedInTos();
      setMessage("LinkedIn automation enabled for this workspace.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }
  async function onDisable() {
    if (!confirm("Disable LinkedIn automation? All running campaigns will pause.")) return;
    setBusy(true);
    try {
      await disableLinkedIn();
      setMessage("LinkedIn automation disabled.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPair() {
    if (!form.email || !form.password) return;
    setBusy(true);
    setError("");
    try {
      await pairLinkedInAccount({
        email: form.email,
        displayName: form.displayName || undefined,
        password: form.password,
        maxPerDay: Number(form.maxPerDay) || 40,
        maxPerHour: Number(form.maxPerHour) || 8,
        maxPerWeek: Number(form.maxPerWeek) || 200,
      });
      setMessage("Account paired. Your password is encrypted in the vault and never shown again.");
      setOpen(false);
      setForm({ email: "", displayName: "", password: "", maxPerDay: 40, maxPerHour: 8, maxPerWeek: 200 });
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to pair account");
    } finally {
      setBusy(false);
    }
  }

  async function onPause(id: string) {
    setBusy(true);
    try {
      await pauseLinkedInAccount(id, "manual");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }
  async function onResume(id: string) {
    setBusy(true);
    try {
      await resumeLinkedInAccount(id);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }
  async function onDelete(id: string) {
    if (!confirm("Remove this account? Stored credentials and session cookies are purged from the vault.")) return;
    setBusy(true);
    try {
      await deleteLinkedInAccount(id);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  const tosRequired = !status?.enabled || !status?.tosAcceptedAt;
  const globalKill = !!status?.globalKillSwitch;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">LinkedIn accounts</h1>
        <p className="text-sm text-muted-foreground">
          Pair LinkedIn accounts to run outreach campaigns. Passwords are encrypted with AES-256-GCM via the vault;
          sessions are rotated to cookies after first login.
        </p>
        <p className="text-sm text-muted-foreground">
          Forgot your LinkedIn password?{" "}
          <a
            className="underline underline-offset-4"
            href="https://www.linkedin.com/uas/request-password-reset"
            target="_blank"
            rel="noreferrer"
          >
            Reset it on LinkedIn
          </a>
          , then use <span className="font-medium text-foreground">Pair account</span> again with the same email and
          your new password. We never know or reset your LinkedIn password for you.
        </p>
      </div>

      {globalKill ? (
        <Card className="border-destructive/60">
          <CardHeader><CardTitle className="text-base">LinkedIn globally disabled</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Operator kill-switch LINKEDIN_KILL_SWITCH is ON. No new actions can run.</p>
          </CardContent>
        </Card>
      ) : null}

      <Card className={tosRequired ? "border-amber-500/60" : undefined}>
        <CardHeader className="pb-2"><CardTitle className="text-base">Terms of Service & Kill-switch</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {tosRequired ? (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium">Before running LinkedIn outreach, accept the automation ToS.</p>
              <p className="mt-2 text-muted-foreground">
                LinkedIn's User Agreement prohibits unauthorized scraping and automation. Operating accounts you do not
                own, or automating outreach at scale, may result in account restriction. You are responsible for the
                compliance posture of every paired account. Three-layer rate limits apply and can be paused instantly.
              </p>
              <div className="mt-3 flex gap-2">
                <Button disabled={busy} onClick={onAcceptTos}>I understand, enable LinkedIn automation</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
              <div>
                <p className="font-medium">LinkedIn automation enabled</p>
                <p className="text-xs text-muted-foreground">
                  Accepted {status?.tosAcceptedAt ? new Date(status.tosAcceptedAt).toLocaleString() : "-"}
                </p>
              </div>
              <Button variant="outline" disabled={busy} onClick={onDisable}>Disable LinkedIn automation</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="flex items-center gap-2">
        <Button onClick={() => setOpen(true)} disabled={tosRequired || globalKill}>Pair account</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Paired accounts</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts yet.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Today</th>
                    <th className="px-3 py-2 text-left font-medium">Hour</th>
                    <th className="px-3 py-2 text-left font-medium">Week</th>
                    <th className="px-3 py-2 text-left font-medium">Last login</th>
                    <th className="px-3 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-b align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium">{a.email}</p>
                        {a.last_error ? <p className="text-xs text-destructive">{a.last_error}</p> : null}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                      </td>
                      <td className="px-3 py-2">{a.actions_today}/{a.max_per_day}</td>
                      <td className="px-3 py-2">{a.actions_this_hour}/{a.max_per_hour}</td>
                      <td className="px-3 py-2">{a.actions_this_week}/{a.max_per_week}</td>
                      <td className="px-3 py-2">{a.last_login_at ? new Date(a.last_login_at).toLocaleString() : "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {a.status === "active" ? (
                            <Button size="sm" variant="outline" onClick={() => onPause(a.id)}>Pause</Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => onResume(a.id)}>Resume</Button>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => onDelete(a.id)}>Remove</Button>
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
        title="Pair LinkedIn account"
        description="Passwords are encrypted immediately. After first login, we rotate to session cookies and the password is not released again unless you re-pair."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="LinkedIn email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          <Input placeholder="Display name (optional)" value={form.displayName} onChange={(e) => setForm((s) => ({ ...s, displayName: e.target.value }))} />
          <div className="md:col-span-2 space-y-1">
            <Input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Not sure of your password? Recover it on{" "}
              <a
                className="underline underline-offset-4"
                href="https://www.linkedin.com/uas/request-password-reset"
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn
              </a>
              , then pair here with the new password (re-pairing updates the vault).
            </p>
          </div>
          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground">Max actions / day</span>
            <Input type="number" value={form.maxPerDay} onChange={(e) => setForm((s) => ({ ...s, maxPerDay: Number(e.target.value) }))} />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground">Max actions / hour</span>
            <Input type="number" value={form.maxPerHour} onChange={(e) => setForm((s) => ({ ...s, maxPerHour: Number(e.target.value) }))} />
          </label>
          <label className="block space-y-1 text-xs md:col-span-2">
            <span className="text-muted-foreground">Max actions / week</span>
            <Input type="number" value={form.maxPerWeek} onChange={(e) => setForm((s) => ({ ...s, maxPerWeek: Number(e.target.value) }))} />
          </label>
          <div className="md:col-span-2 mt-2 flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || !form.email || !form.password} onClick={onPair}>
              {busy ? "Pairing..." : "Pair account"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
