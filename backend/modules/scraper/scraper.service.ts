import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { getDatabase } from '../../shared/database';
import { QUEUE_SCRAPER_JOB, ScraperJobPayload } from '../../shared/queue.tokens';

export interface CreateProfileInput {
  name: string;
  businessType: string;
  city?: string;
  country?: string;
  query?: string;
  targetLimit?: number;
  providers?: string[];
  scheduleCron?: string | null;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(@InjectQueue(QUEUE_SCRAPER_JOB) private readonly queue: Queue<ScraperJobPayload>) {}

  async listProfiles(workspaceId: string) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT id, name, business_type, city, country, query, target_limit, providers,
              schedule_cron, is_active, created_at, updated_at
       FROM search_profiles
       WHERE workspace_id = $1::uuid
       ORDER BY updated_at DESC`,
      [workspaceId],
    );
    return res.rows;
  }

  async createProfile(workspaceId: string, customerId: string, input: CreateProfileInput) {
    if (!input?.name?.trim()) throw new BadRequestException('name required');
    if (!input?.businessType?.trim()) throw new BadRequestException('businessType required');
    const query = input.query?.trim() || this.composeQuery(input.businessType, input.city, input.country);

    const db = getDatabase();
    const res = await db.query(
      `INSERT INTO search_profiles (workspace_id, customer_id, name, business_type, city, country, query,
                                     target_limit, providers, schedule_cron)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
       RETURNING id, name, business_type, city, country, query, target_limit, providers, schedule_cron, is_active, created_at, updated_at`,
      [
        workspaceId,
        customerId,
        input.name.trim(),
        input.businessType.trim(),
        input.city || null,
        input.country || null,
        query,
        input.targetLimit ?? 10,
        JSON.stringify(input.providers || ['gmaps']),
        input.scheduleCron || null,
      ],
    );
    return res.rows[0];
  }

  async updateProfile(workspaceId: string, profileId: string, input: Partial<CreateProfileInput> & { isActive?: boolean }) {
    const db = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    const push = (col: string, val: any) => {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    };
    if (typeof input.name === 'string') push('name', input.name.trim());
    if (typeof input.businessType === 'string') push('business_type', input.businessType.trim());
    if (typeof input.city === 'string') push('city', input.city);
    if (typeof input.country === 'string') push('country', input.country);
    if (typeof input.query === 'string') push('query', input.query.trim());
    if (typeof input.targetLimit === 'number') push('target_limit', input.targetLimit);
    if (Array.isArray(input.providers)) {
      fields.push(`providers = $${idx++}::jsonb`);
      values.push(JSON.stringify(input.providers));
    }
    if (typeof input.scheduleCron !== 'undefined') push('schedule_cron', input.scheduleCron || null);
    if (typeof input.isActive === 'boolean') push('is_active', input.isActive);
    if (fields.length === 0) throw new BadRequestException('no updatable fields');

    values.push(profileId);
    values.push(workspaceId);
    const wid = idx;
    const res = await db.query(
      `UPDATE search_profiles SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${wid}::uuid AND workspace_id = $${wid + 1}::uuid
       RETURNING id, name, business_type, city, country, query, target_limit, providers, schedule_cron, is_active, created_at, updated_at`,
      values,
    );
    if (res.rows.length === 0) throw new NotFoundException('profile not found');
    return res.rows[0];
  }

  async deleteProfile(workspaceId: string, profileId: string) {
    const db = getDatabase();
    await db.query(`DELETE FROM search_profiles WHERE id = $1::uuid AND workspace_id = $2::uuid`, [profileId, workspaceId]);
    return { ok: true };
  }

  async listJobs(workspaceId: string, limit = 50) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT id, provider, query, business_type, city, country, target_limit, status,
              leads_found, leads_with_email, error, progress_label, progress_pct,
              created_at, started_at, completed_at
       FROM scraper_jobs
       WHERE workspace_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT $2`,
      [workspaceId, Math.min(limit, 200)],
    );
    return res.rows;
  }

  async getJobDetail(workspaceId: string, jobId: string) {
    const db = getDatabase();
    const job = await db.query(
      `SELECT id, workspace_id, provider, query, business_type, city, country, target_limit, status,
              leads_found, leads_with_email, error, progress_label, progress_pct,
              created_at, started_at, completed_at
       FROM scraper_jobs WHERE id = $1::uuid AND workspace_id = $2::uuid`,
      [jobId, workspaceId],
    );
    if (job.rows.length === 0) throw new NotFoundException('job not found');
    const items = await db.query(
      `SELECT id, business_name, category, city, country, website_url, phone, rating, review_count,
              has_website, emails, phones, lead_id, lead_status, notes, created_at, updated_at
       FROM search_items WHERE scraper_job_id = $1::uuid
       ORDER BY created_at DESC`,
      [jobId],
    );
    return { job: job.rows[0], items: items.rows };
  }

  async runProfile(workspaceId: string, customerId: string, profileId: string) {
    await this.assertScrapingAllowed(workspaceId);
    const db = getDatabase();
    const profileRes = await db.query(
      `SELECT * FROM search_profiles WHERE id = $1::uuid AND workspace_id = $2::uuid`,
      [profileId, workspaceId],
    );
    if (profileRes.rows.length === 0) throw new NotFoundException('profile not found');
    const p = profileRes.rows[0];
    return this.enqueueJob({
      workspaceId,
      customerId,
      searchProfileId: p.id,
      provider: 'gmaps',
      query: p.query,
      businessType: p.business_type,
      city: p.city,
      country: p.country,
      targetLimit: p.target_limit,
    });
  }

  async runAdhoc(workspaceId: string, customerId: string, body: {
    query?: string;
    businessType?: string;
    city?: string;
    country?: string;
    targetLimit?: number;
    provider?: string;
  }) {
    await this.assertScrapingAllowed(workspaceId);
    const provider = body.provider || 'gmaps';
    const query = (body.query || this.composeQuery(body.businessType || '', body.city, body.country)).trim();
    if (!query) throw new BadRequestException('query or (businessType+city) required');
    return this.enqueueJob({
      workspaceId,
      customerId,
      provider,
      query,
      businessType: body.businessType,
      city: body.city,
      country: body.country,
      targetLimit: body.targetLimit ?? 10,
    });
  }

  async acceptTos(workspaceId: string, customerId: string) {
    const db = getDatabase();
    await db.query(
      `UPDATE workspaces
       SET scraping_enabled = true,
           scraping_tos_accepted_at = CURRENT_TIMESTAMP,
           scraping_tos_accepted_by = $2::uuid,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [workspaceId, customerId],
    );
    return { ok: true };
  }

  async disableScraping(workspaceId: string) {
    const db = getDatabase();
    await db.query(
      `UPDATE workspaces SET scraping_enabled = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
      [workspaceId],
    );
    return { ok: true };
  }

  async getStatus(workspaceId: string) {
    const db = getDatabase();
    const r = await db.query(
      `SELECT scraping_enabled, scraping_tos_accepted_at, scraping_tos_accepted_by FROM workspaces WHERE id = $1::uuid`,
      [workspaceId],
    );
    return {
      globalKillSwitch: process.env.SCRAPER_KILL_SWITCH === 'true',
      enabled: Boolean(r.rows[0]?.scraping_enabled),
      tosAcceptedAt: r.rows[0]?.scraping_tos_accepted_at ?? null,
      tosAcceptedBy: r.rows[0]?.scraping_tos_accepted_by ?? null,
    };
  }

  private async assertScrapingAllowed(workspaceId: string) {
    if (process.env.SCRAPER_KILL_SWITCH === 'true') {
      throw new BadRequestException('Scraping is globally disabled by the operator kill-switch');
    }
    const db = getDatabase();
    const r = await db.query(`SELECT scraping_enabled FROM workspaces WHERE id = $1::uuid`, [workspaceId]);
    if (!r.rows[0]?.scraping_enabled) {
      throw new BadRequestException('Scraping is not enabled for this workspace. Accept the scraping ToS first.');
    }
  }

  private async enqueueJob(args: {
    workspaceId: string;
    customerId: string;
    searchProfileId?: string;
    provider: string;
    query: string;
    businessType?: string;
    city?: string;
    country?: string;
    targetLimit: number;
  }) {
    const db = getDatabase();
    const ins = await db.query(
      `INSERT INTO scraper_jobs (workspace_id, customer_id, search_profile_id, provider, query,
                                  business_type, city, country, target_limit, status)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, 'queued')
       RETURNING id`,
      [
        args.workspaceId,
        args.customerId,
        args.searchProfileId || null,
        args.provider,
        args.query,
        args.businessType || null,
        args.city || null,
        args.country || null,
        args.targetLimit,
      ],
    );
    const jobId = ins.rows[0].id;

    const queueAttempts = Math.max(1, parseInt(process.env.SCRAPER_QUEUE_ATTEMPTS || '1', 10));
    const job = await this.queue.add(
      `scrape-${jobId}`,
      { jobId, workspaceId: args.workspaceId },
      {
        attempts: queueAttempts,
        // Long browser runs: second attempt in <1 min re-enters the same DB job and double-loads GMaps. Retry only for true transient errors (tune with SCRAPER_QUEUE_ATTEMPTS=2 + large backoff in prod if needed).
        backoff: { type: 'exponential', delay: 120_000 },
      },
    );
    await db.query(`UPDATE scraper_jobs SET bullmq_id = $2 WHERE id = $1::uuid`, [jobId, String(job.id)]);
    return { jobId, bullmqId: String(job.id), status: 'queued' };
  }

  private composeQuery(businessType: string, city?: string, country?: string): string {
    const parts = [businessType];
    const location = [city, country].filter(Boolean).join(', ');
    if (location) parts.push(`in ${location}`);
    return parts.join(' ').trim();
  }
}
