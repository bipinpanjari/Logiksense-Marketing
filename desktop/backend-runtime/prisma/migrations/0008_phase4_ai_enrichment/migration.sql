-- Phase 4: AI personalization + enrichment

-- Feature flags + BYOK selection live on the workspace.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS ai_personalization_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(32) NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS ai_openai_vault_ref VARCHAR(255),
  ADD COLUMN IF NOT EXISTS enrichment_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS zerobounce_vault_ref VARCHAR(255),
  ADD COLUMN IF NOT EXISTS apollo_vault_ref VARCHAR(255);

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  provider VARCHAR(32) NOT NULL,
  model VARCHAR(64) NOT NULL,
  operation VARCHAR(64) NOT NULL,
  input_tokens INT,
  output_tokens INT,
  total_tokens INT,
  cost_cents NUMERIC(10,4),
  byok BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(16) NOT NULL DEFAULT 'ok',
  error TEXT,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace ON ai_usage_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_log(created_at DESC);

-- Cache of enrichment results to avoid re-spending credits.
CREATE TABLE IF NOT EXISTS enrichment_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  lookup_key VARCHAR(255) NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMP(6),
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, provider, lookup_key)
);
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_workspace ON enrichment_cache(workspace_id);

-- Lead enrichment / name-detection results live on the lead itself for fast pre-send reads.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS enrichment JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS name_detection JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS icebreaker TEXT,
  ADD COLUMN IF NOT EXISTS email_validation_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMP(6);
