import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { VaultService } from '../../shared/vault.service';
import { getDatabase } from '../../shared/database';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionInput {
  workspaceId: string;
  customerId?: string | null;
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  byok: boolean;
  provider: 'openai';
}

export interface ProviderConfig {
  apiKey: string;
  byok: boolean;
  model: string;
}

const DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'gpt-4o-mini';

@Injectable()
export class OpenAiClient {
  private readonly logger = new Logger(OpenAiClient.name);
  constructor(private readonly vault: VaultService) {}

  /**
   * Resolve the API key and mode for a workspace. BYOK keys live in the vault
   * under scope=openai with ref_key=workspace:<id>. If the workspace selected
   * "platform" (default), fall back to process.env.OPENAI_API_KEY.
   */
  async resolveProvider(workspaceId: string): Promise<ProviderConfig | null> {
    const db = getDatabase();
    const wsRes = await db.query(
      `SELECT ai_provider, ai_openai_vault_ref FROM workspaces WHERE id = $1`,
      [workspaceId],
    );
    const ws = wsRes.rows[0];
    const provider = (ws?.ai_provider || 'platform') as 'platform' | 'byok';

    if (provider === 'byok') {
      const refKey = ws?.ai_openai_vault_ref || `workspace:${workspaceId}`;
      const key = await this.vault.get({ scope: 'openai', refKey, workspaceId });
      if (!key) return null;
      return { apiKey: key, byok: true, model: DEFAULT_MODEL };
    }

    const platformKey = process.env.OPENAI_API_KEY;
    if (!platformKey) return null;
    return { apiKey: platformKey, byok: false, model: DEFAULT_MODEL };
  }

  async chat(input: ChatCompletionInput): Promise<ChatCompletionResult | null> {
    const provider = await this.resolveProvider(input.workspaceId);
    if (!provider) {
      this.logger.warn(`[openai] no provider available for workspace=${input.workspaceId}`);
      return null;
    }
    const model = input.model || provider.model;
    try {
      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          messages: input.messages,
          temperature: input.temperature ?? 0.7,
          max_tokens: input.maxTokens ?? 200,
        },
        {
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );
      const text: string = res.data?.choices?.[0]?.message?.content?.trim() ?? '';
      const usage = res.data?.usage ?? {};
      return {
        text,
        model,
        inputTokens: usage.prompt_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
        byok: provider.byok,
        provider: 'openai',
      };
    } catch (err: any) {
      const detail = err?.response?.data?.error?.message || err?.message || 'openai-error';
      this.logger.warn(`[openai] chat failed: ${detail}`);
      throw new Error(detail);
    }
  }

  async storeWorkspaceKey(workspaceId: string, apiKey: string): Promise<void> {
    const refKey = `workspace:${workspaceId}`;
    await this.vault.put({
      scope: 'openai',
      refKey,
      workspaceId,
      value: apiKey,
    });
    const db = getDatabase();
    await db.query(
      `UPDATE workspaces SET ai_openai_vault_ref = $1, ai_provider = 'byok', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [refKey, workspaceId],
    );
  }

  async removeWorkspaceKey(workspaceId: string): Promise<void> {
    const refKey = `workspace:${workspaceId}`;
    await this.vault.delete({ scope: 'openai', refKey, workspaceId });
    const db = getDatabase();
    await db.query(
      `UPDATE workspaces SET ai_openai_vault_ref = NULL, ai_provider = 'platform', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [workspaceId],
    );
  }
}
