-- Phase 0: Foundation hardening
-- 1. Reconcile lead scoring + segmentation columns referenced in code but missing from baseline
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS job_title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS company_size INTEGER,
  ADD COLUMN IF NOT EXISTS city VARCHAR(255),
  ADD COLUMN IF NOT EXISTS state VARCHAR(255),
  ADD COLUMN IF NOT EXISTS country VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP(6);

CREATE INDEX IF NOT EXISTS idx_leads_job_title ON leads(job_title);
CREATE INDEX IF NOT EXISTS idx_leads_is_unsubscribed ON leads(is_unsubscribed);

-- 2. Reconcile email_analytics columns referenced in code but missing
ALTER TABLE email_analytics
  ADD COLUMN IF NOT EXISTS email_address VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_bounced BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bounce_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS clicked_url TEXT,
  ADD COLUMN IF NOT EXISTS email_clicked_at TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS is_unsubscribed BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill email_address from leads.email for any pre-existing rows
UPDATE email_analytics ea
SET email_address = l.email
FROM leads l
WHERE ea.lead_id = l.id
  AND (ea.email_address IS NULL OR ea.email_address = '');

-- Mirror flags from Prisma schema
UPDATE email_analytics SET email_bounced = bounced WHERE email_bounced IS DISTINCT FROM bounced;
UPDATE email_analytics SET is_unsubscribed = unsubscribed WHERE is_unsubscribed IS DISTINCT FROM unsubscribed;
UPDATE email_analytics SET email_clicked_at = updated_at WHERE click_count > 0 AND email_clicked_at IS NULL;

-- 3. Fix registration.service.ts completion bug: it writes company_id on workspaces.
--    We also rename the Workspace to reference company by id to keep historical queries stable.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_workspaces_company_id ON workspaces(company_id);

-- 3b. registration_sessions + email_configs need DMARC tracking for Phase 0 DNS checks.
ALTER TABLE registration_sessions
  ADD COLUMN IF NOT EXISTS dmarc_valid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dmarc_policy VARCHAR(16);

ALTER TABLE email_configs
  ADD COLUMN IF NOT EXISTS dmarc_valid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dmarc_policy VARCHAR(16);

-- 4. Secrets/vault storage (Phase 0: generic secrets table, encrypted at rest).
--    Used by the VaultService for LinkedIn creds, OpenAI keys, ZeroBounce/Apollo keys, etc.
CREATE TABLE IF NOT EXISTS vault_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  scope VARCHAR(64) NOT NULL,
  ref_key VARCHAR(191) NOT NULL,
  encrypted_value TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_scope_key_ws
  ON vault_secrets(scope, ref_key, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_vault_workspace ON vault_secrets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_vault_customer ON vault_secrets(customer_id);
