import { Injectable, Logger } from '@nestjs/common';
import { getDatabase } from '../../shared/database';

export interface UsageEvent {
  workspaceId: string;
  customerId?: string | null;
  provider: 'openai' | 'anthropic' | 'platform' | 'zerobounce' | 'apollo';
  model: string;
  operation: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  costCents?: number | null;
  byok: boolean;
  status?: 'ok' | 'error';
  error?: string | null;
}

// Pricing is maintained centrally; override via AI_PRICING_JSON env for experiments.
// Values are USD cents per 1K tokens.
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.015, output: 0.06 },
  'gpt-4o': { input: 0.25, output: 1 },
  'gpt-4.1-mini': { input: 0.015, output: 0.06 },
  'claude-3-5-sonnet-20241022': { input: 0.3, output: 1.5 },
  'claude-sonnet-4-6': { input: 0.35, output: 1.75 },
  'claude-3-5-haiku-20241022': { input: 0.08, output: 0.4 },
  'claude-3-opus-20240229': { input: 1.5, output: 7.5 },
};

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  estimateCostCents(model: string, inputTokens?: number | null, outputTokens?: number | null): number {
    const pricing = this.loadPricing()[model];
    if (!pricing) return 0;
    const inCents = ((inputTokens ?? 0) / 1000) * pricing.input;
    const outCents = ((outputTokens ?? 0) / 1000) * pricing.output;
    return Math.round((inCents + outCents) * 10000) / 10000;
  }

  async log(evt: UsageEvent): Promise<void> {
    const db = getDatabase();
    const totalTokens =
      evt.totalTokens ?? ((evt.inputTokens ?? 0) + (evt.outputTokens ?? 0) || null);
    const costCents =
      evt.costCents ?? this.estimateCostCents(evt.model, evt.inputTokens, evt.outputTokens);
    try {
      await db.query(
        `INSERT INTO ai_usage_log (workspace_id, customer_id, provider, model, operation,
                                   input_tokens, output_tokens, total_tokens, cost_cents, byok,
                                   status, error)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          evt.workspaceId,
          evt.customerId ?? null,
          evt.provider,
          evt.model,
          evt.operation,
          evt.inputTokens ?? null,
          evt.outputTokens ?? null,
          totalTokens,
          costCents,
          evt.byok,
          evt.status ?? 'ok',
          evt.error ?? null,
        ],
      );
    } catch (err: any) {
      this.logger.warn(`failed to log ai usage: ${err?.message ?? err}`);
    }
  }

  async summary(workspaceId: string, days = 30) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT provider, model, operation, byok,
              SUM(input_tokens)::int  AS input_tokens,
              SUM(output_tokens)::int AS output_tokens,
              SUM(total_tokens)::int  AS total_tokens,
              SUM(cost_cents)::numeric AS cost_cents,
              COUNT(*)::int           AS calls
       FROM ai_usage_log
       WHERE workspace_id = $1 AND created_at >= NOW() - INTERVAL '${Math.max(1, Math.min(365, days))} days'
       GROUP BY provider, model, operation, byok
       ORDER BY cost_cents DESC NULLS LAST, calls DESC`,
      [workspaceId],
    );
    return res.rows;
  }

  async recent(workspaceId: string, limit = 100) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT id, provider, model, operation, input_tokens, output_tokens, total_tokens,
              cost_cents, byok, status, error, created_at
       FROM ai_usage_log WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [workspaceId, Math.min(500, Math.max(1, limit))],
    );
    return res.rows;
  }

  private loadPricing(): Record<string, { input: number; output: number }> {
    const raw = process.env.AI_PRICING_JSON;
    if (!raw) return DEFAULT_PRICING;
    try {
      return { ...DEFAULT_PRICING, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_PRICING;
    }
  }
}
