import { authedFetch } from "@/lib/api-client";

export type AiLlmVendor = "openai" | "anthropic";

export const AI_PERSONALIZATION_INSTRUCTIONS_MAX_CHARS = 20_000;

export interface AiSettings {
  aiPersonalizationEnabled: boolean;
  aiPersonalizationInstructions: string | null;
  aiProvider: "platform" | "byok";
  aiLlmVendor: AiLlmVendor;
  aiPreferredModel: string | null;
  aiOpenaiConfigured: boolean;
  aiAnthropicConfigured: boolean;
  enrichmentEnabled: boolean;
  zerobounceConfigured: boolean;
  apolloConfigured: boolean;
  platformOpenAiAvailable: boolean;
  platformAnthropicAvailable: boolean;
}

export interface AiUsageSummaryRow {
  provider: string;
  model: string;
  operation: string;
  byok: boolean;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_cents: string | null;
  calls: number;
}

export interface AiUsageRecentRow {
  id: string;
  provider: string;
  model: string;
  operation: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_cents: string | null;
  byok: boolean;
  status: string;
  error: string | null;
  created_at: string;
}

export async function getAiSettings(): Promise<AiSettings> {
  const res = await authedFetch(`/api/ai/settings`);
  return res.json();
}

export interface UpdateAiSettingsBody {
  aiPersonalizationEnabled?: boolean;
  aiPersonalizationInstructions?: string | null;
  aiProvider?: "platform" | "byok";
  aiLlmVendor?: AiLlmVendor;
  aiPreferredModel?: string | null;
  enrichmentEnabled?: boolean;
  openaiApiKey?: string | null;
  anthropicApiKey?: string | null;
  zerobounceApiKey?: string | null;
  apolloApiKey?: string | null;
}

export async function updateAiSettings(body: UpdateAiSettingsBody): Promise<AiSettings> {
  const res = await authedFetch(`/api/ai/settings`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getAiUsageSummary(days = 30): Promise<AiUsageSummaryRow[]> {
  const res = await authedFetch(`/api/ai/usage/summary?days=${days}`);
  return res.json();
}

export async function getAiUsageRecent(limit = 100): Promise<AiUsageRecentRow[]> {
  const res = await authedFetch(`/api/ai/usage/recent?limit=${limit}`);
  return res.json();
}

export async function previewNameDetection(body: {
  email?: string;
  linkedinName?: string;
  companyName?: string;
  jobTitle?: string;
  industry?: string;
  location?: string;
}) {
  const res = await authedFetch(`/api/ai/detect-name`, { method: "POST", body: JSON.stringify(body) });
  return res.json();
}

export async function previewIcebreaker(body: {
  companyName: string;
  websiteText?: string;
  industry?: string;
  jobTitle?: string;
  firstName?: string;
}): Promise<{ icebreaker: string; source: string; model?: string }> {
  const res = await authedFetch(`/api/ai/icebreaker`, { method: "POST", body: JSON.stringify(body) });
  return res.json();
}
