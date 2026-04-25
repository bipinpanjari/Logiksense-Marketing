import { BadRequestException, Injectable } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { LlmGatewayService } from './llm-gateway.service';
import { EnrichmentService } from './enrichment.service';
import type { LlmVendor } from './llm.types';
import { AI_PERSONALIZATION_INSTRUCTIONS_MAX_STORED } from './ai-personalization-instructions.util';

export interface AiSettings {
  aiPersonalizationEnabled: boolean;
  aiPersonalizationInstructions: string | null;
  aiProvider: 'platform' | 'byok';
  aiLlmVendor: LlmVendor;
  aiPreferredModel: string | null;
  aiOpenaiConfigured: boolean;
  aiAnthropicConfigured: boolean;
  enrichmentEnabled: boolean;
  zerobounceConfigured: boolean;
  apolloConfigured: boolean;
  platformOpenAiAvailable: boolean;
  platformAnthropicAvailable: boolean;
}

export interface UpdateAiSettingsInput {
  aiPersonalizationEnabled?: boolean;
  aiPersonalizationInstructions?: string | null;
  aiProvider?: 'platform' | 'byok';
  aiLlmVendor?: LlmVendor;
  aiPreferredModel?: string | null;
  enrichmentEnabled?: boolean;
  openaiApiKey?: string | null;
  anthropicApiKey?: string | null;
  zerobounceApiKey?: string | null;
  apolloApiKey?: string | null;
}

function normaliseVendor(v: string | null | undefined): LlmVendor {
  const x = (v || 'openai').toLowerCase();
  if (x === 'anthropic') return 'anthropic';
  return 'openai';
}

@Injectable()
export class AiSettingsService {
  constructor(
    private readonly llm: LlmGatewayService,
    private readonly enrichment: EnrichmentService,
  ) {}

  async get(workspaceId: string): Promise<AiSettings> {
    const db = getDatabase();
    const res = await db.query(
      `SELECT ai_personalization_enabled, ai_personalization_instructions, ai_provider, ai_llm_vendor, ai_preferred_model,
              ai_openai_vault_ref, ai_anthropic_vault_ref, enrichment_enabled,
              zerobounce_vault_ref, apollo_vault_ref
       FROM workspaces WHERE id = $1::uuid`,
      [workspaceId],
    );
    const row = res.rows[0] ?? {};
    const instrRaw = row.ai_personalization_instructions;
    const instr =
      typeof instrRaw === 'string' && instrRaw.trim() ? instrRaw.trim() : null;
    return {
      aiPersonalizationEnabled: !!row.ai_personalization_enabled,
      aiPersonalizationInstructions: instr,
      aiProvider: (row.ai_provider ?? 'platform') as 'platform' | 'byok',
      aiLlmVendor: normaliseVendor(row.ai_llm_vendor),
      aiPreferredModel:
        typeof row.ai_preferred_model === 'string' && row.ai_preferred_model.trim()
          ? row.ai_preferred_model.trim()
          : null,
      aiOpenaiConfigured: !!row.ai_openai_vault_ref,
      aiAnthropicConfigured: !!row.ai_anthropic_vault_ref,
      enrichmentEnabled: !!row.enrichment_enabled,
      zerobounceConfigured: !!row.zerobounce_vault_ref,
      apolloConfigured: !!row.apollo_vault_ref,
      platformOpenAiAvailable: !!process.env.OPENAI_API_KEY,
      platformAnthropicAvailable: !!process.env.ANTHROPIC_API_KEY,
    };
  }

  async update(workspaceId: string, input: UpdateAiSettingsInput): Promise<AiSettings> {
    const db = getDatabase();

    if (typeof input.aiPersonalizationEnabled === 'boolean') {
      await db.query(
        `UPDATE workspaces SET ai_personalization_enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid`,
        [input.aiPersonalizationEnabled, workspaceId],
      );
    }

    if (input.aiPersonalizationInstructions !== undefined) {
      const raw = input.aiPersonalizationInstructions;
      if (raw === null || raw === '') {
        await db.query(
          `UPDATE workspaces SET ai_personalization_instructions = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
          [workspaceId],
        );
      } else if (typeof raw === 'string') {
        const t = raw.trim();
        if (t.length > AI_PERSONALIZATION_INSTRUCTIONS_MAX_STORED) {
          throw new BadRequestException(
            `aiPersonalizationInstructions must be at most ${AI_PERSONALIZATION_INSTRUCTIONS_MAX_STORED} characters`,
          );
        }
        await db.query(
          `UPDATE workspaces SET ai_personalization_instructions = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid`,
          [t || null, workspaceId],
        );
      } else {
        throw new BadRequestException('aiPersonalizationInstructions must be a string or null');
      }
    }

    if (typeof input.enrichmentEnabled === 'boolean') {
      await db.query(
        `UPDATE workspaces SET enrichment_enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid`,
        [input.enrichmentEnabled, workspaceId],
      );
    }

    if (input.aiProvider === 'platform') {
      await db.query(
        `UPDATE workspaces SET ai_provider = 'platform', updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
        [workspaceId],
      );
    } else if (input.aiProvider === 'byok') {
      await db.query(
        `UPDATE workspaces SET ai_provider = 'byok', updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
        [workspaceId],
      );
    }

    if (input.aiLlmVendor !== undefined) {
      const v = input.aiLlmVendor;
      if (v !== 'openai' && v !== 'anthropic') {
        throw new BadRequestException('aiLlmVendor must be openai or anthropic');
      }
      await db.query(
        `UPDATE workspaces SET ai_llm_vendor = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid`,
        [v, workspaceId],
      );
    }

    if (input.aiPreferredModel !== undefined) {
      const raw = input.aiPreferredModel;
      const trimmed = typeof raw === 'string' ? raw.trim() : '';
      await db.query(
        `UPDATE workspaces SET ai_preferred_model = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid`,
        [trimmed || null, workspaceId],
      );
    }

    if (input.openaiApiKey !== undefined) {
      if (input.openaiApiKey === null || input.openaiApiKey === '') {
        await this.llm.removeOpenAiKey(workspaceId);
      } else {
        if (!/^sk-/.test(input.openaiApiKey)) {
          throw new BadRequestException('OpenAI API key must start with sk-');
        }
        await this.llm.storeOpenAiKey(workspaceId, input.openaiApiKey);
      }
    }

    if (input.anthropicApiKey !== undefined) {
      if (input.anthropicApiKey === null || input.anthropicApiKey === '') {
        await this.llm.removeAnthropicKey(workspaceId);
      } else {
        if (!/^sk-ant-[a-zA-Z0-9_-]+/.test(input.anthropicApiKey)) {
          throw new BadRequestException('Anthropic API key must start with sk-ant-');
        }
        await this.llm.storeAnthropicKey(workspaceId, input.anthropicApiKey);
      }
    }

    if (input.zerobounceApiKey !== undefined) {
      if (!input.zerobounceApiKey) {
        await this.enrichment.removeApiKey(workspaceId, 'zerobounce');
      } else {
        await this.enrichment.storeApiKey(workspaceId, 'zerobounce', input.zerobounceApiKey);
      }
    }

    if (input.apolloApiKey !== undefined) {
      if (!input.apolloApiKey) {
        await this.enrichment.removeApiKey(workspaceId, 'apollo');
      } else {
        await this.enrichment.storeApiKey(workspaceId, 'apollo', input.apolloApiKey);
      }
    }

    return this.get(workspaceId);
  }
}
