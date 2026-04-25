import type { SearchItem, SearchItemBusinessProfile } from "@/lib/scraper";
import type { PipelineLead } from "@/lib/pipeline";

export interface BusinessResearchModel {
  businessName: string | null;
  category: string | null;
  city: string | null;
  country: string | null;
  websiteUrl: string | null;
  phone: string | null;
  emails: string[];
  phones: string[];
  rating: number | null;
  reviewCount: number | null;
  profile: SearchItemBusinessProfile | null;
  enrichment?: Record<string, unknown> | null;
  leadPromoted?: { status: string } | null;
}

function asList(v: string[] | string | null | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseProfile(raw: unknown): SearchItemBusinessProfile | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as SearchItemBusinessProfile;
}

export function researchModelFromSearchItem(item: SearchItem): BusinessResearchModel {
  const profile = parseProfile(item.business_profile);
  return {
    businessName: item.business_name,
    category: item.category,
    city: item.city,
    country: item.country,
    websiteUrl: item.website_url,
    phone: item.phone,
    emails: asList(item.emails),
    phones: asList(item.phones),
    rating: item.rating != null ? Number(item.rating) : null,
    reviewCount: item.review_count,
    profile,
    enrichment: null,
    leadPromoted: item.lead_id ? { status: item.lead_status || "linked" } : null,
  };
}

export function researchModelFromPipelineLead(lead: PipelineLead): BusinessResearchModel {
  const profile = parseProfile(lead.scraper_business_profile);
  const scraperEmails = asList(lead.scraper_emails);
  const scraperPhones = asList(lead.scraper_phones);
  const phones = new Set<string>();
  if (lead.phone) phones.add(lead.phone);
  if (lead.scraper_item_phone) phones.add(lead.scraper_item_phone);
  scraperPhones.forEach((p) => phones.add(p));
  const emails = [...new Set([...(lead.email ? [lead.email] : []), ...scraperEmails])];
  const primaryPhone = lead.phone || lead.scraper_item_phone || scraperPhones[0] || null;
  return {
    businessName: lead.scraper_business_name ?? lead.company ?? null,
    category: lead.scraper_category ?? null,
    city: lead.city,
    country: lead.country,
    websiteUrl: lead.scraper_website_url ?? null,
    phone: primaryPhone ?? null,
    emails,
    phones: [...phones],
    rating: lead.scraper_rating != null ? Number(lead.scraper_rating) : null,
    reviewCount: lead.scraper_review_count ?? null,
    profile,
    enrichment:
      lead.enrichment && typeof lead.enrichment === "object"
        ? (lead.enrichment as Record<string, unknown>)
        : null,
    leadPromoted: null,
  };
}
