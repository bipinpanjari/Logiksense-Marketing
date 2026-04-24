import { Injectable, Logger } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { v4 as uuid } from 'uuid';
import { SmtpTransportFactory, ResolvedEmailConfig } from './smtp-transport.factory';
import { TemplateRendererService } from './template-renderer.service';
import { UnsubscribeService } from './unsubscribe.service';
import { NameDetectorService } from '../ai/name-detector.service';
import { IcebreakerService } from '../ai/icebreaker.service';
import { EnrichmentService } from '../ai/enrichment.service';
import { PipelineService } from '../pipeline/pipeline.service';

export interface DispatchInput {
  workspaceId: string;
  customerId: string;
  leadId: string;
  templateId?: string;
  campaignId?: string;
  enrollmentId?: string;
  override?: { subject?: string; html?: string; text?: string };
}

export interface DispatchResult {
  status: 'sent' | 'skipped' | 'bounced' | 'failed';
  logId?: string;
  messageId?: string;
  reason?: string;
}

@Injectable()
export class EmailDispatcherService {
  private readonly logger = new Logger(EmailDispatcherService.name);

  constructor(
    private readonly smtp: SmtpTransportFactory,
    private readonly renderer: TemplateRendererService,
    private readonly unsub: UnsubscribeService,
    private readonly nameDetector: NameDetectorService,
    private readonly icebreaker: IcebreakerService,
    private readonly enrichment: EnrichmentService,
    private readonly pipeline: PipelineService,
  ) {}

  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    const db = getDatabase();

    const leadRes = await db.query(
      `SELECT id, workspace_id, first_name, last_name, email, company, job_title,
              city, state, country, custom_fields, is_unsubscribed, is_suppressed,
              icebreaker, email_validation_status, name_detection, enrichment
       FROM leads WHERE id = $1 AND workspace_id = $2`,
      [input.leadId, input.workspaceId],
    );
    if (leadRes.rows.length === 0) {
      return { status: 'failed', reason: 'lead-not-found' };
    }
    const lead = leadRes.rows[0];
    if (lead.is_unsubscribed || lead.is_suppressed) {
      return { status: 'skipped', reason: 'lead-suppressed' };
    }
    if (!lead.email || !this.isValidEmail(lead.email)) {
      return { status: 'skipped', reason: 'invalid-email' };
    }
    if (await this.unsub.isSuppressed(input.workspaceId, lead.email)) {
      return { status: 'skipped', reason: 'workspace-suppressed' };
    }

    const personalization = await this.runPersonalizationHook(input.workspaceId, lead);
    if (personalization.blockDeliverability) {
      return { status: 'skipped', reason: `invalid-email:${personalization.validationStatus}` };
    }

    const config = await this.smtp.loadWorkspaceConfig(input.workspaceId);
    if (!config) {
      return { status: 'failed', reason: 'no-smtp-config' };
    }

    const wsRes = await db.query(`SELECT id, name FROM workspaces WHERE id = $1`, [input.workspaceId]);
    const workspace = wsRes.rows[0] ?? { id: input.workspaceId, name: null };

    const template = await this.loadTemplate(input, db);
    if (!template) {
      return { status: 'failed', reason: 'template-not-found' };
    }

    const logId = uuid();
    const trackingToken = this.renderer.newTrackingToken();
    const unsubToken = await this.unsub.issueToken(input.workspaceId, input.leadId);

    const base = process.env.API_URL || 'http://localhost:3000';
    const openPixel = `${base}/api/track/open/${trackingToken}.gif`;
    const unsubscribeUrl = `${base}/api/unsubscribe/${unsubToken}`;
    const clickWrap = (url: string) =>
      `${base}/api/track/click/${trackingToken}?u=${encodeURIComponent(url)}`;

    const rendered = this.renderer.render(template.body_html, template.subject, template.body_text, {
      lead: {
        id: lead.id,
        firstName: personalization.firstName ?? lead.first_name,
        lastName: lead.last_name,
        email: lead.email,
        company: personalization.companyDisplay ?? lead.company,
        jobTitle: lead.job_title,
        city: lead.city,
        state: lead.state,
        country: lead.country,
        customFields: {
          ...(lead.custom_fields ?? {}),
          greeting: personalization.greeting,
          icebreaker: personalization.icebreaker,
          subject_token: personalization.subjectToken,
        },
      },
      workspace: { id: workspace.id, name: workspace.name },
      sender: { email: config.sendingEmail, name: config.smtpFromName },
      urls: { openPixel, unsubscribe: unsubscribeUrl, clickWrap },
    });

    const subject = input.override?.subject ?? rendered.subject;
    const html = input.override?.html ?? rendered.html;
    const text = input.override?.text ?? rendered.text;

    await this.insertPendingLog(db, {
      logId,
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      templateId: input.templateId ?? null,
      campaignId: input.campaignId ?? null,
      enrollmentId: input.enrollmentId ?? null,
      trackingToken,
      subject,
    });

    try {
      const transport = this.smtp.build(config);
      const fromName = config.smtpFromName || workspace.name || 'Logik Sense';
      const from = `${fromName} <${config.sendingEmail}>`;
      const result = await transport.send({
        from,
        to: lead.email,
        subject,
        html,
        text,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Logik-Tracking': trackingToken,
        },
      });

      await this.markSent(db, {
        logId,
        messageId: result.messageId,
        rejected: result.rejected,
        campaignId: input.campaignId,
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        email: lead.email,
        subject,
      });

      const wasRejected = (result.rejected || []).includes(lead.email);
      try {
        if (wasRejected) {
          await this.pipeline.recordEvent(input.workspaceId, input.leadId, 'bounced', {
            at: new Date().toISOString(),
            type: 'bounced',
            data: { logId, messageId: result.messageId, reason: 'rejected-at-send' },
          });
        } else {
          await this.pipeline.recordEvent(input.workspaceId, input.leadId, 'sent', {
            at: new Date().toISOString(),
            type: 'sent',
            data: { logId, messageId: result.messageId, subject, campaignId: input.campaignId ?? null },
          });
        }
      } catch (err: any) {
        this.logger.debug(`pipeline event skipped: ${err?.message ?? err}`);
      }

      return { status: 'sent', logId, messageId: result.messageId };
    } catch (err: any) {
      const reason = err?.message || 'smtp-error';
      this.logger.error(`[dispatch] send failed for lead=${input.leadId}: ${reason}`);
      await db.query(
        `UPDATE email_logs SET status = 'failed', error = $1 WHERE id = $2`,
        [String(reason).slice(0, 4000), logId],
      );
      if (input.campaignId) {
        await db.query(
          `UPDATE email_campaigns SET bounced_count = bounced_count + 1 WHERE id = $1`,
          [input.campaignId],
        );
      }
      return { status: 'failed', logId, reason };
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Pre-send personalization hook: runs the name detector for greeting + subject
   * token, lazily generates an AI icebreaker if the workspace has it enabled,
   * and - when enrichment is enabled - validates the email via ZeroBounce so we
   * skip doomed sends before we even open the SMTP socket.
   */
  private async runPersonalizationHook(
    workspaceId: string,
    lead: any,
  ): Promise<{
    firstName: string | null;
    companyDisplay: string | null;
    greeting: string;
    subjectToken: string;
    icebreaker: string;
    validationStatus: string | null;
    blockDeliverability: boolean;
  }> {
    let firstName = lead.first_name as string | null;
    let companyDisplay = lead.company as string | null;
    let greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
    let subjectToken = firstName || companyDisplay || 'there';

    try {
      const detection = this.nameDetector.detect({
        email: lead.email,
        linkedinName:
          lead.first_name && lead.last_name ? `${lead.first_name} ${lead.last_name}` : null,
        companyName: lead.company,
        jobTitle: lead.job_title,
      });
      firstName = detection.nameDetection.firstName ?? firstName;
      companyDisplay = detection.company.displayName || companyDisplay;
      greeting = detection.greeting.salutation;
      subjectToken = detection.subjectLineToken.token;
    } catch (err: any) {
      this.logger.debug(`name detector skipped: ${err?.message ?? err}`);
    }

    let icebreaker = (lead.icebreaker as string | null) ?? '';
    if (!icebreaker && companyDisplay) {
      try {
        const result = await this.icebreaker.generate({
          workspaceId,
          leadId: lead.id,
          companyName: companyDisplay,
          firstName: firstName ?? undefined,
          jobTitle: lead.job_title ?? undefined,
        });
        icebreaker = result.icebreaker;
      } catch (err: any) {
        this.logger.debug(`icebreaker skipped: ${err?.message ?? err}`);
      }
    }

    let validationStatus: string | null = lead.email_validation_status ?? null;
    let blockDeliverability = false;
    try {
      if (!validationStatus && (await this.enrichment.isEnabled(workspaceId))) {
        const verdict = await this.enrichment.verifyEmail(workspaceId, lead.email);
        if (verdict) {
          validationStatus = verdict.status;
          if (!verdict.deliverable && verdict.status !== 'unknown') {
            blockDeliverability = true;
          }
        }
      } else if (
        validationStatus === 'invalid' ||
        validationStatus === 'spamtrap' ||
        validationStatus === 'abuse' ||
        validationStatus === 'do_not_mail'
      ) {
        blockDeliverability = true;
      }
    } catch (err: any) {
      this.logger.debug(`verifyEmail skipped: ${err?.message ?? err}`);
    }

    return {
      firstName: firstName ?? null,
      companyDisplay: companyDisplay ?? null,
      greeting,
      subjectToken,
      icebreaker,
      validationStatus,
      blockDeliverability,
    };
  }

  private async loadTemplate(
    input: DispatchInput,
    db: ReturnType<typeof getDatabase>,
  ): Promise<{ subject: string; body_html: string; body_text: string | null } | null> {
    if (input.override?.html && input.override?.subject) {
      return {
        subject: input.override.subject,
        body_html: input.override.html,
        body_text: input.override.text ?? null,
      };
    }
    if (!input.templateId) return null;
    const r = await db.query(
      `SELECT subject, body_html, body_text FROM email_templates WHERE id = $1`,
      [input.templateId],
    );
    return r.rows[0] ?? null;
  }

  private async insertPendingLog(
    db: ReturnType<typeof getDatabase>,
    args: {
      logId: string;
      workspaceId: string;
      leadId: string;
      templateId: string | null;
      campaignId: string | null;
      enrollmentId: string | null;
      trackingToken: string;
      subject: string;
    },
  ) {
    await db.query(
      `INSERT INTO email_logs (id, workspace_id, lead_id, template_id, campaign_id, enrollment_id,
                               tracking_token, status, subject)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
      [
        args.logId,
        args.workspaceId,
        args.leadId,
        args.templateId,
        args.campaignId,
        args.enrollmentId,
        args.trackingToken,
        args.subject.slice(0, 512),
      ],
    );

    await db.query(
      `INSERT INTO email_analytics (workspace_id, lead_id, campaign_id, email_subject, email_address, email_sent_at)
       VALUES ($1, $2, $3, $4, (SELECT email FROM leads WHERE id = $2), CURRENT_TIMESTAMP)`,
      [args.workspaceId, args.leadId, args.campaignId, args.subject.slice(0, 255)],
    );
  }

  private async markSent(
    db: ReturnType<typeof getDatabase>,
    args: {
      logId: string;
      messageId: string;
      rejected: string[];
      campaignId?: string;
      workspaceId: string;
      leadId: string;
      email: string;
      subject: string;
    },
  ) {
    const wasRejected = (args.rejected || []).includes(args.email);
    if (wasRejected) {
      await db.query(
        `UPDATE email_logs SET status = 'bounced', message_id = $1, bounced_at = CURRENT_TIMESTAMP,
                               bounce_reason = 'rejected-at-send'
         WHERE id = $2`,
        [args.messageId, args.logId],
      );
      if (args.campaignId) {
        await db.query(
          `UPDATE email_campaigns SET bounced_count = bounced_count + 1 WHERE id = $1`,
          [args.campaignId],
        );
      }
      return;
    }
    await db.query(
      `UPDATE email_logs SET status = 'sent', message_id = $1 WHERE id = $2`,
      [args.messageId, args.logId],
    );
    if (args.campaignId) {
      await db.query(
        `UPDATE email_campaigns
         SET sent_count = sent_count + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [args.campaignId],
      );
    }
  }
}
