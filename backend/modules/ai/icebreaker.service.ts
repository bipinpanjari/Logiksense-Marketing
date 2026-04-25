import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from './llm-gateway.service';
import { AiUsageService } from './ai-usage.service';
import { getDatabase } from '../../shared/database';
import { mergePersonalizationInstructionsIntoSystem } from './ai-personalization-instructions.util';

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

@Injectable()
export class IcebreakerService {
  private readonly logger = new Logger(IcebreakerService.name);

  constructor(
    private readonly llm: LlmGatewayService,
    private readonly usage: AiUsageService,
  ) {}

  async generate(input: IcebreakerInput): Promise<IcebreakerResult> {
    const db = getDatabase();
    const wsRes = await db.query(
      `SELECT ai_personalization_enabled, ai_personalization_instructions FROM workspaces WHERE id = $1`,
      [input.workspaceId],
    );
    const wsRow = wsRes.rows[0];
    const enabled = wsRow?.ai_personalization_enabled === true;
    if (!enabled) return { icebreaker: '', source: 'disabled' };
    const personalizationInstructions =
      typeof wsRow?.ai_personalization_instructions === 'string'
        ? wsRow.ai_personalization_instructions
        : null;

    const context = (input.websiteText || '').trim();
    if (!context && !input.industry && !input.jobTitle) {
      return { icebreaker: this.templateFallback(input), source: 'template_fallback' };
    }

    const systemBase = `You are a senior B2B sales rep. Write ONE casual, specific, friendly opening sentence ("icebreaker") for an outreach email. Rules:
1. Ground it in the provided context - no generic "leading provider" phrases.
2. Strictly under 20 words.
3. No greetings, no sign-offs, no quotes. Output the sentence only.
4. If the lead has a first name use it naturally, otherwise reference the company.`;

    const messages = [
      {
        role: 'system' as const,
        content: mergePersonalizationInstructionsIntoSystem(systemBase, personalizationInstructions),
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

    const routing = await this.llm.resolveCredentials(input.workspaceId);
    if (!routing) {
      return { icebreaker: this.templateFallback(input), source: 'template_fallback' };
    }

    try {
      const result = await this.llm.chat({
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
        provider: result.provider,
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
        provider: routing.vendor,
        model: routing.model,
        operation: 'icebreaker',
        byok: routing.byok,
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
