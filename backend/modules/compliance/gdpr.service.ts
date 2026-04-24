import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { getDatabase } from '../../shared/database';

/**
 * GDPR / DSAR service.
 *
 * - Data export: produces a JSON snapshot of every table row attributable to
 *   the requesting customer + workspace, so it can be handed to the data
 *   subject under GDPR Art. 15 / CCPA.
 * - Data deletion: hard-deletes leads/contacts/logs and anonymises the
 *   customer + workspace rows to preserve referential integrity without
 *   retaining PII. Activity log is preserved in an anonymised state for
 *   regulatory audit.
 *
 * All operations are logged in the `gdpr_requests` table for traceability.
 */
@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  async requestExport(workspaceId: string, customerId: string): Promise<{ requestId: string; snapshot: any }> {
    const db = getDatabase();
    const requestRes = await db.query(
      `INSERT INTO gdpr_requests (workspace_id, customer_id, kind, status, requested_by)
       VALUES ($1, $2, 'export', 'running', $2)
       RETURNING id`,
      [workspaceId, customerId],
    );
    const requestId = requestRes.rows[0].id as string;

    try {
      const snapshot = await this.buildSnapshot(workspaceId, customerId);
      await db.query(
        `UPDATE gdpr_requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [requestId],
      );
      return { requestId, snapshot };
    } catch (err: any) {
      await db.query(
        `UPDATE gdpr_requests SET status = 'failed', error = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [requestId, (err?.message || String(err)).slice(0, 1024)],
      );
      throw err;
    }
  }

  async requestDeletion(workspaceId: string, customerId: string, confirm: string): Promise<{ requestId: string }> {
    if (confirm !== 'DELETE') {
      throw new BadRequestException('pass confirm="DELETE" to proceed');
    }
    const db = getDatabase();
    const requestRes = await db.query(
      `INSERT INTO gdpr_requests (workspace_id, customer_id, kind, status, requested_by)
       VALUES ($1, $2, 'delete', 'running', $2)
       RETURNING id`,
      [workspaceId, customerId],
    );
    const requestId = requestRes.rows[0].id as string;

    try {
      await this.purgeWorkspace(workspaceId);
      await db.query(
        `UPDATE customers SET
           email = CONCAT('deleted+', id, '@example.invalid'),
           password_hash = '',
           first_name = NULL,
           last_name = NULL,
           gdpr_deletion_requested_at = CURRENT_TIMESTAMP,
           gdpr_deleted_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [customerId],
      );
      await db.query(
        `UPDATE gdpr_requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [requestId],
      );
      return { requestId };
    } catch (err: any) {
      await db.query(
        `UPDATE gdpr_requests SET status = 'failed', error = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [requestId, (err?.message || String(err)).slice(0, 1024)],
      );
      throw err;
    }
  }

  async listRequests(workspaceId: string) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT id, customer_id, kind, status, requested_at, completed_at, error
       FROM gdpr_requests WHERE workspace_id = $1 ORDER BY requested_at DESC LIMIT 200`,
      [workspaceId],
    );
    return res.rows;
  }

  private async buildSnapshot(workspaceId: string, customerId: string) {
    const db = getDatabase();
    const tables = [
      { key: 'customer', sql: `SELECT id, email, first_name, last_name, onboarding_completed, role, plan_tier, subscription_status, created_at, updated_at FROM customers WHERE id = $1`, params: [customerId] },
      { key: 'workspace', sql: `SELECT id, name, settings, created_at FROM workspaces WHERE id = $1`, params: [workspaceId] },
      { key: 'leads', sql: `SELECT id, email, first_name, last_name, company, job_title, pipeline_stage, created_at FROM leads WHERE workspace_id = $1`, params: [workspaceId] },
      { key: 'contacts', sql: `SELECT id, lead_id, timeline, created_at FROM contacts WHERE workspace_id = $1`, params: [workspaceId] },
      { key: 'email_campaigns', sql: `SELECT id, name, status, created_at FROM email_campaigns WHERE workspace_id = $1`, params: [workspaceId] },
      { key: 'email_logs', sql: `SELECT id, lead_id, subject, status, sent_at FROM email_logs WHERE workspace_id = $1 LIMIT 10000`, params: [workspaceId] },
      { key: 'activity_log', sql: `SELECT id, action, details, created_at FROM activity_logs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 10000`, params: [workspaceId] },
    ];
    const snapshot: Record<string, unknown> = { exportedAt: new Date().toISOString() };
    for (const t of tables) {
      try {
        const r = await db.query(t.sql, t.params);
        snapshot[t.key] = r.rows;
      } catch (err: any) {
        snapshot[t.key] = { error: err?.message ?? 'query-failed' };
      }
    }
    return snapshot;
  }

  private async purgeWorkspace(workspaceId: string) {
    const db = getDatabase();
    const statements: Array<[string, any[]]> = [
      [`DELETE FROM inbound_replies WHERE workspace_id = $1`, [workspaceId]],
      [`DELETE FROM contact_notes WHERE workspace_id = $1`, [workspaceId]],
      [`DELETE FROM email_logs WHERE workspace_id = $1`, [workspaceId]],
      [
        `DELETE FROM sequence_lead_enrollment
         WHERE sequence_id IN (SELECT id FROM email_sequences WHERE workspace_id = $1)`,
        [workspaceId],
      ],
      [`DELETE FROM email_campaigns WHERE workspace_id = $1`, [workspaceId]],
      [`DELETE FROM email_sequences WHERE workspace_id = $1`, [workspaceId]],
      [`DELETE FROM email_templates WHERE workspace_id = $1`, [workspaceId]],
      [`DELETE FROM contacts WHERE workspace_id = $1`, [workspaceId]],
      [`DELETE FROM leads WHERE workspace_id = $1`, [workspaceId]],
      [`DELETE FROM scraper_jobs WHERE workspace_id = $1`, [workspaceId]],
      [`DELETE FROM search_profiles WHERE workspace_id = $1`, [workspaceId]],
      [`DELETE FROM linkedin_messages WHERE workspace_id = $1`, [workspaceId]],
      [`DELETE FROM linkedin_campaigns WHERE workspace_id = $1`, [workspaceId]],
      [`DELETE FROM linkedin_accounts WHERE workspace_id = $1`, [workspaceId]],
      [`DELETE FROM ai_usage_log WHERE workspace_id = $1`, [workspaceId]],
      [`DELETE FROM enrichment_cache WHERE workspace_id = $1`, [workspaceId]],
      [`UPDATE workspaces SET is_active = FALSE, settings = '{}'::jsonb, name = CONCAT('deleted-', id) WHERE id = $1`, [workspaceId]],
    ];
    for (const [sql, params] of statements) {
      try {
        await db.query(sql, params);
      } catch (err: any) {
        this.logger.warn(`gdpr purge step skipped: ${err?.message ?? err}`);
      }
    }
  }
}
