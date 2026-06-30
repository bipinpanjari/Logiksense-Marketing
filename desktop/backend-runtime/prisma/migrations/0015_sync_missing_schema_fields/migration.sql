-- Sync database with missing Prisma schema columns and tables for desktop client deployment

-- AlterTable
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "terms_accepted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP(6);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "two_factor_secret" VARCHAR(255);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "recovery_codes" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "password_reset_expires" TIMESTAMP(6);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "password_reset_token" VARCHAR(255);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "linkedin_url" VARCHAR(255);

-- AlterTable
ALTER TABLE "email_configs" ADD COLUMN IF NOT EXISTS "monthly_send_limit" INTEGER DEFAULT 3000;
ALTER TABLE "email_configs" ADD COLUMN IF NOT EXISTS "auth_type" VARCHAR(32) NOT NULL DEFAULT 'BASIC';
ALTER TABLE "email_configs" ADD COLUMN IF NOT EXISTS "oauth2_client_id" VARCHAR(255);
ALTER TABLE "email_configs" ADD COLUMN IF NOT EXISTS "oauth2_client_secret_encrypted" VARCHAR(500);
ALTER TABLE "email_configs" ADD COLUMN IF NOT EXISTS "oauth2_refresh_token_encrypted" TEXT;
ALTER TABLE "email_configs" ADD COLUMN IF NOT EXISTS "oauth2_tenant_id" VARCHAR(255);
ALTER TABLE "email_configs" ADD COLUMN IF NOT EXISTS "signature_html" TEXT;

-- AlterTable
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "is_warmup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "email_config_id" UUID;

-- AlterTable
ALTER TABLE "search_profiles" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC';
ALTER TABLE "search_profiles" ADD COLUMN IF NOT EXISTS "scrape_options" JSONB;

-- AlterTable
ALTER TABLE "scraper_jobs" ADD COLUMN IF NOT EXISTS "scrape_options" JSONB;

-- CreateTable (WorkspaceMember)
CREATE TABLE IF NOT EXISTS "workspace_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "role" VARCHAR(32) NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable (WorkspaceInvitation)
CREATE TABLE IF NOT EXISTS "workspace_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" VARCHAR(32) NOT NULL DEFAULT 'member',
    "token" VARCHAR(255) NOT NULL,
    "inviter_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_workspace_id_customer_id_key" ON "workspace_members"("workspace_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invitations_token_key" ON "workspace_invitations"("token");

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
