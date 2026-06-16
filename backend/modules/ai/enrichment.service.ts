import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { VaultService } from '../../shared/vault.service';
import { AiUsageService } from './ai-usage.service';
import { getDatabase } from '../../shared/database';
<<<<<<< Updated upstream
=======
import { ApolloService } from './apollo.service';
>>>>>>> Stashed changes

export interface ZeroBounceResult {
  status: string;
  sub_status?: string;
  raw: any;
  deliverable: boolean;
}

export interface ApolloPerson {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  linkedinUrl: string | null;
  raw: any;
}

const GENERIC_LOCAL = new Set([
  'info',
  'contact',
  'hello',
  'sales',
  'support',
  'admin',
  'office',
  'enquiries',
  'team',
  'marketing',
]);

/**
 * EnrichmentService wraps ZeroBounce (email validation) and Apollo.io (person
 * lookup by domain). Both providers are BYOK per-workspace; keys live in the
 * vault under scope `zerobounce` / `apollo`. Results are cached for 30 days to
 * avoid burning credits on repeat lookups.
 */
@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    private readonly vault: VaultService,
    private readonly usage: AiUsageService,
<<<<<<< Updated upstream
=======
    private readonly apollo: ApolloService,
>>>>>>> Stashed changes
  ) {}

  async isEnabled(workspaceId: string): Promise<boolean> {
    const db = getDatabase();
    const res = await db.query(
      `SELECT enrichment_enabled FROM workspaces WHERE id = $1`,
      [workspaceId],
    );
    return res.rows[0]?.enrichment_enabled === true;
  }

  async verifyEmail(workspaceId: string, email: string): Promise<ZeroBounceResult | null> {
    if (!(await this.isEnabled(workspaceId))) return null;
    if (!email) return null;

    const cached = await this.readCache(workspaceId, 'zerobounce', email.toLowerCase());
    if (cached) return cached as ZeroBounceResult;

    const apiKey = await this.vault.get({
      scope: 'zerobounce',
      refKey: `workspace:${workspaceId}`,
      workspaceId,
    });
    if (!apiKey) return null;

    try {
      const res = await axios.get('https://api.zerobounce.net/v2/validate', {
        params: { api_key: apiKey, email },
        timeout: 15000,
      });
      const status: string = res.data?.status ?? 'unknown';
      const deliverable = status === 'valid' || status === 'catch-all';
      const result: ZeroBounceResult = {
        status,
        sub_status: res.data?.sub_status,
        raw: res.data,
        deliverable,
      };
      await this.writeCache(workspaceId, 'zerobounce', email.toLowerCase(), result, 30);
      await this.usage.log({
        workspaceId,
        provider: 'zerobounce',
        model: 'validate',
        operation: 'email_validation',
        byok: true,
        status: 'ok',
      });
      return result;
    } catch (err: any) {
      await this.usage.log({
        workspaceId,
        provider: 'zerobounce',
        model: 'validate',
        operation: 'email_validation',
        byok: true,
        status: 'error',
        error: err?.message ?? 'zerobounce-error',
      });
      this.logger.warn(`zerobounce failed for ${email}: ${err?.message ?? err}`);
      return null;
    }
  }

  async enrichByDomain(
    workspaceId: string,
    domain: string,
    options: { titles?: string[] } = {},
  ): Promise<ApolloPerson | null> {
    if (!(await this.isEnabled(workspaceId))) return null;
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!cleanDomain) return null;

    const cached = await this.readCache(workspaceId, 'apollo', cleanDomain);
    if (cached) return cached as ApolloPerson;

<<<<<<< Updated upstream
    const apiKey = await this.vault.get({
      scope: 'apollo',
      refKey: `workspace:${workspaceId}`,
      workspaceId,
    });
    if (!apiKey) return null;

    try {
      const res = await axios.post(
        'https://api.apollo.io/v1/mixed_people/search',
        {
          api_key: apiKey,
          q_organization_domains: cleanDomain,
          person_titles: options.titles ?? ['CEO', 'Founder', 'Owner', 'Managing Director', 'Director'],
          page: 1,
        },
        {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
          timeout: 20000,
        },
      );
      const people: any[] = res.data?.people || [];
      const match = people.find((p) => p?.email) ?? people[0];
      if (!match) return null;
      const person: ApolloPerson = {
        email: match?.email ?? null,
        firstName: match?.first_name ?? null,
        lastName: match?.last_name ?? null,
        title: match?.title ?? null,
        linkedinUrl: match?.linkedin_url ?? null,
        raw: match,
      };
      await this.writeCache(workspaceId, 'apollo', cleanDomain, person, 30);
      await this.usage.log({
        workspaceId,
        provider: 'apollo',
        model: 'mixed_people_search',
        operation: 'company_enrichment',
        byok: true,
        status: 'ok',
      });
      return person;
    } catch (err: any) {
      await this.usage.log({
        workspaceId,
        provider: 'apollo',
        model: 'mixed_people_search',
        operation: 'company_enrichment',
        byok: true,
        status: 'error',
        error: err?.message ?? 'apollo-error',
      });
      this.logger.warn(`apollo failed for ${cleanDomain}: ${err?.message ?? err}`);
=======
    try {
      const searchRes = await this.apollo.searchPeople(workspaceId, {
        domains: [cleanDomain],
        titles: options.titles ?? ['CEO', 'Founder', 'Owner', 'Managing Director', 'Director'],
        page: 1,
        perPage: 5,
      });

      if (!searchRes || searchRes.people.length === 0) return null;

      // Find the first one that has an email, or just the first one
      const match = searchRes.people.find((p) => p.email) ?? searchRes.people[0];
      
      const person: ApolloPerson = {
        email: match.email ?? null,
        firstName: match.firstName ?? null,
        lastName: match.lastName ?? null,
        title: match.title ?? null,
        linkedinUrl: match.linkedinUrl ?? null,
        raw: match,
      };

      await this.writeCache(workspaceId, 'apollo', cleanDomain, person, 30);
      return person;
    } catch (err: any) {
      this.logger.warn(`apollo migration failed for ${cleanDomain}: ${err?.message ?? err}`);
>>>>>>> Stashed changes
      return null;
    }
  }

  /**
   * For a given lead row, attempt to upgrade a generic contact (info@, sales@)
   * to a personal contact via Apollo, then validate the email via ZeroBounce.
   * Persists enrichment metadata on the lead and returns the final decision.
   */
  async enrichLead(workspaceId: string, leadId: string): Promise<{
    changed: boolean;
    validation?: ZeroBounceResult | null;
    person?: ApolloPerson | null;
  }> {
    const db = getDatabase();
    const res = await db.query(
      `SELECT id, email, first_name, last_name, company, website FROM leads WHERE id = $1 AND workspace_id = $2`,
      [leadId, workspaceId],
    );
    if (res.rows.length === 0) return { changed: false };
    const lead = res.rows[0];

    let changed = false;
    let person: ApolloPerson | null = null;
    const email: string | null = lead.email;
    const local = email?.includes('@') ? email.split('@')[0].toLowerCase() : '';

    if (email && GENERIC_LOCAL.has(local) && lead.website) {
      person = await this.enrichByDomain(workspaceId, lead.website);
      if (person?.email) {
        await db.query(
          `UPDATE leads
             SET email = $1,
                 first_name = COALESCE(NULLIF($2,''), first_name),
                 last_name  = COALESCE(NULLIF($3,''), last_name),
                 job_title  = COALESCE(NULLIF($4,''), job_title),
                 last_enriched_at = CURRENT_TIMESTAMP,
                 enrichment = enrichment || $5::jsonb,
                 updated_at = CURRENT_TIMESTAMP
           WHERE id = $6 AND workspace_id = $7`,
          [
            person.email,
            person.firstName ?? '',
            person.lastName ?? '',
            person.title ?? '',
            JSON.stringify({ apollo: person.raw ?? null, apollo_matched_at: new Date().toISOString() }),
            leadId,
            workspaceId,
          ],
        );
        changed = true;
      }
    }

    const finalEmailRes = await db.query(
      `SELECT email FROM leads WHERE id = $1 AND workspace_id = $2`,
      [leadId, workspaceId],
    );
    const finalEmail: string | null = finalEmailRes.rows[0]?.email ?? null;

    let validation: ZeroBounceResult | null = null;
    if (finalEmail) {
      validation = await this.verifyEmail(workspaceId, finalEmail);
      if (validation) {
        await db.query(
          `UPDATE leads
             SET email_validation_status = $1,
                 last_enriched_at = CURRENT_TIMESTAMP,
                 enrichment = enrichment || $2::jsonb
           WHERE id = $3 AND workspace_id = $4`,
          [validation.status, JSON.stringify({ zerobounce: validation.raw }), leadId, workspaceId],
        );
        if (!validation.deliverable) {
          await db.query(
            `UPDATE leads SET is_suppressed = TRUE, suppression_reason = $1 WHERE id = $2 AND workspace_id = $3`,
            [`zerobounce:${validation.status}`, leadId, workspaceId],
          );
          changed = true;
        }
      }
    }

    return { changed, validation, person };
  }

  async storeApiKey(workspaceId: string, provider: 'zerobounce' | 'apollo', apiKey: string): Promise<void> {
    await this.vault.put({
      scope: provider,
      refKey: `workspace:${workspaceId}`,
      workspaceId,
      value: apiKey,
    });
    const db = getDatabase();
    const col = provider === 'zerobounce' ? 'zerobounce_vault_ref' : 'apollo_vault_ref';
    await db.query(
      `UPDATE workspaces SET ${col} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [`workspace:${workspaceId}`, workspaceId],
    );
  }

  async removeApiKey(workspaceId: string, provider: 'zerobounce' | 'apollo'): Promise<void> {
    await this.vault.delete({
      scope: provider,
      refKey: `workspace:${workspaceId}`,
      workspaceId,
    });
    const db = getDatabase();
    const col = provider === 'zerobounce' ? 'zerobounce_vault_ref' : 'apollo_vault_ref';
    await db.query(
      `UPDATE workspaces SET ${col} = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [workspaceId],
    );
  }

  private async readCache(workspaceId: string, provider: string, key: string): Promise<any | null> {
    const db = getDatabase();
    const res = await db.query(
      `SELECT result FROM enrichment_cache
       WHERE workspace_id = $1 AND provider = $2 AND lookup_key = $3
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [workspaceId, provider, key],
    );
    return res.rows[0]?.result ?? null;
  }

  private async writeCache(
    workspaceId: string,
    provider: string,
    key: string,
    value: any,
    days: number,
  ): Promise<void> {
    const db = getDatabase();
    await db.query(
      `INSERT INTO enrichment_cache (workspace_id, provider, lookup_key, result, expires_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW() + (INTERVAL '1 day') * $5)
       ON CONFLICT (workspace_id, provider, lookup_key)
       DO UPDATE SET result = EXCLUDED.result, expires_at = EXCLUDED.expires_at, created_at = NOW()`,
      [workspaceId, provider, key, JSON.stringify(value), days],
    );
  }
}
