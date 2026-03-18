import { Injectable, ForbiddenException } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { v4 as uuid } from 'uuid';

export interface AddNoteDto {
  content: string;
}

export interface ActivityLogEntry {
  type: string;
  timestamp: string;
  details?: Record<string, any>;
}

@Injectable()
export class ContactService {
  async addNote(workspaceId: string, leadId: string, content: string, userId: string) {
    const db = getDatabase();

    try {
      // Verify lead exists
      const leadResult = await db.query(
        'SELECT id FROM leads WHERE id = $1 AND workspace_id = $2',
        [leadId, workspaceId]
      );

      if (leadResult.rows.length === 0) {
        throw new ForbiddenException('Lead not found');
      }

      // Update contact notes
      const result = await db.query(
        `UPDATE contacts SET notes = $1
         WHERE lead_id = $2 AND workspace_id = $3
         RETURNING id, notes`,
        [content, leadId, workspaceId]
      );

      // Log activity
      await db.query(
        `INSERT INTO activity_logs (id, workspace_id, entity_type, entity_id, action, details, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuid(),
          workspaceId,
          'lead',
          leadId,
          'note_added',
          JSON.stringify({ content }),
          userId,
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Add note error:', error);
      throw error;
    }
  }

  async getActivityLog(workspaceId: string, leadId: string) {
    const db = getDatabase();

    try {
      // Verify lead exists
      const leadResult = await db.query(
        'SELECT id FROM leads WHERE id = $1 AND workspace_id = $2',
        [leadId, workspaceId]
      );

      if (leadResult.rows.length === 0) {
        throw new ForbiddenException('Lead not found');
      }

      // Get activity log
      const result = await db.query(
        `SELECT id, entity_type, action, details, performed_by, created_at
         FROM activity_logs
         WHERE workspace_id = $1 AND entity_id = $2 AND entity_type = 'lead'
         ORDER BY created_at DESC`,
        [workspaceId, leadId]
      );

      return result.rows.map(row => ({
        id: row.id,
        type: row.action,
        timestamp: row.created_at,
        details: row.details,
        performedBy: row.performed_by,
      }));
    } catch (error) {
      console.error('Get activity log error:', error);
      throw error;
    }
  }

  async logActivity(
    workspaceId: string,
    leadId: string,
    action: string,
    details: Record<string, any>,
    userId?: string
  ) {
    const db = getDatabase();

    try {
      await db.query(
        `INSERT INTO activity_logs (id, workspace_id, entity_type, entity_id, action, details, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuid(),
          workspaceId,
          'lead',
          leadId,
          action,
          JSON.stringify(details),
          userId || null,
        ]
      );

      return { success: true };
    } catch (error) {
      console.error('Log activity error:', error);
      throw error;
    }
  }

  async addAttachment(
    workspaceId: string,
    leadId: string,
    fileName: string,
    fileUrl: string,
    userId: string
  ) {
    const db = getDatabase();

    try {
      // Verify lead exists
      const leadResult = await db.query(
        'SELECT id FROM leads WHERE id = $1 AND workspace_id = $2',
        [leadId, workspaceId]
      );

      if (leadResult.rows.length === 0) {
        throw new ForbiddenException('Lead not found');
      }

      // Log attachment activity
      await this.logActivity(
        workspaceId,
        leadId,
        'file_attached',
        { fileName, fileUrl },
        userId
      );

      return { success: true, fileName, fileUrl };
    } catch (error) {
      console.error('Add attachment error:', error);
      throw error;
    }
  }

  async getContact(workspaceId: string, leadId: string) {
    const db = getDatabase();

    try {
      const result = await db.query(
        `SELECT * FROM contacts WHERE lead_id = $1 AND workspace_id = $2`,
        [leadId, workspaceId]
      );

      if (result.rows.length === 0) {
        throw new ForbiddenException('Contact not found');
      }

      const contact = result.rows[0];

      // Get activity log
      const activityLog = await this.getActivityLog(workspaceId, leadId);

      return {
        id: contact.id,
        leadId: contact.lead_id,
        notes: contact.notes,
        activityLog,
        lastActivityAt: contact.last_activity_at,
      };
    } catch (error) {
      console.error('Get contact error:', error);
      throw error;
    }
  }
}
