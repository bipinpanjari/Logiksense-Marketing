import { Injectable } from '@nestjs/common';
import { getDatabase } from '../../shared/database';

export interface DashboardKpis {
  totalLeads: number;
  leadsAddedLast7d: number;
  sentLast7d: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  activeCampaigns: number;
  activeSequences: number;
  scheduledSends: number;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  created_at: string;
}

/**
 * AnalyticsService powers the dashboard + analytics pages from live data.
 * All reads are workspace-scoped and aggregate over `email_logs` /
 * `email_campaigns` / `leads` - keeping a single source of truth.
 */
@Injectable()
export class AnalyticsService {
  async kpis(workspaceId: string): Promise<DashboardKpis> {
    const db = getDatabase();
    const [leadsRes, engagementRes, campaignsRes, sequencesRes, scheduledRes] = await Promise.all([
      db.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS added_7d
         FROM leads WHERE workspace_id = $1`,
        [workspaceId],
      ),
      db.query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('sent','opened','clicked','replied'))::int AS total_sent,
           COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
           COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked,
           COUNT(*) FILTER (WHERE status = 'bounced')::int AS bounced,
           COUNT(*) FILTER (WHERE status IN ('sent','opened','clicked','replied') AND sent_at >= NOW() - INTERVAL '7 days')::int AS sent_7d
         FROM email_logs WHERE workspace_id = $1`,
        [workspaceId],
      ),
      db.query(
        `SELECT COUNT(*)::int AS active
         FROM email_campaigns
         WHERE workspace_id = $1 AND status IN ('running','scheduled')`,
        [workspaceId],
      ),
      db.query(
        `SELECT COUNT(*)::int AS active
         FROM email_sequences
         WHERE workspace_id = $1 AND is_active = true`,
        [workspaceId],
      ),
      db.query(
        `SELECT COUNT(*)::int AS scheduled
         FROM sequence_lead_enrollment sle
         INNER JOIN email_sequences es ON es.id = sle.sequence_id
         WHERE es.workspace_id = $1::uuid AND sle.status = 'active'`,
        [workspaceId],
      ),
    ]);

    const total = leadsRes.rows[0]?.total ?? 0;
    const added7 = leadsRes.rows[0]?.added_7d ?? 0;
    const sent = engagementRes.rows[0]?.total_sent ?? 0;
    const opened = engagementRes.rows[0]?.opened ?? 0;
    const clicked = engagementRes.rows[0]?.clicked ?? 0;
    const bounced = engagementRes.rows[0]?.bounced ?? 0;
    const sent7 = engagementRes.rows[0]?.sent_7d ?? 0;

    const repliedRes = await db.query(
      `SELECT COUNT(*)::int AS replied FROM inbound_replies WHERE workspace_id = $1`,
      [workspaceId],
    );
    const replied = repliedRes.rows[0]?.replied ?? 0;

    return {
      totalLeads: total,
      leadsAddedLast7d: added7,
      sentLast7d: sent7,
      openRate: sent ? Math.round((opened / sent) * 1000) / 10 : 0,
      clickRate: sent ? Math.round((clicked / sent) * 1000) / 10 : 0,
      replyRate: sent ? Math.round((replied / sent) * 1000) / 10 : 0,
      bounceRate: sent ? Math.round((bounced / sent) * 1000) / 10 : 0,
      activeCampaigns: campaignsRes.rows[0]?.active ?? 0,
      activeSequences: sequencesRes.rows[0]?.active ?? 0,
      scheduledSends: scheduledRes.rows[0]?.scheduled ?? 0,
    };
  }

  async topCampaigns(workspaceId: string, limit = 5): Promise<CampaignSummary[]> {
    const db = getDatabase();
    const res = await db.query(
      `SELECT c.id, c.name, c.status,
              c.sent_count::int AS sent,
              c.opened_count::int AS opened,
              c.clicked_count::int AS clicked,
              c.bounced_count::int AS bounced,
              COALESCE(r.replied, 0)::int AS replied,
              c.created_at
       FROM email_campaigns c
       LEFT JOIN (
         SELECT campaign_id, COUNT(*)::int AS replied
         FROM inbound_replies WHERE workspace_id = $1 GROUP BY campaign_id
       ) r ON r.campaign_id = c.id
       WHERE c.workspace_id = $1
       ORDER BY c.sent_count DESC NULLS LAST, c.created_at DESC
       LIMIT $2`,
      [workspaceId, Math.min(50, Math.max(1, limit))],
    );
    return res.rows as CampaignSummary[];
  }

  async sendsByDay(workspaceId: string, days = 30) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT date_trunc('day', sent_at) AS day,
              COUNT(*) FILTER (WHERE status IN ('sent','opened','clicked','replied'))::int AS sent,
              COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
              COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked,
              COUNT(*) FILTER (WHERE status = 'bounced')::int AS bounced
       FROM email_logs
       WHERE workspace_id = $1 AND sent_at >= NOW() - (INTERVAL '1 day') * $2
       GROUP BY date_trunc('day', sent_at)
       ORDER BY day ASC`,
      [workspaceId, Math.max(1, Math.min(365, days))],
    );
    return res.rows;
  }
}
