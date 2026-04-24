import { Browser, BrowserContext, chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const LAUNCH_TIMEOUT_MS = Math.max(
  15_000,
  parseInt(process.env.PLAYWRIGHT_BROWSER_TIMEOUT_MS || '120000', 10),
);

const CHROMIUM_ARGS: string[] = ['--disable-dev-shm-usage'];
if (process.env.SCRAPER_CHROMIUM_NO_SANDBOX === 'true' || process.env.CI) {
  CHROMIUM_ARGS.push('--no-sandbox', '--disable-setuid-sandbox');
}

const BROWSER_LOCALE = (process.env.SCRAPER_BROWSER_LOCALE || 'en-US').trim() || 'en-US';
const ACCEPT_LANG =
  process.env.SCRAPER_ACCEPT_LANGUAGE?.trim() || `${BROWSER_LOCALE},en;q=0.8`;

function contextLanguageOptions() {
  return {
    locale: BROWSER_LOCALE,
    extraHTTPHeaders: { 'Accept-Language': ACCEPT_LANG },
  };
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
];

export interface BrowserSetup {
  browser: Browser | null;
  context: BrowserContext;
}

/**
 * Create a Playwright browser context. If a persistent dir is requested, the
 * session (cookies, localStorage) survives restarts — useful for LinkedIn, but
 * we keep scraper contexts ephemeral by default to avoid cross-workspace leaks.
 */
export async function setupBrowser(options?: {
  headless?: boolean;
  persistentDir?: string;
  proxy?: string;
}): Promise<BrowserSetup> {
  const headless = options?.headless ?? true;
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const proxy = options?.proxy ? { server: options.proxy } : undefined;

  if (options?.persistentDir) {
    if (!fs.existsSync(options.persistentDir)) {
      fs.mkdirSync(options.persistentDir, { recursive: true });
    }
    const context = await chromium.launchPersistentContext(options.persistentDir, {
      headless,
      viewport: { width: 1280, height: 800 },
      userAgent,
      proxy,
      timeout: LAUNCH_TIMEOUT_MS,
      args: CHROMIUM_ARGS,
      ...contextLanguageOptions(),
    });
    return { browser: null, context };
  }

  const browser = await withLaunchGuard(
    chromium.launch({
      headless,
      proxy,
      timeout: LAUNCH_TIMEOUT_MS,
      args: CHROMIUM_ARGS,
    }),
  );
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent,
    ...contextLanguageOptions(),
  });
  return { browser, context };
}

/**
 * Harden: some environments ignore Playwright’s own launch `timeout` and hang forever.
 */
async function withLaunchGuard<T>(launchPromise: Promise<T>): Promise<T> {
  const max = LAUNCH_TIMEOUT_MS + 10_000;
  let t: ReturnType<typeof setTimeout> | undefined;
  const err = new Error(
    `Chromium did not start within ${Math.round(LAUNCH_TIMEOUT_MS / 1000)}s. From the backend directory run: npx playwright install chromium (or npx playwright install --with-deps). On Linux in Docker, try SCRAPER_CHROMIUM_NO_SANDBOX=true.`,
  );
  const timeoutP = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(err), max);
  });
  try {
    return await Promise.race([launchPromise, timeoutP]);
  } finally {
    if (t) clearTimeout(t);
  }
}

export function defaultPersistentDir(scope: string): string {
  const base = process.env.BROWSER_DATA_DIR || path.join(process.cwd(), '.browser-data');
  return path.join(base, scope);
}

export async function closeBrowser(setup: BrowserSetup) {
  try {
    if (setup.browser) {
      await setup.browser.close();
    } else {
      await setup.context.close();
    }
  } catch {
    // ignore close errors
  }
}

export function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((resolve) => setTimeout(resolve, ms));
}
