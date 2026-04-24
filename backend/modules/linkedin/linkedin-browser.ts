import type { BrowserContext, Page } from 'playwright';
import { setupBrowser, randomDelay, closeBrowser } from '../scraper/utils/browser-config';

/**
 * Thin wrapper so LinkedIn services don't import Playwright directly. Keeps
 * the persistent session dir scoped per account so sessions don't leak across
 * workspaces.
 */
export async function openLinkedInContext(accountId: string, proxy?: string) {
  return setupBrowser({
    headless: process.env.LINKEDIN_HEADLESS !== 'false',
    persistentDir: `.playwright-sessions/linkedin/${accountId}`,
    proxy,
  });
}

export { randomDelay, closeBrowser };
export type { BrowserContext, Page };
