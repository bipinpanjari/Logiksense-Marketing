import { BadRequestException, Injectable } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { OpenAiClient } from './openai.client';
import { EnrichmentService } from './enrichment.service';

export interface AiSettings {
  aiPersonalizationEnabled: boolean;
  aiProvider: 'platform' | 'byok';
  aiOpenaiConfigured: boolean;
  enrichmentEnabled: boolean;
  zerobounceConfigured: boolean;
  apolloConfigured: boolean;
  platformKeyAvailable: boolean;
}

export interface UpdateAiSettingsInput {
  aiPersonalizationEnabled?: boolean;
  aiProvider?: 'platform' | 'byok';
  enrichmentEnabled?: boolean;
  openaiApiKey?: string | null;
  zerobounceApiKey?: string | null;
  apolloApiKey?: string | null;
}

@Injectable()
export class AiSettingsService {
  constructor(
    private readonly openai: OpenAiClient,
    private readonly enrichment: EnrichmentService,
  ) {}

  async get(workspaceId: string): Promise<AiSettings> {
    const db = getDatabase();
    const res = await db.query(
      `SELECT ai_personalization_enabled, ai_provider,
              ai_openai_vault_ref, enrichment_enabled,
              zerobounce_vault_ref, apollo_vault_ref
       FROM workspaces WHERE id = $1`,
      [workspaceId],
    );
    const row = res.rows[0] ?? {};
    return {
      aiPersonalizationEnabled: !!row.ai_personalization_enabled,
      aiProvider: (row.ai_provider ?? 'platform') as 'platform' | 'byok',
      aiOpenaiConfigured: !!row.ai_openai_vault_ref,
      enrichmentEnabled: !!row.enrichment_enabled,
      zerobounceConfigured: !!row.zerobounce_vault_ref,
      apolloConfigured: !!row.apollo_vault_ref,
      platformKeyAvailable: !!process.env.OPENAI_API_KEY,
    };
  }

  async update(workspaceId: string, input: UpdateAiSettingsInput): Promise<AiSettings> {
    const db = getDatabase();

    if (typeof input.aiPersonalizationEnabled === 'boolean') {
      await db.query(
        `UPDATE workspaces SET ai_personalization_enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [input.aiPersonalizationEnabled, workspaceId],
      );
    }

    if (typeof input.enrichmentEnabled === 'boolean') {
      await db.query(
        `UPDATE workspaces SET enrichment_enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [input.enrichmentEnabled, workspaceId],
      );
    }

    if (input.aiProvider === 'platform') {
      await db.query(
        `UPDATE workspaces SET ai_provider = 'platform', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [workspaceId],
      );
    } else if (input.aiProvider === 'byok') {
      await db.query(
        `UPDATE workspaces SET ai_provider = 'byok', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [workspaceId],
      );
    }

    if (input.openaiApiKey !== undefined) {
      if (input.openaiApiKey === null || input.openaiApiKey === '') {
        await this.openai.removeWorkspaceKey(workspaceId);
      } else {
        if (!/^sk-/.test(input.openaiApiKey)) {
          throw new BadRequestException('openai key must start with "sk-"');
        }
        await this.openai.storeWorkspaceKey(workspaceId, input.openaiApiKey);
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
