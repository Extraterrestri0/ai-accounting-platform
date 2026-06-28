/**
 * Posting/review error mapping — the "Осчетоводи → Internal server error" fix.
 * Domain refusals must reach the UI as 4xx with the exact user-safe reason, never a
 * generic 500 (a bare Error swallowed by Nest is a silent failure for the reviewer).
 */
import { HttpException } from '@nestjs/common';
import { PostingError, DuplicatePostingError } from '../../src/modules/docintel/application/posting.service';
import { ReviewError } from '../../src/modules/docintel/application/review.service';
import { ExtractionError } from '../../src/modules/docintel/application/extraction.service';
import { PeriodLockedError } from '../../src/modules/periods/domain/errors';
import { OcrUnavailableError } from '../../src/modules/docintel/domain/errors';

describe('posting flow errors carry HTTP semantics + the exact reason', () => {
  it('PostingError → 422 with message (e.g. "No approved posting lines to post.")', () => {
    const e = new PostingError('No approved posting lines to post.');
    expect(e).toBeInstanceOf(HttpException);
    expect(e.getStatus()).toBe(422);
    expect(e.message).toBe('No approved posting lines to post.');
  });
  it('DuplicatePostingError → 409 (already posted)', () => {
    const e = new DuplicatePostingError('This review has already been posted.');
    expect(e.getStatus()).toBe(409);
  });
  it('ReviewError → 422', () => {
    expect(new ReviewError('Review package x not found.').getStatus()).toBe(422);
  });
  it('ExtractionError → 422 (e.g. document not ready)', () => {
    expect(new ExtractionError('Document x is not ready for extraction (status trashed).').getStatus()).toBe(422);
  });
  it('PeriodLockedError stays 409 (compliance gate)', () => {
    const e = new PeriodLockedError(2026, 5);
    expect(e).toBeInstanceOf(HttpException);
    expect(e.getStatus()).toBe(409);
  });
  it('OcrUnavailableError carries the exact user-facing message', () => {
    expect(new OcrUnavailableError().message).toMatch(/OCR provider is not configured\. Image invoices cannot be extracted automatically\./);
  });
});
