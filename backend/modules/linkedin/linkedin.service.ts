<<<<<<< Updated upstream
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
=======
import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
>>>>>>> Stashed changes
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { getDatabase } from '../../shared/database';
import { QUEUE_LINKEDIN_JOB, LinkedInJobPayload } from '../../shared/queue.tokens';
import { LinkedInAccountService } from './linkedin-account.service';

export interface CreateCampaignInput {
  name: string;
  linkedinAccountId?: string | null;
  jobTitleFilter?: string | null;
  industryFilter?: string | null;
  companySizeFilter?: string | null;
  seniorityFilter?: string | null;
  location?: string | null;
  maxPerDay?: number;
  messages?: any[];
}

@Injectable()
export class LinkedInService {
  private readonly logger = new Logger(LinkedInService.name);

  constructor(
<<<<<<< Updated upstream
    @InjectQueue(QUEUE_LINKEDIN_JOB) private readonly queue: Queue<LinkedInJobPayload>,
=======
    @Optional() @InjectQueue(QUEUE_LINKEDIN_JOB) private readonly queue: Queue<LinkedInJobPayload>,
>>>>>>> Stashed changes
    private readonly accounts: LinkedInAccountService,
  ) {}

  async listCampaigns(workspaceId: string) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT c.id, c.name, c.status, c.location, c.max_per_day,
              c.job_title_filter, c.industry_filter, c.linkedin_account_id,
              c.last_run_at, c.paused_reason, c.created_at, c.updated_at,
              a.email AS account_email, a.status AS account_status,
              (SELECT COUNT(*) FROM linkedin_sequences s WHERE s.campaign_id = c.id) AS sequence_count,
              (SELECT COUNT(*) FROM linkedin_messages m WHERE m.campaign_id = c.id AND m.status = 'sent') AS sent_count,
              (SELECT COUNT(*) FROM linkedin_sequences s WHERE s.campaign_id = c.id AND s.status = 'replied') AS reply_count
       FROM linkedin_campaigns c
       LEFT JOIN linkedin_accounts a ON a.id = c.linkedin_account_id
       WHERE c.workspace_id = $1::uuid
       ORDER BY c.updated_at DESC`,
      [workspaceId],
    );
    return res.rows;
  }

  async getCampaign(workspaceId: string, id: string) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT c.*, a.email AS account_email, a.status AS account_status
       FROM linkedin_campaigns c
       LEFT JOIN linkedin_accounts a ON a.id = c.linkedin_account_id
       WHERE c.id = $1::uuid AND c.workspace_id = $2::uuid`,
      [id, workspaceId],
    );
    if (res.rows.length === 0) throw new NotFoundException('campaign not found');

    const seq = await db.query(
      `SELECT id, first_name, last_name, job_title, company, location, status,
              sequence_step, next_send_at, last_action_at, reply_classification,
              created_at, updated_at
       FROM linkedin_sequences WHERE campaign_id = $1::uuid
       ORDER BY created_at DESC LIMIT 200`,
      [id],
    );

    const messages = await db.query(
      `SELECT id, sequence_id, step_number, kind, status, body, error, sent_at, created_at
       FROM linkedin_messages WHERE campaign_id = $1::uuid
       ORDER BY created_at DESC LIMIT 200`,
      [id],
    );
    return { campaign: res.rows[0], sequences: seq.rows, messages: messages.rows };
  }

  async createCampaign(workspaceId: string, customerId: string, input: CreateCampaignInput) {
    if (!input.name?.trim()) throw new BadRequestException('name required');
    await this.ensureEnabled(workspaceId);
    const db = getDatabase();
    const res = await db.query(
      `INSERT INTO linkedin_campaigns (workspace_id, customer_id, linkedin_account_id, name,
                                        job_title_filter, industry_filter, company_size_filter,
                                        seniority_filter, location, max_per_day, messages, status)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, 'draft')
       RETURNING *`,
      [
        workspaceId,
        customerId,
        input.linkedinAccountId || null,
        input.name.trim(),
        input.jobTitleFilter || null,
        input.industryFilter || null,
        input.companySizeFilter || null,
        input.seniorityFilter || null,
        input.location || null,
        input.maxPerDay ?? 20,
        JSON.stringify(input.messages || []),
      ],
    );
    return res.rows[0];
  }

  async updateCampaign(workspaceId: string, id: string, input: Partial<CreateCampaignInput>) {
    const db = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    const push = (col: string, val: any) => {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    };
    const pushUuid = (col: string, val: any) => {
      fields.push(`${col} = $${idx++}::uuid`);
      values.push(val);
    };
    if (typeof input.name === 'string') push('name', input.name.trim());
    if (typeof input.linkedinAccountId !== 'undefined') pushUuid('linkedin_account_id', input.linkedinAccountId || null);
    if (typeof input.jobTitleFilter !== 'undefined') push('job_title_filter', input.jobTitleFilter || null);
    if (typeof input.industryFilter !== 'undefined') push('industry_filter', input.industryFilter || null);
    if (typeof input.companySizeFilter !== 'undefined') push('company_size_filter', input.companySizeFilter || null);
    if (typeof input.seniorityFilter !== 'undefined') push('seniority_filter', input.seniorityFilter || null);
    if (typeof input.location !== 'undefined') push('location', input.location || null);
    if (typeof input.maxPerDay === 'number') push('max_per_day', input.maxPerDay);
    if (Array.isArray(input.messages)) {
      fields.push(`messages = $${idx++}::jsonb`);
      values.push(JSON.stringify(input.messages));
    }
    if (fields.length === 0) throw new BadRequestException('no updatable fields');
    values.push(id);
    values.push(workspaceId);
    const res = await db.query(
      `UPDATE linkedin_campaigns SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${idx}::uuid AND workspace_id = $${idx + 1}::uuid
       RETURNING *`,
      values,
    );
    if (res.rows.length === 0) throw new NotFoundException('campaign not found');
    return res.rows[0];
  }

  async startCampaign(workspaceId: string, id: string) {
    await this.ensureEnabled(workspaceId);
    const db = getDatabase();
    const res = await db.query(
      `UPDATE linkedin_campaigns SET status = 'running', paused_reason = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid AND workspace_id = $2::uuid
       RETURNING id, linkedin_account_id`,
      [id, workspaceId],
    );
    if (res.rows.length === 0) throw new NotFoundException('campaign not found');
    if (!res.rows[0].linkedin_account_id) {
      throw new BadRequestException('Attach a LinkedIn account before running this campaign');
    }
    const job = await this.queue.add(
      `li-campaign-${id}`,
      { campaignId: id, workspaceId, linkedinAccountId: res.rows[0].linkedin_account_id },
      { attempts: 2, backoff: { type: 'exponential', delay: 60_000 } },
    );
    return { ok: true, jobId: String(job.id) };
  }

  async pauseCampaign(workspaceId: string, id: string, reason?: string) {
    const db = getDatabase();
    const res = await db.query(
      `UPDATE linkedin_campaigns SET status = 'paused', paused_reason = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2::uuid AND workspace_id = $3::uuid
       RETURNING id`,
      [reason || 'manual', id, workspaceId],
    );
    if (res.rows.length === 0) throw new NotFoundException('campaign not found');
    return { ok: true };
  }

  async deleteCampaign(workspaceId: string, id: string) {
    const db = getDatabase();
    await db.query(`DELETE FROM linkedin_campaigns WHERE id = $1::uuid AND workspace_id = $2::uuid`, [id, workspaceId]);
    return { ok: true };
  }

  private async ensureEnabled(workspaceId: string) {
    if (process.env.LINKEDIN_KILL_SWITCH === 'true') {
      throw new BadRequestException('LinkedIn automation is globally disabled by operator kill-switch');
    }
    const db = getDatabase();
    const res = await db.query(`SELECT linkedin_enabled FROM workspaces WHERE id = $1::uuid`, [workspaceId]);
    if (!res.rows[0]?.linkedin_enabled) {
      throw new BadRequestException('LinkedIn automation is not enabled for this workspace. Accept the ToS first.');
    }
  }
}
