<<<<<<< Updated upstream
export type LlmVendor = 'openai' | 'anthropic';
=======
export type LlmVendor = 'openai' | 'anthropic' | 'gemini' | 'ollama';
>>>>>>> Stashed changes

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
  /** OpenAI: native JSON mode. Anthropic: enforced via system instruction. */
  jsonObject?: boolean;
}

export interface ChatCompletionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  byok: boolean;
  provider: LlmVendor;
}

export interface ResolvedLlmCredentials {
  vendor: LlmVendor;
  apiKey: string;
  byok: boolean;
  model: string;
}
