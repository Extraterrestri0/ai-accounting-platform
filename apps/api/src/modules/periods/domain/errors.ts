import { ConflictException } from '@nestjs/common';

/**
 * Thrown when an accounting write targets a LOCKED period. A ConflictException so
 * the API returns 409 with a user-safe message (no internals leaked).
 */
export class PeriodLockedError extends ConflictException {
  constructor(year: number, month: number, what = 'Operation') {
    super(`${what} blocked: accounting period ${String(month).padStart(2, '0')}/${year} is locked.`);
  }
}
