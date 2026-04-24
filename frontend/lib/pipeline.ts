import { authedFetch } from "@/lib/api-client";

export type PipelineStage =
  | "new"
  | "queued"
  | "sent"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "unsubscribed";

export const STAGE_LABELS: Record<PipelineStage, string> = {
  new: "New",
  queued: "Queued",
  sent: "Sent",
  opened: "Opened",
  clicked: "Clicked",
  replied: "Replied",
  bounced: "Bounced",
  unsubscribed: "Unsubscribed",
};

export interface StageCount {
  stage: PipelineStage;
  count: number;
}

export interface PipelineLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  job_title: string | null;
  pipeline_stage: PipelineStage;
  pipeline_stage_updated_at: string | null;
  last_contacted_at: string | null;
  last_replied_at: string | null;
  reply_count: number;
  lead_score: number;
  icebreaker: string | null;
  email_validation_status: string | null;
}

export interface PipelineColumn {
  stage: PipelineStage;
  count: number;
  leads: PipelineLead[];
}

export interface PipelineBoard {
  stages: StageCount[];
  columns: PipelineColumn[];
}

export interface ContactNote {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_id: string | null;
  author_first_name: string | null;
  author_last_name: string | null;
}

export interface TimelineEvent {
  at: string;
  type: string;
  data?: Record<string, unknown>;
}

export async function getPipelineBoard(): Promise<PipelineBoard> {
  const res = await authedFetch(`/api/pipeline`);
  return res.json();
}

export async function getPipelineStage(stage: PipelineStage): Promise<PipelineLead[]> {
  const res = await authedFetch(`/api/pipeline?stage=${stage}`);
  return res.json();
}

export async function getPipelineStageCounts(): Promise<StageCount[]> {
  const res = await authedFetch(`/api/pipeline/stages`);
  return res.json();
}

export async function setLeadStage(leadId: string, stage: PipelineStage) {
  const res = await authedFetch(`/api/pipeline/lead/${leadId}/stage`, {
    method: "POST",
    body: JSON.stringify({ stage }),
  });
  return res.json();
}

export async function getLeadTimeline(leadId: string): Promise<{ events: TimelineEvent[]; notes: ContactNote[] }> {
  const res = await authedFetch(`/api/pipeline/lead/${leadId}/timeline`);
  return res.json();
}

export async function listLeadNotes(leadId: string): Promise<ContactNote[]> {
  const res = await authedFetch(`/api/pipeline/lead/${leadId}/notes`);
  return res.json();
}

export async function createLeadNote(leadId: string, body: string): Promise<ContactNote> {
  const res = await authedFetch(`/api/pipeline/lead/${leadId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return res.json();
}

export async function deleteLeadNote(noteId: string) {
  const res = await authedFetch(`/api/pipeline/notes/${noteId}`, { method: "DELETE" });
  return res.json();
}

export async function listInboundReplies(limit = 100) {
  const res = await authedFetch(`/api/pipeline/replies?limit=${limit}`);
  return res.json();
}

export async function getInboundWebhookToken(): Promise<{ token: string }> {
  const res = await authedFetch(`/api/pipeline/inbound/token`);
  return res.json();
}

export async function rotateInboundWebhookToken(): Promise<{ token: string }> {
  const res = await authedFetch(`/api/pipeline/inbound/token/rotate`, { method: "POST" });
  return res.json();
}
