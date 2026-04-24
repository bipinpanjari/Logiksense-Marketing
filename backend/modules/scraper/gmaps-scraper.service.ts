import { Injectable, Logger } from '@nestjs/common';
import type { BrowserContext, Page } from 'playwright';
import { randomDelay } from './utils/browser-config';

function withMapsEnglishParam(url: string): string {
  if (url.includes('hl=') || url.includes('hl%3D')) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('hl', 'en');
    return u.toString();
  } catch {
    return url.includes('?') ? `${url}&hl=en` : `${url}?hl=en`;
  }
}

export interface GoogleMapsResult {
  companyName: string;
  category?: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  websiteUrl?: string;
  hasWebsite: boolean;
}

/**
 * Google Maps scraper. Uses public, unauthenticated search. Honors robots.txt
 * at the service layer (kill-switch and ToS gate live upstream in the scraper
 * module). Designed to be polite: generous human-style delays, small batches.
 */
@Injectable()
export class GoogleMapsScraperService {
  private readonly logger = new Logger(GoogleMapsScraperService.name);

  /**
   * @param onProgress GMaps is the slowest phase; report place index for UI/DB so runs feel "alive"
   */
  async scrape(
    context: BrowserContext,
    query: string,
    limit: number,
    onProgress?: (ev: {
      phase: 'load' | 'list' | 'place';
      current: number;
      total: number;
      detail?: string;
    }) => void | Promise<void>,
  ): Promise<GoogleMapsResult[]> {
    this.logger.log(`GMaps: search start query=${query.slice(0, 120)}${query.length > 120 ? "…" : ""} limit=${limit}`);
    const page = await context.newPage();
    const results: GoogleMapsResult[] = [];
    try {
      await Promise.resolve(onProgress?.({ phase: 'load', current: 0, total: limit, detail: 'Opening search' }));
      const url = withMapsEnglishParam(
        `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
      );
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await this.dismissConsent(page);

      await page.waitForSelector('a.hfpxzc, div[role="feed"] a', { timeout: 30_000 }).catch(() => null);

      await Promise.resolve(
        onProgress?.({ phase: 'list', current: 0, total: limit, detail: 'Collecting result cards' }),
      );
      const cards = await this.collectResultCards(page, limit, (scrollAttempt, seen) => {
        void Promise.resolve(
          onProgress?.({
            phase: 'list',
            current: seen,
            total: limit,
            detail: `Scrolling results (${scrollAttempt}/10)`,
          }),
        );
      });
      for (const card of cards) {
        if (results.length >= limit) break;
        try {
          await Promise.resolve(
            onProgress?.({
              phase: 'place',
              current: results.length + 1,
              total: limit,
              detail: 'Opening business page',
            }),
          );
          const item = await this.openAndExtract(page, card);
          if (item) {
            results.push(item);
            await randomDelay(800, 1800);
          }
        } catch (err) {
          this.logger.warn(`gmaps extract failed: ${err instanceof Error ? err.message : err}`);
        }
      }
    } finally {
      await page.close().catch(() => null);
    }
    this.logger.log(`GMaps: search done places=${results.length}`);
    return results;
  }

  private async dismissConsent(page: Page) {
    const buttons = [
      'button:has-text("Accept all")',
      'button:has-text("I agree")',
      'button:has-text("Reject all")',
      'form[action*="consent"] button',
    ];
    for (const sel of buttons) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click().catch(() => null);
        await randomDelay(500, 1200);
        break;
      }
    }
  }

  private async collectResultCards(
    page: Page,
    limit: number,
    onScroll?: (attempt: number, seen: number) => void,
  ): Promise<string[]> {
    const hrefs = new Set<string>();
    let attempts = 0;
    while (hrefs.size < limit && attempts < 10) {
      const items = await page.$$eval('a.hfpxzc', (els) =>
        (els as HTMLAnchorElement[])
          .map((el) => el.getAttribute('href'))
          .filter((h): h is string => typeof h === 'string' && h.length > 0),
      );
      for (const href of items) hrefs.add(href);
      onScroll?.(attempts + 1, hrefs.size);
      if (hrefs.size >= limit) break;

      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollTop = feed.scrollHeight;
        else window.scrollBy(0, window.innerHeight);
      });
      await randomDelay(800, 1600);
      attempts += 1;
    }
    return Array.from(hrefs).slice(0, limit);
  }

  private async openAndExtract(page: Page, href: string): Promise<GoogleMapsResult | null> {
    await page.goto(withMapsEnglishParam(href), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForSelector('h1', { timeout: 15_000 }).catch(() => null);

    const data = await page.evaluate(() => {
      const text = (sel: string) => document.querySelector(sel)?.textContent?.trim() || '';
      const attr = (sel: string, name: string) => document.querySelector(sel)?.getAttribute(name) || '';

      const name = text('h1');
      const category = text('button[jsaction*="category"]') || text('button[aria-label*="category" i]');
      const address = attr('button[data-item-id="address"]', 'aria-label').replace(/^Address:\s*/i, '');
      const phone = attr('button[data-item-id^="phone:tel"]', 'aria-label').replace(/^Phone:\s*/i, '');
      const websiteAnchor = document.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement | null;
      const website = websiteAnchor?.href || '';
      const ratingStr = text('div.F7nice span[aria-hidden="true"]');
      const reviewStr = text('div.F7nice span[aria-label*="review" i]');

      return { name, category, address, phone, website, ratingStr, reviewStr };
    });

    if (!data.name) return null;

    const rating = parseFloat(data.ratingStr.replace(',', '.')) || undefined;
    const reviewCount =
      parseInt(data.reviewStr.replace(/[^\d]/g, ''), 10) || undefined;

    return {
      companyName: data.name,
      category: data.category || undefined,
      address: data.address || undefined,
      phone: data.phone || undefined,
      rating,
      reviewCount,
      websiteUrl: data.website || undefined,
      hasWebsite: Boolean(data.website),
    };
  }
}
