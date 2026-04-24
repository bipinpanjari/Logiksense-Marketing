import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { getDatabase } from '../../shared/database';
import { v4 as uuid } from 'uuid';

@Injectable()
export class UnsubscribeService {
  async issueToken(workspaceId: string, leadId: string): Promise<string> {
    const db = getDatabase();
    const token = crypto.randomBytes(24).toString('hex');
    await db.query(
      `INSERT INTO unsubscribe_tokens (id, workspace_id, lead_id, token)
       VALUES ($1, $2, $3, $4)`,
      [uuid(), workspaceId, leadId, token],
    );
    return token;
  }

  async honorToken(token: string): Promise<{
    ok: boolean;
    leadId?: string;
    workspaceId?: string;
    email?: string;
  }> {
    const db = getDatabase();
    const res = await db.query(
      `SELECT ut.id, ut.lead_id, ut.workspace_id, l.email
       FROM unsubscribe_tokens ut
       LEFT JOIN leads l ON l.id = ut.lead_id
       WHERE ut.token = $1
       LIMIT 1`,
      [token],
    );
    if (res.rows.length === 0) return { ok: false };
    const row = res.rows[0];

    await db.query(
      `UPDATE unsubscribe_tokens SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP) WHERE id = $1`,
      [row.id],
    );

    await db.query(
      `UPDATE leads
       SET is_unsubscribed = true,
           unsubscribed_at = COALESCE(unsubscribed_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [row.lead_id],
    );

    if (row.email) {
      await db.query(
        `INSERT INTO email_suppressions (workspace_id, email, reason, source_lead_id)
         VALUES ($1, $2, 'unsubscribe', $3)
         ON CONFLICT (workspace_id, email) DO NOTHING`,
        [row.workspace_id, row.email.toLowerCase(), row.lead_id],
      );
    }

    return {
      ok: true,
      leadId: row.lead_id,
      workspaceId: row.workspace_id,
      email: row.email,
    };
  }

  async isSuppressed(workspaceId: string, email: string): Promise<boolean> {
    const db = getDatabase();
    const res = await db.query(
      `SELECT 1 FROM email_suppressions WHERE workspace_id = $1 AND email = $2 LIMIT 1`,
      [workspaceId, email.toLowerCase()],
    );
    return res.rows.length > 0;
  }
}
