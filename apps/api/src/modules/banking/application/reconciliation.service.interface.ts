import type { ApplicationService } from '../../../shared-kernel';
import type { Payment } from '../../payments';
import type { BankTransaction, BankingSummary, MatchDocumentType, MatchSuggestion } from '../domain/models';

export interface ConfirmMatchInput { documentType: MatchDocumentType; documentId: string; amount?: string | number; confidence?: number; reason?: string; }
export interface ManualMatchInput { documentType: MatchDocumentType; documentId: string; amount?: string | number; }
export interface ReconcileResult { transaction: BankTransaction; payment: Payment; }

export interface TransactionFilters { status?: string; bankAccountId?: string; statementId?: string; }

export interface IReconciliationService extends ApplicationService {
  suggestMatches(transactionId: string): Promise<MatchSuggestion[]>;
  confirmMatch(transactionId: string, input: ConfirmMatchInput): Promise<ReconcileResult>;
  rejectMatch(transactionId: string, reason?: string): Promise<BankTransaction>;
  manualMatch(transactionId: string, input: ManualMatchInput): Promise<ReconcileResult>;
  listTransactions(filters: TransactionFilters, page?: number, pageSize?: number): Promise<BankTransaction[]>;
  getTransaction(id: string): Promise<BankTransaction | null>;
  summary(): Promise<BankingSummary>;
}
export const RECONCILIATION_SERVICE = Symbol('Banking.ReconciliationService');
