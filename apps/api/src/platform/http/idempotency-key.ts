import { BadRequestException } from '@nestjs/common';

/**
 * Validate an `Idempotency-Key` request header for money-moving endpoints.
 * The client sends one opaque key per user operation (a fresh UUID per deliberate action,
 * reused verbatim on retries). We accept any opaque token within sane bounds; a UUID is the
 * recommended shape. Financial write endpoints REQUIRE it and fail closed when absent/invalid.
 */
const KEY_RE = /^[A-Za-z0-9._:-]{8,200}$/;

export function requireIdempotencyKey(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const key = (value ?? '').trim();
  if (!key) throw new BadRequestException('Idempotency-Key header is required for this operation.');
  if (!KEY_RE.test(key)) throw new BadRequestException('Idempotency-Key must be 8–200 chars of [A-Za-z0-9._:-] (a UUID is recommended).');
  return key;
}
