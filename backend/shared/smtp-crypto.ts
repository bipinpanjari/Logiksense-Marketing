import * as crypto from 'crypto';

const IV_LENGTH_BYTES = 12; // AES-GCM recommended
const TAG_LENGTH_BYTES = 16;

function requireKey(): Buffer {
  const raw = process.env.SMTP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('SMTP_ENCRYPTION_KEY is not configured');
  }

  // Accept base64/hex/utf8 secrets and derive a stable 32-byte key.
  const asHex = /^[0-9a-fA-F]+$/.test(raw) && raw.length >= 32;
  const keyMaterial = asHex
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64').length >= 16
      ? Buffer.from(raw, 'base64')
      : Buffer.from(raw, 'utf8');

  return crypto.createHash('sha256').update(keyMaterial).digest();
}

export function encryptSmtpPassword(plain: string): string {
  const key = requireKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  if (tag.length !== TAG_LENGTH_BYTES) {
    throw new Error('Unexpected GCM tag length');
  }

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

export function decryptSmtpPassword(encrypted: string): string {
  const key = requireKey();
  const [ivB64, tagB64, dataB64] = encrypted.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted SMTP password format');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return plain;
}

