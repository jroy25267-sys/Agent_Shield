import crypto from 'node:crypto';
import type { AdminUser } from '../types';

const SESSION_SECRET =
  process.env.AGENTSHIELD_SESSION_SECRET ||
  crypto.createHash('sha256').update('agentshield-local-dev-secret-2026').digest('hex');

const KEY_PEPPER =
  process.env.AGENTSHIELD_KEY_PEPPER || 'agentshield-pepper-v1';

export function generateApiKey(): { rawKey: string; prefix: string; hash: string } {
  const token = crypto.randomBytes(24).toString('hex');
  const rawKey = `as_live_${token}`;
  const prefix = `${rawKey.slice(0, 14)}...`;
  const hash = hashApiKey(rawKey);
  return { rawKey, prefix, hash };
}

export function hashApiKey(rawKey: string): string {
  return crypto
    .createHmac('sha256', KEY_PEPPER)
    .update(rawKey)
    .digest('hex');
}

export function verifyApiKey(rawKey: string, expectedHash: string): boolean {
  if (!rawKey || !expectedHash) return false;
  const computed = hashApiKey(rawKey);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return `${actualSalt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function signAdminToken(user: AdminUser, ttlSeconds = 86400): string {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyAdminToken(token: string): AdminUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function sanitizeForAudit(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value
      .replace(/as_live_[a-zA-Z0-9_]{16,}/gi, '[REDACTED_AGENT_KEY]')
      .replace(/sk_(?:live|test)?_?[a-zA-Z0-9_]{12,}/gi, '[REDACTED_SECRET_KEY]')
      .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_API_KEY]')
      .replace(/\b(?:\d[ -]*?){13,16}\b/g, (match) => {
        const digits = match.replace(/\D/g, '');
        return digits.length >= 13 && digits.length <= 16
          ? `****-****-****-${digits.slice(-4)}`
          : match;
      });
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForAudit);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/api_key|password|secret|token|authorization/i.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizeForAudit(v);
      }
    }
    return out;
  }
  return value;
}
