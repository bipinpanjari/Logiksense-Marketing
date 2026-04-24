import { Injectable, Logger } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { closeBrowser } from './linkedin-browser';
import { openLinkedInContext } from './linkedin-browser';
import { LinkedInLoginService } from './linkedin-login.service';
import { LinkedInSearchService } from './linkedin-search.service';
import { LinkedInMessagingService, DEFAULT_DM_SEQUENCE } from './linkedin-messaging.service';
import { checkAndIncrement } from './rate-limiter';

@Injectable()
export class LinkedInCampaignService {
  private readonly logger = new Logger(LinkedInCampaignService.name);

  constructor(
    private readonly login: LinkedInLoginService,
    private readonly search: LinkedInSearchService,
    private readonly messaging: LinkedInMessagingService,
  ) {}

  async runCampaign(campaignId: string): Promise<{ status: 'ok' | 'paused' | 'failed'; reason?: string; sent: number; discovered: number }> {
    const db = getDatabase();
    const campaignRes = await db.query(
      `SELECT c.*, a.id AS account_id, a.status AS account_status, a.email AS account_email
       FROM linkedin_campaigns c
       LEFT JOIN linkedin_accounts a ON a.id = c.linkedin_account_id
       WHERE c.id = $1`,
      [campaignId],
    );
    const campaign = campaignRes.rows[0];
    if (!campaign) return { status: 'failed', reason: 'campaign-not-found', sent: 0, discovered: 0 };
    if (campaign.status !== 'running') {
      return { status: 'paused', reason: `campaign-status=${campaign.status}`, sent: 0, discovered: 0 };
    }
    if (!campaign.account_id) {
      await this.setStatus(campaignId, 'paused', 'no-linkedin-account');
      return { status: 'paused', reason: 'no-linkedin-account', sent: 0, discovered: 0 };
    }
    if (process.env.LINKEDIN_KILL_SWITCH === 'true') {
      await this.setStatus(campaignId, 'paused', 'global-kill-switch');
      return { status: 'paused', reason: 'global-kill-switch', sent: 0, discovered: 0 };
    }

    const workspaceRes = await db.query(`SELECT linkedin_enabled FROM workspaces WHERE id = $1`, [campaign.workspace_id]);
    if (!workspaceRes.rows[0]?.linkedin_enabled) {
      await this.setStatus(campaignId, 'paused', 'workspace-not-enabled');
      return { status: 'paused', reason: 'workspace-not-enabled', sent: 0, discovered: 0 };
    }

    const started = Date.now();
    const setup = await openLinkedInContext(campaign.account_id);
    let sent = 0;
    let discovered = 0;
    try {
      const { page, success, requiresCaptcha } = await this.login.loginOrRestore(setup.context, campaign.account_id);
      if (!success) {
        await this.setStatus(
          campaignId,
          'paused',
          requiresCaptcha ? 'captcha-required' : 'login-failed',
        );
        return { status: 'paused', reason: requiresCaptcha ? 'captcha-required' : 'login-failed', sent: 0, discovered: 0 };
      }

      // 1) discover prospects via Sales Nav
      const inSalesNav = await this.login.navigateToSalesNav(page);
      if (inSalesNav) {
        const prospects = await this.search.searchSalesNav(page, {
          jobTitles: campaign.job_title_filter ? String(campaign.job_title_filter).split(',').map((s: string) => s.trim()) : undefined,
          industries: campaign.industry_filter ? String(campaign.industry_filter).split(',').map((s: string) => s.trim()) : undefined,
          location: campaign.location,
          limit: Math.min(campaign.max_per_day, 20),
        });
        discovered = prospects.length;
        for (const p of prospects) {
          await this.ensureSequence(campaign, p);
        }
      }

      // 2) send next step for sequences whose next_send_at <= now
      const pendingRes = await db.query(
        `SELECT * FROM linkedin_sequences
         WHERE campaign_id = $1
           AND status IN ('pending','sent')
           AND (next_send_at IS NULL OR next_send_at <= NOW())
         ORDER BY COALESCE(next_send_at, created_at) ASC
         LIMIT $2`,
        [campaignId, campaign.max_per_day],
      );

      const steps = this.resolveSteps(campaign);

      for (const seq of pendingRes.rows) {
        const nextStep = (seq.sequence_step || 0) + 1;
        if (nextStep > steps.length) {
          await db.query(
            `UPDATE linkedin_sequences SET status='completed', updated_at=CURRENT_TIMESTAMP WHERE id = $1`,
            [seq.id],
          );
          continue;
        }
        // rate limit (three-layer)
        const decision = await checkAndIncrement(campaign.account_id);
        if (!decision.allowed) {
          this.logger.warn(`rate limit hit account=${campaign.account_id} reason=${decision.reason}`);
          await this.setStatus(campaignId, 'paused', `rate-limit:${decision.reason}`);
          break;
        }

        const step = steps[nextStep - 1];
        const body = this.messaging.renderTemplate(step.message, {
          first_name: seq.first_name,
          last_name: seq.last_name,
          job_title: seq.job_title,
          company: seq.company,
          industry: seq.industry || campaign.industry_filter,
          recent_post: seq.recent_post,
        });

        const threadId = await this.messaging.openOrResumeThread(page, seq.profile_url, seq.thread_id);

        let status: 'sent' | 'failed' = 'failed';
        let error: string | null = null;
        try {
          const ok = await this.messaging.sendMessage(page, body);
          status = ok ? 'sent' : 'failed';
          if (!ok) error = 'send-failed';
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        }

        await db.query(
          `INSERT INTO linkedin_messages (workspace_id, campaign_id, sequence_id, linkedin_account_id,
                                           step_number, kind, status, personalisation_tag, body, error, sent_at)
           VALUES ($1, $2, $3, $4, $5, 'dm', $6, $7, $8, $9, CASE WHEN $6 = 'sent' THEN NOW() ELSE NULL END)`,
          [
            campaign.workspace_id,
            campaignId,
            seq.id,
            campaign.account_id,
            nextStep,
            status,
            step.tag,
            body,
            error,
          ],
        );

        if (status === 'sent') {
          sent += 1;
          const nextStepIndex = nextStep; // 1-based
          const nextDelayDays = steps[nextStepIndex]?.dayOffset;
          await db.query(
            `UPDATE linkedin_sequences
             SET sequence_step = $1,
                 status = CASE WHEN $1 >= $5 THEN 'completed' ELSE 'sent' END,
                 thread_id = COALESCE($2, thread_id),
                 last_action_at = NOW(),
                 next_send_at = CASE WHEN $3::int IS NULL THEN NULL ELSE NOW() + MAKE_INTERVAL(days => $3) END,
                 updated_at = NOW()
             WHERE id = $4`,
            [nextStep, threadId, nextDelayDays ?? null, seq.id, steps.length],
          );
        } else {
          await db.query(
            `UPDATE linkedin_sequences SET status='failed', updated_at=NOW() WHERE id = $1`,
            [seq.id],
          );
        }
      }

      await db.query(
        `UPDATE linkedin_campaigns SET last_run_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [campaignId],
      );
    } catch (err) {
      this.logger.error(`campaign run failed: ${err instanceof Error ? err.message : err}`);
      return { status: 'failed', reason: err instanceof Error ? err.message : 'unknown', sent, discovered };
    } finally {
      try {
        await closeBrowser(setup);
      } catch {
        // ignore
      }
    }

    this.logger.log(`linkedin campaign=${campaignId} sent=${sent} discovered=${discovered} in ${Date.now() - started}ms`);
    return { status: 'ok', sent, discovered };
  }

  private async ensureSequence(campaign: any, p: any) {
    const db = getDatabase();
    await db.query(
      `INSERT INTO linkedin_sequences (workspace_id, campaign_id, profile_url, first_name, last_name,
                                        job_title, company, location, industry, status, next_send_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
       ON CONFLICT (campaign_id, profile_url) DO NOTHING`,
      [
        campaign.workspace_id,
        campaign.id,
        p.profileUrl,
        p.firstName,
        p.lastName,
        p.jobTitle,
        p.company,
        p.location,
        campaign.industry_filter || null,
      ],
    );
  }

  private resolveSteps(campaign: any) {
    try {
      const raw = typeof campaign.messages === 'string' ? JSON.parse(campaign.messages) : campaign.messages;
      if (Array.isArray(raw) && raw.length > 0) {
        return raw.map((m: any, idx: number) => ({
          step: idx + 1,
          dayOffset: Number(m.dayOffset ?? (idx === 0 ? 1 : idx * 3)),
          message: String(m.message || m.body || ''),
          tag: String(m.tag || `step_${idx + 1}`),
        }));
      }
    } catch {
      // fall through to default
    }
    return DEFAULT_DM_SEQUENCE;
  }

  private async setStatus(id: string, status: string, reason?: string) {
    const db = getDatabase();
    await db.query(
      `UPDATE linkedin_campaigns SET status = $1, paused_reason = $2, updated_at = NOW() WHERE id = $3`,
      [status, reason || null, id],
    );
  }
}
