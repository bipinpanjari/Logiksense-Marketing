-- Phase 3: LinkedIn automation platform
-- Kill-switch flags on workspace mirror the scraper ToS pattern
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS linkedin_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS linkedin_tos_accepted_at TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS linkedin_tos_accepted_by UUID REFERENCES customers(id) ON DELETE SET NULL;

-- A LinkedIn account paired with a workspace. We never store the password in
-- plaintext - it lives in vault_secrets under scope='linkedin_password'.
CREATE TABLE IF NOT EXISTS linkedin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  -- 'active' | 'paused' | 'suspended' | 'blocked' | 'captcha_required'
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMP(6),
  last_error TEXT,
  -- Three-layer rate limiter state (hour/day/week)
  actions_today INT NOT NULL DEFAULT 0,
  actions_this_hour INT NOT NULL DEFAULT 0,
  actions_this_week INT NOT NULL DEFAULT 0,
  day_window_start TIMESTAMP(6),
  hour_window_start TIMESTAMP(6),
  week_window_start TIMESTAMP(6),
  max_per_day INT NOT NULL DEFAULT 40,
  max_per_hour INT NOT NULL DEFAULT 8,
  max_per_week INT NOT NULL DEFAULT 200,
  -- Vault refs (scope='linkedin_password' / 'linkedin_session')
  password_vault_ref VARCHAR(255),
  session_vault_ref VARCHAR(255),
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, email)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_workspace ON linkedin_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_status ON linkedin_accounts(status);

CREATE TABLE IF NOT EXISTS linkedin_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  linkedin_account_id UUID REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  -- 'draft' | 'running' | 'paused' | 'completed' | 'failed'
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  job_title_filter TEXT,
  industry_filter TEXT,
  company_size_filter TEXT,
  seniority_filter TEXT,
  location VARCHAR(255),
  max_per_day INT NOT NULL DEFAULT 20,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_run_at TIMESTAMP(6),
  paused_reason TEXT,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_linkedin_campaigns_workspace ON linkedin_campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_campaigns_status ON linkedin_campaigns(status);

-- One prospect under one campaign progressing through the DM sequence.
CREATE TABLE IF NOT EXISTS linkedin_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES linkedin_campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  profile_url TEXT NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  job_title VARCHAR(255),
  company VARCHAR(255),
  location VARCHAR(255),
  industry VARCHAR(255),
  recent_post TEXT,
  years_at_company INT,
  greeting_salutation VARCHAR(64),
  thread_id TEXT,
  sequence_step INT NOT NULL DEFAULT 0,
  -- 'pending' | 'sent' | 'replied' | 'completed' | 'failed' | 'paused'
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  next_send_at TIMESTAMP(6),
  last_action_at TIMESTAMP(6),
  reply_classification VARCHAR(32),
  reply_text TEXT,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (campaign_id, profile_url)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_seq_workspace ON linkedin_sequences(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_seq_campaign ON linkedin_sequences(campaign_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_seq_status ON linkedin_sequences(status);
CREATE INDEX IF NOT EXISTS idx_linkedin_seq_next_send ON linkedin_sequences(next_send_at);

-- Per-message record (full audit log: what was sent, when, by which account).
CREATE TABLE IF NOT EXISTS linkedin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES linkedin_campaigns(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES linkedin_sequences(id) ON DELETE CASCADE,
  linkedin_account_id UUID REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  step_number INT NOT NULL,
  -- 'connection_request' | 'dm' | 'inmail' | 'reply_received'
  kind VARCHAR(32) NOT NULL,
  -- 'queued' | 'sent' | 'failed' | 'skipped'
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  personalisation_tag VARCHAR(64),
  body TEXT NOT NULL,
  error TEXT,
  sent_at TIMESTAMP(6),
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_linkedin_msg_workspace ON linkedin_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_msg_campaign ON linkedin_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_msg_sequence ON linkedin_messages(sequence_id);

-- Audit log for compliance (account pairing, ToS acceptance, pauses, failures).
CREATE TABLE IF NOT EXISTS linkedin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  linkedin_account_id UUID REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  event VARCHAR(64) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_linkedin_audit_workspace ON linkedin_audit_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_audit_created ON linkedin_audit_log(created_at DESC);
