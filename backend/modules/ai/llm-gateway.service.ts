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

const DEFAULT_GEMINI_MODEL = process.env.AI_GEMINI_DEFAULT_MODEL || 'gemini-1.5-flash';
const DEFAULT_OLLAMA_MODEL = process.env.AI_OLLAMA_DEFAULT_MODEL || 'mistral';


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

      `SELECT ai_provider, ai_llm_vendor, ai_preferred_model, ai_openai_vault_ref, ai_anthropic_vault_ref, ai_gemini_vault_ref, ai_ollama_vault_ref

       FROM workspaces WHERE id = $1::uuid`,
      [workspaceId],
    );
    const ws = wsRes.rows[0];
    if (!ws) return null;

    const vendor = ((ws.ai_llm_vendor || 'openai') as string).toLowerCase() as LlmVendor;

    if (!['openai', 'anthropic', 'gemini', 'ollama'].includes(vendor)) {

      this.logger.warn(`[llm] invalid ai_llm_vendor for workspace=${workspaceId}`);
      return null;
    }

    const keyMode = (ws.ai_provider || 'platform') as 'platform' | 'byok';
    const preferred = typeof ws.ai_preferred_model === 'string' ? ws.ai_preferred_model.trim() : '';

    
    let defaultModel = DEFAULT_OPENAI_MODEL;
    if (vendor === 'anthropic') defaultModel = DEFAULT_ANTHROPIC_MODEL;
    else if (vendor === 'gemini') defaultModel = DEFAULT_GEMINI_MODEL;
    else if (vendor === 'ollama') defaultModel = DEFAULT_OLLAMA_MODEL;


    let model = (requestModel || preferred || defaultModel).trim();
    if (vendor === 'anthropic') {
      model = ANTHROPIC_RETIRED_REPLACEMENTS[model] ?? model;
    }


    if (keyMode === 'byok' || vendor === 'ollama') {

      if (vendor === 'openai') {
        const refKey = ws.ai_openai_vault_ref || `workspace:${workspaceId}`;
        const key = await this.vault.get({ scope: 'openai', refKey, workspaceId });
        if (!key) return null;
        return { vendor: 'openai', apiKey: key, byok: true, model };
      }

      if (vendor === 'anthropic') {
        const refKey = ws.ai_anthropic_vault_ref || `workspace:${workspaceId}:anthropic`;
        const key = await this.vault.get({ scope: 'anthropic', refKey, workspaceId });
        if (!key) return null;
        return { vendor: 'anthropic', apiKey: key, byok: true, model };
      }
      if (vendor === 'gemini') {
        const refKey = ws.ai_gemini_vault_ref || `workspace:${workspaceId}:gemini`;
        const key = await this.vault.get({ scope: 'gemini', refKey, workspaceId });
        if (!key) return null;
        return { vendor: 'gemini', apiKey: key, byok: true, model };
      }
      if (vendor === 'ollama') {
        // Ollama usually connects to a local URL. We store it in the vault as well or use env.
        const refKey = ws.ai_ollama_vault_ref || `workspace:${workspaceId}:ollama`;
        const url = await this.vault.get({ scope: 'ollama', refKey, workspaceId });
        return { vendor: 'ollama', apiKey: url || process.env.OLLAMA_HOST || 'http://localhost:11434', byok: true, model };
      }

    }

    if (vendor === 'openai') {
      const platformKey = process.env.OPENAI_API_KEY;
      if (!platformKey) return null;
      return { vendor: 'openai', apiKey: platformKey, byok: false, model };
    }


    if (vendor === 'anthropic') {
      const platformKey = process.env.ANTHROPIC_API_KEY;
      if (!platformKey) return null;
      return { vendor: 'anthropic', apiKey: platformKey, byok: false, model };
    }

    if (vendor === 'gemini') {
      const platformKey = process.env.GEMINI_API_KEY;
      if (!platformKey) return null;
      return { vendor: 'gemini', apiKey: platformKey, byok: false, model };
    }

    return null;

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

    if (cfg.vendor === 'anthropic') {
      return this.chatAnthropic(input, cfg);
    }
    if (cfg.vendor === 'gemini') {
      return this.chatGemini(input, cfg);
    }
    if (cfg.vendor === 'ollama') {
      return this.chatOllama(input, cfg);
    }
    return null;

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


  private async chatGemini(
    input: ChatCompletionInput,
    cfg: ResolvedLlmCredentials,
  ): Promise<ChatCompletionResult | null> {
    const model = input.model || cfg.model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`;

    const contents = input.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemMessage = input.messages.find((m) => m.role === 'system');
    const system_instruction = systemMessage
      ? { parts: [{ text: systemMessage.content }] }
      : undefined;

    try {
      const res = await axios.post(
        url,
        {
          contents,
          system_instruction,
          generationConfig: {
            temperature: input.temperature ?? 0.7,
            maxOutputTokens: input.maxTokens ?? 1024,
            responseMimeType: input.jsonObject ? 'application/json' : 'text/plain',
          },
        },
        { timeout: 60_000 },
      );

      const candidate = res.data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text?.trim() ?? '';
      const usage = res.data?.usageMetadata ?? {};

      return {
        text,
        model,
        inputTokens: usage.promptTokenCount ?? 0,
        outputTokens: usage.candidatesTokenCount ?? 0,
        totalTokens: usage.totalTokenCount ?? 0,
        byok: cfg.byok,
        provider: 'gemini',
      };
    } catch (err: any) {
      const detail = err?.response?.data?.[0]?.error?.message || err?.message || 'gemini-error';
      this.logger.warn(`[llm] gemini chat failed: ${detail}`);
      throw new Error(detail);
    }
  }

  private async chatOllama(
    input: ChatCompletionInput,
    cfg: ResolvedLlmCredentials,
  ): Promise<ChatCompletionResult | null> {
    const model = input.model || cfg.model;
    const baseUrl = cfg.apiKey; // We store host URL in apiKey field for Ollama
    const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;

    try {
      const res = await axios.post(
        url,
        {
          model,
          messages: input.messages,
          stream: false,
          options: {
            temperature: input.temperature ?? 0.7,
            num_predict: input.maxTokens ?? 1024,
          },
          format: input.jsonObject ? 'json' : undefined,
        },
        { timeout: 120_000 },
      );

      const text = res.data?.message?.content?.trim() ?? '';
      const inTok = res.data?.prompt_eval_count ?? 0;
      const outTok = res.data?.eval_count ?? 0;

      return {
        text,
        model,
        inputTokens: inTok,
        outputTokens: outTok,
        totalTokens: inTok + outTok,
        byok: true,
        provider: 'ollama',
      };
    } catch (err: any) {
      this.logger.warn(`[llm] ollama chat failed: ${err.message}`);
      throw new Error(`Ollama Error: ${err.message}`);
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


  async storeGeminiKey(workspaceId: string, apiKey: string): Promise<void> {
    const refKey = `workspace:${workspaceId}:gemini`;
    await this.vault.put({
      scope: 'gemini',
      refKey,
      workspaceId,
      value: apiKey,
    });
    const db = getDatabase();
    await db.query(
      `UPDATE workspaces SET ai_gemini_vault_ref = $1, ai_provider = 'byok', updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid`,
      [refKey, workspaceId],
    );
  }

  async removeGeminiKey(workspaceId: string): Promise<void> {
    const db = getDatabase();
    const r = await db.query(
      `SELECT ai_llm_vendor, ai_gemini_vault_ref FROM workspaces WHERE id = $1::uuid`,
      [workspaceId],
    );
    const row = r.rows[0];
    const refKey = row?.ai_gemini_vault_ref || `workspace:${workspaceId}:gemini`;
    await this.vault.delete({ scope: 'gemini', refKey, workspaceId });
    await db.query(
      `UPDATE workspaces SET ai_gemini_vault_ref = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
      [workspaceId],
    );
    if ((row?.ai_llm_vendor || 'openai') === 'gemini') {
      await db.query(
        `UPDATE workspaces SET ai_provider = 'platform', updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
        [workspaceId],
      );
    }
  }

  async storeOllamaHost(workspaceId: string, host: string): Promise<void> {
    const refKey = `workspace:${workspaceId}:ollama`;
    await this.vault.put({
      scope: 'ollama',
      refKey,
      workspaceId,
      value: host,
    });
    const db = getDatabase();
    await db.query(
      `UPDATE workspaces SET ai_ollama_vault_ref = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid`,
      [refKey, workspaceId],
    );
  }

  async removeOllamaHost(workspaceId: string): Promise<void> {
    const db = getDatabase();
    const r = await db.query(
      `SELECT ai_ollama_vault_ref FROM workspaces WHERE id = $1::uuid`,
      [workspaceId],
    );
    const row = r.rows[0];
    const refKey = row?.ai_ollama_vault_ref || `workspace:${workspaceId}:ollama`;
    await this.vault.delete({ scope: 'ollama', refKey, workspaceId });
    await db.query(
      `UPDATE workspaces SET ai_ollama_vault_ref = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
      [workspaceId],
    );
  }

}
