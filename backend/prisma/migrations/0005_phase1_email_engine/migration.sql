-- Phase 1: Native email send pipeline
-- Extend email_campaigns with template/sequence linkage and aggregate counters
ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sequence_id UUID REFERENCES email_sequences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES contact_segments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opened_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounced_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unsubscribed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error TEXT;

CREATE INDEX IF NOT EXISTS idx_email_campaigns_template ON email_campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_sequence ON email_campaigns(sequence_id);

-- Extend email_logs for campaign attribution + tracking token
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS bounce_reason TEXT,
  ADD COLUMN IF NOT EXISTS subject VARCHAR(512);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_logs_tracking_token ON email_logs(tracking_token) WHERE tracking_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign ON email_logs(campaign_id);

-- Unsubscribe token records tie signed URLs to a lead+workspace for revocability
CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  token VARCHAR(128) NOT NULL UNIQUE,
  used_at TIMESTAMP(6),
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_unsub_workspace ON unsubscribe_tokens(workspace_id);
CREATE INDEX IF NOT EXISTS idx_unsub_lead ON unsubscribe_tokens(lead_id);

-- Email suppression list (workspace-scoped, includes all unsubscribes and hard bounces)
CREATE TABLE IF NOT EXISTS email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  reason VARCHAR(64) NOT NULL,
  source_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_suppressions_ws_email ON email_suppressions(workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_email ON email_suppressions(email);
