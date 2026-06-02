/** Request body for posting. No tenant/company fields — taken from request context. */
export interface PostEntryLineDto { accountId: string; direction: 'debit' | 'credit'; amount: string; narrative?: string; }
export interface PostEntryDto {
  postingDate: string; description?: string; sourceType?: string; sourceRef?: string;
  currency?: string; lines: PostEntryLineDto[];
}
export interface ReverseEntryDto { reason: string; }
