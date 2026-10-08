'use client';

/**
 * Generate a client-side Idempotency-Key for retry-safe financial writes (payments).
 * A fresh key is minted per logical record action; the SAME key must be reused when the
 * exact same request is retried after a transient failure, so the backend replays the
 * original result instead of double-posting. Uses crypto.randomUUID when available.
 */
export function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* fall through */ }
  // Fallback: RFC-4122-ish v4 without crypto.randomUUID (old browsers / non-secure contexts).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
