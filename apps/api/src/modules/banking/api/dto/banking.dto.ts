import type { MatchDocumentType } from '../../domain/models';

export interface CreateBankAccountDto { iban: string; bic?: string; bankName?: string; currency?: string; isPrimary?: boolean; }
export interface UpdateBankAccountDto { bic?: string; bankName?: string; currency?: string; isActive?: boolean; }
export interface ConfirmMatchDto { documentType: MatchDocumentType; documentId: string; amount?: string | number; confidence?: number; reason?: string; }
export interface ManualMatchDto { documentType: MatchDocumentType; documentId: string; amount?: string | number; }
export interface RejectMatchDto { reason?: string; }
export interface ImportDto { bankAccountId: string; format?: string; }
