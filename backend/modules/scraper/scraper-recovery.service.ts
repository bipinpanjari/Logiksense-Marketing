import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { getDatabase } from '../../shared/database';

/**
 * When the API process restarts, Bull may re-queue later but the DB can still
 * show status=running for a job the old worker was processing. That looks like
 * a stuck "running" run with no "[scraper] picking up" logs. On boot, optionally
 * mark those rows failed so the UI and operators can re-run.
 *
 * - Development: enabled unless SCRAPER_RECOVER_RUNNING_ON_BOOT=false
 * - Production: only if SCRAPER_RECOVER_RUNNING_ON_BOOT=true
 */
@Injectable()
export class ScraperRecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScraperRecoveryService.name);

  async onApplicationBootstrap() {
    const mode = process.env.SCRAPER_RECOVER_RUNNING_ON_BOOT;
    if (mode === 'false') return;
    const dev = process.env.NODE_ENV === 'development';
    if (!dev && mode !== 'true') return;

    const db = getDatabase();
    const r = await db.query(
      `UPDATE scraper_jobs
       SET status = 'failed',
           error = 'Interrupted: app restarted while this job was still marked running. Start a new run from the profile.',
           progress_label = NULL,
           progress_pct = NULL,
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE status = 'running'
       RETURNING id`,
    );
    const n = r.rowCount ?? 0;
    if (n > 0) {
      this.logger.warn(
        `Recovered ${n} scraper job(s) left in "running" after process restart (DB consistent with new worker)`,
      );
    }
  }
}
