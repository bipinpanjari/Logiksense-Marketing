import { getDatabase } from '../../shared/database';

export interface RateDecision {
  allowed: boolean;
  reason?: 'global-kill' | 'not-enabled' | 'account-paused' | 'hour' | 'day' | 'week';
  waitMs?: number;
}

/**
 * Three-layer rate limiter for LinkedIn actions, enforced atomically in SQL
 * so concurrent workers can't double-spend a single account's quota. Windows
 * roll forward when the previous window has elapsed.
 */
export async function checkAndIncrement(accountId: string): Promise<RateDecision> {
  if (process.env.LINKEDIN_KILL_SWITCH === 'true') {
    return { allowed: false, reason: 'global-kill' };
  }

  const db = getDatabase();
  // Atomic upsert-ish update: we roll windows forward if they expired, then
  // conditionally increment counters only if all three caps allow.
  const result = await db.query(
    `
    WITH current AS (
      SELECT id, status,
             CASE WHEN hour_window_start IS NULL OR NOW() - hour_window_start >= INTERVAL '1 hour'
                  THEN 0 ELSE actions_this_hour END AS hour_count,
             CASE WHEN day_window_start IS NULL OR NOW() - day_window_start >= INTERVAL '1 day'
                  THEN 0 ELSE actions_today END AS day_count,
             CASE WHEN week_window_start IS NULL OR NOW() - week_window_start >= INTERVAL '7 days'
                  THEN 0 ELSE actions_this_week END AS week_count,
             CASE WHEN hour_window_start IS NULL OR NOW() - hour_window_start >= INTERVAL '1 hour'
                  THEN NOW() ELSE hour_window_start END AS new_hour_start,
             CASE WHEN day_window_start IS NULL OR NOW() - day_window_start >= INTERVAL '1 day'
                  THEN NOW() ELSE day_window_start END AS new_day_start,
             CASE WHEN week_window_start IS NULL OR NOW() - week_window_start >= INTERVAL '7 days'
                  THEN NOW() ELSE week_window_start END AS new_week_start,
             max_per_hour, max_per_day, max_per_week
      FROM linkedin_accounts
      WHERE id = $1
    ),
    updated AS (
      UPDATE linkedin_accounts a
      SET actions_this_hour = current.hour_count + 1,
          actions_today = current.day_count + 1,
          actions_this_week = current.week_count + 1,
          hour_window_start = current.new_hour_start,
          day_window_start  = current.new_day_start,
          week_window_start = current.new_week_start,
          updated_at = NOW()
      FROM current
      WHERE a.id = current.id
        AND current.status = 'active'
        AND current.hour_count < current.max_per_hour
        AND current.day_count  < current.max_per_day
        AND current.week_count < current.max_per_week
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM updated)::int AS updated_count,
           c.status, c.hour_count, c.day_count, c.week_count,
           c.max_per_hour, c.max_per_day, c.max_per_week
    FROM current c
    `,
    [accountId],
  );

  const row = result.rows[0];
  if (!row) return { allowed: false, reason: 'account-paused' };
  if (Number(row.updated_count) === 1) return { allowed: true };

  if (row.status !== 'active') return { allowed: false, reason: 'account-paused' };
  if (Number(row.hour_count) >= Number(row.max_per_hour)) return { allowed: false, reason: 'hour' };
  if (Number(row.day_count) >= Number(row.max_per_day)) return { allowed: false, reason: 'day' };
  if (Number(row.week_count) >= Number(row.max_per_week)) return { allowed: false, reason: 'week' };
  return { allowed: false, reason: 'account-paused' };
}
