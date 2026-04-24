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
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string | null;
  smtpPassword?: string | null;
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
      smtpHost: row.smtp_host,
      smtpPort: port,
      smtpSecure: port === 465,
      smtpUser: row.smtp_user,
      smtpPassword: password,
    };
  }

  build(config: ResolvedEmailConfig): EmailTransport {
    if (!config.smtpHost) {
      throw new BadRequestException(
        'SMTP host is not configured for this workspace. Save email settings with a real SMTP hostname before sending.',
      );
    }
    const host = config.smtpHost === 'localhost' ? '127.0.0.1' : config.smtpHost;
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
