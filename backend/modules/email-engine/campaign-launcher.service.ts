<<<<<<< Updated upstream
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
=======
import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
>>>>>>> Stashed changes
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { getDatabase } from '../../shared/database';
import { EmailSendJobPayload, QUEUE_EMAIL_SEND } from '../../shared/queue.tokens';
import { PipelineService } from '../pipeline/pipeline.service';

interface LaunchResult {
  campaignId: string;
  launchedAt: string;
  queued: number;
  skipped: number;
  audience: number;
}

@Injectable()
export class CampaignLauncherService {
  private readonly logger = new Logger(CampaignLauncherService.name);

  constructor(
<<<<<<< Updated upstream
    @InjectQueue(QUEUE_EMAIL_SEND) private readonly emailQueue: Queue<EmailSendJobPayload>,
=======
    @Optional() @InjectQueue(QUEUE_EMAIL_SEND) private readonly emailQueue: Queue<EmailSendJobPayload>,
>>>>>>> Stashed changes
    private readonly pipeline: PipelineService,
  ) {}

  async launchCampaign(workspaceId: string, customerId: string, campaignId: string): Promise<LaunchResult> {
    const db = getDatabase();

    const cRes = await db.query(
      `SELECT id, workspace_id, customer_id, status, template_id, segment_id, scheduled_at
       FROM email_campaigns WHERE id = $1`,
      [campaignId],
    );
    if (cRes.rows.length === 0) throw new NotFoundException('Campaign not found');
    const c = cRes.rows[0];
    if (c.workspace_id !== workspaceId) {
      throw new BadRequestException('Campaign does not belong to workspace');
    }
    if (!c.template_id) {
      throw new BadRequestException('Campaign has no template attached');
    }
    if (c.status === 'running' || c.status === 'sent') {
      throw new BadRequestException(`Campaign already ${c.status}`);
    }

    const leads = await this.resolveAudience(workspaceId, c.segment_id);
    if (leads.length === 0) {
      throw new BadRequestException('Campaign audience is empty');
    }

    await db.query(
      `UPDATE email_campaigns
       SET status = 'running', launched_at = CURRENT_TIMESTAMP, audience_count = $1,
           sent_count = 0, opened_count = 0, clicked_count = 0, bounced_count = 0, unsubscribed_count = 0,
           error = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [leads.length, campaignId],
    );

    let queued = 0;
    let skipped = 0;
    const jitterBaseMs = parseInt(process.env.CAMPAIGN_SEND_JITTER_MS || '2000', 10);
    for (const leadId of leads) {
      try {
        await this.emailQueue.add(
          `camp-${campaignId}-lead-${leadId}`,
          {
            workspaceId,
            customerId,
            leadId,
            templateId: c.template_id,
            campaignId,
          },
          {
            delay: Math.floor(Math.random() * jitterBaseMs),
          },
        );
        queued += 1;
        try {
          await this.pipeline.recordEvent(workspaceId, leadId, 'queued', {
            at: new Date().toISOString(),
            type: 'queued',
            data: { campaignId },
          });
        } catch {
          // best effort
        }
      } catch (err) {
        this.logger.error(`failed to enqueue campaign send for lead=${leadId}: ${err}`);
        skipped += 1;
      }
    }

    return {
      campaignId,
      launchedAt: new Date().toISOString(),
      queued,
      skipped,
      audience: leads.length,
    };
  }

  async pauseCampaign(workspaceId: string, campaignId: string) {
    const db = getDatabase();
    await db.query(
      `UPDATE email_campaigns SET status = 'paused', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND workspace_id = $2`,
      [campaignId, workspaceId],
    );
    // Queued jobs keep their state; the worker checks campaign status before sending.
    return { ok: true };
  }

  private async resolveAudience(workspaceId: string, segmentId: string | null): Promise<string[]> {
    const db = getDatabase();
    if (segmentId) {
      const r = await db.query(
        `SELECT l.id
         FROM leads l
         JOIN segment_members sm ON sm.lead_id = l.id
         WHERE sm.segment_id = $1
           AND l.workspace_id = $2
           AND COALESCE(l.is_unsubscribed, false) = false
           AND COALESCE(l.is_suppressed, false) = false`,
        [segmentId, workspaceId],
      );
      return r.rows.map((x) => x.id);
    }
    const r = await db.query(
      `SELECT id FROM leads
       WHERE workspace_id = $1
         AND COALESCE(is_unsubscribed, false) = false
         AND COALESCE(is_suppressed, false) = false`,
      [workspaceId],
    );
    return r.rows.map((x) => x.id);
  }
}
