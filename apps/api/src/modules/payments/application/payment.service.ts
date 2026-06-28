import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { LEDGER_SERVICE, type ILedgerService, type PostEntryInput } from '../../ledger';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../../masterdata';
import { PERIOD_SERVICE, type IAccountingPeriodService } from '../../periods';
import { PaymentsRepository, type SettleableDoc } from '../infrastructure/payments.repository';
import { assertPayable, calcOutstanding, calcOverdueDays, fromCents, toCents } from '../domain/aging';
import {
  AccountNotConfiguredError, AlreadyReversedError, DocumentNotFoundError, PaymentError, PaymentNotFoundError,
} from '../domain/errors';
import { PaymentEvents } from '../events';
import type { DocumentType, Payment, PaymentType } from '../domain/models';
import type { IPaymentService, OutstandingBalance, RecordPaymentInput } from './payment.service.interface';

const today = (): string => new Date().toISOString().slice(0, 10);

@Injectable()
export class PaymentService implements IPaymentService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: PaymentsRepository,
    @Inject(LEDGER_SERVICE) private readonly ledger: ILedgerService,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
    @Inject(MASTERDATA_SERVICE) private readonly masterdata: IMasterDataService,
    @Inject(PERIOD_SERVICE) private readonly periods: IAccountingPeriodService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new PaymentError('No active company in context.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }
  /** Recording/reversing a payment posts to the ledger — a HUMAN-only action (Inv. 4/5). */
  private requireHuman(): string {
    const { userId } = this.scope();
    if (!userId) throw new ForbiddenException('Recording a payment requires a human (AI cannot post settlements).');
    return userId;
  }

  async recordPayment(input: RecordPaymentInput): Promise<Payment> {
    const { tenantId, companyId } = this.scope();
    const userId = this.requireHuman();
    // Compliance gate (Task 4.3): no payment postings into a locked period.
    await this.periods.assertOpen(input.paymentDate ?? today(), 'Payment');
    const accts = await this.masterdata.getPostingAccounts();

    // 1) Resolve the settleable document + its current outstanding balance.
    const doc = await this.db.run((db) => this.resolveDoc(db, input.documentType, input.documentId, accts.payable));
    if (!doc) throw new DocumentNotFoundError(input.documentId);
    const paid = await this.db.run((db) => this.repo.paidForDocument(db, doc.documentType, doc.documentId));
    const outstanding = calcOutstanding(doc.total, paid);

    // 2) Overpayment prevention — deterministic, never trusts the client amount.
    const amountCents = assertPayable(outstanding, input.amount);
    const amount = fromCents(amountCents);
    const currency = input.currency ?? doc.currency ?? 'EUR';
    const paymentType: PaymentType = doc.documentType === 'sales_invoice' ? 'inbound' : 'outbound';

    // 3) Resolve the cash/bank + control accounts through the mapping (never hardcoded).
    const cashCode = accts.cash_bank;
    const controlCode = paymentType === 'inbound' ? accts.receivable : accts.payable;
    const { cashId, controlId } = await this.db.run(async (db) => {
      const cash = await this.repo.accountIdByCode(db, cashCode);
      const control = await this.repo.accountIdByCode(db, controlCode);
      if (!cash?.isPostable) throw new AccountNotConfiguredError('cash_bank', cashCode);
      if (!control?.isPostable) throw new AccountNotConfiguredError(paymentType === 'inbound' ? 'receivable' : 'payable', controlCode);
      return { cashId: cash.id, controlId: control.id };
    });

    // 4) Post the balanced settlement entry to the immutable ledger.
    //    inbound:  Dr cash_bank(503) / Cr receivable(411)   — customer paid us
    //    outbound: Dr payable(401)   / Cr cash_bank(503)     — we paid a supplier
    const lines = paymentType === 'inbound'
      ? [{ accountId: cashId, direction: 'debit' as const, amount, narrative: 'Постъпление' },
         { accountId: controlId, direction: 'credit' as const, amount, narrative: 'Погасено вземане' }]
      : [{ accountId: controlId, direction: 'debit' as const, amount, narrative: 'Погасено задължение' },
         { accountId: cashId, direction: 'credit' as const, amount, narrative: 'Плащане' }];
    const entry: PostEntryInput = {
      postingDate: input.paymentDate ?? today(),
      description: `Плащане ${doc.ref ?? doc.documentId}`,
      sourceType: 'payment', sourceRef: doc.documentId, currency, lines,
    };
    const journal = await this.ledger.postEntry(entry);

    // 5) Record the payment row + link the entry + audit (own txn; ledger already committed).
    const paymentId = await this.db.run(async (db) => {
      const id = await this.repo.insertPayment(db, tenantId, companyId, {
        paymentType, documentType: doc.documentType, documentId: doc.documentId, counterpartyId: doc.counterpartyId,
        amount, currency, paymentDate: input.paymentDate ?? today(), reference: input.reference, notes: input.notes, createdBy: userId,
      });
      await this.repo.linkJournalEntry(db, id, journal.id);
      await this.audit.append(db, {
        companyId, actorType: 'user', actorId: userId, action: PaymentEvents.PaymentRecorded,
        entityType: 'payment', entityId: id,
        after: { documentType: doc.documentType, documentId: doc.documentId, amount, currency, counterpartyId: doc.counterpartyId, journalEntryId: journal.id },
      });
      // 6) If this payment fully settles the document, emit the closed event.
      const newOutstanding = calcOutstanding(doc.total, fromCents(toCents(paid) + amountCents));
      if (toCents(newOutstanding) === 0) {
        await this.audit.append(db, {
          companyId, actorType: 'user', actorId: userId,
          action: doc.documentType === 'sales_invoice' ? PaymentEvents.ReceivableClosed : PaymentEvents.PayableClosed,
          entityType: doc.documentType, entityId: doc.documentId,
          after: { documentId: doc.documentId, total: doc.total, counterpartyId: doc.counterpartyId },
        });
      }
      return id;
    });

    const fresh = await this.db.run((db) => this.repo.getPayment(db, paymentId));
    return fresh!;
  }

  async reversePayment(paymentId: string, reason: string): Promise<Payment> {
    const { companyId } = this.scope();
    const userId = this.requireHuman();
    const payment = await this.db.run((db) => this.repo.getPayment(db, paymentId));
    if (!payment) throw new PaymentNotFoundError(paymentId);
    if (payment.status === 'reversed') throw new AlreadyReversedError(paymentId);
    if (!payment.journalEntryId) throw new PaymentError(`Payment ${paymentId} has no ledger entry to reverse.`);

    // Reversing entry through the ledger (mirrors directions; immutable — Inv. 2).
    const reversal = await this.ledger.reverseEntry(payment.journalEntryId, reason || `Reversal of payment ${paymentId}`);

    await this.db.run(async (db) => {
      await this.repo.markReversed(db, paymentId, null);
      await this.audit.append(db, {
        companyId, actorType: 'user', actorId: userId, action: PaymentEvents.PaymentReversed,
        entityType: 'payment', entityId: paymentId, reason,
        before: { status: 'active', amount: payment.amount, journalEntryId: payment.journalEntryId },
        after: { status: 'reversed', amount: payment.amount, documentType: payment.documentType, documentId: payment.documentId, counterpartyId: payment.counterpartyId, reversalEntryId: reversal.id },
      });
    });
    const fresh = await this.db.run((db) => this.repo.getPayment(db, paymentId));
    return fresh!;
  }

  async calculateOutstandingBalance(documentType: DocumentType, documentId: string): Promise<OutstandingBalance> {
    this.scope();
    const accts = await this.masterdata.getPostingAccounts();
    const doc = await this.db.run((db) => this.resolveDoc(db, documentType, documentId, accts.payable));
    if (!doc) throw new DocumentNotFoundError(documentId);
    const paid = await this.db.run((db) => this.repo.paidForDocument(db, doc.documentType, doc.documentId));
    const outstanding = calcOutstanding(doc.total, paid);
    return { documentType: doc.documentType, documentId: doc.documentId, currency: doc.currency, total: doc.total, paid, outstanding, settled: toCents(outstanding) === 0 };
  }

  async calculateOverdueDays(documentType: DocumentType, documentId: string, asOf?: string): Promise<number> {
    this.scope();
    const accts = await this.masterdata.getPostingAccounts();
    const doc = await this.db.run((db) => this.resolveDoc(db, documentType, documentId, accts.payable));
    if (!doc) throw new DocumentNotFoundError(documentId);
    return calcOverdueDays(doc.dueDate, asOf ?? today());
  }

  getPayment(paymentId: string): Promise<Payment | null> {
    this.scope();
    return this.db.run((db) => this.repo.getPayment(db, paymentId));
  }

  listPayments(filters: { documentType?: DocumentType; documentId?: string; counterpartyId?: string }, page = 1, pageSize = 50): Promise<Payment[]> {
    this.scope();
    const size = Math.min(200, Math.max(1, pageSize));
    return this.db.run((db) => this.repo.listPayments(db, filters, size, (Math.max(1, page) - 1) * size));
  }

  private resolveDoc(db: import('../../../platform').ScopedClient, documentType: DocumentType, documentId: string, payableCode: string): Promise<SettleableDoc | null> {
    return documentType === 'sales_invoice'
      ? this.repo.receivableDocument(db, documentId)
      : this.repo.payableDocument(db, documentId, payableCode);
  }
}
