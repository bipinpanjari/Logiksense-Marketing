import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { BrowserContext, Page } from 'playwright';
import { EmailExtractorService, ExtractedContact } from './email-extractor.service';
import { randomDelay } from './utils/browser-config';

const CANDIDATE_PATHS = [
  '/',
  '/about',
  '/about-us',
  '/company',
  '/team',
  '/leadership',
  '/contact',
  '/contact-us',
  '/careers',
  '/news',
  '/blog',
  '/press',
  '/stories',
  '/imprint',
  '/impressum',
  '/kontakt',
];

const ASSET_EXT = /\.(png|jpe?g|gif|webp|svg|ico|pdf|zip|mp4|mp3|woff2?|ttf|eot)(\?|$)/i;

export interface CrawlPageSnapshot {
  url: string;
  title?: string;
  metaDescription?: string;
  canonical?: string;
  h1?: string;
  h2Sample?: string[];
  jsonLdEntities?: Array<{
    type: string;
    name?: string;
    description?: string;
    url?: string;
    sameAs?: string[];
    telephone?: string;
  }>;
  socialLinks?: string[];
}

export interface WebsiteCrawlMeta {
  mode: 'deep' | 'shallow';
  sameOriginOnly: true;
  maxPages: number;
  maxDepth: number;
  pagesCrawled: number;
  sitemapUrlsSeeded: number;
  textCharsTotal: number;
  snapshots: CrawlPageSnapshot[];
}

export interface WebsiteScrapeResult {
  websiteUrl: string;
  companyName: string;
  emails: string[];
  phoneNumbers: string[];
  timestamp: string;
  websiteText?: string;
  pagesVisited: string[];
  crawl?: WebsiteCrawlMeta;
}

@Injectable()
export class WebsiteScraperService {
  private readonly logger = new Logger(WebsiteScraperService.name);
  private readonly deepCrawl = process.env.SCRAPER_WEBSITE_DEEP_CRAWL !== 'false';
  private readonly maxPathsShallow = Math.min(
    CANDIDATE_PATHS.length,
    Math.max(1, parseInt(process.env.SCRAPER_WEBSITE_MAX_PATHS || '6', 10)),
  );
  private readonly maxPagesDeep = Math.min(80, Math.max(5, parseInt(process.env.SCRAPER_WEBSITE_MAX_PAGES || '28', 10)));
  private readonly maxDepthDeep = Math.min(4, Math.max(1, parseInt(process.env.SCRAPER_WEBSITE_MAX_DEPTH || '2', 10)));
  private readonly sitemapUrlCap = Math.min(60, Math.max(0, parseInt(process.env.SCRAPER_WEBSITE_SITEMAP_URLS_MAX || '35', 10)));
  private readonly maxLinksPerPage = Math.min(80, Math.max(10, parseInt(process.env.SCRAPER_WEBSITE_LINKS_PER_PAGE || '36', 10)));
  private readonly textBudget = Math.min(120_000, Math.max(8_000, parseInt(process.env.SCRAPER_WEBSITE_TEXT_BUDGET || '72000', 10)));
  private readonly perPageTextCap = Math.min(20_000, Math.max(1_000, parseInt(process.env.SCRAPER_WEBSITE_PER_PAGE_TEXT || '8000', 10)));
  private readonly pageTimeoutMs = Math.min(
    60_000,
    Math.max(3_000, parseInt(process.env.SCRAPER_PAGE_TIMEOUT_MS || '12000', 10)),
  );

  constructor(private readonly extractor: EmailExtractorService) {}

  async scrape(context: BrowserContext, websiteUrl: string): Promise<WebsiteScrapeResult | null> {
    if (!websiteUrl) return null;
    const baseUrl = this.normalize(websiteUrl);
    if (!baseUrl) return null;

    if (this.deepCrawl) {
      return this.scrapeDeep(context, baseUrl);
    }
    return this.scrapeShallow(context, baseUrl);
  }

  /** Legacy: fixed paths only, stop early when enough emails. */
  private async scrapeShallow(context: BrowserContext, baseUrl: string): Promise<WebsiteScrapeResult | null> {
    const origin = new URL(baseUrl).origin;
    const page = await context.newPage();
    const visited: string[] = [];
    const segments: { url: string; text: string }[] = [];
    const aggregated: { emails: string[]; phones: string[] } = { emails: [], phones: [] };

    try {
      for (const rel of CANDIDATE_PATHS.slice(0, this.maxPathsShallow)) {
        if (aggregated.emails.length >= 3) break;
        const target = new URL(rel, origin).toString();
        const contact = await this.scrapePageContactOnly(page, target);
        if (!contact) continue;
        visited.push(target);
        aggregated.emails.push(...contact.emails);
        aggregated.phones.push(...contact.phones);
        const blob = contact.texts.join(' ').replace(/\s+/g, ' ').trim().slice(0, this.perPageTextCap);
        if (blob) segments.push({ url: target, text: blob });
        await randomDelay(600, 1400);
      }
    } finally {
      await page.close().catch(() => null);
    }

    const emails = this.unique(aggregated.emails).slice(0, 5);
    const phones = this.unique(aggregated.phones).slice(0, 5);
    const text = this.composeSegmentText(segments, this.textBudget);

    return {
      websiteUrl: baseUrl,
      companyName: new URL(baseUrl).hostname.replace(/^www\./, ''),
      emails,
      phoneNumbers: phones,
      timestamp: new Date().toISOString(),
      websiteText: text,
      pagesVisited: visited,
      crawl: {
        mode: 'shallow',
        sameOriginOnly: true,
        maxPages: this.maxPathsShallow,
        maxDepth: 0,
        pagesCrawled: visited.length,
        sitemapUrlsSeeded: 0,
        textCharsTotal: text?.length ?? 0,
        snapshots: [],
      },
    };
  }

  /**
   * Same-origin crawl: sitemap seeds + BFS on internal links. Caps prevent runaway jobs.
   * Not "the whole internet" — that would violate most sites' ToS and your infra; this maxes out *their* site.
   */
  private async scrapeDeep(context: BrowserContext, baseUrl: string): Promise<WebsiteScrapeResult | null> {
    const origin = new URL(baseUrl).origin;
    const page = await context.newPage();
    const visitedKeys = new Set<string>();
    const visitedUrls: string[] = [];
    const snapshots: CrawlPageSnapshot[] = [];
    const segments: { url: string; text: string }[] = [];
    const aggregated: { emails: string[]; phones: string[] } = { emails: [], phones: [] };

    type Q = { url: string; depth: number };
    const queue: Q[] = [];
    const queuedKeys = new Set<string>();

    const enqueue = (url: string, depth: number) => {
      if (depth > this.maxDepthDeep) return;
      const k = this.normalizePageKey(url);
      if (visitedKeys.has(k) || queuedKeys.has(k)) return;
      queuedKeys.add(k);
      queue.push({ url, depth });
    };

    for (const rel of CANDIDATE_PATHS) {
      enqueue(new URL(rel, origin).toString(), 0);
    }

    let sitemapSeeded = 0;
    if (this.sitemapUrlCap > 0) {
      const fromMap = await this.discoverSitemapUrls(origin);
      for (const u of fromMap) {
        if (sitemapSeeded >= this.sitemapUrlCap) break;
        enqueue(u, 0);
        sitemapSeeded += 1;
      }
    }

    queue.sort((a, b) => this.urlPriority(b.url) - this.urlPriority(a.url));

    try {
      while (queue.length > 0 && visitedUrls.length < this.maxPagesDeep) {
        queue.sort((a, b) => this.urlPriority(b.url) - this.urlPriority(a.url));
        const next = queue.shift()!;
        const key = this.normalizePageKey(next.url);
        queuedKeys.delete(key);
        if (visitedKeys.has(key)) continue;
        if (next.depth > this.maxDepthDeep) continue;

        visitedKeys.add(key);
        const { contact, rich, html } = await this.scrapePageFull(page, next.url);
        if (!html && !contact) continue;

        visitedUrls.push(next.url);
        if (contact) {
          aggregated.emails.push(...contact.emails);
          aggregated.phones.push(...contact.phones);
          const blob = contact.texts.join(' ').replace(/\s+/g, ' ').trim().slice(0, this.perPageTextCap);
          if (blob) segments.push({ url: next.url, text: blob });
        }
        if (rich) snapshots.push(rich);

        if (html && next.depth < this.maxDepthDeep && visitedUrls.length < this.maxPagesDeep) {
          const links = this.extractSameOriginLinks(html, next.url, origin, this.maxLinksPerPage);
          for (const link of links) {
            enqueue(link, next.depth + 1);
          }
        }

        await randomDelay(350, 900);
      }
    } finally {
      await page.close().catch(() => null);
    }

    const emails = this.unique(aggregated.emails).slice(0, 12);
    const phones = this.unique(aggregated.phones).slice(0, 10);
    const text = this.composeSegmentText(segments, this.textBudget);

    return {
      websiteUrl: baseUrl,
      companyName: new URL(baseUrl).hostname.replace(/^www\./, ''),
      emails,
      phoneNumbers: phones,
      timestamp: new Date().toISOString(),
      websiteText: text,
      pagesVisited: visitedUrls,
      crawl: {
        mode: 'deep',
        sameOriginOnly: true,
        maxPages: this.maxPagesDeep,
        maxDepth: this.maxDepthDeep,
        pagesCrawled: visitedUrls.length,
        sitemapUrlsSeeded: sitemapSeeded,
        textCharsTotal: text?.length ?? 0,
        snapshots: snapshots.slice(0, 40),
      },
    };
  }

  private urlPriority(url: string): number {
    const p = url.toLowerCase();
    let s = 0;
    if (/about|story|company|who-we/i.test(p)) s += 8;
    if (/team|leadership|people|management|founder/i.test(p)) s += 7;
    if (/product|solution|service|platform|pricing/i.test(p)) s += 6;
    if (/news|blog|press|media|stories/i.test(p)) s += 5;
    if (/career|job|hiring/i.test(p)) s += 4;
    if (/contact|location|office/i.test(p)) s += 3;
    if (p.endsWith('/') || /\/$/.test(new URL(url).pathname)) s += 1;
    return s;
  }

  private async discoverSitemapUrls(origin: string): Promise<string[]> {
    const seeds = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`];
    const found = new Set<string>();
    for (const sm of seeds) {
      try {
        const res = await axios.get<string>(sm, {
          timeout: 12_000,
          maxContentLength: 3_000_000,
          responseType: 'text',
          validateStatus: (st) => st === 200,
        });
        const body = res.data;
        if (!body || typeof body !== 'string') continue;
        const locs = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
        for (const loc of locs) {
          try {
            const u = new URL(loc);
            if (u.origin !== origin) continue;
            if (ASSET_EXT.test(u.pathname)) continue;
            found.add(u.toString().split('#')[0]);
            if (found.size >= this.sitemapUrlCap) return [...found];
          } catch {
            /* skip */
          }
        }
      } catch {
        /* no sitemap */
      }
    }
    return [...found];
  }

  private extractSameOriginLinks(html: string, pageUrl: string, origin: string, cap: number): string[] {
    const $ = cheerio.load(html);
    const out: string[] = [];
    const seen = new Set<string>();
    $('a[href]').each((_, el) => {
      if (out.length >= cap) return false;
      const raw = ($(el).attr('href') || '').trim();
      if (!raw || raw.startsWith('#') || raw.startsWith('javascript:')) return;
      let abs: string;
      try {
        abs = new URL(raw, pageUrl).toString();
      } catch {
        return;
      }
      try {
        const u = new URL(abs);
        if (u.origin !== origin) return;
        if (!/^https?:$/i.test(u.protocol)) return;
        if (ASSET_EXT.test(u.pathname)) return;
        u.hash = '';
        const key = this.normalizePageKey(u.toString());
        if (seen.has(key)) return;
        seen.add(key);
        out.push(u.toString());
      } catch {
        /* skip */
      }
      return undefined;
    });
    return out;
  }

  private normalizePageKey(absUrl: string): string {
    try {
      const u = new URL(absUrl);
      u.hash = '';
      const path = u.pathname.replace(/\/+$/, '') || '/';
      return `${u.origin}${path}${u.search}`;
    } catch {
      return absUrl;
    }
  }

  private async scrapePageContactOnly(page: Page, url: string): Promise<ExtractedContact | null> {
    const { contact } = await this.scrapePageFull(page, url);
    return contact;
  }

  private async scrapePageFull(
    page: Page,
    url: string,
  ): Promise<{ contact: ExtractedContact | null; rich: CrawlPageSnapshot | null; html: string | null }> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.pageTimeoutMs });
      const html = await page.content();
      const contact = this.extractor.extractFromHtml(html);
      const rich = this.extractRichIntel(html, url);
      return { contact, rich, html };
    } catch (err) {
      this.logger.debug(`page failed ${url}: ${err instanceof Error ? err.message : err}`);
      return { contact: null, rich: null, html: null };
    }
  }

  private extractRichIntel(html: string, url: string): CrawlPageSnapshot {
    const $ = cheerio.load(html);
    const title = $('title').first().text().trim().replace(/\s+/g, ' ') || undefined;
    const metaDescription =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      undefined;
    const canonical = $('link[rel="canonical"]').attr('href')?.trim() || undefined;
    const h1 = $('h1').first().text().trim().replace(/\s+/g, ' ') || undefined;
    const h2Sample = $('h2')
      .slice(0, 10)
      .map((_, el) => $(el).text().trim().replace(/\s+/g, ' '))
      .get()
      .filter(Boolean);

    const social = new Set<string>();
    $('a[href]').each((_, el) => {
      const h = ($(el).attr('href') || '').trim();
      if (!h.startsWith('http')) return;
      if (/linkedin\.com\/(company|school|showcase|in)\//i.test(h)) social.add(h.split('?')[0]);
      else if (/twitter\.com\//i.test(h) || /x\.com\//i.test(h)) social.add(h.split('?')[0]);
      else if (/facebook\.com\//i.test(h)) social.add(h.split('?')[0]);
      else if (/instagram\.com\//i.test(h)) social.add(h.split('?')[0]);
      else if (/youtube\.com\//i.test(h) || /youtu\.be\//i.test(h)) social.add(h.split('?')[0]);
      else if (/github\.com\//i.test(h)) social.add(h.split('?')[0]);
    });

    const jsonLdEntities = this.extractJsonLdEntities($);

    return {
      url,
      title,
      metaDescription: metaDescription?.slice(0, 2000),
      canonical,
      h1: h1?.slice(0, 500),
      h2Sample: h2Sample.slice(0, 10),
      jsonLdEntities: jsonLdEntities?.slice(0, 15),
      socialLinks: [...social].slice(0, 20),
    };
  }

  private extractJsonLdEntities($: ReturnType<typeof cheerio.load>): CrawlPageSnapshot['jsonLdEntities'] {
    const rawBlocks: Record<string, unknown>[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).contents().text();
      if (!raw?.trim()) return;
      try {
        const data = JSON.parse(raw) as unknown;
        this.flattenJsonLd(data, rawBlocks);
      } catch {
        /* invalid JSON-LD */
      }
    });

    const interesting = new Set(
      [
        'Organization',
        'Corporation',
        'LocalBusiness',
        'ProfessionalService',
        'Store',
        'Restaurant',
        'FinancialService',
        'SoftwareApplication',
        'WebSite',
      ].map((s) => s.toLowerCase()),
    );

    const out: NonNullable<CrawlPageSnapshot['jsonLdEntities']> = [];
    for (const node of rawBlocks) {
      const t = node['@type'];
      const types: string[] = Array.isArray(t) ? (t as string[]) : t ? [String(t)] : [];
      const match = types.find((x) => interesting.has(String(x).toLowerCase()));
      if (!match) continue;

      const sameAs = node['sameAs'];
      const sameAsArr = Array.isArray(sameAs)
        ? sameAs.map(String).slice(0, 8)
        : typeof sameAs === 'string'
          ? [sameAs]
          : undefined;

      out.push({
        type: types.join(', '),
        name: (node['name'] as string) || (node['legalName'] as string) || undefined,
        description:
          typeof node['description'] === 'string' ? (node['description'] as string).slice(0, 2500) : undefined,
        url: typeof node['url'] === 'string' ? (node['url'] as string) : undefined,
        sameAs: sameAsArr,
        telephone: typeof node['telephone'] === 'string' ? (node['telephone'] as string) : undefined,
      });
      if (out.length >= 15) break;
    }
    return out;
  }

  private flattenJsonLd(node: unknown, acc: Record<string, unknown>[]): void {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const n of node) this.flattenJsonLd(n, acc);
      return;
    }
    if (typeof node === 'object' && '@graph' in (node as object)) {
      this.flattenJsonLd((node as { '@graph': unknown })['@graph'], acc);
      return;
    }
    if (typeof node === 'object') {
      acc.push(node as Record<string, unknown>);
    }
  }

  private composeSegmentText(segments: { url: string; text: string }[], budget: number): string | undefined {
    const parts: string[] = [];
    let total = 0;
    for (const s of segments) {
      const block = `\n---\n${s.url}\n---\n${s.text}`;
      if (total + block.length > budget) {
        parts.push(block.slice(0, Math.max(0, budget - total)));
        break;
      }
      parts.push(block);
      total += block.length;
    }
    const joined = parts.join('').trim();
    return joined || undefined;
  }

  private normalize(url: string): string | null {
    if (!url) return null;
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      u.hash = '';
      return u.toString();
    } catch {
      return null;
    }
  }

  private unique<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
  }
}
