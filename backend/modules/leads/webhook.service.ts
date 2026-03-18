import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';

export interface WebhookLead {
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  customFields?: Record<string, any>;
}

export interface GenerateWebhookResponse {
  webhookUrl: string;
  webhookId: string;
  apiKey: string;
  createdAt: string;
}

@Injectable()
export class WebhookService {
  async generateWebhookUrl(workspaceId: string, workspaceName: string): Promise<GenerateWebhookResponse> {
    const db = getDatabase();
    const webhookId = uuid();
    const apiKey = this.generateApiKey();

    try {
      const result = await db.query(
        `INSERT INTO api_keys (id, workspace_id, key_hash, name, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [
          uuid(),
          workspaceId,
          crypto.createHash('sha256').update(apiKey).digest('hex'),
          `Contact Form Webhook - ${workspaceName}`,
        ]
      );

      return {
        webhookUrl: `${process.env.API_URL || 'http://localhost:3000'}/api/webhooks/contact-form/${webhookId}`,
        webhookId,
        apiKey,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Generate webhook error:', error);
      throw error;
    }
  }

  async handleContactFormSubmission(
    webhookId: string,
    apiKey: string,
    leadData: WebhookLead
  ) {
    const db = getDatabase();

    try {
      // Validate API key
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      const keyResult = await db.query(
        `SELECT workspace_id FROM api_keys 
         WHERE id = (SELECT workspace_id FROM api_keys WHERE key_hash = $1)`,
        [keyHash]
      );

      // Get workspace from webhook ID - simpler approach
      const webhookResult = await db.query(
        `SELECT workspace_id FROM api_keys WHERE id = $1 AND is_active = true`,
        [webhookId]
      );

      if (webhookResult.rows.length === 0) {
        throw new UnauthorizedException('Invalid webhook');
      }

      const workspaceId = webhookResult.rows[0].workspace_id;

      // Validate email
      if (!leadData.email || !this.isValidEmail(leadData.email)) {
        throw new BadRequestException('Invalid email address');
      }

      // Check for duplicates
      const existing = await db.query(
        'SELECT id FROM leads WHERE workspace_id = $1 AND email = $2',
        [workspaceId, leadData.email]
      );

      const leadId = uuid();

      if (existing.rows.length > 0) {
        // Update existing lead with form submission data
        await db.query(
          `UPDATE leads SET custom_fields = jsonb_set(custom_fields, '{last_form_submission}', to_jsonb($1::text))
           WHERE id = $2`,
          [new Date().toISOString(), existing.rows[0].id]
        );

        return {
          success: true,
          leadId: existing.rows[0].id,
          isNew: false,
          message: 'Lead updated with new form submission',
        };
      }

      // Create new lead
      const result = await db.query(
        `INSERT INTO leads (id, workspace_id, first_name, last_name, email, phone, company, source, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'contact_form', $8)
         RETURNING id`,
        [
          leadId,
          workspaceId,
          leadData.firstName || '',
          leadData.lastName || '',
          leadData.email,
          leadData.phone || null,
          leadData.company || null,
          JSON.stringify({
            formSubmission: {
              message: leadData.message,
              timestamp: new Date().toISOString(),
              ...leadData.customFields,
            },
          }),
        ]
      );

      // Create contact record
      await db.query(
        `INSERT INTO contacts (id, workspace_id, lead_id, notes)
         VALUES ($1, $2, $3, $4)`,
        [uuid(), workspaceId, leadId, `Form submission: ${leadData.message}`]
      );

      // Log activity
      await db.query(
        `INSERT INTO activity_logs (id, workspace_id, entity_type, entity_id, action, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          uuid(),
          workspaceId,
          'lead',
          leadId,
          'created',
          JSON.stringify({ source: 'contact_form', email: leadData.email }),
        ]
      );

      return {
        success: true,
        leadId,
        isNew: true,
        message: 'Lead created from contact form',
      };
    } catch (error) {
      console.error('Handle webhook submission error:', error);
      throw error;
    }
  }

  async revokeWebhook(workspaceId: string, webhookId: string) {
    const db = getDatabase();

    try {
      const result = await db.query(
        `UPDATE api_keys SET is_active = false
         WHERE id = $1 AND workspace_id = $2
         RETURNING id`,
        [webhookId, workspaceId]
      );

      if (result.rows.length === 0) {
        throw new BadRequestException('Webhook not found');
      }

      return { success: true, message: 'Webhook revoked' };
    } catch (error) {
      console.error('Revoke webhook error:', error);
      throw error;
    }
  }

  async getWebhooks(workspaceId: string) {
    const db = getDatabase();

    try {
      const result = await db.query(
        `SELECT id, name, is_active, created_at, last_used_at
         FROM api_keys
         WHERE workspace_id = $1 AND name LIKE 'Contact Form%'
         ORDER BY created_at DESC`,
        [workspaceId]
      );

      return result.rows.map(row => ({
        webhookId: row.id,
        name: row.name,
        isActive: row.is_active,
        createdAt: row.created_at,
        lastUsed: row.last_used_at,
      }));
    } catch (error) {
      console.error('Get webhooks error:', error);
      throw error;
    }
  }

  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
