import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { getDatabase } from '../../shared/database';
import { PipelineService } from './pipeline.service';

export interface InboundPayload {
  fromEmail: string;
  toEmail?: string;
  subject?: string;
  snippet?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[] | string;
  headers?: Record<string, any>;
}

const AUTO_REPLY_PATTERNS = [
  /out\s*of\s*office/i,
  /auto(-|\s)?reply/i,
  /vacation/i,
  /automatic response/i,
  /away from the office/i,
];

const UNSUBSCRIBE_PATTERNS = [/unsubscribe/i, /remove me/i, /stop emailing/i, /do not contact/i];
const POSITIVE_PATTERNS = [/interested/i, /tell me more/i, /sounds good/i, /let'?s chat/i, /yes/i];
const NEGATIVE_PATTERNS = [/not interested/i, /no thanks/i, /wrong person/i, /not a fit/i];

/**
 * RepliesService accepts inbound emails via a workspace-scoped webhook token
 * (Mailgun/Postmark/SES all map onto the same envelope). It matches the inbound
 * to a prior `email_logs.message_id` via In-Reply-To / References, records it,
 * flips the lead into `replied` (or `unsubscribed` / `bounced`) and auto-pauses
 * any active sequence enrollment so we don't keep blasting someone who
 * responded.
 */
@Injectable()
export class RepliesService {
  private readonly logger = new Logger(RepliesService.name);

  constructor(private readonly pipeline: PipelineService) {}

  async ensureWebhookToken(workspaceId: string): Promise<string> {
    const db = getDatabase();
    const res = await db.query(
      `SELECT inbound_webhook_token FROM workspaces WHERE id = $1`,
      [workspaceId],
    );
    if (res.rows[0]?.inbound_webhook_token) return res.rows[0].inbound_webhook_token as string;
    const token = crypto.randomBytes(24).toString('base64url');
    await db.query(
      `UPDATE workspaces SET inbound_webhook_token = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [token, workspaceId],
    );
    return token;
  }

  async rotateWebhookToken(workspaceId: string): Promise<string> {
    const db = getDatabase();
    const token = crypto.randomBytes(24).toString('base64url');
    await db.query(
      `UPDATE workspaces SET inbound_webhook_token = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [token, workspaceId],
    );
    return token;
  }

  async workspaceByToken(token: string): Promise<string | null> {
    if (!token) return null;
    const db = getDatabase();
    const res = await db.query(
      `SELECT id FROM workspaces WHERE inbound_webhook_token = $1 LIMIT 1`,
      [token],
    );
    return res.rows[0]?.id ?? null;
  }

  async ingest(workspaceId: string, payload: InboundPayload): Promise<{ matched: boolean; id: string }> {
    const db = getDatabase();
    const refs = Array.isArray(payload.references)
      ? payload.references
      : typeof payload.references === 'string'
        ? payload.references.split(/\s+/).filter(Boolean)
        : [];
    const candidates = [payload.inReplyTo, ...refs].filter(Boolean) as string[];

    let match: any = null;
    if (candidates.length > 0) {
      const inRes = await db.query(
        `SELECT id, lead_id, campaign_id, enrollment_id, workspace_id
         FROM email_logs WHERE workspace_id = $1 AND message_id = ANY($2::text[])
         ORDER BY sent_at DESC LIMIT 1`,
        [workspaceId, candidates],
      );
      match = inRes.rows[0] ?? null;
    }
    if (!match && payload.fromEmail) {
      const fallback = await db.query(
        `SELECT el.id, el.lead_id, el.campaign_id, el.enrollment_id, el.workspace_id
         FROM email_logs el
         INNER JOIN leads l ON l.id = el.lead_id
         WHERE el.workspace_id = $1 AND LOWER(l.email) = LOWER($2)
         ORDER BY el.sent_at DESC NULLS LAST LIMIT 1`,
        [workspaceId, payload.fromEmail],
      );
      match = fallback.rows[0] ?? null;
    }

    const classification = this.classify(payload);

    const insert = await db.query(
      `INSERT INTO inbound_replies
         (workspace_id, lead_id, email_log_id, campaign_id, enrollment_id,
          from_email, to_email, subject, snippet, in_reply_to, message_id, raw_headers,
          matched, classification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        workspaceId,
        match?.lead_id ?? null,
        match?.id ?? null,
        match?.campaign_id ?? null,
        match?.enrollment_id ?? null,
        payload.fromEmail,
        payload.toEmail ?? null,
        (payload.subject ?? '').slice(0, 1024),
        (payload.snippet ?? '').slice(0, 10000),
        payload.inReplyTo ?? null,
        payload.messageId ?? null,
        payload.headers ? JSON.stringify(payload.headers) : null,
        !!match,
        classification,
      ],
    );
    const id = insert.rows[0].id as string;

    if (match?.lead_id) {
      await db.query(
        `UPDATE email_logs SET replied_at = COALESCE(replied_at, CURRENT_TIMESTAMP) WHERE id = $1`,
        [match.id],
      );

      if (classification === 'unsubscribe') {
        await this.pipeline.recordEvent(workspaceId, match.lead_id, 'unsubscribed', {
          at: new Date().toISOString(),
          type: 'unsubscribed',
          data: { replyId: id, source: 'reply' },
        });
        await db.query(
          `UPDATE leads SET is_unsubscribed = TRUE, unsubscribed_at = CURRENT_TIMESTAMP WHERE id = $1 AND workspace_id = $2`,
          [match.lead_id, workspaceId],
        );
      } else {
        await this.pipeline.recordEvent(workspaceId, match.lead_id, 'replied', {
          at: new Date().toISOString(),
          type: 'replied',
          data: { replyId: id, classification, from: payload.fromEmail },
        });
      }

      if (match.enrollment_id) {
        await db.query(
          `UPDATE sequence_lead_enrollment AS sle
             SET status = 'completed', completed_at = COALESCE(sle.completed_at, CURRENT_TIMESTAMP)
            FROM email_sequences AS es
           WHERE sle.id = $1::uuid AND sle.sequence_id = es.id AND es.workspace_id = $2::uuid`,
          [match.enrollment_id, workspaceId],
        );
      }
    }

    return { matched: !!match, id };
  }

  async list(workspaceId: string, limit = 100) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT ir.id, ir.from_email, ir.to_email, ir.subject, ir.snippet, ir.received_at,
              ir.matched, ir.classification, ir.lead_id, ir.campaign_id,
              l.first_name AS lead_first_name, l.last_name AS lead_last_name, l.email AS lead_email
       FROM inbound_replies ir
       LEFT JOIN leads l ON l.id = ir.lead_id
       WHERE ir.workspace_id = $1
       ORDER BY ir.received_at DESC
       LIMIT $2`,
      [workspaceId, Math.min(500, Math.max(1, limit))],
    );
    return res.rows;
  }

  private classify(payload: InboundPayload): string {
    const text = `${payload.subject ?? ''} ${payload.snippet ?? ''}`;
    if (AUTO_REPLY_PATTERNS.some((re) => re.test(text))) return 'auto_reply';
    if (UNSUBSCRIBE_PATTERNS.some((re) => re.test(text))) return 'unsubscribe';
    if (POSITIVE_PATTERNS.some((re) => re.test(text))) return 'positive';
    if (NEGATIVE_PATTERNS.some((re) => re.test(text))) return 'negative';
    return 'neutral';
  }
}
