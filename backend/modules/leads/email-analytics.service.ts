import { Injectable } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { v4 as uuid } from 'uuid';

export interface EmailAnalyticsRecord {
  id?: string;
  leadId: string;
  campaignId?: string;
  emailAddress: string;
  sentAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  bounced?: boolean;
  isUnsubscribed?: boolean;
  errorMessage?: string;
}

@Injectable()
export class EmailAnalyticsService {
  /**
   * Record email sent event
   */
  async recordEmailSent(
    leadId: string,
    emailAddress: string,
    campaignId?: string,
  ): Promise<string> {
    const db = getDatabase();
    const id = uuid();

    await db.query(
      `INSERT INTO email_analytics (id, lead_id, email_address, campaign_id, email_sent_at)
      VALUES ($1, $2, $3, $4, NOW())`,
      [id, leadId, emailAddress, campaignId || null],
    );

    return id;
  }

  /**
   * Record email opened event
   */
  async recordEmailOpened(analyticsId: string): Promise<void> {
    const db = getDatabase();

    await db.query(
      `UPDATE email_analytics 
      SET email_opened_at = NOW()
      WHERE id = $1`,
      [analyticsId],
    );

    // Update lead engagement score
    await this.updateLeadEngagementScore(analyticsId);
  }

  /**
   * Record email clicked event
   */
  async recordEmailClicked(analyticsId: string, url?: string): Promise<void> {
    const db = getDatabase();

    await db.query(
      `UPDATE email_analytics 
      SET email_clicked_at = NOW(), clicked_url = $1
      WHERE id = $2`,
      [url || null, analyticsId],
    );

    // Update lead engagement score (clicks worth more than opens)
    await this.updateLeadEngagementScore(analyticsId);
  }

  /**
   * Record email bounce
   */
  async recordEmailBounce(
    analyticsId: string,
    bounceType: 'hard' | 'soft' | 'complaint',
  ): Promise<void> {
    const db = getDatabase();

    await db.query(
      `UPDATE email_analytics 
      SET email_bounced = true, bounce_type = $1
      WHERE id = $2`,
      [bounceType, analyticsId],
    );

    // Unsubscribe on hard bounce
    if (bounceType === 'hard') {
      const result = await db.query(
        'SELECT lead_id FROM email_analytics WHERE id = $1',
        [analyticsId],
      );

      if (result.rows.length) {
        await db.query('UPDATE leads SET is_unsubscribed = true WHERE id = $1', [
          result.rows[0].lead_id,
        ]);
      }
    }
  }

  /**
   * Record unsubscribe event
   */
  async recordUnsubscribe(analyticsId: string): Promise<void> {
    const db = getDatabase();

    await db.query(
      `UPDATE email_analytics 
      SET is_unsubscribed = true
      WHERE id = $1`,
      [analyticsId],
    );

    // Mark lead as unsubscribed
    const result = await db.query(
      'SELECT lead_id FROM email_analytics WHERE id = $1',
      [analyticsId],
    );

    if (result.rows.length) {
      await db.query('UPDATE leads SET is_unsubscribed = true WHERE id = $1', [
        result.rows[0].lead_id,
      ]);
    }
  }

  /**
   * Get email analytics for lead
   */
  async getLeadAnalytics(leadId: string): Promise<any> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN email_opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened,
        SUM(CASE WHEN email_clicked_at IS NOT NULL THEN 1 ELSE 0 END) as total_clicked,
        SUM(CASE WHEN email_bounced = true THEN 1 ELSE 0 END) as total_bounced,
        SUM(CASE WHEN is_unsubscribed = true THEN 1 ELSE 0 END) as total_unsubscribed,
        ROUND(
          CAST(SUM(CASE WHEN email_opened_at IS NOT NULL THEN 1 ELSE 0 END) AS DECIMAL) / 
          NULLIF(COUNT(*), 0) * 100, 2
        ) as open_rate,
        ROUND(
          CAST(SUM(CASE WHEN email_clicked_at IS NOT NULL THEN 1 ELSE 0 END) AS DECIMAL) / 
          NULLIF(COUNT(*), 0) * 100, 2
        ) as click_rate
      FROM email_analytics
      WHERE lead_id = $1`,
      [leadId],
    );

    if (!result.rows.length) {
      return null;
    }

    const analytics = result.rows[0];

    // Get recent email events
    const recentResult = await db.query(
      `SELECT 
        id, campaign_id, email_address, email_sent_at, email_opened_at, 
        email_clicked_at, email_bounced, is_unsubscribed
      FROM email_analytics
      WHERE lead_id = $1
      ORDER BY email_sent_at DESC
      LIMIT 10`,
      [leadId],
    );

    analytics.recent_emails = recentResult.rows;

    return analytics;
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<any> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT 
        campaign_id,
        COUNT(*) as total_sent,
        SUM(CASE WHEN email_opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened,
        SUM(CASE WHEN email_clicked_at IS NOT NULL THEN 1 ELSE 0 END) as total_clicked,
        SUM(CASE WHEN email_bounced = true THEN 1 ELSE 0 END) as total_bounced,
        SUM(CASE WHEN is_unsubscribed = true THEN 1 ELSE 0 END) as total_unsubscribed,
        ROUND(
          CAST(SUM(CASE WHEN email_opened_at IS NOT NULL THEN 1 ELSE 0 END) AS DECIMAL) / 
          NULLIF(COUNT(*), 0) * 100, 2
        ) as open_rate,
        ROUND(
          CAST(SUM(CASE WHEN email_clicked_at IS NOT NULL THEN 1 ELSE 0 END) AS DECIMAL) / 
          NULLIF(COUNT(*), 0) * 100, 2
        ) as click_rate,
        MIN(email_sent_at) as campaign_started_at,
        MAX(email_sent_at) as campaign_ended_at
      FROM email_analytics
      WHERE campaign_id = $1
      GROUP BY campaign_id`,
      [campaignId],
    );

    if (!result.rows.length) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Get workspace email analytics summary
   */
  async getWorkspaceAnalyticsSummary(workspaceId: string): Promise<any> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT 
        COUNT(DISTINCT ea.id) as total_emails_sent,
        COUNT(DISTINCT CASE WHEN ea.email_opened_at IS NOT NULL THEN ea.id END) as total_opens,
        COUNT(DISTINCT CASE WHEN ea.email_clicked_at IS NOT NULL THEN ea.id END) as total_clicks,
        COUNT(DISTINCT CASE WHEN ea.email_bounced = true THEN ea.id END) as total_bounces,
        COUNT(DISTINCT CASE WHEN ea.is_unsubscribed = true THEN ea.id END) as total_unsubscribes,
        ROUND(
          CAST(COUNT(DISTINCT CASE WHEN ea.email_opened_at IS NOT NULL THEN ea.id END) AS DECIMAL) /
          NULLIF(COUNT(DISTINCT ea.id), 0) * 100, 2
        ) as overall_open_rate,
        ROUND(
          CAST(COUNT(DISTINCT CASE WHEN ea.email_clicked_at IS NOT NULL THEN ea.id END) AS DECIMAL) /
          NULLIF(COUNT(DISTINCT ea.id), 0) * 100, 2
        ) as overall_click_rate,
        COUNT(DISTINCT ea.campaign_id) as total_campaigns
      FROM email_analytics ea
      INNER JOIN leads l ON ea.lead_id = l.id
      WHERE l.workspace_id = $1`,
      [workspaceId],
    );

    return result.rows[0];
  }

  /**
   * Get top performing campaigns
   */
  async getTopCampaigns(
    workspaceId: string,
    limit = 10,
  ): Promise<any[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT 
        ea.campaign_id,
        COUNT(*) as total_sent,
        SUM(CASE WHEN ea.email_opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened,
        SUM(CASE WHEN ea.email_clicked_at IS NOT NULL THEN 1 ELSE 0 END) as total_clicked,
        ROUND(
          CAST(SUM(CASE WHEN ea.email_opened_at IS NOT NULL THEN 1 ELSE 0 END) AS DECIMAL) / 
          NULLIF(COUNT(*), 0) * 100, 2
        ) as open_rate,
        ROUND(
          CAST(SUM(CASE WHEN ea.email_clicked_at IS NOT NULL THEN 1 ELSE 0 END) AS DECIMAL) / 
          NULLIF(COUNT(*), 0) * 100, 2
        ) as click_rate,
        MIN(ea.email_sent_at) as started_at,
        MAX(ea.email_sent_at) as ended_at
      FROM email_analytics ea
      INNER JOIN leads l ON ea.lead_id = l.id
      WHERE l.workspace_id = $1 AND ea.campaign_id IS NOT NULL
      GROUP BY ea.campaign_id
      ORDER BY open_rate DESC, total_sent DESC
      LIMIT $2`,
      [workspaceId, limit],
    );

    return result.rows;
  }

  /**
   * Get engagement timeline for lead (last 30 days)
   */
  async getLeadEngagementTimeline(leadId: string): Promise<any[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT 
        DATE(email_sent_at) as date,
        SUM(CASE WHEN email_opened_at IS NOT NULL THEN 1 ELSE 0 END) as opens,
        SUM(CASE WHEN email_clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicks,
        COUNT(*) as emails_sent
      FROM email_analytics
      WHERE lead_id = $1 AND email_sent_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(email_sent_at)
      ORDER BY DATE(email_sent_at) DESC`,
      [leadId],
    );

    return result.rows;
  }

  /**
   * Update lead engagement score based on email interactions
   */
  private async updateLeadEngagementScore(analyticsId: string): Promise<void> {
    const db = getDatabase();

    // Get the lead ID
    const analyticsResult = await db.query(
      'SELECT lead_id FROM email_analytics WHERE id = $1',
      [analyticsId],
    );

    if (!analyticsResult.rows.length) return;

    const leadId = analyticsResult.rows[0].lead_id;

    // Calculate engagement score (same as lead scoring service)
    const engagementResult = await db.query(
      `SELECT 
        SUM(CASE WHEN email_opened_at IS NOT NULL THEN 5 ELSE 0 END) +
        SUM(CASE WHEN email_clicked_at IS NOT NULL THEN 10 ELSE 0 END) as engagement_score
      FROM email_analytics
      WHERE lead_id = $1 AND email_sent_at > NOW() - INTERVAL '30 days'`,
      [leadId],
    );

    const engagementScore =
      engagementResult.rows[0]?.engagement_score || 0;

    // Update lead engagement score
    await db.query(
      `UPDATE leads SET engagement_score = $1 WHERE id = $2`,
      [engagementScore, leadId],
    );
  }

  /**
   * Get most engaged leads (by opens and clicks)
   */
  async getMostEngagedLeads(
    workspaceId: string,
    limit = 20,
  ): Promise<any[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT 
        l.id, l.email, l.first_name, l.last_name,
        SUM(CASE WHEN ea.email_opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opens,
        SUM(CASE WHEN ea.email_clicked_at IS NOT NULL THEN 1 ELSE 0 END) as total_clicks,
        COUNT(DISTINCT ea.id) as emails_received
      FROM leads l
      LEFT JOIN email_analytics ea ON l.id = ea.lead_id
      WHERE l.workspace_id = $1 AND ea.email_sent_at > NOW() - INTERVAL '90 days'
      GROUP BY l.id
      HAVING SUM(CASE WHEN ea.email_opened_at IS NOT NULL THEN 1 ELSE 0 END) > 0
      ORDER BY total_opens DESC, total_clicks DESC
      LIMIT $2`,
      [workspaceId, limit],
    );

    return result.rows;
  }
}
