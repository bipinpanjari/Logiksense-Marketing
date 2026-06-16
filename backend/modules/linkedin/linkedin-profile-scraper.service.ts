import { Injectable, Logger } from '@nestjs/common';
import type { BrowserContext, Page } from 'playwright';
import { randomDelay } from './linkedin-browser';
import { EnrichmentService } from '../ai/enrichment.service';
import { getDatabase } from '../../shared/database';

export interface LinkedInEmployee {
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  profileUrl: string;
  email?: string;
}

@Injectable()
export class LinkedinProfileScraperService {
  private readonly logger = new Logger(LinkedinProfileScraperService.name);

  constructor(private readonly enrichment: EnrichmentService) {}

  /**
   * Main entry point to find and scrape employees for a company.
   */
  async findAndScrapeEmployees(
    context: BrowserContext,
    companyName: string,
    domain: string | null,
    options: { targetTitles?: string[]; limit?: number; workspaceId: string },
  ): Promise<LinkedInEmployee[]> {
    const limit = options.limit || 3;
    const page = await context.newPage();
    const employees: LinkedInEmployee[] = [];

    try {
      this.logger.log(`[linkedin] searching for employees of "${companyName}" (limit=${limit})`);
      
      // Step 1: Find profile URLs using Google Search (avoids LinkedIn search limits)
      const profileUrls = await this.searchProfilesOnGoogle(page, companyName, options.targetTitles);
      
      this.logger.log(`[linkedin] found ${profileUrls.length} potential profiles on Google`);

      // Step 2: Visit each profile and extract data
      for (const url of profileUrls.slice(0, limit)) {
        try {
          const profile = await this.scrapeProfile(page, url);
          if (profile) {
            // Step 3: Attempt to get email via EnrichmentService
            if (domain) {
              const enriched = await this.enrichment.enrichByDomain(options.workspaceId, domain, {
                // We could pass the person's name here if enrichment service supported it
              });
              // Note: Our current enrichment.enrichByDomain just finds SOMEONE at the company.
              // In a real implementation, we'd want to use a "person lookup" API by name + domain.
              // For now, we'll store what we find.
              if (enriched && enriched.email) {
                profile.email = enriched.email;
              }
            }
            employees.push(profile);
          }
          await randomDelay(2000, 5000);
        } catch (err: any) {
          this.logger.warn(`Failed to scrape profile ${url}: ${err.message}`);
        }
      }
    } finally {
      await page.close().catch(() => null);
    }

    return employees;
  }

  private async searchProfilesOnGoogle(
    page: Page,
    companyName: string,
    targetTitles?: string[],
  ): Promise<string[]> {
    const titleQuery = targetTitles?.length ? `(${targetTitles.join(' OR ')})` : '';
    const query = `site:linkedin.com/in "${companyName}" ${titleQuery}`.trim();
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // Extract LinkedIn URLs from search results
    const urls = await page.$$eval('a', (links) =>
      links
        .map((l) => (l as HTMLAnchorElement).href)
        .filter((href) => href.includes('linkedin.com/in/') && !href.includes('google.com/'))
    );

    return [...new Set(urls)];
  }

  private async scrapeProfile(page: Page, url: string): Promise<LinkedInEmployee | null> {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Simple extraction - LinkedIn structure changes often, this is best-effort
    const data = await page.evaluate(() => {
      const getText = (sel: string) => document.querySelector(sel)?.textContent?.trim() || '';
      
      const name = getText('h1') || getText('.text-heading-xlarge');
      const title = getText('.text-body-medium') || getText('.pv-text-details__left-panel div:nth-child(2)');
      
      return { name, title };
    });

    if (!data.name) return null;

    const [firstName, ...rest] = data.name.split(' ');
    const lastName = rest.join(' ');

    return {
      fullName: data.name,
      firstName,
      lastName,
      jobTitle: data.title,
      profileUrl: url,
    };
  }
}
