import * as crypto from 'node:crypto';

/**
 * Signing for the LOCAL storage driver's download URLs.
 *
 * Background: with STORAGE_DRIVER=local the browser viewer loads document bytes from the
 * `GET /dev-storage/*` route, which is intentionally excluded from the auth middleware so an
 * <iframe>/<img> can load it without an Authorization header (same as a presigned S3 GET).
 * That makes the signature the ONLY access control on this route, so it must be unforgeable
 * and time-limited — a keyed HMAC over (key + expiry), never a plain unkeyed hash.
 *
 * In production the S3/MinIO adapter uses real AWS presigned URLs and this module is unused.
 */

/** Secret for the download-URL HMAC. Reuses the already-required, already-validated JWT secret
 *  so no new mandatory env var is introduced (a dedicated STORAGE_URL_SECRET may override it). */
export function storageUrlSecret(): string {
  return process.env.STORAGE_URL_SECRET
    || process.env.JWT_SECRET
    || process.env.AUTH_JWT_SECRET
    || 'dev-only-not-for-prod';
}

/** Keyed signature over the exact storage key and expiry (ms since epoch). */
export function signStorageKey(storageKey: string, expMs: number, secret = storageUrlSecret()): string {
  return crypto.createHmac('sha256', secret).update(`${storageKey}\n${expMs}`).digest('hex');
}

/** Build a signed, time-limited relative URL for the local dev-storage GET route. */
export function buildSignedLocalUrl(storageKey: string, ttlSeconds: number, secret = storageUrlSecret()): string {
  const exp = Date.now() + ttlSeconds * 1000;
  const sig = signStorageKey(storageKey, exp, secret);
  return `/dev-storage/${encodeURIComponent(storageKey)}?exp=${exp}&sig=${sig}`;
}

/** Upper bound on accepted expiry: a signed URL is never valid more than a day out, so even a
 *  mis-issued or replayed token has bounded life (we only ever issue minutes-long TTLs). */
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

/**
 * Verify an (exp, sig) pair for a key: present, both single strings (duplicate query params arrive
 * as arrays → rejected), expiry finite / not past / not absurdly far future, and the HMAC matches
 * in constant time. Never throws — any malformed input returns false.
 */
export function verifyStorageSignature(storageKey: string, exp: unknown, sig: unknown, secret = storageUrlSecret()): boolean {
  if (typeof exp !== 'string' || typeof sig !== 'string' || exp === '' || sig === '') return false;
  if (!/^[0-9]+$/.test(exp)) return false;               // strict integer ms, no NaN/Infinity/sign/float
  const expMs = Number(exp);
  const now = Date.now();
  if (!Number.isFinite(expMs) || expMs < now || expMs > now + MAX_FUTURE_MS) return false;
  if (!/^[0-9a-f]+$/i.test(sig)) return false;           // hex only
  const expected = signStorageKey(storageKey, expMs, secret);
  if (sig.length !== expected.length) return false;      // equalize before timingSafeEqual
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
