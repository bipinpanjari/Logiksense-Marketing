import { Injectable } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { v4 as uuid } from 'uuid';

export interface ScoringCriteria {
  emailOpens: number; // Points per open
  emailClicks: number; // Points per click
  websiteVisits: number; // Points per visit
  formSubmissions: number; // Points per form
  jobTitleWeight: number; // 0-30 points based on seniority
  companySize: number; // 0-20 points based on company size
  engagementPeriod: number; // Days of recent activity to consider
}

export interface LeadScore {
  leadId: string;
  totalScore: number;
  engagementScore: number;
  qualityScore: number;
  breakdown: {
    emailEngagement: number;
    webEngagement: number;
    demographicQuality: number;
    recency: number;
    jobTitle: number;
    companySize: number;
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendation: string;
}

@Injectable()
export class LeadScoringService {
  // Default Mautic-based scoring criteria
  private defaultCriteria: ScoringCriteria = {
    emailOpens: 5,
    emailClicks: 10,
    websiteVisits: 2,
    formSubmissions: 15,
    jobTitleWeight: 30,
    companySize: 20,
    engagementPeriod: 30, // Last 30 days
  };

  /**
   * Calculate lead score based on engagement and demographics
   */
  async calculateLeadScore(
    leadId: string,
    criteria: ScoringCriteria = this.defaultCriteria,
  ): Promise<LeadScore> {
    const db = getDatabase();

    // Get lead data
    const leadResult = await db.query(
      'SELECT * FROM leads WHERE id = $1',
      [leadId],
    );

    if (!leadResult.rows.length) {
      throw new Error(`Lead ${leadId} not found`);
    }

    const lead = leadResult.rows[0];

    // Calculate engagement score from email analytics
    const emailEngagement = await this.calculateEmailEngagement(
      leadId,
      criteria,
    );

    // Calculate web engagement
    const webEngagement = await this.calculateWebEngagement(leadId, criteria);

    // Calculate demographic quality
    const demographicQuality = this.calculateDemographicQuality(
      lead,
      criteria,
    );

    // Calculate recency bonus (recent activity worth more)
    const recencyBonus = await this.calculateRecencyBonus(leadId, criteria);

    // Calculate job title score
    const jobTitleScore = this.calculateJobTitleScore(lead.job_title, criteria);

    // Calculate company size score
    const companySizeScore = this.calculateCompanySizeScore(
      lead.company_size,
      criteria,
    );

    // Total engagement score
    const engagementScore = Math.min(
      50,
      emailEngagement + webEngagement + recencyBonus,
    );

    // Total quality score
    const qualityScore = Math.min(
      50,
      demographicQuality + jobTitleScore + companySizeScore,
    );

    // Total score (0-100)
    const totalScore = engagementScore + qualityScore;

    // Determine grade
    const grade = this.getScoreGrade(totalScore);

    // Get recommendation
    const recommendation = this.getRecommendation(totalScore, engagementScore);

    const score: LeadScore = {
      leadId,
      totalScore,
      engagementScore,
      qualityScore,
      breakdown: {
        emailEngagement,
        webEngagement,
        demographicQuality,
        recency: recencyBonus,
        jobTitle: jobTitleScore,
        companySize: companySizeScore,
      },
      grade,
      recommendation,
    };

    // Update lead_score in database
    await this.updateLeadScore(leadId, score);

    return score;
  }

  /**
   * Calculate email engagement points
   */
  private async calculateEmailEngagement(
    leadId: string,
    criteria: ScoringCriteria,
  ): Promise<number> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT 
        SUM(CASE WHEN email_opened_at IS NOT NULL THEN 1 ELSE 0 END) as opens,
        SUM(click_count) as clicks
      FROM email_analytics 
      WHERE lead_id = $1 
      AND email_sent_at > NOW() - INTERVAL '${criteria.engagementPeriod} days'`,
      [leadId],
    );

    const { opens = 0, clicks = 0 } = result.rows[0] || {};

    return opens * criteria.emailOpens + clicks * criteria.emailClicks;
  }

  /**
   * Calculate web engagement points
   */
  private async calculateWebEngagement(
    leadId: string,
    criteria: ScoringCriteria,
  ): Promise<number> {
    // This would track website visits and form submissions
    // For now, returning placeholder - implement tracking system later
    return 0;
  }

  /**
   * Calculate demographic quality score
   */
  private calculateDemographicQuality(
    lead: any,
    criteria: ScoringCriteria,
  ): number {
    let score = 0;

    // Email quality (verified emails worth more)
    if (lead.email && lead.email.includes('@')) {
      score += 5;
    }

    // Phone contact
    if (lead.phone) {
      score += 3;
    }

    // Company information
    if (lead.company_name) {
      score += 5;
    }

    // Location
    if (lead.city || lead.state || lead.country) {
      score += 2;
    }

    return Math.min(15, score);
  }

  /**
   * Calculate recency bonus (more recent activity = higher score)
   */
  private async calculateRecencyBonus(
    leadId: string,
    criteria: ScoringCriteria,
  ): Promise<number> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT MAX(email_opened_at) as last_activity 
      FROM email_analytics 
      WHERE lead_id = $1`,
      [leadId],
    );

    const lastActivity = result.rows[0]?.last_activity;

    if (!lastActivity) {
      return 0;
    }

    const daysAgo = Math.floor(
      (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysAgo < 7) {
      return 10; // Very recent
    } else if (daysAgo < 14) {
      return 7; // Recent
    } else if (daysAgo < 30) {
      return 3; // Somewhat recent
    }

    return 0; // Too old
  }

  /**
   * Calculate job title seniority score
   */
  private calculateJobTitleScore(
    jobTitle: string | null,
    criteria: ScoringCriteria,
  ): number {
    if (!jobTitle) {
      return 0;
    }

    const seniorKeywords = [
      'ceo',
      'cfo',
      'cto',
      'director',
      'vp',
      'vice president',
      'president',
      'founder',
      'owner',
    ];
    const midKeywords = [
      'manager',
      'head of',
      'lead',
      'principal',
      'senior',
      'architect',
    ];
    const juniorKeywords = ['analyst', 'specialist', 'associate', 'coordinator'];

    const title = jobTitle.toLowerCase();

    if (seniorKeywords.some((kw) => title.includes(kw))) {
      return Math.min(30, criteria.jobTitleWeight);
    }

    if (midKeywords.some((kw) => title.includes(kw))) {
      return Math.min(20, criteria.jobTitleWeight * 0.66);
    }

    if (juniorKeywords.some((kw) => title.includes(kw))) {
      return Math.min(10, criteria.jobTitleWeight * 0.33);
    }

    return 5; // Generic job title
  }

  /**
   * Calculate company size score
   */
  private calculateCompanySizeScore(
    companySize: number | null,
    criteria: ScoringCriteria,
  ): number {
    if (!companySize) {
      return 0;
    }

    if (companySize >= 1000) {
      return criteria.companySize; // Enterprise
    } else if (companySize >= 100) {
      return criteria.companySize * 0.8; // Mid-market
    } else if (companySize >= 10) {
      return criteria.companySize * 0.5; // SMB
    }

    return criteria.companySize * 0.2; // Startup
  }

  /**
   * Determine letter grade from score
   */
  private getScoreGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 80) return 'A';
    if (score >= 60) return 'B';
    if (score >= 40) return 'C';
    if (score >= 20) return 'D';
    return 'F';
  }

  /**
   * Get recommendation for sales team
   */
  private getRecommendation(
    totalScore: number,
    engagementScore: number,
  ): string {
    if (totalScore >= 80) {
      return 'Ready for sales outreach - High quality, highly engaged lead';
    }
    if (totalScore >= 60) {
      return 'Good fit - Engage with nurture campaign before sales call';
    }
    if (totalScore >= 40) {
      return 'Promising - Continue nurturing, may need qualification';
    }
    if (engagementScore > totalScore * 0.5) {
      return 'Engaged but low quality - Verify information before outreach';
    }
    return 'Low priority - Add to nurture list, revisit in 3 months';
  }

  /**
   * Update lead score in database
   */
  private async updateLeadScore(leadId: string, score: LeadScore) {
    const db = getDatabase();

    // Get previous score for history
    const prevResult = await db.query(
      'SELECT lead_score FROM leads WHERE id = $1',
      [leadId],
    );
    const previousScore = prevResult.rows[0]?.lead_score || 0;

    // Update lead
    await db.query(
      `UPDATE leads 
      SET lead_score = $1, 
          engagement_score = $2,
          quality_score = $3,
          last_score_updated = NOW()
      WHERE id = $4`,
      [score.totalScore, score.engagementScore, score.qualityScore, leadId],
    );

    // Log score change
    if (previousScore !== score.totalScore) {
      await db.query(
        `INSERT INTO lead_score_history (lead_id, previous_score, new_score, reason)
        VALUES ($1, $2, $3, $4)`,
        [leadId, previousScore, score.totalScore, score.recommendation],
      );
    }
  }

  /**
   * Batch score all leads in a workspace
   */
  async scoreAllLeads(
    workspaceId: string,
    criteria?: ScoringCriteria,
  ): Promise<{ success: number; failed: number }> {
    const db = getDatabase();

    const result = await db.query(
      'SELECT id FROM leads WHERE workspace_id = $1',
      [workspaceId],
    );

    let success = 0;
    let failed = 0;

    for (const lead of result.rows) {
      try {
        await this.calculateLeadScore(lead.id, criteria);
        success++;
      } catch (error) {
        console.error(`Failed to score lead ${lead.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Get leads above score threshold
   */
  async getLeadsByScoreThreshold(
    workspaceId: string,
    minScore: number,
    maxResults = 50,
  ): Promise<any[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT * FROM leads 
      WHERE workspace_id = $1 AND lead_score >= $2
      ORDER BY lead_score DESC
      LIMIT $3`,
      [workspaceId, minScore, maxResults],
    );

    return result.rows;
  }
}
