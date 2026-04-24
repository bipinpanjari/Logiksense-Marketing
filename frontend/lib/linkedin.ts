import { authedFetch } from "@/lib/api-client";

export interface LinkedInStatus {
  globalKillSwitch: boolean;
  enabled: boolean;
  tosAcceptedAt: string | null;
  tosAcceptedBy: string | null;
}

export interface LinkedInAccount {
  id: string;
  email: string;
  display_name: string | null;
  status: "active" | "paused" | "suspended" | "blocked" | "captcha_required";
  last_login_at: string | null;
  last_error: string | null;
  actions_today: number;
  actions_this_hour: number;
  actions_this_week: number;
  max_per_day: number;
  max_per_hour: number;
  max_per_week: number;
  created_at: string;
  updated_at: string;
}

export interface LinkedInCampaignRow {
  id: string;
  name: string;
  status: "draft" | "running" | "paused" | "completed" | "failed";
  location: string | null;
  max_per_day: number;
  job_title_filter: string | null;
  industry_filter: string | null;
  linkedin_account_id: string | null;
  account_email: string | null;
  account_status: string | null;
  last_run_at: string | null;
  paused_reason: string | null;
  sequence_count: string | number;
  sent_count: string | number;
  reply_count: string | number;
  created_at: string;
  updated_at: string;
}

export interface LinkedInSequenceRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  location: string | null;
  status: string;
  sequence_step: number;
  next_send_at: string | null;
  last_action_at: string | null;
  reply_classification: string | null;
}

export interface LinkedInMessageRow {
  id: string;
  sequence_id: string;
  step_number: number;
  kind: string;
  status: string;
  body: string;
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface LinkedInAuditRow {
  id: string;
  linkedin_account_id: string | null;
  customer_id: string | null;
  event: string;
  details: any;
  created_at: string;
}

export async function getLinkedInStatus(): Promise<LinkedInStatus> {
  const res = await authedFetch(`/api/linkedin/status`);
  return res.json();
}
export async function acceptLinkedInTos() {
  const res = await authedFetch(`/api/linkedin/accept-tos`, { method: "POST" });
  return res.json();
}
export async function disableLinkedIn() {
  const res = await authedFetch(`/api/linkedin/disable`, { method: "POST" });
  return res.json();
}
export async function listLinkedInAccounts(): Promise<LinkedInAccount[]> {
  const res = await authedFetch(`/api/linkedin/accounts`);
  return res.json();
}
export async function pairLinkedInAccount(body: {
  email: string;
  displayName?: string;
  password: string;
  maxPerDay?: number;
  maxPerHour?: number;
  maxPerWeek?: number;
}) {
  const res = await authedFetch(`/api/linkedin/accounts`, { method: "POST", body: JSON.stringify(body) });
  return res.json();
}
export async function pauseLinkedInAccount(id: string, reason?: string) {
  const res = await authedFetch(`/api/linkedin/accounts/${id}/pause`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return res.json();
}
export async function resumeLinkedInAccount(id: string) {
  const res = await authedFetch(`/api/linkedin/accounts/${id}/resume`, { method: "POST" });
  return res.json();
}
export async function deleteLinkedInAccount(id: string) {
  const res = await authedFetch(`/api/linkedin/accounts/${id}`, { method: "DELETE" });
  return res.json();
}
export async function getLinkedInAuditLog(limit = 200): Promise<LinkedInAuditRow[]> {
  const res = await authedFetch(`/api/linkedin/audit-log?limit=${limit}`);
  return res.json();
}

export async function listLinkedInCampaigns(): Promise<LinkedInCampaignRow[]> {
  const res = await authedFetch(`/api/linkedin/campaigns`);
  return res.json();
}
export async function createLinkedInCampaign(body: any) {
  const res = await authedFetch(`/api/linkedin/campaigns`, { method: "POST", body: JSON.stringify(body) });
  return res.json();
}
export async function getLinkedInCampaign(id: string): Promise<{
  campaign: LinkedInCampaignRow & { messages?: any; max_per_day?: number };
  sequences: LinkedInSequenceRow[];
  messages: LinkedInMessageRow[];
}> {
  const res = await authedFetch(`/api/linkedin/campaigns/${id}`);
  return res.json();
}
export async function updateLinkedInCampaign(id: string, body: any) {
  const res = await authedFetch(`/api/linkedin/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  return res.json();
}
export async function startLinkedInCampaign(id: string) {
  const res = await authedFetch(`/api/linkedin/campaigns/${id}/start`, { method: "POST" });
  return res.json();
}
export async function pauseLinkedInCampaign(id: string, reason?: string) {
  const res = await authedFetch(`/api/linkedin/campaigns/${id}/pause`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return res.json();
}
export async function deleteLinkedInCampaign(id: string) {
  const res = await authedFetch(`/api/linkedin/campaigns/${id}`, { method: "DELETE" });
  return res.json();
}
