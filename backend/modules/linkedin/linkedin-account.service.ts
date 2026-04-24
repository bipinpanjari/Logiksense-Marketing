import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { VaultService } from '../../shared/vault.service';

export interface PairAccountInput {
  email: string;
  displayName?: string;
  password: string;
  maxPerDay?: number;
  maxPerHour?: number;
  maxPerWeek?: number;
}

/**
 * LinkedInAccountService owns the credential lifecycle. Passwords are stored
 * only via VaultService (AES-256-GCM), never returned to the API, and released
 * only in-process during a login attempt. UI collects the password once; after
 * that we rotate to session cookies.
 */
@Injectable()
export class LinkedInAccountService {
  private readonly logger = new Logger(LinkedInAccountService.name);
  constructor(private readonly vault: VaultService) {}

  async list(workspaceId: string) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT id, email, display_name, status, last_login_at, last_error,
              actions_today, actions_this_hour, actions_this_week,
              day_window_start, hour_window_start, week_window_start,
              max_per_day, max_per_hour, max_per_week, created_at, updated_at
       FROM linkedin_accounts WHERE workspace_id = $1::uuid ORDER BY created_at DESC`,
      [workspaceId],
    );
    return res.rows;
  }

  async pair(workspaceId: string, customerId: string, input: PairAccountInput) {
    if (!input.email) throw new BadRequestException('email required');
    if (!input.password) throw new BadRequestException('password required to pair an account');

    const db = getDatabase();
    const existing = await db.query(
      `SELECT id FROM linkedin_accounts WHERE workspace_id = $1::uuid AND email = $2`,
      [workspaceId, input.email.toLowerCase()],
    );
    let accountId: string;
    if (existing.rows.length > 0) {
      accountId = existing.rows[0].id;
    } else {
      const ins = await db.query(
        `INSERT INTO linkedin_accounts (workspace_id, customer_id, email, display_name,
                                         max_per_day, max_per_hour, max_per_week, status)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, 'active')
         RETURNING id`,
        [
          workspaceId,
          customerId,
          input.email.toLowerCase(),
          input.displayName || null,
          input.maxPerDay ?? 40,
          input.maxPerHour ?? 8,
          input.maxPerWeek ?? 200,
        ],
      );
      accountId = ins.rows[0].id;
    }

    const refKey = `account:${accountId}`;
    await this.vault.put({
      scope: 'linkedin_password',
      refKey,
      workspaceId,
      customerId,
      value: input.password,
    });
    await db.query(
      `UPDATE linkedin_accounts SET password_vault_ref = $1, status = 'active', last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid`,
      [refKey, accountId],
    );
    await this.audit(workspaceId, customerId, accountId, 'account.paired', { email: input.email });
    return { id: accountId, status: 'active' };
  }

  async pause(workspaceId: string, accountId: string, reason?: string) {
    await this.updateStatus(workspaceId, accountId, 'paused', reason);
    await this.audit(workspaceId, null, accountId, 'account.paused', { reason });
    return { ok: true };
  }

  async resume(workspaceId: string, accountId: string) {
    await this.updateStatus(workspaceId, accountId, 'active', null);
    await this.audit(workspaceId, null, accountId, 'account.resumed', {});
    return { ok: true };
  }

  async remove(workspaceId: string, accountId: string) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT password_vault_ref, session_vault_ref FROM linkedin_accounts WHERE id = $1::uuid AND workspace_id = $2::uuid`,
      [accountId, workspaceId],
    );
    if (res.rows.length === 0) throw new NotFoundException('account not found');
    const row = res.rows[0];
    if (row.password_vault_ref) {
      await this.vault.delete({ scope: 'linkedin_password', refKey: row.password_vault_ref, workspaceId }).catch(() => null);
    }
    if (row.session_vault_ref) {
      await this.vault.delete({ scope: 'linkedin_session', refKey: row.session_vault_ref, workspaceId }).catch(() => null);
    }
    await this.audit(workspaceId, null, accountId, 'account.deleted', { accountId });
    await db.query(`DELETE FROM linkedin_accounts WHERE id = $1::uuid AND workspace_id = $2::uuid`, [accountId, workspaceId]);
    return { ok: true };
  }

  async acceptTos(workspaceId: string, customerId: string) {
    const db = getDatabase();
    await db.query(
      `UPDATE workspaces
       SET linkedin_enabled = true,
           linkedin_tos_accepted_at = CURRENT_TIMESTAMP,
           linkedin_tos_accepted_by = $2::uuid,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [workspaceId, customerId],
    );
    await this.audit(workspaceId, customerId, null, 'tos.accepted', {});
    return { ok: true };
  }

  async disable(workspaceId: string, customerId: string) {
    const db = getDatabase();
    await db.query(
      `UPDATE workspaces SET linkedin_enabled = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
      [workspaceId],
    );
    await this.audit(workspaceId, customerId, null, 'tos.disabled', {});
    return { ok: true };
  }

  async getStatus(workspaceId: string) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT linkedin_enabled, linkedin_tos_accepted_at, linkedin_tos_accepted_by FROM workspaces WHERE id = $1::uuid`,
      [workspaceId],
    );
    return {
      globalKillSwitch: process.env.LINKEDIN_KILL_SWITCH === 'true',
      enabled: Boolean(res.rows[0]?.linkedin_enabled),
      tosAcceptedAt: res.rows[0]?.linkedin_tos_accepted_at ?? null,
      tosAcceptedBy: res.rows[0]?.linkedin_tos_accepted_by ?? null,
    };
  }

  async auditLog(workspaceId: string, limit = 200) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT id, linkedin_account_id, customer_id, event, details, created_at
       FROM linkedin_audit_log
       WHERE workspace_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT $2`,
      [workspaceId, Math.min(limit, 500)],
    );
    return res.rows;
  }

  private async updateStatus(workspaceId: string, accountId: string, status: string, lastError: string | null | undefined) {
    const db = getDatabase();
    const res = await db.query(
      `UPDATE linkedin_accounts SET status = $1, last_error = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3::uuid AND workspace_id = $4::uuid
       RETURNING id`,
      [status, lastError || null, accountId, workspaceId],
    );
    if (res.rows.length === 0) throw new NotFoundException('account not found');
  }

  async audit(workspaceId: string, customerId: string | null, accountId: string | null, event: string, details: any) {
    const db = getDatabase();
    await db.query(
      `INSERT INTO linkedin_audit_log (workspace_id, customer_id, linkedin_account_id, event, details)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb)`,
      [workspaceId, customerId, accountId, event, JSON.stringify(details || {})],
    );
  }
}
