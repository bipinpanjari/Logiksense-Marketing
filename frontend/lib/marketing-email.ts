import { authedFetch } from "@/lib/api-client";

export async function listCampaigns() {
  const res = await authedFetch("/marketing-email/campaigns");
  return res.json();
}

export async function createCampaign(payload: { name: string; status?: string; audienceCount?: number; scheduledAt?: string }) {
  const res = await authedFetch("/marketing-email/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getCalendar(days = 7) {
  const res = await authedFetch(`/marketing-email/calendar?days=${days}`);
  return res.json();
}

export async function listTemplates() {
  const res = await authedFetch("/marketing-email/templates");
  return res.json();
}

export async function createTemplate(payload: {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  category?: string;
}) {
  const res = await authedFetch("/marketing-email/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function listSequences() {
  const res = await authedFetch("/marketing-email/sequences");
  return res.json();
}

export async function createSequence(payload: {
  name: string;
  description?: string;
  status?: string;
  steps: Array<{ id: number | string; name: string; delayHours: number; subject?: string }>;
}) {
  const res = await authedFetch("/marketing-email/sequences", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json();
}

