import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_SCRAPER_JOB, ScraperJobPayload } from '../../../shared/queue.tokens';
import { ScraperOrchestratorService } from '../scraper-orchestrator.service';
import { ScraperService } from '../scraper.service';
import { getDatabase } from '../../../shared/database';

const isWorker = process.env.SCRAPER_WORKER_ENABLED !== 'false';

@Processor(QUEUE_SCRAPER_JOB, {
  concurrency: parseInt(process.env.SCRAPER_WORKER_CONCURRENCY || '1', 10),
  lockDuration: parseInt(process.env.SCRAPER_LOCK_DURATION_MS || String(15 * 60 * 1000), 10),
  // Default 30s can mis-classify long Playwright work; use a few minutes
  stalledInterval: parseInt(process.env.SCRAPER_STALLED_INTERVAL_MS || String(5 * 60 * 1000), 10),
  autorun: isWorker,
})
export class ScraperJobProcessor extends WorkerHost {
  private readonly logger = new Logger(ScraperJobProcessor.name);

  constructor(
    private readonly orchestrator: ScraperOrchestratorService,
    private readonly scraper: ScraperService,
  ) {
    super();
  }

  async process(job: Job<ScraperJobPayload>): Promise<any> {
    if (job.data.aiDigestBackfillOnly) {
      const { jobId, workspaceId, customerId } = job.data;
      if (!jobId || !customerId) {
        return { status: 'skipped', reason: 'ai-digest-missing-ids' };
      }
      const force = job.data.aiDigestForce === true;
      this.logger.log(`[scraper] AI digest backfill bullmq=${job.id} scraperJob=${jobId} force=${force}`);
      const out = await this.scraper.executeBackfillJobWebsiteDigest(workspaceId, customerId, jobId, force);
      return { status: 'ai-digest-backfill', ...out };
    }

    let jobId: string | null | undefined = job.data.jobId;
    if ((!jobId || jobId === '__pending__') && job.data.searchProfileId) {
      jobId = await this.materialiseFromProfile(job.data.searchProfileId);
      if (!jobId) return { status: 'skipped', reason: 'profile-missing' };
    }
    if (!jobId) return { status: 'skipped', reason: 'no-job-id' };

    this.logger.log(`[scraper] picking up job=${jobId} bullmq=${job.id}`);
    const out = await this.orchestrator.run({ jobId, bullJob: job });
    this.logger.log(
      `[scraper] job=${jobId} done status=${out.status} leads=${out.leadsFound} emails=${out.leadsWithEmail} ${out.reason ? `err=${out.reason}` : ''}`,
    );
    return out;
  }

  private async materialiseFromProfile(profileId: string): Promise<string | null> {
    const db = getDatabase();
    const r = await db.query(
      `SELECT id, workspace_id, customer_id, query, business_type, city, country, target_limit, is_active
       FROM search_profiles WHERE id = $1::uuid`,
      [profileId],
    );
    const p = r.rows[0];
    if (!p || !p.is_active) return null;

    const ins = await db.query(
      `INSERT INTO scraper_jobs (workspace_id, customer_id, search_profile_id, provider, query,
                                  business_type, city, country, target_limit, status)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'gmaps', $4, $5, $6, $7, $8, 'queued')
       RETURNING id`,
      [p.workspace_id, p.customer_id, p.id, p.query, p.business_type, p.city, p.country, p.target_limit],
    );
    return ins.rows[0].id;
  }
}
