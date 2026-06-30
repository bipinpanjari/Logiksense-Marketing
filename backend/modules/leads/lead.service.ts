import { Injectable, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { v4 as uuid } from 'uuid';

export interface CreateLeadDto {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;

  tags?: string[];
  customFields?: Record<string, any>;
  leadNumber?: string; // Auto-generated lead identifier

}

export interface UpdateLeadDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;


  tags?: string[];
  customFields?: Record<string, any>;
  isSuppressed?: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string[];
  company?: string;
}

@Injectable()
export class LeadService {
  private normalizeEmail(email: string | undefined): string {
    return (email || '').trim().toLowerCase();
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async createLead(
    workspaceId: string,
    customerId: string,
    createLeadDto: CreateLeadDto
  ) {
    const db = getDatabase();
    const leadId = uuid();
    const email = this.normalizeEmail(createLeadDto.email);

    if (!email || !this.validateEmail(email)) {
      throw new BadRequestException('Valid email is required');
    }
    if (!createLeadDto.firstName?.trim() && !createLeadDto.lastName?.trim()) {
      throw new BadRequestException('At least firstName or lastName is required');
    }

    try {

      // Include leadNumber in customFields if provided
      const customFields = {
        ...(createLeadDto.customFields || {}),
        ...(createLeadDto.leadNumber && { leadNumber: createLeadDto.leadNumber })
      };

      const result = await db.query(
        `INSERT INTO leads (id, workspace_id, first_name, last_name, email, phone, company, tags, custom_fields, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)

         RETURNING *`,
        [
          leadId,
          workspaceId,
          createLeadDto.firstName?.trim() || null,
          createLeadDto.lastName?.trim() || null,
          email,
          createLeadDto.phone || null,
          createLeadDto.company || null,

          createLeadDto.tags || [],
          JSON.stringify(customFields),

          customerId,
        ]
      );

      // Create contact record
      await db.query(
        `INSERT INTO contacts (id, workspace_id, lead_id)
         VALUES ($1, $2, $3)`,
        [uuid(), workspaceId, leadId]
      );

      return this.formatLead(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException('Lead already exists with this email in this workspace');
      }
      console.error('Create lead error:', error);
      throw error;
    }
  }

  async getLeads(workspaceId: string, params: PaginationParams = {}) {
    const db = getDatabase();
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM leads WHERE workspace_id = $1';
    const queryParams: any[] = [workspaceId];
    let paramIndex = 2;

    // Search by name or email
    if (params.search) {
      query += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      queryParams.push(`%${params.search}%`);
      paramIndex++;
    }

    // Filter by tags
    if (params.tags && params.tags.length > 0) {
      query += ` AND tags && $${paramIndex}::text[]`;
      queryParams.push(params.tags);
      paramIndex++;
    }

    // Filter by company
    if (params.company) {
      query += ` AND company ILIKE $${paramIndex}`;
      queryParams.push(`%${params.company}%`);
      paramIndex++;
    }

    // Add pagination and sorting
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM leads WHERE workspace_id = $1';
    const countParams: any[] = [workspaceId];
    let countParamIndex = 2;

    if (params.search) {
      countQuery += ` AND (first_name ILIKE $${countParamIndex} OR last_name ILIKE $${countParamIndex} OR email ILIKE $${countParamIndex})`;
      countParams.push(`%${params.search}%`);
      countParamIndex++;
    }

    if (params.tags && params.tags.length > 0) {
      countQuery += ` AND tags && $${countParamIndex}::text[]`;
      countParams.push(params.tags);
      countParamIndex++;
    }

    if (params.company) {
      countQuery += ` AND company ILIKE $${countParamIndex}`;
      countParams.push(`%${params.company}%`);
      countParamIndex++;
    }

    try {
      const leadsResult = await db.query(query, queryParams);
      const countResult = await db.query(countQuery, countParams);

      return {
        data: leadsResult.rows.map(l => this.formatLead(l)),
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].count),
          pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
        },
      };
    } catch (error) {
      console.error('Get leads error:', error);
      throw error;
    }
  }

  async getLead(workspaceId: string, leadId: string) {
    const db = getDatabase();

    try {
      const result = await db.query(
        `SELECT l.*, c.notes, c.activity_log FROM leads l
         LEFT JOIN contacts c ON l.id = c.lead_id
         WHERE l.id = $1 AND l.workspace_id = $2`,
        [leadId, workspaceId]
      );

      if (result.rows.length === 0) {
        throw new ForbiddenException('Lead not found');
      }

      return this.formatLeadWithContact(result.rows[0]);
    } catch (error) {
      console.error('Get lead error:', error);
      throw error;
    }
  }

  async updateLead(
    workspaceId: string,
    leadId: string,
    updateLeadDto: UpdateLeadDto
  ) {
    const db = getDatabase();

    try {
      // Verify lead exists and belongs to workspace
      await this.getLead(workspaceId, leadId);

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (updateLeadDto.firstName) {
        updateFields.push(`first_name = $${paramIndex}`);
        updateValues.push(updateLeadDto.firstName);
        paramIndex++;
      }

      if (updateLeadDto.lastName) {
        updateFields.push(`last_name = $${paramIndex}`);
        updateValues.push(updateLeadDto.lastName);
        paramIndex++;
      }

      if (updateLeadDto.email) {
        const normalized = this.normalizeEmail(updateLeadDto.email);
        if (!this.validateEmail(normalized)) {
          throw new BadRequestException('Invalid email format');
        }
        updateFields.push(`email = $${paramIndex}`);
        updateValues.push(normalized);
        paramIndex++;
      }

      if (updateLeadDto.phone !== undefined) {
        updateFields.push(`phone = $${paramIndex}`);
        updateValues.push(updateLeadDto.phone);
        paramIndex++;
      }

      if (updateLeadDto.company !== undefined) {
        updateFields.push(`company = $${paramIndex}`);
        updateValues.push(updateLeadDto.company);
        paramIndex++;
      }



      if (updateLeadDto.tags) {
        updateFields.push(`tags = $${paramIndex}`);
        updateValues.push(updateLeadDto.tags);
        paramIndex++;
      }

      if (updateLeadDto.customFields) {
        updateFields.push(`custom_fields = $${paramIndex}`);
        updateValues.push(JSON.stringify(updateLeadDto.customFields));
        paramIndex++;
      }

      if (updateLeadDto.isSuppressed !== undefined) {
        updateFields.push(`is_suppressed = $${paramIndex}`);
        updateValues.push(updateLeadDto.isSuppressed);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return this.getLead(workspaceId, leadId);
      }

      updateValues.push(leadId);

      const result = await db.query(
        `UPDATE leads
         SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramIndex}
         RETURNING *`,
        updateValues
      );

      return this.formatLead(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException('Lead already exists with this email in this workspace');
      }
      console.error('Update lead error:', error);
      throw error;
    }
  }

  async deleteLead(workspaceId: string, leadId: string) {
    const db = getDatabase();

    try {
      // Verify ownership first
      await this.getLead(workspaceId, leadId);

      // Delete contact first (foreign key)
      await db.query(
        'DELETE FROM contacts WHERE lead_id = $1',
        [leadId]
      );

      // Delete lead
      const result = await db.query(
        'DELETE FROM leads WHERE id = $1 AND workspace_id = $2 RETURNING id',
        [leadId, workspaceId]
      );

      if (result.rows.length === 0) {
        throw new ForbiddenException('Could not delete lead');
      }

      return { success: true, deletedId: leadId };
    } catch (error) {
      console.error('Delete lead error:', error);
      throw error;
    }
  }

  async bulkDeleteLeads(workspaceId: string, leadIds: string[]) {
    const db = getDatabase();

    try {
      // Delete contacts first
      await db.query(
        `DELETE FROM contacts WHERE lead_id = ANY($1)`,
        [leadIds]
      );

      // Delete leads
      const result = await db.query(
        `DELETE FROM leads WHERE id = ANY($1) AND workspace_id = $2 RETURNING id`,
        [leadIds, workspaceId]
      );

      return { success: true, deletedCount: result.rows.length };
    } catch (error) {
      console.error('Bulk delete leads error:', error);
      throw error;
    }
  }

  async bulkUpdateLeads(
    workspaceId: string,
    leadIds: string[],
    updates: UpdateLeadDto
  ) {
    const db = getDatabase();

    try {
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (updates.tags) {
        updateFields.push(`tags = $${paramIndex}`);
        updateValues.push(updates.tags);
        paramIndex++;
      }

      if (updates.company !== undefined) {
        updateFields.push(`company = $${paramIndex}`);
        updateValues.push(updates.company);
        paramIndex++;
      }

      if (updates.isSuppressed !== undefined) {
        updateFields.push(`is_suppressed = $${paramIndex}`);
        updateValues.push(updates.isSuppressed);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return { success: true, updatedCount: 0 };
      }

      updateValues.push(leadIds);
      updateValues.push(workspaceId);

      const result = await db.query(
        `UPDATE leads
         SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = ANY($${paramIndex}) AND workspace_id = $${paramIndex + 1}
         RETURNING id`,
        updateValues
      );

      return { success: true, updatedCount: result.rows.length };
    } catch (error) {
      console.error('Bulk update leads error:', error);
      throw error;
    }
  }

  async getLeadStats(workspaceId: string) {
    const db = getDatabase();

    try {
      const totalLeads = await db.query(
        'SELECT COUNT(*) FROM leads WHERE workspace_id = $1',
        [workspaceId]
      );

      const suppressedLeads = await db.query(
        'SELECT COUNT(*) FROM leads WHERE workspace_id = $1 AND is_suppressed = true',
        [workspaceId]
      );

      const tagStats = await db.query(
        `SELECT tag, COUNT(*) as count
         FROM (SELECT UNNEST(tags) as tag FROM leads WHERE workspace_id = $1) t
         GROUP BY tag
         ORDER BY count DESC
         LIMIT 10`,
        [workspaceId]
      );

      const companyStats = await db.query(
        `SELECT company, COUNT(*) as count
         FROM leads WHERE workspace_id = $1 AND company IS NOT NULL
         GROUP BY company
         ORDER BY count DESC
         LIMIT 10`,
        [workspaceId]
      );

      return {
        total: parseInt(totalLeads.rows[0].count),
        suppressed: parseInt(suppressedLeads.rows[0].count),
        active: parseInt(totalLeads.rows[0].count) - parseInt(suppressedLeads.rows[0].count),
        topTags: tagStats.rows,
        topCompanies: companyStats.rows,
      };
    } catch (error) {
      console.error('Get lead stats error:', error);
      throw error;
    }
  }

  private formatLead(lead: any) {
    return {
      id: lead.id,
      firstName: lead.first_name,
      lastName: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,


      tags: lead.tags || [],
      customFields: lead.custom_fields || {},
      source: lead.source,
      isSuppressed: lead.is_suppressed,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
    };
  }

  private formatLeadWithContact(lead: any) {
    return {
      ...this.formatLead(lead),
      notes: lead.notes,
      activityLog: lead.activity_log || [],
    };
  }
}
