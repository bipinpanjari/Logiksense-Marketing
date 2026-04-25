import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from './llm-gateway.service';
import { AiUsageService } from './ai-usage.service';
import { getDatabase } from '../../shared/database';
import { mergePersonalizationInstructionsIntoSystem } from './ai-personalization-instructions.util';

export interface WebsiteDigestStructuredPage {
  url: string;
  pageKind: string;
  title: string | null;
  summary: string;
  keyPoints: string[];
  likelyNotFound: boolean;
}

export interface WebsiteDigestStructured {
  structuredAt: string;
  model?: string;
  siteOverview: string;
  accountBrief?: string;
  outreachAngles?: string[];
  openQuestions?: string[];
  callPrepNotes?: string;
  pages: WebsiteDigestStructuredPage[];
}

/** @deprecated use RepBriefExtractionInput */
export type ExtractionStructureInput = RepBriefExtractionInput;

export interface RepBriefExtractionInput {
  workspaceId: string;
  customerId?: string | null;
  businessName: string;
  category?: string | null;
  city?: string | null;
  country?: string | null;
  websiteUrl?: string | null;
  phone?: string | null;
  emails?: string[];
  phones?: string[];
  businessProfile: Record<string, unknown>;
}

const MAX_CHUNKS = 10;
const BODY_CAP = 2800;
const BUNDLE_CAP = 14_000;

function parseDigestChunks(raw: string): { url: string; body: string }[] {
  if (!raw?.trim()) return [];
  const parts = raw.split(/\n---\n/);
  const out: { url: string; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const url = (parts[i] || '').trim();
    const body = (parts[i + 1] || '').trim();
    if (!url.startsWith('http')) continue;
    out.push({ url, body });
  }
  return out;
}

function stripJsonFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return m ? m[1].trim() : t;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function buildResearchBundle(input: RepBriefExtractionInput): string {
  const parts: string[] = [];
  const p = input.businessProfile || {};
  const maps = (p.maps || {}) as Record<string, unknown>;
  const intel = (maps.mapsIntel || {}) as {
    attributeMap?: Record<string, string>;
    hoursSummary?: string;
    secondaryCategories?: string[];
  };
  const website = (p.website || {}) as Record<string, unknown>;
  const ctx = (p.searchContext || {}) as Record<string, unknown>;

  parts.push('=== LISTING (row) ===');
  parts.push(`Name: ${input.businessName}`);
  if (input.category) parts.push(`Category: ${input.category}`);
  if (input.city || input.country) parts.push(`Location: ${[input.city, input.country].filter(Boolean).join(', ')}`);
  if (input.websiteUrl) parts.push(`Website URL: ${input.websiteUrl}`);
  if (input.phone) parts.push(`Phone: ${input.phone}`);
  const em = input.emails?.length ? input.emails : [];
  const ph = input.phones?.length ? input.phones : [];
  if (em.length) parts.push(`Emails found: ${em.join(', ')}`);
  if (ph.length) parts.push(`Phones found: ${ph.join(', ')}`);

  parts.push('', '=== GOOGLE MAPS / SEARCH CONTEXT ===');
  if (ctx.searchQuery) parts.push(`Search query: ${ctx.searchQuery}`);
  if (ctx.businessType) parts.push(`Business type (search): ${ctx.businessType}`);
  if (maps.addressLine) parts.push(`Address: ${maps.addressLine}`);
  if (intel.hoursSummary) parts.push(`Hours: ${intel.hoursSummary}`);
  if (intel.secondaryCategories?.length) parts.push(`Categories: ${intel.secondaryCategories.join('; ')}`);
  if (intel.attributeMap && typeof intel.attributeMap === 'object') {
    const entries = Object.entries(intel.attributeMap).slice(0, 40);
    parts.push('Place attributes:');
    for (const [k, v] of entries) parts.push(`  ${k}: ${v}`);
  }

  const extractedText = typeof website.extractedText === 'string' ? website.extractedText : '';
  const chunks = parseDigestChunks(extractedText).slice(0, MAX_CHUNKS);
  if (chunks.length > 0) {
    parts.push('', '=== WEBSITE TEXT DIGEST (per URL) ===');
    for (const c of chunks) {
      const body = c.body.length > BODY_CAP ? `${c.body.slice(0, BODY_CAP)}…` : c.body;
      parts.push(`URL: ${c.url}`, body, '');
    }
  } else if (extractedText.trim()) {
    parts.push('', '=== WEBSITE TEXT (unsegmented) ===', truncate(extractedText.trim(), 6000));
  }

  const crawl = website.crawl as Record<string, unknown> | undefined;
  const snapshots = Array.isArray(crawl?.snapshots) ? (crawl!.snapshots as Record<string, unknown>[]) : [];
  if (snapshots.length > 0) {
    parts.push('', '=== PAGE SNAPSHOTS (titles / meta / headings) ===');
    for (const snap of snapshots.slice(0, 15)) {
      const url = String(snap.url || '');
      const title = String(snap.title || '');
      const h1 = String(snap.h1 || '');
      const md = String(snap.metaDescription || '');
      const h2 = Array.isArray(snap.h2Sample) ? (snap.h2Sample as string[]).slice(0, 4).join(' | ') : '';
      parts.push(`- ${url}`);
      if (title) parts.push(`  title: ${title}`);
      if (h1) parts.push(`  h1: ${h1}`);
      if (md) parts.push(`  meta: ${truncate(md, 240)}`);
      if (h2) parts.push(`  h2: ${h2}`);
    }
  }

  if (website.companyNameHint) parts.push('', `Company name hint: ${website.companyNameHint}`);
  if (typeof website.emailCount === 'number') parts.push(`Crawl email count: ${website.emailCount}`);
  if (typeof website.phoneCount === 'number') parts.push(`Crawl phone count: ${website.phoneCount}`);
  if (Array.isArray(website.pagesVisited) && website.pagesVisited.length) {
    parts.push(`Pages visited: ${(website.pagesVisited as string[]).slice(0, 20).join(', ')}`);
  }

  const bundle = parts.join('\n').trim();
  return truncate(bundle, BUNDLE_CAP);
}

@Injectable()
export class WebsiteDigestRepBriefService {
  private readonly logger = new Logger(WebsiteDigestRepBriefService.name);

  constructor(
    private readonly llm: LlmGatewayService,
    private readonly usage: AiUsageService,
  ) {}

  /**
   * Sales rep–style research brief from all scraper extraction fields.
   */
  async buildRepBriefFromExtraction(input: RepBriefExtractionInput): Promise<WebsiteDigestStructured | null> {
    const db = getDatabase();
    const wsRes = await db.query(
      `SELECT ai_personalization_enabled, ai_personalization_instructions FROM workspaces WHERE id = $1::uuid`,
      [input.workspaceId],
    );
    const wsRow = wsRes.rows[0];
    if (wsRow?.ai_personalization_enabled !== true) {
      return null;
    }
    const personalizationInstructions =
      typeof wsRow?.ai_personalization_instructions === 'string'
        ? wsRow.ai_personalization_instructions
        : null;

    const bundle = buildResearchBundle(input);
    if (!bundle || bundle.length < 20) return null;

    const schemaHint = `{
  "siteOverview": "3-5 sentences: tight elevator picture of the business. Sound like a competent rep, not a directory. Ground ONLY in the research sections below.",
  "accountBrief": "2-4 short paragraphs of plain internal sales notes: who they are, what likely matters to them, what stands out, fit or risk signals. Narrative prose — not bullet taxonomies or page-by-page site structure.",
  "outreachAngles": ["each: 1-2 sentences with a concrete personalized hook from the data"],
  "openQuestions": ["honest gaps — what we do not know or should verify before claiming"],
  "callPrepNotes": "1-2 paragraphs: what to listen for on discovery, language to mirror, landmines to avoid.",
  "pages": []
}`;

    const systemBase = `You are a senior B2B sales rep writing your own account notes after reviewing research gathered by your team. The user message is ALL you have: listing row, Google Maps attributes, phones/emails, website crawl text, and page snapshots.

Your job is to UNDERSTAND the business the way a human seller would — who they are, what they likely offer, who buys, how they present themselves, and what a thoughtful first conversation could reference. You are not an information architect. Do not "structure the website" or classify every URL. Do not produce CMS-style page inventories.

The main deliverable is how this rep would actually think and write: tight overview, longer narrative brief, real outreach angles, honest unknowns, and call prep. Optional "pages" entries are only for short factual tie-ins to a specific URL when it genuinely helps (e.g. one maps:listing row if everything is Maps-only, or 1-3 URLs for a hard fact). Prefer "pages": []. At most 5 page objects. Never paste nav menus or duplicate the whole site.

Output valid JSON only, exactly this shape (fill strings/arrays; pages usually empty): ${schemaHint}

Rules:
- Ground every factual claim in the labeled sections. If the data is thin, say so in openQuestions instead of inventing.
- Never invent awards, press, certifications, revenue, headcount, logos, or contacts.
- Use Maps + listing + contacts even when website text is missing.
- Tone: clear, direct colleague — not marketing fluff, not robotic JSON-speak.`;

    const messages = [
      {
        role: 'system' as const,
        content: mergePersonalizationInstructionsIntoSystem(systemBase, personalizationInstructions),
      },
      {
        role: 'user' as const,
        content: `Research bundle for one prospect — write your notes:\n\n${bundle}`,
      },
    ];

    const routing = await this.llm.resolveCredentials(input.workspaceId);
    if (!routing) return null;

    try {
      const result = await this.llm.chat({
        workspaceId: input.workspaceId,
        customerId: input.customerId ?? null,
        messages,
        temperature: 0.45,
        maxTokens: 4500,
        jsonObject: true,
      });
      if (!result?.text) return null;

      const parsed = JSON.parse(stripJsonFence(result.text)) as {
        siteOverview?: string;
        accountBrief?: string;
        outreachAngles?: string[];
        openQuestions?: string[];
        callPrepNotes?: string;
        pages?: Partial<WebsiteDigestStructuredPage>[];
      };
      const siteOverview = (parsed.siteOverview || '').trim();
      const accountBrief = typeof parsed.accountBrief === 'string' ? parsed.accountBrief.trim() : '';
      const outreachAngles = Array.isArray(parsed.outreachAngles)
        ? parsed.outreachAngles.filter((x) => typeof x === 'string' && x.trim().length > 0).slice(0, 12)
        : [];
      const openQuestions = Array.isArray(parsed.openQuestions)
        ? parsed.openQuestions.filter((x) => typeof x === 'string' && x.trim().length > 0).slice(0, 12)
        : [];
      const callPrepNotes = typeof parsed.callPrepNotes === 'string' ? parsed.callPrepNotes.trim() : '';
      const pagesRaw = Array.isArray(parsed.pages) ? parsed.pages : [];
      const pages: WebsiteDigestStructuredPage[] = pagesRaw
        .filter((p) => p && typeof p.url === 'string' && p.url.trim().length > 0)
        .slice(0, 8)
        .map((p) => ({
          url: String(p.url).trim(),
          pageKind: typeof p.pageKind === 'string' ? p.pageKind : 'other',
          title: typeof p.title === 'string' ? p.title : null,
          summary: typeof p.summary === 'string' ? p.summary : '',
          keyPoints: Array.isArray(p.keyPoints) ? p.keyPoints.filter((x) => typeof x === 'string').slice(0, 12) : [],
          likelyNotFound: p.likelyNotFound === true,
        }));

      const hasNarrative =
        siteOverview.length > 0 ||
        accountBrief.length > 0 ||
        outreachAngles.length > 0 ||
        openQuestions.length > 0 ||
        callPrepNotes.length > 0;
      if (!hasNarrative && pages.length === 0) return null;

      await this.usage.log({
        workspaceId: input.workspaceId,
        customerId: input.customerId ?? null,
        provider: result.provider,
        model: result.model,
        operation: 'website_digest_rep_brief',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        byok: result.byok,
        status: 'ok',
      });

      return {
        structuredAt: new Date().toISOString(),
        model: result.model,
        siteOverview: siteOverview || accountBrief.slice(0, 500) || 'Research brief below.',
        ...(accountBrief ? { accountBrief } : {}),
        ...(outreachAngles.length ? { outreachAngles } : {}),
        ...(openQuestions.length ? { openQuestions } : {}),
        ...(callPrepNotes ? { callPrepNotes } : {}),
        pages,
      };
    } catch (err: any) {
      const msg = err?.message || String(err);
      this.logger.warn(`[website-digest-rep-brief] failed: ${msg}`);
      try {
        await this.usage.log({
          workspaceId: input.workspaceId,
          customerId: input.customerId ?? null,
          provider: routing.vendor,
          model: routing.model,
          operation: 'website_digest_rep_brief',
          byok: routing.byok,
          status: 'error',
          error: msg.slice(0, 500),
        });
      } catch {
        // ignore
      }
      return null;
    }
  }

  /** @deprecated use buildRepBriefFromExtraction */
  async structureFromExtraction(input: RepBriefExtractionInput): Promise<WebsiteDigestStructured | null> {
    return this.buildRepBriefFromExtraction(input);
  }

  /** @deprecated use buildRepBriefFromExtraction */
  async structure(input: {
    workspaceId: string;
    customerId?: string | null;
    businessName: string;
    extractedText: string | null | undefined;
  }): Promise<WebsiteDigestStructured | null> {
    return this.buildRepBriefFromExtraction({
      workspaceId: input.workspaceId,
      customerId: input.customerId,
      businessName: input.businessName,
      businessProfile: {
        website: { extractedText: input.extractedText ?? null },
      },
    });
  }
}
