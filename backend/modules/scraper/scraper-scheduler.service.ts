
import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';

import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { getDatabase } from '../../shared/database';
import { QUEUE_SCRAPER_JOB, ScraperJobPayload } from '../../shared/queue.tokens';

/**
 * Loads every active SearchProfile with a schedule_cron at boot, registers it
 * as a BullMQ repeatable job so one worker instance in the cluster runs it on
 * cadence. Because BullMQ repeatable jobs dedupe on {name, cron, id}, restart
 * is idempotent.
 *
 * New profiles added at runtime will be picked up on the next process restart,
 * or call reloadSchedules() from the management API to refresh without a
 * deploy.
 */
function isScraperSchemaMissingError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Postgres undefined_table, or Prisma raw query wrapper mentioning it
  return (
    msg.includes('42P01') ||
    /relation "[^"]+" does not exist/i.test(msg) ||
    (msg.includes('search_profiles') && msg.toLowerCase().includes('does not exist'))
  );
}

@Injectable()
export class ScraperSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ScraperSchedulerService.name);


  constructor(@Optional() @InjectQueue(QUEUE_SCRAPER_JOB) private readonly queue: Queue<ScraperJobPayload>) {}


  async onModuleInit() {
    if (process.env.SCRAPER_SCHEDULER_ENABLED === 'false') return;
    try {
      await this.reloadSchedules();
    } catch (err) {
      this.logger.error(`failed to load scraper schedules: ${err instanceof Error ? err.message : err}`);
    }
  }

  async reloadSchedules() {
    const db = getDatabase();
    let res: { rows: any[]; rowCount: number };
    try {
      res = await db.query(
        `SELECT id, workspace_id, customer_id, query, business_type, city, country, target_limit, schedule_cron
       FROM search_profiles
       WHERE is_active = true AND schedule_cron IS NOT NULL AND length(schedule_cron) > 0`,
      );
    } catch (err) {
      if (isScraperSchemaMissingError(err)) {
        this.logger.warn(
          'Scraper schema is missing (e.g. search_profiles). Apply migrations: npx prisma migrate deploy',
        );
        return;
      }
      throw err;
    }

    // Remove existing repeatables that reference profile ids not present anymore
    try {
      const existing = await this.queue.getRepeatableJobs();
      for (const r of existing) {
        await this.queue.removeRepeatableByKey(r.key).catch(() => null);
      }
    } catch (err) {
      this.logger.warn(`failed to reset repeatables: ${err instanceof Error ? err.message : err}`);
    }

    for (const row of res.rows) {
      try {
        await this.queue.add(
          `scrape-profile-${row.id}`,
          {
            workspaceId: row.workspace_id,
            searchProfileId: row.id,
          } as ScraperJobPayload,
          {
            repeat: { pattern: row.schedule_cron },
            jobId: `sp-${row.id}`,
          },
        );
        this.logger.log(`scheduled search_profile=${row.id} cron="${row.schedule_cron}"`);
      } catch (err) {
        this.logger.warn(
          `failed to schedule profile=${row.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }
}
