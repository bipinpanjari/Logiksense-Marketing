import { Injectable, Logger } from '@nestjs/common';
import type { BrowserContext, Page } from 'playwright';
import { EmailExtractorService, ExtractedContact } from './email-extractor.service';
import { randomDelay } from './utils/browser-config';

const CANDIDATE_PATHS = ['/', '/contact', '/contact-us', '/about', '/about-us', '/team', '/imprint', '/impressum', '/kontakt'];

export interface WebsiteScrapeResult {
  websiteUrl: string;
  companyName: string;
  emails: string[];
  phoneNumbers: string[];
  timestamp: string;
  websiteText?: string;
  pagesVisited: string[];
}

@Injectable()
export class WebsiteScraperService {
  private readonly logger = new Logger(WebsiteScraperService.name);
  private readonly maxPaths = Math.min(
    CANDIDATE_PATHS.length,
    Math.max(1, parseInt(process.env.SCRAPER_WEBSITE_MAX_PATHS || '4', 10)),
  );
  private readonly pageTimeoutMs = Math.min(
    60_000,
    Math.max(3_000, parseInt(process.env.SCRAPER_PAGE_TIMEOUT_MS || '12000', 10)),
  );

  constructor(private readonly extractor: EmailExtractorService) {}

  async scrape(context: BrowserContext, websiteUrl: string): Promise<WebsiteScrapeResult | null> {
    if (!websiteUrl) return null;
    const baseUrl = this.normalize(websiteUrl);
    if (!baseUrl) return null;
    const origin = new URL(baseUrl).origin;

    const page = await context.newPage();
    const visited: string[] = [];
    const aggregated: ExtractedContact = { emails: [], phones: [], texts: [] };

    try {
      for (const rel of CANDIDATE_PATHS.slice(0, this.maxPaths)) {
        if (aggregated.emails.length >= 3) break;
        const target = new URL(rel, origin).toString();
        const contact = await this.scrapePage(page, target);
        if (!contact) continue;
        visited.push(target);
        aggregated.emails.push(...contact.emails);
        aggregated.phones.push(...contact.phones);
        aggregated.texts.push(...contact.texts);
        await randomDelay(600, 1400);
      }
    } finally {
      await page.close().catch(() => null);
    }

    const emails = this.unique(aggregated.emails).slice(0, 5);
    const phones = this.unique(aggregated.phones).slice(0, 5);
    const text = aggregated.texts.join(' ').slice(0, 8000) || undefined;

    return {
      websiteUrl: baseUrl,
      companyName: new URL(baseUrl).hostname.replace(/^www\./, ''),
      emails,
      phoneNumbers: phones,
      timestamp: new Date().toISOString(),
      websiteText: text,
      pagesVisited: visited,
    };
  }

  private async scrapePage(page: Page, url: string): Promise<ExtractedContact | null> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.pageTimeoutMs });
      const html = await page.content();
      return this.extractor.extractFromHtml(html);
    } catch (err) {
      this.logger.debug(`website page failed ${url}: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  private normalize(url: string): string | null {
    if (!url) return null;
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.toString();
    } catch {
      return null;
    }
  }

  private unique<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
  }
}
