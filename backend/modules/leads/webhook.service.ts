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
  async generateWebhookUrl(
    workspaceId: string,
    customerId: string,
    workspaceName: string,
  ): Promise<GenerateWebhookResponse> {
    const db = getDatabase();
    const webhookId = uuid();
    const apiKey = this.generateApiKey();
    const keyHash = this.hashApiKey(apiKey);

    await db.query(
      `INSERT INTO api_keys (id, workspace_id, customer_id, key_hash, name, is_active)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [webhookId, workspaceId, customerId, keyHash, `Contact Form Webhook - ${workspaceName}`],
    );

    return {
      webhookUrl: `${process.env.API_URL || 'http://localhost:3000'}/api/webhooks/contact-form/${webhookId}`,
      webhookId,
      apiKey,
      createdAt: new Date().toISOString(),
    };
  }

  async handleContactFormSubmission(
    webhookId: string,
    apiKey: string,
    leadData: WebhookLead,
  ) {
    const db = getDatabase();

    const keyHash = this.hashApiKey(apiKey);
    const webhookResult = await db.query(
      `SELECT workspace_id, key_hash, is_active
       FROM api_keys
       WHERE id = $1`,
      [webhookId],
    );

    if (webhookResult.rows.length === 0) {
      throw new UnauthorizedException('Invalid webhook');
    }
    const row = webhookResult.rows[0];
    if (!row.is_active) {
      throw new UnauthorizedException('Webhook revoked');
    }
    if (!crypto.timingSafeEqual(Buffer.from(row.key_hash), Buffer.from(keyHash))) {
      throw new UnauthorizedException('Invalid API key');
    }

    const workspaceId = row.workspace_id;

    if (!leadData.email || !this.isValidEmail(leadData.email)) {
      throw new BadRequestException('Invalid email address');
    }

    await db.query(
      `UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [webhookId],
    );

    const existing = await db.query(
      'SELECT id FROM leads WHERE workspace_id = $1 AND email = $2',
      [workspaceId, leadData.email],
    );

    if (existing.rows.length > 0) {
      const leadId = existing.rows[0].id;
      await db.query(
        `UPDATE leads
         SET custom_fields = jsonb_set(
               COALESCE(custom_fields, '{}'::jsonb),
               '{last_form_submission}',
               to_jsonb($1::text)
             ),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [new Date().toISOString(), leadId],
      );
      await this.logActivity(db, workspaceId, leadId, 'contact_form_duplicate', leadData);
      return {
        success: true,
        leadId,
        isNew: false,
        message: 'Lead updated with new form submission',
      };
    }

    const leadId = uuid();
    await db.query(
      `INSERT INTO leads (id, workspace_id, first_name, last_name, email, phone, company, source, custom_fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'contact_form', $8)`,
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
      ],
    );

    await db.query(
      `INSERT INTO contacts (id, workspace_id, lead_id, notes)
       VALUES ($1, $2, $3, $4)`,
      [uuid(), workspaceId, leadId, `Form submission: ${leadData.message ?? ''}`],
    );

    await this.logActivity(db, workspaceId, leadId, 'created', {
      source: 'contact_form',
      email: leadData.email,
    });

    return {
      success: true,
      leadId,
      isNew: true,
      message: 'Lead created from contact form',
    };
  }

  async revokeWebhook(workspaceId: string, webhookId: string) {
    const db = getDatabase();
    const result = await db.query(
      `UPDATE api_keys SET is_active = false
       WHERE id = $1 AND workspace_id = $2
       RETURNING id`,
      [webhookId, workspaceId],
    );
    if (result.rows.length === 0) {
      throw new BadRequestException('Webhook not found');
    }
    return { success: true, message: 'Webhook revoked' };
  }

  async getWebhooks(workspaceId: string) {
    const db = getDatabase();
    const result = await db.query(
      `SELECT id, name, is_active, created_at, last_used_at
       FROM api_keys
       WHERE workspace_id = $1 AND name LIKE 'Contact Form%'
       ORDER BY created_at DESC`,
      [workspaceId],
    );
    return result.rows.map((r) => ({
      webhookId: r.id,
      name: r.name,
      isActive: r.is_active,
      createdAt: r.created_at,
      lastUsed: r.last_used_at,
    }));
  }

  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async logActivity(
    db: ReturnType<typeof getDatabase>,
    workspaceId: string,
    leadId: string,
    action: string,
    details: Record<string, any>,
  ) {
    try {
      await db.query(
        `INSERT INTO activity_logs (id, workspace_id, entity_type, entity_id, action, details)
         VALUES ($1, $2, 'lead', $3, $4, $5)`,
        [uuid(), workspaceId, leadId, action, JSON.stringify(details)],
      );
    } catch {
      // non-fatal
    }
  }
}
