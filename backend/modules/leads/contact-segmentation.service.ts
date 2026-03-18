import { Injectable } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { v4 as uuid } from 'uuid';

export interface SegmentCriteria {
  scoreMin?: number;
  scoreMax?: number;
  jobTitles?: string[];
  companySizes?: { min: number; max: number };
  locations?: string[];
  emailEngaged?: boolean; // Has opened in last 30 days
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
}

@Injectable()
export class ContactSegmentationService {
  /**
   * Create a new segment
   */
  async createSegment(
    workspaceId: string,
    name: string,
    description: string,
    criteria: SegmentCriteria,
  ): Promise<any> {
    const db = getDatabase();

    const segmentId = uuid();

    const result = await db.query(
      `INSERT INTO contact_segments (id, workspace_id, name, description, criteria)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [segmentId, workspaceId, name, description, JSON.stringify(criteria)],
    );

    // Populate segment with matching leads
    await this.refreshSegmentMembers(segmentId);

    return result.rows[0];
  }

  /**
   * Get all segments for workspace
   */
  async getSegments(workspaceId: string): Promise<any[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT * FROM contact_segments 
      WHERE workspace_id = $1 
      ORDER BY created_at DESC`,
      [workspaceId],
    );

    return result.rows;
  }

  /**
   * Get segment details with member count
   */
  async getSegmentDetails(segmentId: string): Promise<any> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT cs.*, 
        (SELECT COUNT(*) FROM segment_members WHERE segment_id = $1) as member_count
      FROM contact_segments cs
      WHERE cs.id = $1`,
      [segmentId],
    );

    if (!result.rows.length) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    const segment = result.rows[0];
    segment.criteria = JSON.parse(segment.criteria);

    return segment;
  }

  /**
   * Get members of a segment
   */
  async getSegmentMembers(
    segmentId: string,
    offset = 0,
    limit = 50,
  ): Promise<any[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT l.* FROM leads l
      INNER JOIN segment_members sm ON l.id = sm.lead_id
      WHERE sm.segment_id = $1
      ORDER BY sm.added_at DESC
      OFFSET $2 LIMIT $3`,
      [segmentId, offset, limit],
    );

    return result.rows;
  }

  /**
   * Refresh segment members based on criteria
   */
  async refreshSegmentMembers(segmentId: string): Promise<number> {
    const db = getDatabase();

    // Get segment
    const segmentResult = await db.query(
      'SELECT * FROM contact_segments WHERE id = $1',
      [segmentId],
    );

    if (!segmentResult.rows.length) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    const segment = segmentResult.rows[0];
    const criteria = JSON.parse(segment.criteria);

    // Clear existing members
    await db.query('DELETE FROM segment_members WHERE segment_id = $1', [
      segmentId,
    ]);

    // Get matching leads
    const matchingLeads = await this.findLeadsByCriteria(
      segment.workspace_id,
      criteria,
    );

    // Add leads to segment
    for (const lead of matchingLeads) {
      await db.query(
        `INSERT INTO segment_members (segment_id, lead_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING`,
        [segmentId, lead.id],
      );
    }

    // Update member count
    await db.query(
      `UPDATE contact_segments 
      SET member_count = $1
      WHERE id = $2`,
      [matchingLeads.length, segmentId],
    );

    return matchingLeads.length;
  }

  /**
   * Find leads matching criteria
   */
  private async findLeadsByCriteria(
    workspaceId: string,
    criteria: SegmentCriteria,
  ): Promise<any[]> {
    const db = getDatabase();

    let query = 'SELECT * FROM leads WHERE workspace_id = $1';
    const params: any[] = [workspaceId];
    let paramIndex = 2;

    // Score filters
    if (criteria.scoreMin !== undefined) {
      query += ` AND lead_score >= $${paramIndex}`;
      params.push(criteria.scoreMin);
      paramIndex++;
    }

    if (criteria.scoreMax !== undefined) {
      query += ` AND lead_score <= $${paramIndex}`;
      params.push(criteria.scoreMax);
      paramIndex++;
    }

    // Job title filter
    if (criteria.jobTitles && criteria.jobTitles.length > 0) {
      const jobFilters = criteria.jobTitles
        .map(
          (_, i) =>
            `job_title ILIKE $${paramIndex + i}`,
        )
        .join(' OR ');
      query += ` AND (${jobFilters})`;
      criteria.jobTitles.forEach((title) => {
        params.push(`%${title}%`);
        paramIndex++;
      });
    }

    // Company size filter
    if (criteria.companySizes) {
      query += ` AND company_size >= $${paramIndex} AND company_size <= $${paramIndex + 1}`;
      params.push(criteria.companySizes.min, criteria.companySizes.max);
      paramIndex += 2;
    }

    // Location filter
    if (criteria.locations && criteria.locations.length > 0) {
      const locationFilters = criteria.locations
        .map(
          (_, i) =>
            `(city ILIKE $${paramIndex + i} OR state ILIKE $${paramIndex + i} OR country ILIKE $${paramIndex + i})`,
        )
        .join(' OR ');
      query += ` AND (${locationFilters})`;
      criteria.locations.forEach((location) => {
        params.push(`%${location}%`);
        paramIndex++;
      });
    }

    // Email engagement filter
    if (criteria.emailEngaged) {
      query += ` AND EXISTS (
        SELECT 1 FROM email_analytics 
        WHERE email_analytics.lead_id = leads.id 
        AND email_opened_at > NOW() - INTERVAL '30 days'
      )`;
    }

    // Date filters
    if (criteria.createdAfter) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(criteria.createdAfter);
      paramIndex++;
    }

    if (criteria.createdBefore) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(criteria.createdBefore);
      paramIndex++;
    }

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Delete segment
   */
  async deleteSegment(segmentId: string): Promise<void> {
    const db = getDatabase();

    await db.query('DELETE FROM segment_members WHERE segment_id = $1', [
      segmentId,
    ]);
    await db.query('DELETE FROM contact_segments WHERE id = $1', [segmentId]);
  }

  /**
   * Update segment criteria
   */
  async updateSegmentCriteria(
    segmentId: string,
    criteria: SegmentCriteria,
  ): Promise<any> {
    const db = getDatabase();

    const result = await db.query(
      `UPDATE contact_segments 
      SET criteria = $1
      WHERE id = $2
      RETURNING *`,
      [JSON.stringify(criteria), segmentId],
    );

    // Refresh members
    await this.refreshSegmentMembers(segmentId);

    return result.rows[0];
  }

  /**
   * Get high-value segment (A-grade leads)
   */
  async getHighValueSegment(workspaceId: string): Promise<any[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT * FROM leads 
      WHERE workspace_id = $1 AND lead_score >= 80
      ORDER BY lead_score DESC`,
      [workspaceId],
    );

    return result.rows;
  }

  /**
   * Get at-risk segment (disengaged leads)
   */
  async getAtRiskSegment(workspaceId: string): Promise<any[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT l.* FROM leads l
      WHERE l.workspace_id = $1 
      AND l.lead_score < 40
      AND NOT EXISTS (
        SELECT 1 FROM email_analytics 
        WHERE email_analytics.lead_id = l.id 
        AND email_opened_at > NOW() - INTERVAL '60 days'
      )
      ORDER BY l.lead_score ASC`,
      [workspaceId],
    );

    return result.rows;
  }

  /**
   * Get leads by score range (ready for sales, nurture, etc)
   */
  async getLeadsByScoreRange(
    workspaceId: string,
    minScore: number,
    maxScore: number,
  ): Promise<any[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT * FROM leads 
      WHERE workspace_id = $1 
      AND lead_score >= $2 
      AND lead_score <= $3
      ORDER BY lead_score DESC`,
      [workspaceId, minScore, maxScore],
    );

    return result.rows;
  }
}
