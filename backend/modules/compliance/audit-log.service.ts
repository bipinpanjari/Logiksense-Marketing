import { Injectable } from '@nestjs/common';
import { getDatabase } from '../../shared/database';

/**
 * AuditLogService wraps reads against the existing `activity_log` table
 * (seeded by other modules) so the frontend can render an admin-only search
 * view. Writes still go through the owning service to keep context.
 */
@Injectable()
export class AuditLogService {
  async list(
    workspaceId: string,
    opts: { limit?: number; offset?: number; action?: string; actorId?: string; since?: string; until?: string } = {},
  ) {
    const db = getDatabase();
    const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
    const offset = Math.max(0, opts.offset ?? 0);
    const filters: string[] = [`al.workspace_id = $1`];
    const params: any[] = [workspaceId];

    if (opts.action) {
      params.push(`%${opts.action}%`);
      filters.push(`al.action ILIKE $${params.length}`);
    }
    if (opts.actorId) {
      params.push(opts.actorId);
      filters.push(`al.performed_by = $${params.length}`);
    }
    if (opts.since) {
      params.push(opts.since);
      filters.push(`al.created_at >= $${params.length}`);
    }
    if (opts.until) {
      params.push(opts.until);
      filters.push(`al.created_at <= $${params.length}`);
    }
    params.push(limit, offset);

    const res = await db.query(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.details, al.created_at,
              al.performed_by, c.email AS actor_email, c.first_name AS actor_first_name, c.last_name AS actor_last_name
       FROM activity_logs al
       LEFT JOIN customers c ON c.id = al.performed_by
       WHERE ${filters.join(' AND ')}
       ORDER BY al.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return res.rows;
  }

  async countActions(workspaceId: string, days = 30) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT action, COUNT(*)::int AS count
       FROM activity_logs
       WHERE workspace_id = $1 AND created_at >= NOW() - ($2::int || ' days')::interval
       GROUP BY action ORDER BY count DESC LIMIT 50`,
      [workspaceId, Math.min(365, Math.max(1, days))],
    );
    return res.rows;
  }
}
