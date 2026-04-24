"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionCount, AuditRow, auditCounts, listAuditLog } from "@/lib/compliance";

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [counts, setCounts] = useState<ActionCount[]>([]);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [logs, c] = await Promise.all([
        listAuditLog({ limit: 200, action: action || undefined }),
        auditCounts(30),
      ]);
      setRows(logs);
      setCounts(c);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">Every mutation in this workspace, admin-only.</p>
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top actions (30d)</CardTitle>
          <CardDescription>Most common mutations by count</CardDescription>
        </CardHeader>
        <CardContent>
          {counts.length === 0 ? (
            <div className="text-sm text-muted-foreground">No activity recorded yet.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {counts.map((c) => (
                <div key={c.action} className="rounded-md border p-3 text-sm">
                  <div className="truncate font-medium">{c.action}</div>
                  <div className="text-xs text-muted-foreground">{c.count} events</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-end justify-between gap-3">
          <div>
            <CardTitle className="text-base">Events</CardTitle>
            <CardDescription>Latest 200 entries</CardDescription>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <Input placeholder="Filter by action…" value={action} onChange={(e) => setAction(e.target.value)} />
            <Button type="submit">Apply</Button>
          </form>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No events.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">Actor</th>
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2 pr-4">Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t align-top">
                      <td className="py-2 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 max-w-[200px] truncate">
                        {r.actor_email || r.performed_by || "system"}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline">{r.action ?? "n/a"}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        <div>
                          {r.entity_type ?? ""}
                          {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}…` : ""}
                        </div>
                        {r.details && (
                          <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-1 text-[11px] leading-tight">
                            {JSON.stringify(r.details, null, 2)}
                          </pre>
                        )}
                      </td>
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
