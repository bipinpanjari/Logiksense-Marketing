import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import * as nodemailer from 'nodemailer';
import { decryptSmtpPassword, encryptSmtpPassword } from '../../shared/smtp-crypto';
import { EmailValidationService } from '../auth/email-validation.service';

export interface UpsertEmailConfigInput {
  sendingEmail: string;
  domain: string;
  smtpHost: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromName?: string;
  emailProvider?: string;
  dailySendLimit?: number;
  hourlySendLimit?: number;
  isActive?: boolean;
}

export interface EmailConfigPublic {
  id: string;
  workspaceId: string | null;
  customerId: string;
  sendingEmail: string;
  domain: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpFromName: string | null;
  emailProvider: string | null;
  dailySendLimit: number | null;
  hourlySendLimit: number | null;
  isActive: boolean;
  lastValidated: string | null;
  createdAt: string;
  updatedAt: string;
  hasPassword: boolean;
  dkimValid: boolean;
  spfValid: boolean;
  dmarcValid: boolean;
  dmarcPolicy: string | null;
}

@Injectable()
export class EmailService {
  constructor(private readonly emailValidation: EmailValidationService) {}

  async getActiveConfig(workspaceId: string, customerId: string): Promise<EmailConfigPublic | null> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT
         id,
         workspace_id,
         customer_id,
         sending_email,
         domain,
         smtp_host,
         smtp_port,
         smtp_user,
         smtp_password_encrypted,
         smtp_from_name,
         email_provider,
         daily_send_limit,
         hourly_send_limit,
         is_active,
         last_validated,
         dkim_valid,
         spf_valid,
         dmarc_valid,
         dmarc_policy,
         created_at,
         updated_at
       FROM email_configs
       WHERE (workspace_id = $1 OR (workspace_id IS NULL AND customer_id = $2))
         AND is_active = true
       ORDER BY updated_at DESC
       LIMIT 1`,
      [workspaceId, customerId]
    );

    if (result.rows.length === 0) return null;
    return this.toPublic(result.rows[0]);
  }

  async upsertConfig(workspaceId: string, customerId: string, input: UpsertEmailConfigInput): Promise<EmailConfigPublic> {
    const db = getDatabase();
    const sendingEmail = (input.sendingEmail || '').trim().toLowerCase();
    const domain = (input.domain || '').trim().toLowerCase();
    const smtpHost = (input.smtpHost || '').trim();

    if (!sendingEmail || !sendingEmail.includes('@')) {
      throw new BadRequestException('Invalid sendingEmail');
    }
    if (!domain) {
      throw new BadRequestException('Invalid domain');
    }
    if (!smtpHost) {
      throw new BadRequestException('Invalid smtpHost');
    }

    const smtpPort = input.smtpPort ?? 587;
    if (!Number.isFinite(smtpPort) || smtpPort <= 0 || smtpPort > 65535) {
      throw new BadRequestException('Invalid smtpPort');
    }

    const encryptedPassword = input.smtpPassword ? encryptSmtpPassword(input.smtpPassword) : null;

    // We do a workspace-scoped "upsert" by selecting latest, then update/insert.
    const existing = await db.query(
      `SELECT id, smtp_password_encrypted
       FROM email_configs
       WHERE workspace_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [workspaceId]
    );

    if (existing.rows.length > 0) {
      const existingId = existing.rows[0].id as string;
      const passwordToStore = encryptedPassword ?? (existing.rows[0].smtp_password_encrypted ?? null);

      const updated = await db.query(
        `UPDATE email_configs
         SET
           sending_email = $1,
           domain = $2,
           smtp_host = $3,
           smtp_port = $4,
           smtp_user = $5,
           smtp_password_encrypted = $6,
           smtp_from_name = $7,
           email_provider = $8,
           daily_send_limit = $9,
           hourly_send_limit = $10,
           is_active = $11,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $12 AND customer_id = $13
         RETURNING *`,
        [
          sendingEmail,
          domain,
          smtpHost,
          smtpPort,
          input.smtpUser?.trim() || null,
          passwordToStore,
          input.smtpFromName?.trim() || null,
          input.emailProvider?.trim() || null,
          input.dailySendLimit ?? null,
          input.hourlySendLimit ?? null,
          input.isActive ?? true,
          existingId,
          customerId,
        ]
      );
      if (updated.rows.length === 0) {
        throw new ForbiddenException('Not allowed to update this config');
      }
      return this.toPublic(updated.rows[0]);
    }

    const inserted = await db.query(
      `INSERT INTO email_configs (
         workspace_id,
         customer_id,
         sending_email,
         domain,
         smtp_host,
         smtp_port,
         smtp_user,
         smtp_password_encrypted,
         smtp_from_name,
         email_provider,
         daily_send_limit,
         hourly_send_limit,
         is_active
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        workspaceId,
        customerId,
        sendingEmail,
        domain,
        smtpHost,
        smtpPort,
        input.smtpUser?.trim() || null,
        encryptedPassword,
        input.smtpFromName?.trim() || null,
        input.emailProvider?.trim() || null,
        input.dailySendLimit ?? null,
        input.hourlySendLimit ?? null,
        input.isActive ?? true,
      ]
    );

    return this.toPublic(inserted.rows[0]);
  }

  async testConnection(workspaceId: string, customerId: string): Promise<{ ok: boolean; message: string }> {
    const config = await this.getActiveConfig(workspaceId, customerId);
    if (!config) {
      throw new BadRequestException('No active email config found');
    }

    const raw = await this.getRawConfigById(config.id, customerId);
    const transporter = this.buildTransporter(raw);
    await transporter.verify();

    const db = getDatabase();
    await db.query(
      `UPDATE email_configs SET last_validated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND customer_id = $2`,
      [config.id, customerId]
    );

    return { ok: true, message: 'SMTP connection verified successfully' };
  }

  async sendTestEmail(
    workspaceId: string,
    customerId: string,
    to: string,
    subject?: string,
    html?: string
  ): Promise<{ ok: boolean; message: string }> {
    const config = await this.getActiveConfig(workspaceId, customerId);
    if (!config) {
      throw new BadRequestException('No active email config found');
    }

    const recipient = (to || '').trim().toLowerCase();
    if (!recipient || !recipient.includes('@')) {
      throw new BadRequestException('Invalid recipient email');
    }

    const raw = await this.getRawConfigById(config.id, customerId);
    const transporter = this.buildTransporter(raw);

    const fromName = raw.smtp_from_name || 'Logik Sense';
    const from = `${fromName} <${raw.sending_email}>`;

    await transporter.sendMail({
      from,
      to: recipient,
      subject: subject?.trim() || 'Test email from Logik Sense',
      html:
        html?.trim() ||
        `<div style="font-family: Arial, sans-serif; line-height: 1.5;">
           <h2>SMTP Test Successful</h2>
           <p>This is a test email sent from your Logik Sense workspace using your configured SMTP provider.</p>
           <p><strong>From:</strong> ${raw.sending_email}</p>
           <p><strong>Workspace:</strong> ${workspaceId}</p>
         </div>`,
    });

    return { ok: true, message: `Test email sent to ${recipient}` };
  }

  async validateDkim(domain: string, selector?: string) {
    const cleanDomain = (domain || '').trim().toLowerCase();
    if (!cleanDomain) {
      throw new BadRequestException('Invalid domain');
    }
    const cleanSelector = (selector || 'logik').trim().toLowerCase() || 'logik';
    const result = await this.emailValidation.validateDKIM(cleanDomain, cleanSelector);
    return {
      ok: result.valid,
      selector: cleanSelector,
      recordName: `${cleanSelector}._domainkey.${cleanDomain}`,
      details: result,
    };
  }

  async validateSpf(domain: string) {
    const cleanDomain = (domain || '').trim().toLowerCase();
    if (!cleanDomain) {
      throw new BadRequestException('Invalid domain');
    }
    const result = await this.emailValidation.validateSPF(cleanDomain);
    return {
      ok: result.valid,
      recordName: cleanDomain,
      details: result,
    };
  }

  async validateDmarc(domain: string) {
    const cleanDomain = (domain || '').trim().toLowerCase();
    if (!cleanDomain) {
      throw new BadRequestException('Invalid domain');
    }
    const result = await this.emailValidation.validateDMARC(cleanDomain);
    return {
      ok: result.valid,
      recordName: `_dmarc.${cleanDomain}`,
      policy: (result as any).policy ?? null,
      details: result,
    };
  }

  private async getRawConfigById(id: string, customerId: string): Promise<any> {
    const db = getDatabase();
    const result = await db.query(`SELECT * FROM email_configs WHERE id = $1 AND customer_id = $2`, [id, customerId]);
    if (result.rows.length === 0) {
      throw new ForbiddenException('Email config not found');
    }
    return result.rows[0];
  }

  private buildTransporter(raw: any) {
    const port = raw.smtp_port ? Number(raw.smtp_port) : 587;
    const secure = port === 465;
    const hasAuth = Boolean(raw.smtp_user) && Boolean(raw.smtp_password_encrypted);

    const hostRaw = typeof raw.smtp_host === 'string' ? raw.smtp_host.trim() : '';
    if (!hostRaw) {
      throw new BadRequestException(
        'SMTP host is not configured for this workspace. Save email settings with a real SMTP hostname (e.g. smtp.sendgrid.net) before testing or sending.',
      );
    }
    const smtpHost = hostRaw === 'localhost' ? '127.0.0.1' : hostRaw;
    return nodemailer.createTransport({
      host: smtpHost,
      port,
      secure,
      connectionTimeout: 25_000,
      greetingTimeout: 15_000,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: hasAuth
        ? {
            user: raw.smtp_user,
            pass: decryptSmtpPassword(raw.smtp_password_encrypted),
          }
        : undefined,
    });
  }

  private toPublic(row: any): EmailConfigPublic {
    return {
      id: row.id,
      workspaceId: row.workspace_id ?? null,
      customerId: row.customer_id,
      sendingEmail: row.sending_email,
      domain: row.domain,
      smtpHost: row.smtp_host ?? null,
      smtpPort: row.smtp_port ?? null,
      smtpUser: row.smtp_user ?? null,
      smtpFromName: row.smtp_from_name ?? null,
      emailProvider: row.email_provider ?? null,
      dailySendLimit: row.daily_send_limit ?? null,
      hourlySendLimit: row.hourly_send_limit ?? null,
      isActive: Boolean(row.is_active),
      lastValidated: row.last_validated ? new Date(row.last_validated).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      hasPassword: Boolean(row.smtp_password_encrypted),
      dkimValid: Boolean(row.dkim_valid),
      spfValid: Boolean(row.spf_valid),
      dmarcValid: Boolean(row.dmarc_valid),
      dmarcPolicy: row.dmarc_policy ?? null,
    };
  }
}

