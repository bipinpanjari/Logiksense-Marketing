-- Phase 5: Pipeline / CRM + real analytics + inbox

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(32) NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS pipeline_stage_updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS last_replied_at TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS reply_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads(workspace_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_last_contacted ON leads(workspace_id, last_contacted_at DESC);

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- Collapse any pre-existing duplicates (workspace_id, lead_id) before adding the unique index.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY workspace_id, lead_id ORDER BY created_at ASC) AS rn
  FROM contacts
)
DELETE FROM contacts WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_workspace_lead_unique
  ON contacts(workspace_id, lead_id);

CREATE TABLE IF NOT EXISTS contact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_contact_notes_lead ON contact_notes(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_notes_workspace ON contact_notes(workspace_id, created_at DESC);

-- Inbox / replies. One row per inbound email we managed to attach to a thread.
CREATE TABLE IF NOT EXISTS inbound_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  email_log_id UUID REFERENCES email_logs(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES sequence_lead_enrollment(id) ON DELETE SET NULL,
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255),
  subject VARCHAR(1024),
  snippet TEXT,
  in_reply_to VARCHAR(512),
  message_id VARCHAR(512),
  raw_headers JSONB,
  received_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  matched BOOLEAN NOT NULL DEFAULT FALSE,
  classification VARCHAR(32),
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inbound_replies_workspace ON inbound_replies(workspace_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_replies_lead ON inbound_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_inbound_replies_in_reply_to ON inbound_replies(in_reply_to);

-- Workspace inbound webhook token for routing.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS inbound_webhook_token VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_inbound_webhook_token
  ON workspaces(inbound_webhook_token) WHERE inbound_webhook_token IS NOT NULL;
