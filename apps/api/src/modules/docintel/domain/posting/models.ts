/** Posting-workflow domain models. The ledger entry itself lives in the immutable ledger (Task 004). */
export type PostingKind = 'post' | 'reversal';
export type PostingStatus = 'pending' | 'posted' | 'failed';

export interface PostingLineInput { accountId: string; direction: 'debit' | 'credit'; amount: string; narrative?: string; }
export interface PostingRequest {
  id: string; reviewPackageId?: string; documentId?: string; requestedBy: string;
  kind: PostingKind; status: PostingStatus; lines?: PostingLineInput[]; error?: string; createdAt: string;
}
export interface PostingResult {
  id: string; postingRequestId: string; journalEntryId: string; reversesEntryId?: string; postedAt: string;
}
export interface PostingOutcome {
  request: PostingRequest; journalEntryId?: string; entryNo?: number; lines?: PostingLineInput[]; status: PostingStatus; error?: string;
}
