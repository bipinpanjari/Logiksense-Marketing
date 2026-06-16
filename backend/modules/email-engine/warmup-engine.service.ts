import { Injectable, Logger } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { SmtpTransportFactory } from './smtp-transport.factory';
import { v4 as uuid } from 'uuid';

@Injectable()
export class WarmupEngineService {
  private readonly logger = new Logger(WarmupEngineService.name);

  private readonly WARMUP_TEMPLATES = [
    { subject: 'Quick question about the project', body: 'Hey, I wanted to follow up on our discussion yesterday. Did you have a chance to look at the docs?' },
    { subject: 'Re: Meeting next week', body: 'Sounds good to me. Let me check my calendar and get back to you.' },
    { subject: 'Found this interesting', body: 'Saw this article today and thought of our conversation. Let me know what you think!' },
    { subject: 'Coffee soon?', body: 'Been a while since we caught up. Are you free for a quick chat next Tuesday?' },
    { subject: 'Thanks for the intro', body: 'Really appreciated the introduction to the team. Looking forward to working together.' },
  ];

  private readonly WARMUP_REPLIES = [
    'That sounds great, thanks for sharing!',
    "Interesting point. I'll get back to you soon.",
    "Thanks! Let's touch base next week.",
    'I appreciate the follow up. Talk soon!',
    'Got it. Thanks for keeping me in the loop.',
  ];

  constructor(
    private readonly smtp: SmtpTransportFactory,
  ) {}

  /**
   * Main warmup loop. Typically called by a cron job or background worker.
   */
  async runWarmupCycle() {
    this.logger.log('Starting internal warmup cycle...');
    const db = getDatabase();

    // 1. Get all active sending configs across all workspaces
    const configRes = await db.query(`
      SELECT id, workspace_id, sending_email, smtp_from_name
      FROM email_configs
      WHERE is_active = true
    `);
    const configs = configRes.rows;

    if (configs.length < 2) {
      this.logger.warn('Need at least 2 active email configs to perform internal warmup.');
      return;
    }

    // 2. Perform some new sends and some auto-replies to recent warmup emails
    await this.processPendingWarmupReplies(db);
    
    // 3. New Sends: Pair them up randomly
    const shuffled = [...configs].sort(() => Math.random() - 0.5);
    const numSends = Math.min(2, Math.floor(configs.length / 2)); // Limit new sends per cycle
    
    for (let i = 0; i < numSends; i++) {
        const sender = shuffled[i * 2];
        const recipient = shuffled[i * 2 + 1];
        
        try {
            await this.performWarmupSend(sender, recipient);
        } catch (err) {
            this.logger.error(`Warmup send failed from ${sender.sending_email} to ${recipient.sending_email}`, err);
        }
    }
  }

  private async processPendingWarmupReplies(db: any) {
    // Look for warmup emails that haven't been replied to yet.
    // We prioritize "Reply to Reply" to create longer threads.
    const res = await db.query(`
      SELECT l.id, l.workspace_id, l.email_config_id, l.subject, l.message_id, l.recipient_email,
             ec.sending_email as sender_email,
             ec.id as sender_config_id,
             ec.workspace_id as sender_workspace_id
      FROM email_logs l
      JOIN email_configs ec ON ec.sending_email = l.recipient_email -- The original recipient is the one who will reply
      WHERE l.is_warmup = true 
        AND l.status = 'sent'
        AND l.sent_at < NOW() - INTERVAL '10 minutes'
        AND l.sent_at > NOW() - INTERVAL '24 hours'
        AND ec.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM email_logs r 
          WHERE r.is_warmup = true 
          AND r.subject = 'Re: ' || l.subject
          AND r.sent_at > l.sent_at
        )
      ORDER BY l.sent_at DESC
      LIMIT 15
    `);

    for (const row of res.rows) {
      try {
        await this.performWarmupReply(row);
      } catch (err) {
        this.logger.error(`Failed to send warmup reply for log ${row.id}`, err);
      }
    }
  }

  private async performWarmupSend(sender: any, recipient: any) {
    const db = getDatabase();
    const template = this.WARMUP_TEMPLATES[Math.floor(Math.random() * this.WARMUP_TEMPLATES.length)];
    
    // Load full config for transport
    const fullConfig = await this.smtp.loadWorkspaceConfig(sender.workspace_id);
    if (!fullConfig) return;

    const transport = this.smtp.build(fullConfig);
    const fromName = sender.smtp_from_name || 'Team';
    const from = `${fromName} <${sender.sending_email}>`;

    const result = await transport.send({
      from,
      to: recipient.sending_email,
      subject: template.subject,
      html: `<p>${template.body}</p>`,
    });

    await db.query(`
      INSERT INTO email_logs (
        id, workspace_id, email_config_id, subject, message_id, status, is_warmup, recipient_email, sent_at
      ) VALUES (
        $1, $2, $3, $4, $5, 'sent', true, $6, CURRENT_TIMESTAMP
      )
    `, [
      uuid(),
      sender.workspace_id,
      sender.id,
      template.subject,
      result.messageId,
      recipient.sending_email
    ]);
  }

  private async performWarmupReply(originalLog: any) {
    const db = getDatabase();
    const replyText = this.WARMUP_REPLIES[Math.floor(Math.random() * this.WARMUP_REPLIES.length)];
    
    // The "sender" of the reply is the "recipient" of the original email
    // We already have the config info from the join in processPendingWarmupReplies
    const fullConfig = await this.smtp.loadWorkspaceConfig(originalLog.sender_workspace_id);
    if (!fullConfig) return;

    const transport = this.smtp.build(fullConfig);
    const senderEmail = originalLog.recipient_email;
    const recipientEmail = originalLog.sender_email;
    
    const subject = originalLog.subject.startsWith('Re: ') ? originalLog.subject : `Re: ${originalLog.subject}`;

    const result = await transport.send({
      from: senderEmail,
      to: recipientEmail,
      subject: subject,
      html: `<p>${replyText}</p><br/><blockquote>Original message: ${originalLog.subject}</blockquote>`,
      headers: {
        'In-Reply-To': originalLog.message_id,
        'References': originalLog.message_id
      }
    });

    await db.query(`
      INSERT INTO email_logs (
        id, workspace_id, email_config_id, subject, message_id, status, is_warmup, recipient_email, sent_at
      ) VALUES (
        $1, $2, $3, $4, $5, 'sent', true, $6, CURRENT_TIMESTAMP
      )
    `, [
      uuid(),
      originalLog.sender_workspace_id,
      originalLog.sender_config_id,
      subject,
      result.messageId,
      recipientEmail
    ]);
  }
}
