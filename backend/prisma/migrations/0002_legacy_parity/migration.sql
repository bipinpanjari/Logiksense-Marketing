-- Ensure legacy Phase-3 entities exist in Prisma migration history

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS email_provider_config JSONB;

ALTER TABLE email_sequences
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

ALTER TABLE email_sequences
  ALTER COLUMN status TYPE VARCHAR(50);

CREATE TABLE IF NOT EXISTS email_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  email_template_id UUID NOT NULL REFERENCES email_templates(id),
  delay_hours INT DEFAULT 0,
  condition_type VARCHAR(50) DEFAULT 'none',
  condition_value VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(sequence_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_steps_sequence ON email_sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_steps_template ON email_sequence_steps(email_template_id);

CREATE TABLE IF NOT EXISTS sequence_lead_enrollment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  current_step INT DEFAULT 1,
  status VARCHAR(50) DEFAULT 'active',
  enrolled_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  UNIQUE(sequence_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_sequence ON sequence_lead_enrollment(sequence_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_lead ON sequence_lead_enrollment(lead_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_status ON sequence_lead_enrollment(status);

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id),
  message_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  error TEXT,
  enrollment_id UUID REFERENCES sequence_lead_enrollment(id),
  sent_at TIMESTAMP DEFAULT NOW(),
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_logs_workspace ON email_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_lead ON email_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);

-- Ported data-transition steps from legacy SQL migrations
UPDATE email_configs ec
SET workspace_id = (
  SELECT w.id
  FROM workspaces w
  WHERE w.customer_id = ec.customer_id
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE ec.workspace_id IS NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, lower(email)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM leads
  WHERE email IS NOT NULL AND trim(email) <> ''
)
DELETE FROM leads
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_workspace_email_unique
ON leads (workspace_id, lower(email));

