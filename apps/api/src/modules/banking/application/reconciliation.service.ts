import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import {
  PAYMENT_SERVICE, type IPaymentService,
  RECEIVABLES_SERVICE, type IReceivablesService,
  PAYABLES_SERVICE, type IPayablesService,
} from '../../payments';
import { BankingRepository } from '../infrastructure/banking.repository';
import { suggestMatches, type MatchableItem } from '../domain/matching';
import { AlreadyReconciledError, BankTransactionNotFoundError, DirectionMismatchError } from '../domain/errors';
import { BankEvents } from '../events';
import type { BankTransaction, BankingSummary, MatchDocumentType, MatchSuggestion } from '../domain/models';
import type {
  ConfirmMatchInput, IReconciliationService, ManualMatchInput, ReconcileResult, TransactionFilters,
} from './reconciliation.service.interface';

@Injectable()
export class ReconciliationService implements IReconciliationService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: BankingRepository,
    @Inject(PAYMENT_SERVICE) private readonly payments: IPaymentService,
    @Inject(RECEIVABLES_SERVICE) private readonly receivables: IReceivablesService,
    @Inject(PAYABLES_SERVICE) private readonly payables: IPayablesService,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new BadRequestException('No active company selected.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }
  private requireHuman(): string {
    const { userId } = this.scope();
    if (!userId) throw new ForbiddenException('Reconciliation requires a human (records a payment).');
    return userId;
  }
  private actor() { const { userId } = this.scope(); return { actorType: (userId ? 'user' : 'system') as 'user' | 'system', actorId: userId }; }

  async suggestMatches(transactionId: string): Promise<MatchSuggestion[]> {
    const { companyId } = this.scope();
    const txn = await this.db.run((db) => this.repo.getTransaction(db, transactionId));
    if (!txn) throw new BankTransactionNotFoundError(transactionId);

    const open = txn.transactionType === 'inbound' ? await this.receivables.getReceivables() : await this.payables.getPayables();
    const items: MatchableItem[] = open.map((it) => ({
      documentType: it.documentType, documentId: it.documentId, documentRef: it.documentRef,
      counterpartyName: it.counterpartyName, dueDate: it.dueDate, outstanding: it.outstanding, currency: it.currency,
    }));
    const suggestions = suggestMatches({
      amount: txn.amount, transactionType: txn.transactionType, counterpartyName: txn.counterpartyName,
      counterpartyIban: txn.counterpartyIban, reference: txn.reference, description: txn.description,
      bookingDate: txn.bookingDate, currency: txn.currency,
    }, items);

    await this.db.run((db) => this.audit.append(db, { companyId, ...this.actor(), action: BankEvents.MatchSuggested, entityType: 'bank_transaction', entityId: transactionId, after: { count: suggestions.length, topConfidence: suggestions[0]?.confidence ?? 0 } }));
    return suggestions;
  }

  confirmMatch(transactionId: string, input: ConfirmMatchInput): Promise<ReconcileResult> {
    return this.reconcile(transactionId, input.documentType, input.documentId, input.amount, BankEvents.MatchConfirmed, { confidence: input.confidence, reason: input.reason });
  }
  manualMatch(transactionId: string, input: ManualMatchInput): Promise<ReconcileResult> {
    return this.reconcile(transactionId, input.documentType, input.documentId, input.amount, BankEvents.ManualMatchConfirmed, { reason: 'Ръчно равнение' });
  }

  private async reconcile(transactionId: string, documentType: MatchDocumentType, documentId: string, amount: string | number | undefined, action: string, meta: { confidence?: number; reason?: string }): Promise<ReconcileResult> {
    const { companyId } = this.scope();
    this.requireHuman();
    const txn = await this.db.run((db) => this.repo.getTransaction(db, transactionId));
    if (!txn) throw new BankTransactionNotFoundError(transactionId);
    if (txn.reconciliationStatus !== 'unreconciled') throw new AlreadyReconciledError(transactionId);

    // Inbound settles a receivable; outbound settles a payable.
    const expected: MatchDocumentType = txn.transactionType === 'inbound' ? 'sales_invoice' : 'purchase_invoice';
    if (documentType !== expected) throw new DirectionMismatchError();

    const payAmount = amount != null ? String(amount) : Math.abs(Number(txn.amount)).toFixed(2);

    // Reuse the EXISTING PaymentService — it posts to the ledger and closes the AR/AP item.
    const payment = await this.payments.recordPayment({
      documentType, documentId, amount: payAmount,
      paymentDate: txn.valueDate ?? txn.bookingDate, currency: txn.currency,
      reference: txn.reference ?? `Bank ${transactionId.slice(0, 8)}`, notes: 'Банково равнение',
    });

    await this.db.run(async (db) => {
      await this.repo.markReconciled(db, transactionId, payment.id);
      await this.audit.append(db, { companyId, ...this.actor(), action, entityType: 'bank_transaction', entityId: transactionId, after: { paymentId: payment.id, documentType, documentId, amount: payAmount, confidence: meta.confidence, reason: meta.reason } });
    });
    const fresh = (await this.db.run((db) => this.repo.getTransaction(db, transactionId)))!;
    return { transaction: fresh, payment };
  }

  async rejectMatch(transactionId: string, reason?: string): Promise<BankTransaction> {
    const { companyId } = this.scope();
    this.requireHuman();
    const txn = await this.db.run((db) => this.repo.getTransaction(db, transactionId));
    if (!txn) throw new BankTransactionNotFoundError(transactionId);
    if (txn.reconciliationStatus === 'reconciled') throw new AlreadyReconciledError(transactionId);

    await this.db.run(async (db) => {
      await this.repo.markIgnored(db, transactionId);
      await this.audit.append(db, { companyId, ...this.actor(), action: BankEvents.MatchRejected, entityType: 'bank_transaction', entityId: transactionId, reason, after: { status: 'ignored' } });
    });
    return (await this.db.run((db) => this.repo.getTransaction(db, transactionId)))!;
  }

  listTransactions(filters: TransactionFilters, page = 1, pageSize = 50): Promise<BankTransaction[]> {
    const { companyId } = this.scope();
    const size = Math.min(200, Math.max(1, pageSize));
    return this.db.run((db) => this.repo.listTransactions(db, companyId, filters, size, (Math.max(1, page) - 1) * size));
  }
  getTransaction(id: string): Promise<BankTransaction | null> {
    this.scope();
    return this.db.run((db) => this.repo.getTransaction(db, id));
  }

  summary(): Promise<BankingSummary> {
    const { companyId } = this.scope();
    return this.db.run((db) => this.repo.summary(db, companyId));
  }
}

