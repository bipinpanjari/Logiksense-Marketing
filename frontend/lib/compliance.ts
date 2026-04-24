import { authedFetch } from "@/lib/api-client";

export interface AuditRow {
  id: string;
  action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  created_at: string;
  performed_by: string | null;
  actor_email: string | null;
  actor_first_name: string | null;
  actor_last_name: string | null;
}

export interface ActionCount {
  action: string;
  count: number;
}

export interface GdprRequestRow {
  id: string;
  customer_id: string;
  kind: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  error: string | null;
}

export async function listAuditLog(params: {
  limit?: number;
  offset?: number;
  action?: string;
  actor?: string;
  since?: string;
  until?: string;
} = {}): Promise<AuditRow[]> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  if (params.action) q.set("action", params.action);
  if (params.actor) q.set("actor", params.actor);
  if (params.since) q.set("since", params.since);
  if (params.until) q.set("until", params.until);
  const res = await authedFetch(`/api/audit?${q.toString()}`);
  return res.json();
}

export async function auditCounts(days = 30): Promise<ActionCount[]> {
  const res = await authedFetch(`/api/audit/counts?days=${days}`);
  return res.json();
}

export async function requestGdprExport(): Promise<{ requestId: string; snapshot: any }> {
  const res = await authedFetch(`/api/compliance/export`, { method: "POST" });
  return res.json();
}

export async function requestGdprPurge(confirm: string): Promise<{ requestId: string }> {
  const res = await authedFetch(`/api/compliance/purge`, {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
  return res.json();
}

export async function listGdprRequests(): Promise<GdprRequestRow[]> {
  const res = await authedFetch(`/api/compliance/requests`);
  return res.json();
}
