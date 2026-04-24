"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GdprRequestRow,
  listGdprRequests,
  requestGdprExport,
  requestGdprPurge,
} from "@/lib/compliance";

export default function CompliancePage() {
  const [requests, setRequests] = useState<GdprRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [exportData, setExportData] = useState<any | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await listGdprRequests();
      setRequests(r);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function onExport() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await requestGdprExport();
      setExportData(res.snapshot);
      setMessage(`Export ready, request ${res.requestId.slice(0, 8)}.`);
      load();
    } catch (e: any) {
      setError(e?.message || "Export failed");
    } finally {
      setBusy(false);
    }
  }

  function onDownload() {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gdpr-export-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onPurge() {
    if (purgeConfirm !== "DELETE") {
      setError("Type DELETE in the confirmation field to proceed.");
      return;
    }
    if (!confirm("This will permanently delete this workspace's leads, contacts, logs, campaigns and anonymise your account. Continue?")) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await requestGdprPurge(purgeConfirm);
      setMessage(`Workspace purged (request ${r.requestId.slice(0, 8)}). You will be signed out shortly.`);
      setPurgeConfirm("");
      load();
    } catch (e: any) {
      setError(e?.message || "Purge failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy & compliance</h1>
        <p className="text-sm text-muted-foreground">
          GDPR Article 15 (data export) and Article 17 (right to erasure) controls for this workspace.
        </p>
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">{message}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export workspace data</CardTitle>
          <CardDescription>Produces a JSON snapshot of every row attributable to you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={onExport} disabled={busy}>
            {busy ? "Working…" : "Generate export"}
          </Button>
          {exportData && (
            <div className="space-y-2 text-sm">
              <div className="text-muted-foreground">
                Snapshot ready. Download the JSON file below or inspect it inline.
              </div>
              <Button variant="outline" onClick={onDownload}>Download JSON</Button>
              <pre className="max-h-64 overflow-auto rounded bg-muted/40 p-3 text-[11px] leading-tight">
                {JSON.stringify(exportData, null, 2).slice(0, 6000)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Delete workspace (irreversible)</CardTitle>
          <CardDescription>
            Hard-deletes leads, contacts, logs, campaigns, LinkedIn accounts and scraper data for this workspace, and anonymises your customer record. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">Type <code className="rounded bg-muted px-1.5 py-0.5">DELETE</code> in the field below to enable the purge button.</p>
          <Input value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} placeholder="DELETE" />
          <Button variant="destructive" disabled={busy || purgeConfirm !== "DELETE"} onClick={onPurge}>
            {busy ? "Working…" : "Purge workspace"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request history</CardTitle>
          <CardDescription>Audit trail of export + deletion requests</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : requests.length === 0 ? (
            <div className="text-sm text-muted-foreground">No requests yet.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">Kind</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Completed</th>
                    <th className="py-2 pr-4">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.requested_at).toLocaleString()}</td>
                      <td className="py-2 pr-4"><Badge variant="outline">{r.kind}</Badge></td>
                      <td className="py-2 pr-4"><Badge variant={r.status === "completed" ? "success" : "outline"}>{r.status}</Badge></td>
                      <td className="py-2 pr-4 whitespace-nowrap text-xs text-muted-foreground">{r.completed_at ? new Date(r.completed_at).toLocaleString() : "-"}</td>
                      <td className="py-2 pr-4 text-xs text-destructive">{r.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
