import { authedFetch } from "@/lib/api-client";

export interface ScraperStatus {
  globalKillSwitch: boolean;
  enabled: boolean;
  tosAcceptedAt: string | null;
  tosAcceptedBy: string | null;
}

export interface SearchProfile {
  id: string;
  name: string;
  business_type: string;
  city: string | null;
  country: string | null;
  query: string;
  target_limit: number;
  providers: string[] | string;
  schedule_cron: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScraperJobRow {
  id: string;
  provider: string;
  query: string;
  business_type: string | null;
  city: string | null;
  country: string | null;
  target_limit: number;
  status: "queued" | "running" | "completed" | "failed" | "skipped";
  leads_found: number;
  leads_with_email: number;
  error: string | null;
  /** Set while the worker is in the GMaps/website loop */
  progress_label?: string | null;
  progress_pct?: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface SearchItem {
  id: string;
  business_name: string | null;
  category: string | null;
  city: string | null;
  country: string | null;
  website_url: string | null;
  phone: string | null;
  rating: number | null;
  review_count: number | null;
  has_website: boolean;
  emails: string[] | string | null;
  phones: string[] | string | null;
  lead_id: string | null;
  lead_status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function getScraperStatus(): Promise<ScraperStatus> {
  const res = await authedFetch(`/api/scraper/status`);
  return res.json();
}

export async function acceptScraperTos() {
  const res = await authedFetch(`/api/scraper/accept-tos`, { method: "POST" });
  return res.json();
}

export async function disableScraper() {
  const res = await authedFetch(`/api/scraper/disable`, { method: "POST" });
  return res.json();
}

export async function listSearchProfiles(): Promise<SearchProfile[]> {
  const res = await authedFetch(`/api/scraper/profiles`);
  return res.json();
}

export async function createSearchProfile(body: {
  name: string;
  businessType: string;
  city?: string;
  country?: string;
  query?: string;
  targetLimit?: number;
  providers?: string[];
  scheduleCron?: string | null;
}) {
  const res = await authedFetch(`/api/scraper/profiles`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function updateSearchProfile(
  id: string,
  body: Partial<{
    name: string;
    businessType: string;
    city: string;
    country: string;
    query: string;
    targetLimit: number;
    providers: string[];
    scheduleCron: string | null;
    isActive: boolean;
  }>,
) {
  const res = await authedFetch(`/api/scraper/profiles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function deleteSearchProfile(id: string) {
  const res = await authedFetch(`/api/scraper/profiles/${id}`, { method: "DELETE" });
  return res.json();
}

export async function runSearchProfile(id: string) {
  const res = await authedFetch(`/api/scraper/profiles/${id}/run`, { method: "POST" });
  return res.json();
}

export async function runAdhocScrape(body: {
  query?: string;
  businessType?: string;
  city?: string;
  country?: string;
  targetLimit?: number;
  provider?: string;
}) {
  const res = await authedFetch(`/api/scraper/run`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function listScraperJobs(limit = 50): Promise<ScraperJobRow[]> {
  const res = await authedFetch(`/api/scraper/jobs?limit=${limit}`);
  return res.json();
}

export async function getScraperJob(id: string): Promise<{ job: ScraperJobRow; items: SearchItem[] }> {
  const res = await authedFetch(`/api/scraper/jobs/${id}`, { cache: "no-store" });
  return res.json();
}
