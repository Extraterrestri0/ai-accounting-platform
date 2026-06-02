import type { ApplicationService } from '../../../shared-kernel';
import type { PostingOutcome, PostingRequest } from '../domain/posting/models';

/** PUBLIC posting service — turns an APPROVED review into an immutable journal entry. */
export interface IPostingService extends ApplicationService {
  /** Post the human-approved review package to the ledger (idempotent: one posting per review). */
  postFromReview(reviewPackageId: string): Promise<PostingOutcome>;
  /** Reverse a previously posted entry (reversal-only; the ledger never edits/deletes). */
  reverse(journalEntryId: string, reason: string): Promise<PostingOutcome>;
  getPostingForReview(reviewPackageId: string): Promise<{ request: PostingRequest; journalEntryId?: string } | null>;
  listPostings(page?: number, pageSize?: number): Promise<PostingRequest[]>;
}
export const POSTING_SERVICE = Symbol('DocIntel.PostingService');
