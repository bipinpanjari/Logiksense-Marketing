import { Injectable, Logger } from '@nestjs/common';
import type { Page } from 'playwright';
import { randomDelay } from './linkedin-browser';

export interface LinkedInProspect {
  profileUrl: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  location: string;
}

/**
 * LinkedIn Sales Navigator search. The selectors are best-effort for current
 * UI; LinkedIn rotates them often, so every prospect is still wrapped in a
 * try/catch and the caller handles empty results.
 */
@Injectable()
export class LinkedInSearchService {
  private readonly logger = new Logger(LinkedInSearchService.name);

  async searchSalesNav(
    page: Page,
    filters: { jobTitles?: string[]; industries?: string[]; location?: string; limit?: number },
  ): Promise<LinkedInProspect[]> {
    const limit = Math.max(1, Math.min(filters.limit || 10, 25));
    const query = [
      filters.jobTitles?.join(' OR '),
      filters.industries?.join(' OR '),
      filters.location,
    ]
      .filter(Boolean)
      .join(' ');

    try {
      const url = `https://www.linkedin.com/sales/search/people?query=${encodeURIComponent(query)}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomDelay(2000, 4000);
    } catch (err) {
      this.logger.warn(`sales-nav navigate failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }

    // Selector menu - try several known shapes; fail open to empty array.
    const cardSelectors = [
      '[data-test-id="search-result-item"]',
      'li.result-lockup',
      'li.artdeco-list__item',
    ];
    let cards = [] as any[];
    for (const sel of cardSelectors) {
      cards = await page.$$(sel);
      if (cards.length > 0) break;
    }
    if (cards.length === 0) {
      this.logger.warn('no search cards found - LinkedIn selectors may have changed');
      return [];
    }

    const prospects: LinkedInProspect[] = [];
    for (let i = 0; i < Math.min(cards.length, limit); i++) {
      try {
        const c = cards[i];
        const prospect = await c.evaluate((el: Element) => {
          const anchor = el.querySelector('a[href*="/in/"]') as HTMLAnchorElement | null;
          const profileUrl = anchor ? anchor.href : '';
          const name = (el.querySelector('[data-anonymize="person-name"]') || el.querySelector('[data-test-id="profile-name"]'))?.textContent?.trim() || '';
          const headline = (el.querySelector('[data-anonymize="headline"]') || el.querySelector('[data-test-id="profile-headline"]'))?.textContent?.trim() || '';
          const [jobTitle, company] = headline.split(/ at /i).map((s: string) => s.trim());
          const location = (el.querySelector('[data-anonymize="location"]') || el.querySelector('[data-test-id="profile-location"]'))?.textContent?.trim() || '';
          const [firstName, ...rest] = name.split(/\s+/);
          return { profileUrl, firstName: firstName || '', lastName: rest.join(' '), jobTitle: jobTitle || headline, company: company || '', location };
        });
        if (prospect.profileUrl) prospects.push(prospect);
        await randomDelay(300, 700);
      } catch (err) {
        this.logger.warn(`card extraction failed: ${err instanceof Error ? err.message : err}`);
      }
    }
    return prospects;
  }
}
