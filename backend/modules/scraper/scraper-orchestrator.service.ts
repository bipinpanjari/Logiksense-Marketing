import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { BrowserContext } from 'playwright';
import { getDatabase } from '../../shared/database';
import { closeBrowser, setupBrowser, type BrowserSetup } from './utils/browser-config';
import { GoogleMapsScraperService, GoogleMapsResult } from './gmaps-scraper.service';
import { WebsiteScraperService } from './website-scraper.service';

export interface OrchestratorInput {
  jobId: string;
  /** Bull job for `updateProgress` in Redis; DB remains source of truth for the UI */
  bullJob?: Job;
}

export interface OrchestratorResult {
  status: 'ok' | 'killed' | 'error';
  leadsFound: number;
  leadsWithEmail: number;
  reason?: string;
  durationMs: number;
}

@Injectable()
export class ScraperOrchestratorService {
  private readonly logger = new Logger(ScraperOrchestratorService.name);
  private readonly websiteEnabled = process.env.SCRAPER_WEBSITE_ENABLED !== 'false';
  private readonly placeConcurrency = Math.min(
    4,
    Math.max(1, parseInt(process.env.SCRAPER_PLACE_CONCURRENCY || '1', 10)),
  );

  constructor(
    private readonly gmaps: GoogleMapsScraperService,
    private readonly website: WebsiteScraperService,
  ) {}

  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    const start = Date.now();
    const db = getDatabase();

    const jobRes = await db.query(
      `SELECT sj.id, sj.workspace_id, sj.customer_id, sj.provider, sj.query, sj.business_type,
              sj.city, sj.country, sj.target_limit, w.scraping_enabled
       FROM scraper_jobs sj
       JOIN workspaces w ON w.id = sj.workspace_id
       WHERE sj.id = $1::uuid`,
      [input.jobId],
    );
    if (jobRes.rows.length === 0) {
      return this.finalize(input.jobId, 'error', 'job-missing', 0, 0, Date.now() - start);
    }
    const job = jobRes.rows[0];

    if (!job.scraping_enabled || process.env.SCRAPER_KILL_SWITCH === 'true') {
      await db.query(
        `UPDATE scraper_jobs SET status='skipped', error=$2, completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1::uuid`,
        [input.jobId, 'scraping-disabled'],
      );
      return this.finalize(input.jobId, 'killed', 'scraping-disabled', 0, 0, Date.now() - start);
    }

    await db.query(
      `UPDATE scraper_jobs
       SET status='running', started_at=CURRENT_TIMESTAMP,
           progress_label = $2, progress_pct = 3, updated_at=CURRENT_TIMESTAMP
       WHERE id=$1::uuid`,
      [input.jobId, 'Starting browser…'],
    );
    const bull = input.bullJob;

    const limit = job.target_limit || 10;
    this.logger.log(
      `[job ${input.jobId}] start provider=${job.provider} target_limit=${limit} website=${this.websiteEnabled} placeConcurrency=${this.placeConcurrency}`,
    );
    let browserSetup: BrowserSetup | null = null;
    let leadsFound = 0;
    let leadsWithEmail = 0;
    let errorMsg: string | null = null;

    try {
      await this.setProgress(
        db,
        input.jobId,
        bull,
        4,
        'Launching Chromium (first time: run: npx playwright install chromium)…',
      );
      this.logger.log(`[job ${input.jobId}] launching Playwright browser…`);
      browserSetup = await setupBrowser({ headless: true });
      const bctx = browserSetup.context;
      await this.setProgress(db, input.jobId, bull, 6, 'Browser ready, loading Google Maps…');
      this.logger.log(`[job ${input.jobId}] browser ready`);
      if (job.provider !== 'gmaps') {
        throw new Error(`Unsupported provider: ${job.provider}`);
      }
      const gmapsOnProgress = async (ev: {
        phase: 'load' | 'list' | 'place';
        current: number;
        total: number;
        detail?: string;
      }) => {
        if (ev.phase === 'load') {
          await this.setProgress(db, input.jobId, bull, 7, 'Google Maps: opening search');
          return;
        }
        if (ev.phase === 'list') {
          const pct = 8 + Math.min(5, ev.current);
          const label = ev.detail || 'Listing results';
          await this.setProgress(db, input.jobId, bull, pct, `Google Maps: ${label}`);
          return;
        }
        if (ev.phase === 'place') {
          const pct = 12 + (33 * ev.current) / Math.max(1, ev.total);
          const label = `Google Maps: business ${ev.current}/${ev.total}${ev.detail ? ` — ${ev.detail}` : ''}`;
          await this.setProgress(db, input.jobId, bull, Math.min(45, pct), label);
        }
      };
      const gmapsResults = await this.gmaps.scrape(bctx, job.query, limit, gmapsOnProgress);
      this.logger.log(`[job ${input.jobId}] gmaps returned ${gmapsResults.length} places`);
      await this.setProgress(
        db,
        input.jobId,
        bull,
        48,
        `Found ${gmapsResults.length} place(s); extracting & checking websites…`,
      );

      for (let i = 0; i < gmapsResults.length; i += this.placeConcurrency) {
        const batch = gmapsResults.slice(i, i + this.placeConcurrency);
        const batchResults = await Promise.all(
          batch.map((place, j) =>
            this.processOnePlace(
              db,
              job,
              input.jobId,
              place,
              i + j + 1,
              gmapsResults.length,
              bctx,
              bull,
            ),
          ),
        );
        for (const r of batchResults) {
          if (r.processed) leadsFound += 1;
          if (r.withEmail) leadsWithEmail += 1;
        }
        await this.updateRunningCounts(db, input.jobId, leadsFound, leadsWithEmail);
      }
    } catch (err: any) {
      errorMsg = err?.message || String(err);
      this.logger.error(`scraper job ${input.jobId} failed: ${errorMsg}`);
    } finally {
      if (browserSetup) {
        await closeBrowser(browserSetup);
      }
    }

    const status: OrchestratorResult['status'] = errorMsg ? 'error' : 'ok';
    await this.finalize(input.jobId, status, errorMsg || undefined, leadsFound, leadsWithEmail, Date.now() - start);
    return { status, leadsFound, leadsWithEmail, reason: errorMsg || undefined, durationMs: Date.now() - start };
  }

  private async processOnePlace(
    db: ReturnType<typeof getDatabase>,
    job: any,
    jobId: string,
    place: GoogleMapsResult,
    idx1: number,
    total: number,
    context: BrowserContext,
    bull: Job | undefined,
  ): Promise<{ processed: boolean; withEmail: boolean }> {
    const nameShort = (place.companyName || '?').slice(0, 48);
    const phasePct = 50 + (45 * (idx1 - 0.2)) / Math.max(1, total);
    await this.setProgress(
      db,
      jobId,
      bull,
      Math.min(95, phasePct),
      `Place ${idx1}/${total}: ${nameShort} — saving`,
    );
    this.logger.log(`[job ${jobId}] place ${idx1}/${total}: ${place.companyName?.slice(0, 60) || '?'}`);
    await this.persistItem(db, job, place);
    let withEmail = false;
    if (this.websiteEnabled && place.hasWebsite && place.websiteUrl) {
      await this.setProgress(
        db,
        jobId,
        bull,
        Math.min(95, 50 + (45 * idx1) / Math.max(1, total)),
        `Place ${idx1}/${total}: ${nameShort} — scanning website for emails`,
      );
      this.logger.log(`[job ${jobId}]   fetching website for emails…`);
      const ws = await this.website.scrape(context, place.websiteUrl);
      if (ws) {
        await this.updateItemFromWebsite(db, jobId, place, ws);
        if (ws.emails.length > 0) withEmail = true;
        await this.promoteToLeads(db, job, place, ws.emails);
      }
    }
    return { processed: true, withEmail };
  }

  private async setProgress(
    db: ReturnType<typeof getDatabase>,
    jobId: string,
    bull: Job | undefined,
    pct: number,
    label: string,
  ) {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    const safe = label.slice(0, 500);
    await db.query(
      `UPDATE scraper_jobs
       SET progress_label = $2, progress_pct = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [jobId, safe, p],
    );
    if (bull) {
      try {
        await bull.updateProgress({ label: safe.slice(0, 200), pct: p });
      } catch {
        // best-effort
      }
    }
  }

  private async updateRunningCounts(
    db: ReturnType<typeof getDatabase>,
    jobId: string,
    leads: number,
    withEmail: number,
  ) {
    await db.query(
      `UPDATE scraper_jobs
       SET leads_found = $2, leads_with_email = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [jobId, leads, withEmail],
    );
  }

  private async persistItem(db: ReturnType<typeof getDatabase>, job: any, place: GoogleMapsResult) {
    await db.query(
      `INSERT INTO search_items (workspace_id, scraper_job_id, provider, business_name, category, city, country,
                                 website_url, phone, rating, review_count, has_website)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        job.workspace_id,
        job.id,
        'gmaps',
        place.companyName.slice(0, 512),
        place.category?.slice(0, 255) ?? null,
        job.city,
        job.country,
        place.websiteUrl || null,
        place.phone || null,
        typeof place.rating === 'number' ? place.rating : null,
        typeof place.reviewCount === 'number' ? place.reviewCount : null,
        place.hasWebsite,
      ],
    );
  }

  private async updateItemFromWebsite(
    db: ReturnType<typeof getDatabase>,
    jobId: string,
    place: GoogleMapsResult,
    ws: { emails: string[]; phoneNumbers: string[] },
  ) {
    if (!place.websiteUrl) return;
    await db.query(
      `UPDATE search_items
       SET emails = $3::jsonb, phones = $4::jsonb,
           lead_status = CASE WHEN jsonb_array_length($3::jsonb) > 0 THEN 'extracted' ELSE 'empty' END,
           updated_at = CURRENT_TIMESTAMP
       WHERE scraper_job_id = $1::uuid AND website_url = $2`,
      [jobId, place.websiteUrl, JSON.stringify(ws.emails), JSON.stringify(ws.phoneNumbers)],
    );
  }

  private async promoteToLeads(
    db: ReturnType<typeof getDatabase>,
    job: any,
    place: GoogleMapsResult,
    emails: string[],
  ) {
    for (const email of emails) {
      const existing = await db.query(
        `SELECT id FROM leads WHERE workspace_id = $1::uuid AND lower(email) = $2 LIMIT 1`,
        [job.workspace_id, email.toLowerCase()],
      );
      let leadId: string;
      if (existing.rows.length > 0) {
        leadId = existing.rows[0].id;
        await db.query(
          `UPDATE leads SET company = COALESCE(company, $2), phone = COALESCE(phone, $3),
                            city = COALESCE(city, $4), country = COALESCE(country, $5),
                            source = COALESCE(source, 'scraper:gmaps'),
                            updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [leadId, place.companyName, place.phone || null, job.city, job.country],
        );
      } else {
        const insert =         await db.query(
          `INSERT INTO leads (workspace_id, email, company, phone, city, country, source, created_by)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, 'scraper:gmaps', $7::uuid)
           RETURNING id`,
          [job.workspace_id, email, place.companyName, place.phone || null, job.city, job.country, job.customer_id],
        );
        leadId = insert.rows[0].id;
      }

      await db.query(
        `UPDATE search_items SET lead_id = $3::uuid, lead_status = 'promoted', updated_at = CURRENT_TIMESTAMP
         WHERE scraper_job_id = $1::uuid AND website_url = $2`,
        [job.id, place.websiteUrl || null, leadId],
      );
    }
  }

  private async finalize(
    jobId: string,
    status: OrchestratorResult['status'],
    reason: string | undefined,
    leadsFound: number,
    leadsWithEmail: number,
    durationMs: number,
  ): Promise<OrchestratorResult> {
    const db = getDatabase();
    const dbStatus = status === 'ok' ? 'completed' : status === 'killed' ? 'skipped' : 'failed';
    const progressEnd =
      dbStatus === 'completed'
        ? { label: 'Complete', pct: 100 }
        : { label: null as string | null, pct: null as number | null };
    await db.query(
      `UPDATE scraper_jobs
       SET status = $2, leads_found = $3, leads_with_email = $4, error = $5,
           progress_label = $6, progress_pct = $7,
           completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [
        jobId,
        dbStatus,
        leadsFound,
        leadsWithEmail,
        reason ? reason.slice(0, 4000) : null,
        progressEnd.label,
        progressEnd.pct,
      ],
    );
    const jobRow = await db.query(`SELECT workspace_id, provider, query FROM scraper_jobs WHERE id = $1::uuid`, [jobId]);
    if (jobRow.rows[0]) {
      await db.query(
        `INSERT INTO search_history (workspace_id, scraper_job_id, provider, query, leads_found, leads_with_email, duration_ms, outcome)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8)`,
        [
          jobRow.rows[0].workspace_id,
          jobId,
          jobRow.rows[0].provider,
          jobRow.rows[0].query,
          leadsFound,
          leadsWithEmail,
          Math.round(durationMs),
          dbStatus,
        ],
      );
    }
    this.logger.log(
      `[job ${jobId}] finished outcome=${dbStatus} leads=${leadsFound} withEmail=${leadsWithEmail} durationMs=${Math.round(durationMs)}`,
    );
    return { status, leadsFound, leadsWithEmail, reason, durationMs };
  }
}
