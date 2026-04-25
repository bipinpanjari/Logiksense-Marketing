import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { VaultService } from '../../shared/vault.service';
import { getDatabase } from '../../shared/database';
import type {
  ChatCompletionInput,
  ChatCompletionResult,
  ChatMessage,
  LlmVendor,
  ResolvedLlmCredentials,
} from './llm.types';

const DEFAULT_OPENAI_MODEL = process.env.AI_DEFAULT_MODEL || 'gpt-4o-mini';
const DEFAULT_ANTHROPIC_MODEL =
  process.env.AI_ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-6';

const ANTHROPIC_RETIRED_REPLACEMENTS: Record<string, string> = {
  'claude-3-5-sonnet-20241022': 'claude-sonnet-4-6',
  'claude-3-5-sonnet-20240620': 'claude-sonnet-4-6',
};

function splitAnthropicMessages(messages: ChatMessage[]): {
  system: string | undefined;
  messages: { role: 'user' | 'assistant'; content: string }[];
} {
  const systemParts: string[] = [];
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content);
    } else if (m.role === 'user' || m.role === 'assistant') {
      out.push({ role: m.role, content: m.content });
    }
  }
  const system = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;
  return { system, messages: out };
}

/**
 * Single entry for workspace-scoped chat completions. Routes to OpenAI or Anthropic
 * from `workspaces.ai_llm_vendor` and BYOK / platform key policy.
 */
@Injectable()
export class LlmGatewayService {
  private readonly logger = new Logger(LlmGatewayService.name);

  constructor(private readonly vault: VaultService) {}

  async resolveCredentials(workspaceId: string, requestModel?: string | null): Promise<ResolvedLlmCredentials | null> {
    const db = getDatabase();
    const wsRes = await db.query(
      `SELECT ai_provider, ai_llm_vendor, ai_preferred_model, ai_openai_vault_ref, ai_anthropic_vault_ref
       FROM workspaces WHERE id = $1::uuid`,
      [workspaceId],
    );
    const ws = wsRes.rows[0];
    if (!ws) return null;

    const vendor = ((ws.ai_llm_vendor || 'openai') as string).toLowerCase() as LlmVendor;
    if (vendor !== 'openai' && vendor !== 'anthropic') {
      this.logger.warn(`[llm] invalid ai_llm_vendor for workspace=${workspaceId}`);
      return null;
    }

    const keyMode = (ws.ai_provider || 'platform') as 'platform' | 'byok';
    const preferred = typeof ws.ai_preferred_model === 'string' ? ws.ai_preferred_model.trim() : '';
    const defaultModel = vendor === 'openai' ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL;
    let model = (requestModel || preferred || defaultModel).trim();
    if (vendor === 'anthropic') {
      model = ANTHROPIC_RETIRED_REPLACEMENTS[model] ?? model;
    }

    if (keyMode === 'byok') {
      if (vendor === 'openai') {
        const refKey = ws.ai_openai_vault_ref || `workspace:${workspaceId}`;
        const key = await this.vault.get({ scope: 'openai', refKey, workspaceId });
        if (!key) return null;
        return { vendor: 'openai', apiKey: key, byok: true, model };
      }
      const refKey = ws.ai_anthropic_vault_ref || `workspace:${workspaceId}:anthropic`;
      const key = await this.vault.get({ scope: 'anthropic', refKey, workspaceId });
      if (!key) return null;
      return { vendor: 'anthropic', apiKey: key, byok: true, model };
    }

    if (vendor === 'openai') {
      const platformKey = process.env.OPENAI_API_KEY;
      if (!platformKey) return null;
      return { vendor: 'openai', apiKey: platformKey, byok: false, model };
    }

    const platformKey = process.env.ANTHROPIC_API_KEY;
    if (!platformKey) return null;
    return { vendor: 'anthropic', apiKey: platformKey, byok: false, model };
  }

  async chat(input: ChatCompletionInput): Promise<ChatCompletionResult | null> {
    const cfg = await this.resolveCredentials(input.workspaceId, input.model);
    if (!cfg) {
      this.logger.warn(`[llm] no credentials for workspace=${input.workspaceId}`);
      return null;
    }
    if (cfg.vendor === 'openai') {
      return this.chatOpenAI(input, cfg);
    }
    return this.chatAnthropic(input, cfg);
  }

  private async chatOpenAI(
    input: ChatCompletionInput,
    cfg: ResolvedLlmCredentials,
  ): Promise<ChatCompletionResult | null> {
    const model = input.model || cfg.model;
    try {
      const body: Record<string, unknown> = {
        model,
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 200,
      };
      if (input.jsonObject) {
        body.response_format = { type: 'json_object' };
      }
      const res = await axios.post('https://api.openai.com/v1/chat/completions', body, {
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: input.jsonObject ? 120_000 : 30_000,
      });
      const text: string = res.data?.choices?.[0]?.message?.content?.trim() ?? '';
      const usage = res.data?.usage ?? {};
      return {
        text,
        model,
        inputTokens: usage.prompt_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
        byok: cfg.byok,
        provider: 'openai',
      };
    } catch (err: any) {
      const detail = err?.response?.data?.error?.message || err?.message || 'openai-error';
      this.logger.warn(`[llm] openai chat failed: ${detail}`);
      throw new Error(detail);
    }
  }

  private async chatAnthropic(
    input: ChatCompletionInput,
    cfg: ResolvedLlmCredentials,
  ): Promise<ChatCompletionResult | null> {
    const model = input.model || cfg.model;
    let { system, messages } = splitAnthropicMessages(input.messages);
    if (input.jsonObject) {
      const jsonRule =
        'You must respond with valid JSON only. No markdown code fences, no commentary before or after the JSON.';
      system = system ? `${system}\n\n${jsonRule}` : jsonRule;
    }
    if (messages.length === 0) {
      this.logger.warn('[llm] anthropic: no user/assistant messages');
      return null;
    }
    try {
      const res = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model,
          max_tokens: input.maxTokens ?? 4096,
          temperature: input.temperature ?? 0.7,
          ...(system ? { system } : {}),
          messages,
        },
        {
          headers: {
            'x-api-key': cfg.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          timeout: input.jsonObject ? 120_000 : 60_000,
        },
      );
      const blocks = res.data?.content;
      let text = '';
      if (Array.isArray(blocks)) {
        for (const b of blocks) {
          if (b?.type === 'text' && typeof b.text === 'string') {
            text += b.text;
          }
        }
      }
      text = text.trim();
      const usage = res.data?.usage ?? {};
      const inTok = usage.input_tokens ?? 0;
      const outTok = usage.output_tokens ?? 0;
      return {
        text,
        model,
        inputTokens: inTok,
        outputTokens: outTok,
        totalTokens: inTok + outTok,
        byok: cfg.byok,
        provider: 'anthropic',
      };
    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      const msg =
        (typeof body?.error === 'object' && body?.error?.message) ||
        (typeof body?.error === 'string' ? body.error : null) ||
        body?.message ||
        err?.message ||
        'anthropic-error';
      const detail = typeof msg === 'string' ? msg : JSON.stringify(msg);
      this.logger.warn(`[llm] anthropic chat failed status=${status ?? 'n/a'} model=${model} ${detail}`);
      throw new Error(detail);
    }
  }

  async storeOpenAiKey(workspaceId: string, apiKey: string): Promise<void> {
    const refKey = `workspace:${workspaceId}`;
    await this.vault.put({
      scope: 'openai',
      refKey,
      workspaceId,
      value: apiKey,
    });
    const db = getDatabase();
    await db.query(
      `UPDATE workspaces SET ai_openai_vault_ref = $1, ai_provider = 'byok', updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid`,
      [refKey, workspaceId],
    );
  }

  async removeOpenAiKey(workspaceId: string): Promise<void> {
    const db = getDatabase();
    const r = await db.query(
      `SELECT ai_llm_vendor, ai_openai_vault_ref FROM workspaces WHERE id = $1::uuid`,
      [workspaceId],
    );
    const row = r.rows[0];
    const refKey = row?.ai_openai_vault_ref || `workspace:${workspaceId}`;
    await this.vault.delete({ scope: 'openai', refKey, workspaceId });
    await db.query(
      `UPDATE workspaces SET ai_openai_vault_ref = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
      [workspaceId],
    );
    if ((row?.ai_llm_vendor || 'openai') === 'openai') {
      await db.query(
        `UPDATE workspaces SET ai_provider = 'platform', updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
        [workspaceId],
      );
    }
  }

  async storeAnthropicKey(workspaceId: string, apiKey: string): Promise<void> {
    const refKey = `workspace:${workspaceId}:anthropic`;
    await this.vault.put({
      scope: 'anthropic',
      refKey,
      workspaceId,
      value: apiKey,
    });
    const db = getDatabase();
    await db.query(
      `UPDATE workspaces SET ai_anthropic_vault_ref = $1, ai_provider = 'byok', updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid`,
      [refKey, workspaceId],
    );
  }

  async removeAnthropicKey(workspaceId: string): Promise<void> {
    const db = getDatabase();
    const r = await db.query(
      `SELECT ai_llm_vendor, ai_anthropic_vault_ref FROM workspaces WHERE id = $1::uuid`,
      [workspaceId],
    );
    const row = r.rows[0];
    const refKey = row?.ai_anthropic_vault_ref || `workspace:${workspaceId}:anthropic`;
    await this.vault.delete({ scope: 'anthropic', refKey, workspaceId });
    await db.query(
      `UPDATE workspaces SET ai_anthropic_vault_ref = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
      [workspaceId],
    );
    if ((row?.ai_llm_vendor || 'openai') === 'anthropic') {
      await db.query(
        `UPDATE workspaces SET ai_provider = 'platform', updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
        [workspaceId],
      );
    }
  }
}
