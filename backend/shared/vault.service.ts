import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { getDatabase } from './database';

const IV_LENGTH_BYTES = 12;
const TAG_LENGTH_BYTES = 16;

export type VaultScope =
  | 'smtp'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'ollama'
  | 'zerobounce'
  | 'apollo'
  | 'linkedin_session'
  | 'linkedin_password'
  | 'webhook_signing'
  | 'generic';

export interface VaultRef {
  scope: VaultScope;
  refKey: string;
  workspaceId?: string | null;
  customerId?: string | null;
}

export interface VaultWriteInput extends VaultRef {
  value: string;
  metadata?: Record<string, unknown>;
}

/**
 * VaultService centralises secret storage with AES-256-GCM encryption.
 * Secrets live in `vault_secrets` and are never returned to the client.
 * Derivation key: VAULT_ENCRYPTION_KEY, falling back to SMTP_ENCRYPTION_KEY
 * for backwards compatibility with existing SMTP password blobs.
 */
@Injectable()
export class VaultService {
  private deriveKey(): Buffer {
    const raw = process.env.VAULT_ENCRYPTION_KEY || process.env.SMTP_ENCRYPTION_KEY;
    if (!raw) {
      throw new Error('VAULT_ENCRYPTION_KEY (or SMTP_ENCRYPTION_KEY) is not configured');
    }
    const asHex = /^[0-9a-fA-F]+$/.test(raw) && raw.length >= 32;
    const keyMaterial = asHex
      ? Buffer.from(raw, 'hex')
      : Buffer.from(raw, 'base64').length >= 16
        ? Buffer.from(raw, 'base64')
        : Buffer.from(raw, 'utf8');
    return crypto.createHash('sha256').update(keyMaterial).digest();
  }

  encrypt(plain: string): string {
    const key = this.deriveKey();
    const iv = crypto.randomBytes(IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    if (tag.length !== TAG_LENGTH_BYTES) {
      throw new Error('Unexpected GCM tag length');
    }
    return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
  }

  decrypt(blob: string): string {
    const key = this.deriveKey();
    const [ivB64, tagB64, dataB64] = blob.split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Invalid encrypted blob format');
    }
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  async put(input: VaultWriteInput): Promise<{ id: string }> {
    const db = getDatabase();
    const encrypted = this.encrypt(input.value);
    const metadataJson = JSON.stringify(input.metadata ?? {});

    const existing = await db.query(
      `SELECT id FROM vault_secrets
       WHERE scope = $1
         AND ref_key = $2
         AND COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid) =
             COALESCE($3::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
       LIMIT 1`,
      [input.scope, input.refKey, input.workspaceId ?? null],
    );

    if (existing.rows.length > 0) {
      const id = existing.rows[0].id as string;
      await db.query(
        `UPDATE vault_secrets
         SET encrypted_value = $1, metadata = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3::uuid`,
        [encrypted, metadataJson, id],
      );
      return { id };
    }

    const insert = await db.query(
      `INSERT INTO vault_secrets (workspace_id, customer_id, scope, ref_key, encrypted_value, metadata)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb)
       RETURNING id`,
      [
        input.workspaceId ?? null,
        input.customerId ?? null,
        input.scope,
        input.refKey,
        encrypted,
        metadataJson,
      ],
    );
    return { id: insert.rows[0].id };
  }

  async get(ref: VaultRef): Promise<string | null> {
    const db = getDatabase();
    const res = await db.query(
      `SELECT encrypted_value FROM vault_secrets
       WHERE scope = $1
         AND ref_key = $2
         AND COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid) =
             COALESCE($3::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
       LIMIT 1`,
      [ref.scope, ref.refKey, ref.workspaceId ?? null],
    );
    if (res.rows.length === 0) return null;
    try {
      return this.decrypt(res.rows[0].encrypted_value);
    } catch {
      return null;
    }
  }

  async delete(ref: VaultRef): Promise<boolean> {
    const db = getDatabase();
    const res = await db.query(
      `DELETE FROM vault_secrets
       WHERE scope = $1
         AND ref_key = $2
         AND COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid) =
             COALESCE($3::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
       RETURNING id`,
      [ref.scope, ref.refKey, ref.workspaceId ?? null],
    );
    return res.rows.length > 0;
  }
}
