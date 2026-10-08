import { BadRequestException } from '@nestjs/common';
import { requireIdempotencyKey } from '../../src/platform/http/idempotency-key';

/**
 * The money-write endpoints fail closed on a missing or malformed Idempotency-Key.
 * (Adversarial review, Pass 1A §13: malformed / missing key.)
 */
describe('requireIdempotencyKey (fail-closed header guard)', () => {
  it('accepts a UUID and returns it verbatim', () => {
    const k = '0b5f1c2e-3d4a-4b6c-8e9f-1a2b3c4d5e6f';
    expect(requireIdempotencyKey(k)).toBe(k);
  });

  it('accepts other opaque tokens within bounds', () => {
    expect(requireIdempotencyKey('pay:2026-0001:attempt-1')).toBe('pay:2026-0001:attempt-1');
  });

  it('takes the first value when the header arrives as an array', () => {
    expect(requireIdempotencyKey(['abcd1234', 'zzzz9999'])).toBe('abcd1234');
  });

  it.each([undefined, '', '   '])('rejects a missing/blank key (%p)', (raw) => {
    expect(() => requireIdempotencyKey(raw as undefined | string)).toThrow(BadRequestException);
  });

  it.each(['short', 'has space', 'bad/char', 'emoji😀key', 'a'.repeat(201)])('rejects a malformed key (%p)', (raw) => {
    expect(() => requireIdempotencyKey(raw)).toThrow(BadRequestException);
  });
});
