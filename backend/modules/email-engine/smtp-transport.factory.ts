import { BadRequestException, Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { getDatabase } from '../../shared/database';
import { decryptSmtpPassword } from '../../shared/smtp-crypto';
import { EmailTransport } from './email-transport.interface';

export interface ResolvedEmailConfig {
  id: string;
  workspaceId: string;
  customerId: string;
  sendingEmail: string;
  smtpFromName?: string | null;
<<<<<<< Updated upstream
=======
  signatureHtml?: string | null;
>>>>>>> Stashed changes
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string | null;
  smtpPassword?: string | null;
<<<<<<< Updated upstream
=======
  authType?: string | null;
  oauth2ClientId?: string | null;
  oauth2ClientSecret?: string | null;
  oauth2RefreshToken?: string | null;
>>>>>>> Stashed changes
}

class SmtpTransportAdapter implements EmailTransport {
  readonly name = 'smtp';
  constructor(private readonly transporter: nodemailer.Transporter) {}

  async verify(): Promise<void> {
    await this.transporter.verify();
  }

  async send(msg: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
    headers?: Record<string, string>;
    replyTo?: string;
  }) {
    const info = await this.transporter.sendMail(msg);
    return {
      messageId: info.messageId,
      accepted: (info.accepted as string[]) ?? [],
      rejected: (info.rejected as string[]) ?? [],
      response: info.response,
    };
  }
}

@Injectable()
export class SmtpTransportFactory {
  async loadWorkspaceConfig(workspaceId: string): Promise<ResolvedEmailConfig | null> {
    const db = getDatabase();
    const res = await db.query(
<<<<<<< Updated upstream
      `SELECT id, workspace_id, customer_id, sending_email, smtp_from_name,
              smtp_host, smtp_port, smtp_user, smtp_password_encrypted
       FROM email_configs
       WHERE workspace_id = $1 AND is_active = true
       ORDER BY updated_at DESC
       LIMIT 1`,
      [workspaceId],
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
=======
      `SELECT ec.id, ec.workspace_id, ec.customer_id, ec.sending_email, ec.smtp_from_name,
              ec.signature_html,
              ec.smtp_host, ec.smtp_port, ec.smtp_user, ec.smtp_password_encrypted,
              ec.auth_type, ec.oauth2_client_id, ec.oauth2_client_secret_encrypted,
              ec.oauth2_refresh_token_encrypted,
              ec.daily_send_limit, ec.monthly_send_limit,
              (SELECT COUNT(*) FROM email_logs el WHERE el.email_config_id = ec.id AND el.sent_at >= CURRENT_DATE) as today_sent,
              (SELECT COUNT(*) FROM email_logs el WHERE el.email_config_id = ec.id AND el.sent_at >= date_trunc('month', CURRENT_DATE)) as month_sent
       FROM email_configs ec
       WHERE ec.workspace_id = $1 AND ec.is_active = true
       ORDER BY ec.updated_at DESC`,
      [workspaceId],
    );
    if (res.rows.length === 0) return null;

    const availableConfig = res.rows.find((row) => {
      const dailyLimit = Number(row.daily_send_limit) || 100;
      const todaySent = Number(row.today_sent) || 0;
      const monthlyLimit = Number(row.monthly_send_limit) || 3000;
      const monthSent = Number(row.month_sent) || 0;
      return todaySent < dailyLimit && monthSent < monthlyLimit;
    });
    const row = availableConfig || res.rows[0];

>>>>>>> Stashed changes
    const port = Number(row.smtp_port) || 587;
    const password = row.smtp_password_encrypted
      ? safeDecrypt(row.smtp_password_encrypted)
      : null;
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      customerId: row.customer_id,
      sendingEmail: row.sending_email,
      smtpFromName: row.smtp_from_name,
<<<<<<< Updated upstream
=======
      signatureHtml: row.signature_html,
>>>>>>> Stashed changes
      smtpHost: row.smtp_host,
      smtpPort: port,
      smtpSecure: port === 465,
      smtpUser: row.smtp_user,
      smtpPassword: password,
<<<<<<< Updated upstream
=======
      authType: row.auth_type,
      oauth2ClientId: row.oauth2_client_id,
      oauth2ClientSecret: row.oauth2_client_secret_encrypted ? safeDecrypt(row.oauth2_client_secret_encrypted) : null,
      oauth2RefreshToken: row.oauth2_refresh_token_encrypted ? safeDecrypt(row.oauth2_refresh_token_encrypted) : null,
>>>>>>> Stashed changes
    };
  }

  build(config: ResolvedEmailConfig): EmailTransport {
    if (!config.smtpHost) {
      throw new BadRequestException(
        'SMTP host is not configured for this workspace. Save email settings with a real SMTP hostname before sending.',
      );
    }
    const host = config.smtpHost === 'localhost' ? '127.0.0.1' : config.smtpHost;
<<<<<<< Updated upstream
    const auth =
      config.smtpUser && config.smtpPassword
        ? { user: config.smtpUser, pass: config.smtpPassword }
        : undefined;
    const transporter = nodemailer.createTransport({
      host,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth,
    });
=======
    
    let transporter: nodemailer.Transporter;

    if (config.authType === 'OAUTH2') {
      transporter = nodemailer.createTransport({
        host,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          type: 'OAuth2',
          user: config.smtpUser || undefined,
          clientId: config.oauth2ClientId || undefined,
          clientSecret: config.oauth2ClientSecret || undefined,
          refreshToken: config.oauth2RefreshToken || undefined,
        },
      } as any);
    } else {
      const auth =
        config.smtpUser && config.smtpPassword
          ? { user: config.smtpUser, pass: config.smtpPassword }
          : undefined;
      transporter = nodemailer.createTransport({
        host,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth,
      });
    }

>>>>>>> Stashed changes
    return new SmtpTransportAdapter(transporter);
  }
}

function safeDecrypt(blob: string): string | null {
  try {
    return decryptSmtpPassword(blob);
  } catch {
    return null;
  }
}
