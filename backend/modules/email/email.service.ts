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

  signatureHtml?: string;
  emailProvider?: string;
  dailySendLimit?: number;
  hourlySendLimit?: number;
  monthlySendLimit?: number;
  isActive?: boolean;
  authType?: 'BASIC' | 'OAUTH2';
  oauth2ClientId?: string;
  oauth2ClientSecret?: string;
  oauth2TenantId?: string;
  oauth2RefreshToken?: string;

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

  signatureHtml: string | null;
  emailProvider: string | null;
  dailySendLimit: number | null;
  hourlySendLimit: number | null;
  monthlySendLimit: number | null;

  isActive: boolean;
  lastValidated: string | null;
  createdAt: string;
  updatedAt: string;
  hasPassword: boolean;
  dkimValid: boolean;
  spfValid: boolean;
  dmarcValid: boolean;
  dmarcPolicy: string | null;

  authType: string;
  oauth2ClientId: string | null;
  oauth2TenantId: string | null;
  hasClientSecret: boolean;
  hasRefreshToken: boolean;

}

@Injectable()
export class EmailService {
  constructor(private readonly emailValidation: EmailValidationService) {}


  async getActiveConfigs(workspaceId: string, customerId: string): Promise<EmailConfigPublic[]> {

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

         signature_html,
         email_provider,
         daily_send_limit,
         monthly_send_limit,

         hourly_send_limit,
         is_active,
         last_validated,
         dkim_valid,
         spf_valid,
         dmarc_valid,
         dmarc_policy,

         auth_type,
         oauth2_client_id,
         oauth2_client_secret_encrypted,
         oauth2_tenant_id,
         oauth2_refresh_token_encrypted,

         created_at,
         updated_at
       FROM email_configs
       WHERE (workspace_id = $1 OR (workspace_id IS NULL AND customer_id = $2))
         AND is_active = true

       ORDER BY updated_at DESC`,
      [workspaceId, customerId]
    );

    return result.rows.map(r => this.toPublic(r));
  }

  async createConfig(workspaceId: string, customerId: string, input: UpsertEmailConfigInput): Promise<EmailConfigPublic> {

    const db = getDatabase();
    const sendingEmail = (input.sendingEmail || '').trim().toLowerCase();
    const domain = (input.domain || '').trim().toLowerCase();
    const smtpHost = (input.smtpHost || '').trim();


    if (!sendingEmail || !sendingEmail.includes('@')) throw new BadRequestException('Invalid sendingEmail');
    if (!domain) throw new BadRequestException('Invalid domain');
    if (!smtpHost) throw new BadRequestException('Invalid smtpHost');

    const smtpPort = input.smtpPort ?? 587;
    if (!Number.isFinite(smtpPort) || smtpPort <= 0 || smtpPort > 65535) throw new BadRequestException('Invalid smtpPort');

    const encryptedPassword = input.smtpPassword ? encryptSmtpPassword(input.smtpPassword) : null;
    const encryptedClientSecret = input.oauth2ClientSecret ? encryptSmtpPassword(input.oauth2ClientSecret) : null;
    const encryptedRefreshToken = input.oauth2RefreshToken ? encryptSmtpPassword(input.oauth2RefreshToken) : null;

    try {
      const inserted = await db.query(
        `INSERT INTO email_configs (
           workspace_id, customer_id, sending_email, domain, smtp_host, smtp_port, smtp_user,
           smtp_password_encrypted, smtp_from_name, signature_html, email_provider, daily_send_limit, monthly_send_limit, hourly_send_limit, is_active,
           auth_type, oauth2_client_id, oauth2_client_secret_encrypted, oauth2_tenant_id, oauth2_refresh_token_encrypted
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING *`,
        [
          workspaceId, customerId, sendingEmail, domain, smtpHost, smtpPort, input.smtpUser?.trim() || null,
          encryptedPassword, input.smtpFromName?.trim() || null, input.signatureHtml ?? null, input.emailProvider?.trim() || null,
          input.dailySendLimit ?? null, input.monthlySendLimit ?? null, input.hourlySendLimit ?? null, input.isActive ?? true,
          input.authType || 'BASIC', input.oauth2ClientId?.trim() || null, encryptedClientSecret, input.oauth2TenantId?.trim() || null, encryptedRefreshToken
        ]
      );

      return this.toPublic(inserted.rows[0]);
    } catch (err: any) {
      console.error('CREATE_CONFIG_ERROR:', err);
      throw err;
    }
  }

  async updateConfig(workspaceId: string, customerId: string, id: string, input: UpsertEmailConfigInput): Promise<EmailConfigPublic> {
    const db = getDatabase();
    const sendingEmail = (input.sendingEmail || '').trim().toLowerCase();
    const domain = (input.domain || '').trim().toLowerCase();
    const smtpHost = (input.smtpHost || '').trim();

    if (!sendingEmail || !sendingEmail.includes('@')) throw new BadRequestException('Invalid sendingEmail');
    if (!domain) throw new BadRequestException('Invalid domain');
    if (!smtpHost) throw new BadRequestException('Invalid smtpHost');
    const smtpPort = input.smtpPort ?? 587;

    const existing = await db.query(`SELECT id, smtp_password_encrypted, oauth2_client_secret_encrypted, oauth2_refresh_token_encrypted FROM email_configs WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
    if (existing.rows.length === 0) throw new ForbiddenException('Not allowed to update this config');

    const encryptedPassword = input.smtpPassword ? encryptSmtpPassword(input.smtpPassword) : null;
    const passwordToStore = encryptedPassword ?? (existing.rows[0].smtp_password_encrypted ?? null);

    const encryptedClientSecret = input.oauth2ClientSecret ? encryptSmtpPassword(input.oauth2ClientSecret) : null;
    const clientSecretToStore = encryptedClientSecret ?? (existing.rows[0].oauth2_client_secret_encrypted ?? null);

    const encryptedRefreshToken = input.oauth2RefreshToken ? encryptSmtpPassword(input.oauth2RefreshToken) : null;
    const refreshTokenToStore = encryptedRefreshToken ?? (existing.rows[0].oauth2_refresh_token_encrypted ?? null);

    const updated = await db.query(
      `UPDATE email_configs
       SET
         sending_email = $1, domain = $2, smtp_host = $3, smtp_port = $4, smtp_user = $5,
         smtp_password_encrypted = $6, smtp_from_name = $7, signature_html = $8, email_provider = $9,
         daily_send_limit = $10, monthly_send_limit = $11, hourly_send_limit = $12, is_active = $13,
         auth_type = $14, oauth2_client_id = $15, oauth2_client_secret_encrypted = $16, oauth2_tenant_id = $17, oauth2_refresh_token_encrypted = $18,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $19 AND customer_id = $20
       RETURNING *`,
      [
        sendingEmail, domain, smtpHost, smtpPort, input.smtpUser?.trim() || null,
        passwordToStore, input.smtpFromName?.trim() || null, input.signatureHtml ?? null, input.emailProvider?.trim() || null,
        input.dailySendLimit ?? null, input.monthlySendLimit ?? null, input.hourlySendLimit ?? null, input.isActive ?? true,
        input.authType || 'BASIC', input.oauth2ClientId?.trim() || null, clientSecretToStore, input.oauth2TenantId?.trim() || null, refreshTokenToStore,
        id, customerId,
      ]
    );
    return this.toPublic(updated.rows[0]);
  }

  async deleteConfig(workspaceId: string, customerId: string, id: string): Promise<void> {
    const db = getDatabase();
    await db.query(`UPDATE email_configs SET is_active = false WHERE id = $1 AND workspace_id = $2 AND customer_id = $3`, [id, workspaceId, customerId]);
  }

  async testConnection(workspaceId: string, customerId: string, configId?: string): Promise<{ ok: boolean; message: string }> {
    const db = getDatabase();
    let configIdToTest = configId;
    if (!configIdToTest) {
      const configs = await this.getActiveConfigs(workspaceId, customerId);
      if (configs.length === 0) throw new BadRequestException('No active email config found');
      configIdToTest = configs[0].id;
    }

    const raw = await this.getRawConfigById(configIdToTest, customerId);
    const transporter = this.buildTransporter(raw);
    await transporter.verify();

    await db.query(
      `UPDATE email_configs SET last_validated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND customer_id = $2`,
      [configIdToTest, customerId]

    );

    return { ok: true, message: 'SMTP connection verified successfully' };
  }

  async sendTestEmail(
    workspaceId: string,
    customerId: string,
    to: string,
    subject?: string,

    html?: string,
    configId?: string
  ): Promise<{ ok: boolean; message: string }> {
    let configIdToTest = configId;
    if (!configIdToTest) {
      const configs = await this.getActiveConfigs(workspaceId, customerId);
      if (configs.length === 0) throw new BadRequestException('No active email config found');
      configIdToTest = configs[0].id;
    }

    const recipient = (to || '').trim().toLowerCase();
    if (!recipient || !recipient.includes('@')) throw new BadRequestException('Invalid recipient email');

    const raw = await this.getRawConfigById(configIdToTest, customerId);

    const transporter = this.buildTransporter(raw);

    const fromName = raw.smtp_from_name || 'Logik Sense';
    const from = `${fromName} <${raw.sending_email}>`;


    try {
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
    } catch (err: any) {
      console.error('SMTP Send Error:', err);
      throw new BadRequestException(`SMTP Error: ${err.message || 'Failed to send'}`);
    }


    return { ok: true, message: `Test email sent to ${recipient}` };
  }

  async validateDkim(domain: string, selector?: string) {
    const cleanDomain = (domain || '').trim().toLowerCase();

    if (!cleanDomain) throw new BadRequestException('Invalid domain');
    
    // Try provided selector or default 'logik'
    let cleanSelector = (selector || 'logik').trim().toLowerCase();
    let result = await this.emailValidation.validateDKIM(cleanDomain, cleanSelector);
    
    // If it fails and no selector was provided, try Microsoft's common 'selector1'
    if (!result.valid && !selector) {
      const msResult = await this.emailValidation.validateDKIM(cleanDomain, 'selector1');
      if (msResult.valid) {
        result = msResult;
        cleanSelector = 'selector1';
      }
    }
    
    return { ok: result.valid, selector: cleanSelector, recordName: `${cleanSelector}._domainkey.${cleanDomain}`, details: result };

  }

  async validateSpf(domain: string) {
    const cleanDomain = (domain || '').trim().toLowerCase();

    if (!cleanDomain) throw new BadRequestException('Invalid domain');
    const result = await this.emailValidation.validateSPF(cleanDomain);
    return { ok: result.valid, recordName: cleanDomain, details: result };

  }

  async validateDmarc(domain: string) {
    const cleanDomain = (domain || '').trim().toLowerCase();

    if (!cleanDomain) throw new BadRequestException('Invalid domain');
    const result = await this.emailValidation.validateDMARC(cleanDomain);
    return { ok: result.valid, recordName: `_dmarc.${cleanDomain}`, policy: (result as any).policy ?? null, details: result };
  }

  async getMicrosoftAuthUrl(customerId: string, configId: string): Promise<{ url: string }> {
    const raw = await this.getRawConfigById(configId, customerId);
    if (raw.auth_type !== 'OAUTH2') throw new BadRequestException('Config is not set to OAuth2');

    const clientId = raw.oauth2_client_id;
    const tenantId = raw.oauth2_tenant_id || 'common';
    const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/email/oauth/callback`;
    
    const scope = encodeURIComponent('https://outlook.office.com/SMTP.Send offline_access');
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scope}&state=${configId}`;
    
    return { url };
  }

  async handleMicrosoftCallback(customerId: string, configId: string, code: string) {
    const db = getDatabase();
    const raw = await this.getRawConfigById(configId, customerId);
    
    const clientId = raw.oauth2_client_id;
    const clientSecret = raw.oauth2_client_secret_encrypted ? decryptSmtpPassword(raw.oauth2_client_secret_encrypted) : '';
    const tenantId = raw.oauth2_tenant_id || 'common';
    const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/email/oauth/callback`;

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      scope: 'https://outlook.office.com/SMTP.Send offline_access',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new BadRequestException(`Microsoft OAuth Error: ${data.error_description || data.error || 'Unknown error'}`);
    }

    const refreshToken = data.refresh_token;
    const encryptedRefreshToken = encryptSmtpPassword(refreshToken);

    await db.query(
      `UPDATE email_configs SET oauth2_refresh_token_encrypted = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND customer_id = $3`,
      [encryptedRefreshToken, configId, customerId]
    );

    return { ok: true };

  }

  private async getRawConfigById(id: string, customerId: string): Promise<any> {
    const db = getDatabase();
    const result = await db.query(`SELECT * FROM email_configs WHERE id = $1 AND customer_id = $2`, [id, customerId]);

    if (result.rows.length === 0) throw new ForbiddenException('Email config not found');

    return result.rows[0];
  }

  private buildTransporter(raw: any) {
    const port = raw.smtp_port ? Number(raw.smtp_port) : 587;
    const secure = port === 465;

    const hostRaw = typeof raw.smtp_host === 'string' ? raw.smtp_host.trim() : '';
    if (!hostRaw) throw new BadRequestException('SMTP host is not configured.');
    const smtpHost = hostRaw === 'localhost' ? '127.0.0.1' : hostRaw;

    const authType = raw.auth_type || 'BASIC';

    if (authType === 'OAUTH2') {
      const tenantId = raw.oauth2_tenant_id || 'common';
      return nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: {
          type: 'OAuth2',
          user: raw.smtp_user,
          clientId: raw.oauth2_client_id,
          clientSecret: raw.oauth2_client_secret_encrypted ? decryptSmtpPassword(raw.oauth2_client_secret_encrypted) : undefined,
          refreshToken: raw.oauth2_refresh_token_encrypted ? decryptSmtpPassword(raw.oauth2_refresh_token_encrypted) : undefined,
          accessUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        },
      });
    }

    const hasAuth = Boolean(raw.smtp_user) && Boolean(raw.smtp_password_encrypted);

    return nodemailer.createTransport({
      host: smtpHost,
      port,
      secure,
      connectionTimeout: 25_000,
      greetingTimeout: 15_000,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,

      auth: hasAuth ? { user: raw.smtp_user, pass: decryptSmtpPassword(raw.smtp_password_encrypted) } : undefined,

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

      signatureHtml: row.signature_html ?? null,
      emailProvider: row.email_provider ?? null,
      dailySendLimit: row.daily_send_limit ?? null,
      hourlySendLimit: row.hourly_send_limit ?? null,
      monthlySendLimit: row.monthly_send_limit ?? null,

      isActive: Boolean(row.is_active),
      lastValidated: row.last_validated ? new Date(row.last_validated).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      hasPassword: Boolean(row.smtp_password_encrypted),
      dkimValid: Boolean(row.dkim_valid),
      spfValid: Boolean(row.spf_valid),
      dmarcValid: Boolean(row.dmarc_valid),
      dmarcPolicy: row.dmarc_policy ?? null,

      authType: row.auth_type || 'BASIC',
      oauth2ClientId: row.oauth2_client_id ?? null,
      oauth2TenantId: row.oauth2_tenant_id ?? null,
      hasClientSecret: Boolean(row.oauth2_client_secret_encrypted),
      hasRefreshToken: Boolean(row.oauth2_refresh_token_encrypted),
    };
  }
}

