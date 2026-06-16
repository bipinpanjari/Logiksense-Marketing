import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { getDatabase } from '../../shared/database';

export type PipelineStage =
  | 'new'
  | 'queued'
  | 'sent'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced'
  | 'unsubscribed';

export const STAGE_ORDER: PipelineStage[] = [
  'new',
  'queued',
  'sent',
  'opened',
  'clicked',
  'replied',
  'bounced',
  'unsubscribed',
];

// Stages "flow forward" (e.g. opened -> clicked) but never regress. `bounced`
// and `unsubscribed` are terminal and can be set from any prior stage.
const FORWARD_RANK: Record<PipelineStage, number> = {
  new: 0,
  queued: 1,
  sent: 2,
  opened: 3,
  clicked: 4,
  replied: 5,
  bounced: 99,
  unsubscribed: 99,
};

export interface TimelineEvent {
  at: string;
  type:
    | 'queued'
    | 'sent'
    | 'opened'
    | 'clicked'
    | 'replied'
    | 'bounced'
    | 'unsubscribed'
    | 'note'
<<<<<<< Updated upstream
    | 'stage_change';
=======
    | 'stage_change'
    | 'linkedin_message';
>>>>>>> Stashed changes
  data?: Record<string, unknown>;
}

/**
 * PipelineService is the single writer for `leads.pipeline_stage` and
 * `contacts.timeline`. Every transition is safe to call multiple times -
 * stage_change events are idempotent and only recorded when the stage actually
 * moves forward. Callers (email dispatcher, tracking, replies, bounces) hand
 * off by lead_id + event; they never UPDATE leads directly.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  async recordEvent(
    workspaceId: string,
    leadId: string,
    stage: PipelineStage,
    event: TimelineEvent,
  ): Promise<void> {
    const db = getDatabase();
    const current = await db.query(
      `SELECT pipeline_stage FROM leads WHERE id = $1 AND workspace_id = $2`,
      [leadId, workspaceId],
    );
    if (current.rows.length === 0) return;
    const prev = (current.rows[0].pipeline_stage as PipelineStage) ?? 'new';

    const shouldAdvance =
      stage === 'bounced' ||
      stage === 'unsubscribed' ||
      FORWARD_RANK[stage] > FORWARD_RANK[prev];

    if (shouldAdvance) {
      const setClauses = [`pipeline_stage = $1`, `pipeline_stage_updated_at = CURRENT_TIMESTAMP`];
      const params: any[] = [stage];
      if (stage === 'sent' || stage === 'opened' || stage === 'clicked') {
        setClauses.push(`last_contacted_at = COALESCE(last_contacted_at, CURRENT_TIMESTAMP)`);
      }
      if (stage === 'replied') {
        setClauses.push(`last_replied_at = CURRENT_TIMESTAMP`);
        setClauses.push(`reply_count = reply_count + 1`);
      }
      params.push(leadId, workspaceId);
      await db.query(
        `UPDATE leads SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${params.length - 1} AND workspace_id = $${params.length}`,
        params,
      );
      await this.appendTimeline(workspaceId, leadId, {
        at: new Date().toISOString(),
        type: 'stage_change',
        data: { from: prev, to: stage },
      });
    }

    await this.appendTimeline(workspaceId, leadId, event);
  }

  async appendTimeline(workspaceId: string, leadId: string, event: TimelineEvent): Promise<void> {
    const db = getDatabase();
    await db.query(
      `INSERT INTO contacts (workspace_id, lead_id, timeline, last_activity_at)
       VALUES ($1, $2, jsonb_build_array($3::jsonb), CURRENT_TIMESTAMP)
       ON CONFLICT (workspace_id, lead_id)
       DO UPDATE SET
         timeline = contacts.timeline || $3::jsonb,
         last_activity_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [workspaceId, leadId, JSON.stringify(event)],
    );
  }

  async listByStage(workspaceId: string, stage: PipelineStage, limit = 200) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT l.id, l.first_name, l.last_name, l.email, l.company, l.job_title, l.phone, l.city, l.country,
              l.pipeline_stage, l.pipeline_stage_updated_at, l.last_contacted_at, l.last_replied_at, l.reply_count,
              l.lead_score, l.icebreaker, l.email_validation_status, l.enrichment,
              si.business_name AS scraper_business_name,
              si.category AS scraper_category,
              si.website_url AS scraper_website_url,
              si.phone AS scraper_item_phone,
              si.rating AS scraper_rating,
              si.review_count AS scraper_review_count,
              si.emails AS scraper_emails,
              si.phones AS scraper_phones,
              si.business_profile AS scraper_business_profile
       FROM leads l
       LEFT JOIN LATERAL (
         SELECT business_name, category, website_url, phone, rating, review_count, emails, phones, business_profile
         FROM search_items
         WHERE lead_id = l.id AND workspace_id = l.workspace_id
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1
       ) si ON true
       WHERE l.workspace_id = $1 AND l.pipeline_stage = $2
       ORDER BY l.pipeline_stage_updated_at DESC NULLS LAST
       LIMIT $3`,
      [workspaceId, stage, Math.min(500, Math.max(1, limit))],
    );
    return res.rows;
  }

  async stageCounts(workspaceId: string) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT pipeline_stage AS stage, COUNT(*)::int AS count
       FROM leads WHERE workspace_id = $1 GROUP BY pipeline_stage`,
      [workspaceId],
    );
    const byStage = Object.fromEntries(res.rows.map((r) => [r.stage, r.count]));
    return STAGE_ORDER.map((s) => ({ stage: s, count: byStage[s] ?? 0 }));
  }

  async timeline(workspaceId: string, leadId: string) {
    const db = getDatabase();
    const contactRes = await db.query(
<<<<<<< Updated upstream
      `SELECT timeline FROM contacts WHERE workspace_id = $1 AND lead_id = $2`,
      [workspaceId, leadId],
    );
=======
      `SELECT c.timeline, l.linkedin_url 
       FROM contacts c
       JOIN leads l ON l.id = c.lead_id
       WHERE c.workspace_id = $1 AND c.lead_id = $2`,
      [workspaceId, leadId],
    );

    const events: TimelineEvent[] = (contactRes.rows[0]?.timeline as TimelineEvent[]) ?? [];
    const linkedinUrl = contactRes.rows[0]?.linkedin_url;

    if (linkedinUrl) {
      try {
        const linkedinMessages = await db.query(
          `SELECT m.content, m.creation_date as at, m.is_outgoing
           FROM chat_chatmessage m
           JOIN crm_deal d ON d.id = m.object_id
           JOIN crm_lead l ON l.id = d.lead_id
           WHERE m.content_type_id = 9 AND l.linkedin_url = $1
           ORDER BY m.creation_date ASC`,
          [linkedinUrl],
        );

        for (const row of linkedinMessages.rows) {
          events.push({
            at: row.at.toISOString(),
            type: 'linkedin_message',
            data: {
              content: row.content,
              isOutgoing: row.is_outgoing,
            },
          });
        }
      } catch (err) {
        this.logger.error(`Failed to fetch LinkedIn messages: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Sort all events by date to ensure unified view
    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

>>>>>>> Stashed changes
    const notesRes = await db.query(
      `SELECT cn.id, cn.body, cn.created_at, c.first_name AS author_first_name, c.last_name AS author_last_name
       FROM contact_notes cn
       LEFT JOIN customers c ON c.id = cn.author_id
       WHERE cn.workspace_id = $1 AND cn.lead_id = $2
       ORDER BY cn.created_at DESC`,
      [workspaceId, leadId],
    );
    return {
<<<<<<< Updated upstream
      events: (contactRes.rows[0]?.timeline as TimelineEvent[]) ?? [],
=======
      events,
>>>>>>> Stashed changes
      notes: notesRes.rows,
    };
  }

  async setStage(workspaceId: string, leadId: string, stage: PipelineStage): Promise<void> {
    if (!STAGE_ORDER.includes(stage)) throw new BadRequestException('invalid stage');
    const db = getDatabase();
    const prev = await db.query(
      `SELECT pipeline_stage FROM leads WHERE id = $1 AND workspace_id = $2`,
      [leadId, workspaceId],
    );
    if (prev.rows.length === 0) throw new BadRequestException('lead not found');
    await db.query(
      `UPDATE leads SET pipeline_stage = $1, pipeline_stage_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND workspace_id = $3`,
      [stage, leadId, workspaceId],
    );
    await this.appendTimeline(workspaceId, leadId, {
      at: new Date().toISOString(),
      type: 'stage_change',
      data: { from: prev.rows[0].pipeline_stage, to: stage, source: 'manual' },
    });
  }
}
