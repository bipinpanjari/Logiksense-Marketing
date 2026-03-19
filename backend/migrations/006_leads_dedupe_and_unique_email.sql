-- Enforce workspace-scoped lead email uniqueness (case-insensitive)

-- 1) Deduplicate existing rows by (workspace_id, lower(email))
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

-- 2) Add unique index for future writes
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_workspace_email_unique
ON leads (workspace_id, lower(email));

