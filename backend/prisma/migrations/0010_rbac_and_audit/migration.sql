-- Phase cross-cut: RBAC + GDPR/DSAR + audit log enhancements
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS gdpr_deletion_requested_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS gdpr_deleted_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_customers_role ON customers(role);

-- ensure ActivityLog exists / extend (the table is already defined in Prisma, but we add GDPR export trail here)
CREATE TABLE IF NOT EXISTS gdpr_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_by UUID REFERENCES customers(id) ON DELETE SET NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  export_url TEXT NULL,
  error TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_workspace ON gdpr_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_customer ON gdpr_requests(customer_id);
