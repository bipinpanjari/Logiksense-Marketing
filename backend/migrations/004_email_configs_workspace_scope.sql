-- Migration: Scope email configs to workspace (multi-tenant)

ALTER TABLE email_configs
  ADD COLUMN IF NOT EXISTS workspace_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_email_configs_workspace'
      AND table_name = 'email_configs'
  ) THEN
    ALTER TABLE email_configs
      ADD CONSTRAINT fk_email_configs_workspace
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill workspace_id for existing rows (best-effort)
UPDATE email_configs ec
SET workspace_id = (
  SELECT w.id
  FROM workspaces w
  WHERE w.customer_id = ec.customer_id
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE ec.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_configs_workspace_id ON email_configs(workspace_id);

