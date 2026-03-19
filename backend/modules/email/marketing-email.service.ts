import { BadRequestException, Injectable } from '@nestjs/common';
import { getDatabase } from '../../shared/database';

type SequenceStep = {
  id: number | string;
  name: string;
  delayHours: number;
  subject?: string;
};

@Injectable()
export class MarketingEmailService {
  async listCampaigns(
    workspaceId: string,
    filters?: { from?: string; to?: string; status?: string }
  ) {
    const db = getDatabase();
    const values: any[] = [workspaceId];
    let idx = 2;
    const clauses = [`workspace_id = $1`];

    if (filters?.status?.trim()) {
      clauses.push(`status = $${idx++}`);
      values.push(filters.status.trim().toLowerCase());
    }
    if (filters?.from) {
      clauses.push(`COALESCE(scheduled_at, launched_at, created_at) >= $${idx++}`);
      values.push(new Date(filters.from));
    }
    if (filters?.to) {
      clauses.push(`COALESCE(scheduled_at, launched_at, created_at) <= $${idx++}`);
      values.push(new Date(filters.to));
    }

    const result = await db.query(
      `SELECT id, name, status, audience_count, open_rate, click_rate, scheduled_at, launched_at, created_at, updated_at
       FROM email_campaigns
       WHERE ${clauses.join(' AND ')}
       ORDER BY COALESCE(scheduled_at, launched_at, created_at) DESC`,
      values
    );
    return result.rows;
  }

  async createCampaign(workspaceId: string, customerId: string, payload: { name: string; status?: string; audienceCount?: number; scheduledAt?: string }) {
    if (!payload?.name?.trim()) {
      throw new BadRequestException('Campaign name is required');
    }
    const db = getDatabase();
    const result = await db.query(
      `INSERT INTO email_campaigns (workspace_id, customer_id, name, status, audience_count, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, status, audience_count, open_rate, click_rate, scheduled_at, created_at, updated_at`,
      [
        workspaceId,
        customerId,
        payload.name.trim(),
        payload.status || 'draft',
        payload.audienceCount ?? 0,
        payload.scheduledAt ? new Date(payload.scheduledAt) : null,
      ]
    );
    return result.rows[0];
  }

  async updateCampaign(
    workspaceId: string,
    customerId: string,
    campaignId: string,
    payload: { name?: string; status?: string; audienceCount?: number; scheduledAt?: string | null }
  ) {
    const db = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (typeof payload.name === 'string') {
      fields.push(`name = $${idx++}`);
      values.push(payload.name.trim());
    }
    if (typeof payload.status === 'string') {
      fields.push(`status = $${idx++}`);
      values.push(payload.status.trim().toLowerCase());
    }
    if (typeof payload.audienceCount === 'number') {
      fields.push(`audience_count = $${idx++}`);
      values.push(payload.audienceCount);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'scheduledAt')) {
      fields.push(`scheduled_at = $${idx++}`);
      values.push(payload.scheduledAt ? new Date(payload.scheduledAt) : null);
    }
    if (fields.length === 0) {
      throw new BadRequestException('No fields provided for update');
    }

    values.push(campaignId);
    values.push(workspaceId);
    values.push(customerId);

    const result = await db.query(
      `UPDATE email_campaigns
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${idx++} AND workspace_id = $${idx++} AND customer_id = $${idx}
       RETURNING id, name, status, audience_count, open_rate, click_rate, scheduled_at, launched_at, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      throw new BadRequestException('Campaign not found');
    }
    return result.rows[0];
  }

  async getCalendar(workspaceId: string, days = 7) {
    const db = getDatabase();
    const safeDays = Number.isFinite(days) && days > 0 && days <= 31 ? days : 7;
    const result = await db.query(
      `SELECT
         DATE(COALESCE(launched_at, scheduled_at, created_at)) AS day,
         COUNT(*)::int AS campaigns,
         COALESCE(SUM(audience_count), 0)::int AS audience
       FROM email_campaigns
       WHERE workspace_id = $1
         AND COALESCE(launched_at, scheduled_at, created_at) >= NOW() - ($2::text || ' days')::interval
       GROUP BY 1
       ORDER BY 1 DESC`,
      [workspaceId, safeDays]
    );
    return result.rows;
  }

  async listTemplates(workspaceId: string) {
    const db = getDatabase();
    const result = await db.query(
      `SELECT id, name, subject, body_html, body_text, category, created_at, updated_at
       FROM email_templates
       WHERE workspace_id = $1 AND is_active = true
       ORDER BY updated_at DESC`,
      [workspaceId]
    );
    return result.rows;
  }

  async createTemplate(
    workspaceId: string,
    customerId: string,
    payload: { name: string; subject: string; bodyHtml: string; bodyText?: string; category?: string }
  ) {
    if (!payload?.name?.trim() || !payload?.subject?.trim() || !payload?.bodyHtml?.trim()) {
      throw new BadRequestException('name, subject and bodyHtml are required');
    }
    const db = getDatabase();
    const result = await db.query(
      `INSERT INTO email_templates (workspace_id, customer_id, name, subject, body_html, body_text, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, subject, body_html, body_text, category, created_at, updated_at`,
      [
        workspaceId,
        customerId,
        payload.name.trim(),
        payload.subject.trim(),
        payload.bodyHtml,
        payload.bodyText || null,
        payload.category || null,
      ]
    );
    return result.rows[0];
  }

  async listSequences(workspaceId: string) {
    const db = getDatabase();
    const result = await db.query(
      `SELECT id, name, description, status, steps, created_at, updated_at
       FROM email_sequences
       WHERE workspace_id = $1 AND is_active = true
       ORDER BY updated_at DESC`,
      [workspaceId]
    );
    return result.rows.map((row) => ({
      ...row,
      active_leads: 0,
    }));
  }

  async createSequence(
    workspaceId: string,
    customerId: string,
    payload: { name: string; description?: string; status?: string; steps: SequenceStep[] }
  ) {
    if (!payload?.name?.trim()) {
      throw new BadRequestException('Sequence name is required');
    }
    if (!Array.isArray(payload?.steps) || payload.steps.length === 0) {
      throw new BadRequestException('At least one step is required');
    }
    const db = getDatabase();
    const result = await db.query(
      `INSERT INTO email_sequences (workspace_id, customer_id, name, description, status, steps)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, status, steps, created_at, updated_at`,
      [
        workspaceId,
        customerId,
        payload.name.trim(),
        payload.description || null,
        payload.status || 'draft',
        JSON.stringify(payload.steps),
      ]
    );
    return result.rows[0];
  }
}

