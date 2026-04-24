import { Injectable, Logger } from '@nestjs/common';
import { OpenAiClient } from './openai.client';
import { AiUsageService } from './ai-usage.service';
import { getDatabase } from '../../shared/database';

export interface IcebreakerInput {
  workspaceId: string;
  customerId?: string | null;
  leadId?: string | null;
  companyName: string;
  websiteText?: string | null;
  industry?: string | null;
  jobTitle?: string | null;
  firstName?: string | null;
}

export interface IcebreakerResult {
  icebreaker: string;
  source: 'ai' | 'template_fallback' | 'disabled' | 'no_context';
  model?: string;
}

/**
 * Generates a single-line opening sentence for outreach. Honours the workspace
 * AI kill-switch (ai_personalization_enabled) and logs every call to the usage
 * ledger so BYOK and platform spend stay auditable.
 */
@Injectable()
export class IcebreakerService {
  private readonly logger = new Logger(IcebreakerService.name);

  constructor(
    private readonly openai: OpenAiClient,
    private readonly usage: AiUsageService,
  ) {}

  async generate(input: IcebreakerInput): Promise<IcebreakerResult> {
    const db = getDatabase();
    const wsRes = await db.query(
      `SELECT ai_personalization_enabled FROM workspaces WHERE id = $1`,
      [input.workspaceId],
    );
    const enabled = wsRes.rows[0]?.ai_personalization_enabled === true;
    if (!enabled) return { icebreaker: '', source: 'disabled' };

    const context = (input.websiteText || '').trim();
    if (!context && !input.industry && !input.jobTitle) {
      return { icebreaker: this.templateFallback(input), source: 'template_fallback' };
    }

    const messages = [
      {
        role: 'system' as const,
        content: `You are a senior B2B sales rep. Write ONE casual, specific, friendly opening sentence ("icebreaker") for an outreach email. Rules:
1. Ground it in the provided context - no generic "leading provider" phrases.
2. Strictly under 20 words.
3. No greetings, no sign-offs, no quotes. Output the sentence only.
4. If the lead has a first name use it naturally, otherwise reference the company.`,
      },
      {
        role: 'user' as const,
        content: [
          `Company: ${input.companyName}`,
          input.firstName ? `First name: ${input.firstName}` : null,
          input.industry ? `Industry: ${input.industry}` : null,
          input.jobTitle ? `Role: ${input.jobTitle}` : null,
          context ? `Website context: ${context.slice(0, 2000)}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ];

    try {
      const result = await this.openai.chat({
        workspaceId: input.workspaceId,
        customerId: input.customerId ?? null,
        messages,
        temperature: 0.7,
        maxTokens: 120,
      });
      if (!result) {
        return { icebreaker: this.templateFallback(input), source: 'template_fallback' };
      }
      await this.usage.log({
        workspaceId: input.workspaceId,
        customerId: input.customerId ?? null,
        provider: 'openai',
        model: result.model,
        operation: 'icebreaker',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        byok: result.byok,
        status: 'ok',
      });
      const cleaned = this.sanitise(result.text);
      if (input.leadId && cleaned) {
        await db.query(
          `UPDATE leads SET icebreaker = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND workspace_id = $3`,
          [cleaned, input.leadId, input.workspaceId],
        );
      }
      return { icebreaker: cleaned, source: 'ai', model: result.model };
    } catch (err: any) {
      await this.usage.log({
        workspaceId: input.workspaceId,
        customerId: input.customerId ?? null,
        provider: 'openai',
        model: 'gpt-4o-mini',
        operation: 'icebreaker',
        byok: false,
        status: 'error',
        error: err?.message ?? String(err),
      });
      this.logger.warn(`icebreaker generation failed: ${err?.message ?? err}`);
      return { icebreaker: this.templateFallback(input), source: 'template_fallback' };
    }
  }

  private sanitise(text: string): string {
    return text
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\n|\r/)[0];
  }

  private templateFallback(input: IcebreakerInput): string {
    if (input.industry && input.companyName) {
      return `I've been looking at ${input.industry} businesses and ${input.companyName} caught my attention.`;
    }
    if (input.companyName) {
      return `I was looking at what ${input.companyName} is doing and wanted to reach out.`;
    }
    return '';
  }
}
