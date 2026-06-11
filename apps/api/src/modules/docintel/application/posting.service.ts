import { ConflictException, ForbiddenException, HttpException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { LEDGER_SERVICE, type ILedgerService, type PostEntryInput } from '../../ledger';
import { PERIOD_SERVICE, type IAccountingPeriodService } from '../../periods';
import { REVIEW_SERVICE, type IReviewService } from './review.service.interface';
import { PostingRepository } from '../infrastructure/posting.repository';
import { validatePosting, PostingValidationError } from '../domain/posting/validation';
import type { PostedPurchaseDetail, PostingLineInput, PostingOutcome, PostingRequest } from '../domain/posting/models';
import type { IPostingService } from './posting.service.interface';

/**
 * Application-boundary error mapping (fixes the "Осчетоводи → Internal server error" dead end):
 * a bare Error becomes a generic 500 and the UI shows nothing useful. These carry the exact
 * user-safe reason as 422 (cannot post as-is) / 409 (already posted), so the review screen can
 * show WHY and the reviewer can fix it. PeriodLockedError is already a 409 (periods module).
 */
export class PostingError extends UnprocessableEntityException {}
export class DuplicatePostingError extends ConflictException {}
interface ApprovedLine { accountCode: string; side: 'debit' | 'credit'; amount: string; narrative?: string; }

/** Map domain/ledger validation failures (framework-free Errors) to user-visible HTTP errors. */
function toHttpError(e: unknown): unknown {
  if (e instanceof HttpException) return e;
  const name = (e as Error)?.name ?? '';
  if (name === 'PostingValidationError' || name === 'UnbalancedEntryError') {
    return new UnprocessableEntityException((e as Error).message);
  }
  return e; // genuine unexpected failures stay 500
}

@Injectable()
export class PostingService implements IPostingService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: PostingRepository,
    @Inject(REVIEW_SERVICE) private readonly reviews: IReviewService,
    @Inject(LEDGER_SERVICE) private readonly ledger: ILedgerService,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
    @Inject(PERIOD_SERVICE) private readonly periods: IAccountingPeriodService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new PostingError('No active company in context.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }
  /** Posting is a human-authorized action. AI/worker identities have no userId — refused (Invariant 4/5). */
  private requireHuman(): string {
    const { userId } = this.scope();
    if (!userId) throw new ForbiddenException('Posting requires a human (AI cannot post).');
    return userId;
  }

  async postFromReview(reviewPackageId: string): Promise<PostingOutcome> {
    const { tenantId, companyId } = this.scope();
    const userId = this.requireHuman();
    // Compliance gate (Task 4.3): no purchase approvals/postings into a locked period.
    await this.periods.assertOpen(new Date().toISOString().slice(0, 10), 'Posting');

    // 1) Load the approved review + resolve lines + create the posting_request (own txn; no nesting with the ledger).
    const prep = await this.db.run<{ requestId: string; documentId: string | null | undefined; lines: PostingLineInput[] }>(async (db) => {
      const detail = await this.reviews.getDetail((await this.reviewDocId(db, reviewPackageId)));
      if (detail.package.id !== reviewPackageId) throw new PostingError('Review package mismatch.');
      if (detail.package.status !== 'approved') throw new PostingError(`Review package ${reviewPackageId} is not approved (status ${detail.package.status}).`);
      if (await this.repo.hasPostedForReview(db, reviewPackageId)) throw new DuplicatePostingError('This review has already been posted.');

      const approvedLines = (detail.package.approvedPosting as ApprovedLine[] | undefined)
        ?? ((detail.suggestion as { suggestedPosting?: ApprovedLine[] } | null)?.suggestedPosting);
      if (!approvedLines?.length) throw new PostingError('No approved posting lines to post.');

      const lines: PostingLineInput[] = [];
      for (const l of approvedLines) {
        const acc = await this.repo.accountIdByCode(db, l.accountCode);
        if (!acc) throw new PostingValidationError(`Unknown account code ${l.accountCode}.`);
        if (!acc.isPostable) throw new PostingValidationError(`Account ${l.accountCode} is not postable.`);
        lines.push({ accountId: acc.id, direction: l.side, amount: l.amount, narrative: l.narrative });
      }
      validatePosting(lines); // friendly pre-check; the ledger re-validates authoritatively
      const requestId = await this.repo.createRequest(db, tenantId, companyId, { reviewPackageId, documentId: detail.package.documentId ?? undefined, requestedBy: userId, kind: 'post', lines });
      return { requestId, documentId: detail.package.documentId, lines };
    }).catch((e) => { throw toHttpError(e) as Error; });

    // 2) Post through the ledger (its OWN transaction: balance + immutability + audit enforced there).
    try {
      const input: PostEntryInput = { postingDate: new Date().toISOString().slice(0, 10), description: 'Posted from approved review', sourceType: 'review', sourceRef: reviewPackageId, currency: 'EUR', lines: prep.lines };
      const entry = await this.ledger.postEntry(input);
      // 3) Record the result + flip the request + audit as the human poster.
      return await this.db.run(async (db) => {
        await this.repo.addResult(db, tenantId, companyId, { postingRequestId: prep.requestId, journalEntryId: entry.id });
        await this.repo.setRequestStatus(db, prep.requestId, 'posted');
        await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'ledger.posted_from_review', entityType: 'journal_entry', entityId: entry.id, after: { reviewPackageId, entryNo: entry.entryNo } });
        const request: PostingRequest = { id: prep.requestId, reviewPackageId, documentId: prep.documentId ?? undefined, requestedBy: userId, kind: 'post', status: 'posted', lines: prep.lines, createdAt: new Date().toISOString() };
        return { request, journalEntryId: entry.id, entryNo: entry.entryNo, lines: prep.lines, status: 'posted' };
      });
    } catch (e) {
      // Record the failure on the request (never silent / never inconsistent), then surface
      // the exact reason: ledger validation errors → 422 with message; unknown faults stay 500.
      await this.db.run((db) => this.repo.setRequestStatus(db, prep.requestId, 'failed', (e as Error).message));
      throw toHttpError(e) as Error;
    }
  }

  async reverse(journalEntryId: string, reason: string): Promise<PostingOutcome> {
    const { tenantId, companyId } = this.scope();
    const userId = this.requireHuman();
    const requestId = await this.db.run((db) => this.repo.createRequest(db, tenantId, companyId, { requestedBy: userId, kind: 'reversal', lines: [] }));
    try {
      const reversal = await this.ledger.reverseEntry(journalEntryId, reason); // ledger mirrors directions atomically
      return await this.db.run(async (db) => {
        await this.repo.addResult(db, tenantId, companyId, { postingRequestId: requestId, journalEntryId: reversal.id, reversesEntryId: journalEntryId });
        await this.repo.setRequestStatus(db, requestId, 'posted');
        await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'ledger.reversed', entityType: 'journal_entry', entityId: reversal.id, reason, after: { reverses: journalEntryId } });
        const request: PostingRequest = { id: requestId, requestedBy: userId, kind: 'reversal', status: 'posted', createdAt: new Date().toISOString() };
        return { request, journalEntryId: reversal.id, entryNo: reversal.entryNo, status: 'posted' };
      });
    } catch (e) {
      await this.db.run((db) => this.repo.setRequestStatus(db, requestId, 'failed', (e as Error).message));
      throw e;
    }
  }

  getPostingForReview(reviewPackageId: string): Promise<{ request: PostingRequest; journalEntryId?: string } | null> {
    this.scope();
    return this.db.run((db) => this.repo.getByReview(db, reviewPackageId));
  }
  listPostings(page = 1, pageSize = 25): Promise<PostingRequest[]> {
    this.scope();
    const size = Math.min(100, Math.max(1, pageSize));
    return this.db.run((db) => this.repo.list(db, size, (Math.max(1, page) - 1) * size));
  }

  listPostedPurchaseDetails(reviewPackageIds: string[]): Promise<PostedPurchaseDetail[]> {
    this.scope();
    if (reviewPackageIds.length === 0) return Promise.resolve([]);
    return this.db.run((db) => this.repo.purchaseDetailsByReview(db, reviewPackageIds));
  }

  /** Resolve the document id behind a review package (review detail is keyed by document). */
  private async reviewDocId(db: import('../../../platform').ScopedClient, reviewPackageId: string): Promise<string> {
    const r = await db.query<{ document_id: string }>(`SELECT document_id FROM review_packages WHERE id=$1`, [reviewPackageId]);
    if (!r.rows[0]) throw new PostingError(`Review package ${reviewPackageId} not found.`);
    return r.rows[0].document_id;
  }
}
