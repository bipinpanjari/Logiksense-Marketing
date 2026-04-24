import { Body, Controller, Param, Post } from '@nestjs/common';
import { RepliesService } from './replies.service';

/**
 * Inbound email webhook. Unauthenticated but scoped by the per-workspace token
 * that gets minted via the pipeline controller. Providers (Mailgun, Postmark,
 * SES, Cloudflare Email Routing) POST a payload that we normalise into a
 * `InboundPayload`.
 */
@Controller('api/inbound')
export class InboundWebhookController {
  constructor(private readonly replies: RepliesService) {}

  @Post(':token')
  async receive(@Param('token') token: string, @Body() body: any) {
    const workspaceId = await this.replies.workspaceByToken(token);
    if (!workspaceId) return { ok: false, reason: 'invalid-token' };

    const payload = this.normalise(body);
    if (!payload.fromEmail) return { ok: false, reason: 'missing-from' };

    const result = await this.replies.ingest(workspaceId, payload);
    return { ok: true, ...result };
  }

  private normalise(body: any) {
    if (!body || typeof body !== 'object') body = {};

    const fromEmail =
      body.fromEmail ||
      body.from ||
      body.sender ||
      body.From ||
      body['From'] ||
      body.headers?.from ||
      '';

    const headers = body.headers ?? body.Headers ?? body['Message-Headers'] ?? null;

    const messageId =
      body.messageId ||
      body['Message-ID'] ||
      body['Message-Id'] ||
      headers?.['message-id'] ||
      headers?.['Message-Id'];

    const inReplyTo =
      body.inReplyTo ||
      body['In-Reply-To'] ||
      headers?.['in-reply-to'] ||
      headers?.['In-Reply-To'];

    const references =
      body.references ||
      body['References'] ||
      headers?.['references'] ||
      headers?.['References'];

    return {
      fromEmail: this.extractEmail(fromEmail),
      toEmail: this.extractEmail(body.toEmail || body.to || body.recipient || body.To || ''),
      subject: body.subject || body.Subject,
      snippet: body.snippet || body.text || body['body-plain'] || body.TextBody || body.html || '',
      messageId,
      inReplyTo,
      references,
      headers,
    };
  }

  private extractEmail(raw: any): string {
    if (!raw) return '';
    const match = String(raw).match(/[^\s<]+@[^\s>]+/);
    return (match?.[0] ?? '').toLowerCase();
  }
}
