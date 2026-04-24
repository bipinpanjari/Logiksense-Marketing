-- Phase 2: Scraper platform

-- Kill-switch settings live per-workspace so admins can freeze scraping instantly.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS scraping_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scraping_tos_accepted_at TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS scraping_tos_accepted_by UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Saved, reusable search profiles (what to scrape and where).
CREATE TABLE IF NOT EXISTS search_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  business_type VARCHAR(255) NOT NULL,
  city VARCHAR(255),
  country VARCHAR(255),
  query TEXT NOT NULL,
  target_limit INT NOT NULL DEFAULT 10,
  providers JSONB NOT NULL DEFAULT '["gmaps"]',
  schedule_cron VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_profiles_workspace ON search_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_search_profiles_active ON search_profiles(workspace_id, is_active);

-- One concrete execution of a search (manual or scheduled).
CREATE TABLE IF NOT EXISTS scraper_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  search_profile_id UUID REFERENCES search_profiles(id) ON DELETE SET NULL,
  provider VARCHAR(64) NOT NULL DEFAULT 'gmaps',
  query TEXT NOT NULL,
  business_type VARCHAR(255),
  city VARCHAR(255),
  country VARCHAR(255),
  target_limit INT NOT NULL DEFAULT 10,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  leads_found INT NOT NULL DEFAULT 0,
  leads_with_email INT NOT NULL DEFAULT 0,
  error TEXT,
  bullmq_id VARCHAR(128),
  started_at TIMESTAMP(6),
  completed_at TIMESTAMP(6),
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scraper_jobs_workspace ON scraper_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_status ON scraper_jobs(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_profile ON scraper_jobs(search_profile_id);
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_created ON scraper_jobs(workspace_id, created_at DESC);

-- One raw business result found by a scraper job (before / without becoming a lead).
CREATE TABLE IF NOT EXISTS search_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scraper_job_id UUID NOT NULL REFERENCES scraper_jobs(id) ON DELETE CASCADE,
  provider VARCHAR(64) NOT NULL DEFAULT 'gmaps',
  business_name VARCHAR(512) NOT NULL,
  category VARCHAR(255),
  city VARCHAR(255),
  country VARCHAR(255),
  website_url TEXT,
  phone VARCHAR(64),
  rating NUMERIC(3, 1),
  review_count INT,
  has_website BOOLEAN NOT NULL DEFAULT FALSE,
  emails JSONB NOT NULL DEFAULT '[]',
  phones JSONB NOT NULL DEFAULT '[]',
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  lead_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_items_workspace ON search_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_search_items_job ON search_items(scraper_job_id);
CREATE INDEX IF NOT EXISTS idx_search_items_status ON search_items(workspace_id, lead_status);
CREATE INDEX IF NOT EXISTS idx_search_items_website
  ON search_items(workspace_id, lower(coalesce(website_url, '')))
  WHERE website_url IS NOT NULL AND length(website_url) > 0;

-- Coarse history for audit + dashboards (retained after jobs are pruned).
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scraper_job_id UUID REFERENCES scraper_jobs(id) ON DELETE SET NULL,
  provider VARCHAR(64) NOT NULL,
  query TEXT NOT NULL,
  leads_found INT NOT NULL DEFAULT 0,
  leads_with_email INT NOT NULL DEFAULT 0,
  duration_ms INT,
  outcome VARCHAR(32) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_history_workspace ON search_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(workspace_id, created_at DESC);
