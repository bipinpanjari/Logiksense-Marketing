-- LLM vendor (OpenAI vs Anthropic) and optional per-workspace model override.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS ai_llm_vendor VARCHAR(32) NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS ai_preferred_model VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS ai_anthropic_vault_ref VARCHAR(255) NULL;
