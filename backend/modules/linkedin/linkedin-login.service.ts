import { Injectable, Logger } from '@nestjs/common';
import type { BrowserContext, Page } from 'playwright';
import { getDatabase } from '../../shared/database';
import { VaultService } from '../../shared/vault.service';
import { randomDelay } from './linkedin-browser';

/**
 * LinkedIn session/login service. Prefers stored session cookies from the
 * vault; falls back to a fresh login only if the caller supplied a one-time
 * password (the password is never persisted in the browser - the vault
 * releases it server-side just for this action).
 */
@Injectable()
export class LinkedInLoginService {
  private readonly logger = new Logger(LinkedInLoginService.name);
  constructor(private readonly vault: VaultService) {}

  async loginOrRestore(context: BrowserContext, accountId: string, oneTimePassword?: string): Promise<{ page: Page; success: boolean; requiresCaptcha?: boolean }> {
    const db = getDatabase();
    const res = await db.query(
      `SELECT id, email, status, password_vault_ref, session_vault_ref, workspace_id
       FROM linkedin_accounts WHERE id = $1::uuid`,
      [accountId],
    );
    const row = res.rows[0];
    if (!row) throw new Error(`LinkedIn account ${accountId} not found`);
    if (row.status !== 'active') throw new Error(`LinkedIn account status=${row.status} - cannot login`);

    const page = await context.newPage();

    // 1) try restoring session
    if (row.session_vault_ref) {
      try {
        const sessionJson = await this.vault.get({
          scope: 'linkedin_session',
          refKey: row.session_vault_ref,
          workspaceId: row.workspace_id,
        });
        if (sessionJson) {
          const cookies = JSON.parse(sessionJson);
          await context.addCookies(cookies);
          await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
          const loggedIn = await page.evaluate(() => {
            return !!document.querySelector('[aria-label="Home"]') || document.title.toLowerCase().includes('feed');
          });
          if (loggedIn) {
            this.logger.log(`restored linkedin session for account=${accountId}`);
            return { page, success: true };
          }
        }
      } catch (err) {
        this.logger.warn(`session restore failed for account=${accountId}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // 2) fresh login
    const password =
      oneTimePassword ||
      (row.password_vault_ref
        ? await this.vault.get({
            scope: 'linkedin_password',
            refKey: row.password_vault_ref,
            workspaceId: row.workspace_id,
          })
        : null);
    if (!password) throw new Error('No stored credentials. Pair the account with a password first.');

    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="session_key"]', row.email);
    await randomDelay(400, 900);
    await page.fill('input[name="session_password"]', password);
    await randomDelay(400, 900);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => null);

    const hasCaptcha = await page.evaluate(() => {
      return !!document.querySelector('iframe[title*="reCAPTCHA"]') || !!document.querySelector('[data-challenge-element]');
    });
    if (hasCaptcha) {
      await this.markAccount(accountId, 'captcha_required', 'CAPTCHA challenge required');
      return { page, success: false, requiresCaptcha: true };
    }

    const success = await page.evaluate(() => {
      return !!document.querySelector('[aria-label="Home"]') || window.location.href.includes('/feed');
    });
    if (!success) {
      await this.markAccount(accountId, 'blocked', 'Login failed');
      return { page, success: false };
    }

    // persist fresh session cookies
    try {
      const cookies = await context.cookies();
      const refKey = `account:${accountId}`;
      await this.vault.put({
        scope: 'linkedin_session',
        refKey,
        workspaceId: row.workspace_id,
        value: JSON.stringify(cookies),
      });
      await db.query(
        `UPDATE linkedin_accounts SET session_vault_ref = $1, last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid`,
        [refKey, accountId],
      );
    } catch (err) {
      this.logger.warn(`failed to persist session for account=${accountId}: ${err instanceof Error ? err.message : err}`);
    }

    return { page, success: true };
  }

  async navigateToSalesNav(page: Page): Promise<boolean> {
    try {
      await page.goto('https://www.linkedin.com/sales/search/people', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await randomDelay(1500, 3000);
      return page.url().includes('/sales/');
    } catch (err) {
      this.logger.warn(`navigateToSalesNav failed: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  private async markAccount(accountId: string, status: string, error?: string) {
    const db = getDatabase();
    await db.query(
      `UPDATE linkedin_accounts SET status = $1, last_error = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3::uuid`,
      [status, error || null, accountId],
    );
  }
}
