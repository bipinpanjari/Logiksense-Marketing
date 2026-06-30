-- Live progress for long-running browser scrapes (avoids "silent" 10+ min waits in the UI)
ALTER TABLE "scraper_jobs" ADD COLUMN IF NOT EXISTS "progress_label" VARCHAR(500);
ALTER TABLE "scraper_jobs" ADD COLUMN IF NOT EXISTS "progress_pct" SMALLINT;
