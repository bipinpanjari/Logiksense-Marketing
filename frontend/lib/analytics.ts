import { authedFetch } from "@/lib/api-client";

export interface DashboardKpis {
  totalLeads: number;
  leadsAddedLast7d: number;
  sentLast7d: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  activeCampaigns: number;
  activeSequences: number;
  scheduledSends: number;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  created_at: string;
}

export interface SendsByDay {
  day: string;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const res = await authedFetch(`/api/analytics/dashboard`);
  return res.json();
}

export async function getTopCampaigns(limit = 5): Promise<CampaignSummary[]> {
  const res = await authedFetch(`/api/analytics/top-campaigns?limit=${limit}`);
  return res.json();
}

export async function getSendsByDay(days = 30): Promise<SendsByDay[]> {
  const res = await authedFetch(`/api/analytics/sends-by-day?days=${days}`);
  return res.json();
}
