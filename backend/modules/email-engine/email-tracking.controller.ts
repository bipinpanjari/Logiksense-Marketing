import { Body, Controller, Get, Headers, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getDatabase } from '../../shared/database';
import { UnsubscribeService } from './unsubscribe.service';
import { PipelineService } from '../pipeline/pipeline.service';

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

@Controller('api')
export class EmailTrackingController {
  constructor(
    private readonly unsub: UnsubscribeService,
    private readonly pipeline: PipelineService,
  ) {}

  @Get('track/open/:token.gif')
  async trackOpen(@Param('token') token: string, @Res() res: Response) {
    await this.recordOpen(token);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.send(PIXEL);
  }

  @Get('track/click/:token')
  async trackClick(
    @Param('token') token: string,
    @Query('u') url: string,
    @Res() res: Response,
  ) {
    await this.recordClick(token, url);
    const target = this.safeRedirectTarget(url);
    res.redirect(302, target);
  }

  @Get('unsubscribe/:token')
  async unsubscribeGet(@Param('token') token: string, @Res() res: Response) {
    const result = await this.unsub.honorToken(token);
    if (!result.ok) {
      res.status(404).send(this.renderUnsubPage('Invalid or expired link'));
      return;
    }
    await this.emitUnsubscribedEvent(result);
    res.status(200).send(this.renderUnsubPage("You've been unsubscribed."));
  }

  @Post('unsubscribe/:token')
  async unsubscribePost(@Param('token') token: string, @Res() res: Response) {
    const result = await this.unsub.honorToken(token);
    if (result.ok) await this.emitUnsubscribedEvent(result);
    res.status(200).json({ ok: true });
  }

  private async emitUnsubscribedEvent(result: { workspaceId?: string; leadId?: string; email?: string }) {
    if (!result.workspaceId || !result.leadId) return;
    try {
      await this.pipeline.recordEvent(result.workspaceId, result.leadId, 'unsubscribed', {
        at: new Date().toISOString(),
        type: 'unsubscribed',
        data: { source: 'unsubscribe_link', email: result.email },
      });
    } catch {
      // best effort
    }
  }

  /**
   * Generic bounce webhook endpoint. Accepts a small schema:
   *   { messageId: string, type: "hard"|"soft"|"complaint", description?: string }
   * Integrations (SES/Postmark/SendGrid) should be mapped into this shape by a
   * small provider-specific handler in front of this endpoint.
   */
  @Post('webhooks/bounces')
  async bounceWebhook(
    @Headers('x-signature') signature: string | undefined,
    @Body() body: any,
  ) {
    const expectedSecret = process.env.BOUNCE_WEBHOOK_SECRET;
    if (expectedSecret && signature !== expectedSecret) {
      return { ok: false, reason: 'invalid-signature' };
    }

    const messageId = body?.messageId;
    const type = (body?.type as 'hard' | 'soft' | 'complaint') || 'hard';
    const description = (body?.description as string) || '';
    if (!messageId) return { ok: false, reason: 'missing-messageId' };

    const db = getDatabase();
    const logRes = await db.query(
      `SELECT id, workspace_id, lead_id, campaign_id FROM email_logs WHERE message_id = $1 LIMIT 1`,
      [messageId],
    );
    if (logRes.rows.length === 0) return { ok: false, reason: 'log-not-found' };
    const log = logRes.rows[0];

    await db.query(
      `UPDATE email_logs
       SET status = 'bounced', bounced_at = CURRENT_TIMESTAMP,
           bounce_reason = $1
       WHERE id = $2`,
      [`${type}:${description}`.slice(0, 4000), log.id],
    );

    await db.query(
      `UPDATE email_analytics
       SET email_bounced = true, bounced = true, bounce_type = $1, updated_at = CURRENT_TIMESTAMP
       WHERE lead_id = $2 AND campaign_id IS NOT DISTINCT FROM $3`,
      [type, log.lead_id, log.campaign_id],
    );

    if (type === 'hard' || type === 'complaint') {
      await db.query(
        `UPDATE leads SET is_suppressed = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [log.lead_id],
      );
      const emailRes = await db.query(`SELECT email FROM leads WHERE id = $1`, [log.lead_id]);
      const email = emailRes.rows[0]?.email;
      if (email) {
        await db.query(
          `INSERT INTO email_suppressions (workspace_id, email, reason, source_lead_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (workspace_id, email) DO NOTHING`,
          [log.workspace_id, email.toLowerCase(), type === 'complaint' ? 'complaint' : 'bounce', log.lead_id],
        );
      }
    }

    if (log.campaign_id) {
      await db.query(
        `UPDATE email_campaigns SET bounced_count = bounced_count + 1 WHERE id = $1`,
        [log.campaign_id],
      );
    }

    try {
      await this.pipeline.recordEvent(log.workspace_id, log.lead_id, 'bounced', {
        at: new Date().toISOString(),
        type: 'bounced',
        data: { logId: log.id, type, description, messageId },
      });
    } catch {
      // best effort
    }

    return { ok: true };
  }

  private async recordOpen(token: string) {
    const db = getDatabase();
    const r = await db.query(
      `UPDATE email_logs
       SET opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP)
       WHERE tracking_token = $1
       RETURNING id, workspace_id, lead_id, campaign_id, opened_at`,
      [token],
    );
    if (r.rows.length === 0) return;
    const log = r.rows[0];

    await db.query(
      `UPDATE email_analytics
       SET email_opened_at = COALESCE(email_opened_at, CURRENT_TIMESTAMP),
           opened_count = opened_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE lead_id = $1 AND campaign_id IS NOT DISTINCT FROM $2`,
      [log.lead_id, log.campaign_id],
    );

    if (log.campaign_id) {
      await db.query(
        `UPDATE email_campaigns SET opened_count = opened_count + 1 WHERE id = $1`,
        [log.campaign_id],
      );
    }

    try {
      await this.pipeline.recordEvent(log.workspace_id, log.lead_id, 'opened', {
        at: new Date().toISOString(),
        type: 'opened',
        data: { logId: log.id, campaignId: log.campaign_id ?? null },
      });
    } catch {
      // tracking must never block the pixel response
    }
  }

  private async recordClick(token: string, url: string) {
    const db = getDatabase();
    const r = await db.query(
      `UPDATE email_logs
       SET clicked_at = COALESCE(clicked_at, CURRENT_TIMESTAMP),
           opened_at  = COALESCE(opened_at, CURRENT_TIMESTAMP)
       WHERE tracking_token = $1
       RETURNING id, workspace_id, lead_id, campaign_id`,
      [token],
    );
    if (r.rows.length === 0) return;
    const log = r.rows[0];

    await db.query(
      `UPDATE email_analytics
       SET email_clicked_at = COALESCE(email_clicked_at, CURRENT_TIMESTAMP),
           click_count = click_count + 1,
           clicked_url = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE lead_id = $1 AND campaign_id IS NOT DISTINCT FROM $3`,
      [log.lead_id, url?.slice(0, 1024) ?? null, log.campaign_id],
    );

    if (log.campaign_id) {
      await db.query(
        `UPDATE email_campaigns SET clicked_count = clicked_count + 1 WHERE id = $1`,
        [log.campaign_id],
      );
    }

    try {
      await this.pipeline.recordEvent(log.workspace_id, log.lead_id, 'clicked', {
        at: new Date().toISOString(),
        type: 'clicked',
        data: { logId: log.id, url: url?.slice(0, 1024) ?? null, campaignId: log.campaign_id ?? null },
      });
    } catch {
      // tracking must never block the redirect
    }
  }

  private safeRedirectTarget(url: string | undefined): string {
    if (!url) return process.env.FRONTEND_URL || 'https://logik-sense.com';
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol');
      return u.toString();
    } catch {
      return process.env.FRONTEND_URL || 'https://logik-sense.com';
    }
  }

  private renderUnsubPage(body: string): string {
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Unsubscribe</title></head>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:80px auto;padding:0 24px;color:#111;">
  <h1 style="font-size:24px;margin-bottom:8px;">Logik Sense</h1>
  <p style="color:#444;">${body}</p>
</body></html>`;
  }
}
