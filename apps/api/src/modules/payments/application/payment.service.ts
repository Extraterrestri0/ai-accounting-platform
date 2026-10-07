import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  DatabaseContextService, TenantContextService, IdempotencyRepository, canonicalFingerprint,
  type ScopedClient,
} from '../../../platform';
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
    private readonly idem: IdempotencyRepository,
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

  /** Public entrypoint — owns ONE transaction so the idempotency claim, the document lock, the
   *  ledger entry, the payment row + linkage and the audit all commit together or not at all. */
  async recordPayment(input: RecordPaymentInput, idem: { key: string }): Promise<Payment> {
    const { tenantId, companyId } = this.scope();
    const userId = this.requireHuman();
    return this.db.run((db) => this.settleInTx(db, input, { tenantId, companyId, userId }, { operation: 'payment.record', key: idem.key }));
  }

  /**
   * Atomic settlement core, running on a CALLER-OWNED transaction (used by recordPayment and by
   * bank reconciliation so the bank-status flip is atomic with the payment+ledger). Steps:
   * idempotency claim → lock the document → re-read outstanding INSIDE the txn → overpayment check
   * → post via the ledger's in-txn path → insert payment + link + audit → record idempotency result.
   */
  async settleInTx(
    db: ScopedClient,
    input: RecordPaymentInput,
    who: { tenantId: string; companyId: string; userId?: string },
    idem: { operation: string; key: string },
  ): Promise<Payment> {
    const { tenantId, companyId, userId } = who;
    const paymentDate = input.paymentDate ?? today();

    // 0) Idempotency: a replayed request returns the original payment; a same-key/different-payload
    //    request is refused. The claim commits atomically with everything below.
    const fingerprint = canonicalFingerprint(idem.operation, {
      documentType: input.documentType, documentId: input.documentId,
      amount: String(input.amount), currency: input.currency ?? null, paymentDate,
    });
    const claim = await this.idem.claim(db, { tenantId, companyId, operation: idem.operation, key: idem.key, fingerprint });
    if (claim.status === 'conflict') throw new ConflictException('Idempotency-Key was already used for a different payment request.');
    if (claim.status === 'replay') {
      const existing = await this.repo.getPayment(db, String(claim.result.paymentId));
      if (existing) return existing;
      throw new ConflictException('Idempotency replay could not resolve the original payment.');
    }

    // 2) Resolve the settleable document and LOCK it, then re-read outstanding under the lock.
    const accts = await this.masterdata.getPostingAccountsTx(db);
    const doc = await this.resolveDoc(db, input.documentType, input.documentId, accts.payable);
    if (!doc) throw new DocumentNotFoundError(input.documentId);
    await this.repo.lockDocument(db, doc.documentType, doc.documentId);
    // Period gate on the caller's transaction, AFTER the row lock: every financial write takes its
    // row locks first and the shared period-gate lock last (one consistent order, no lock cycles).
    await this.periods.assertOpenTx(db, paymentDate, 'Payment');
    const paid = await this.repo.paidForDocument(db, doc.documentType, doc.documentId);
    const outstanding = calcOutstanding(doc.total, paid);

    // 3) Overpayment prevention — deterministic, never trusts the client amount (now under the lock).
    const amountCents = assertPayable(outstanding, input.amount);
    const amount = fromCents(amountCents);
    const currency = input.currency ?? doc.currency ?? 'EUR';
    const paymentType: PaymentType = doc.documentType === 'sales_invoice' ? 'inbound' : 'outbound';

    // 4) Resolve cash/bank + control accounts through the mapping (never hardcoded), same txn.
    const cashCode = accts.cash_bank;
    const controlCode = paymentType === 'inbound' ? accts.receivable : accts.payable;
    const cash = await this.repo.accountIdByCode(db, cashCode);
    const control = await this.repo.accountIdByCode(db, controlCode);
    if (!cash?.isPostable) throw new AccountNotConfiguredError('cash_bank', cashCode);
    if (!control?.isPostable) throw new AccountNotConfiguredError(paymentType === 'inbound' ? 'receivable' : 'payable', controlCode);

    // 5) Post the balanced settlement entry through the ledger's in-transaction path.
    //    inbound:  Dr cash_bank(503) / Cr receivable(411)   — customer paid us
    //    outbound: Dr payable(401)   / Cr cash_bank(503)     — we paid a supplier
    const lines = paymentType === 'inbound'
      ? [{ accountId: cash.id, direction: 'debit' as const, amount, narrative: 'Постъпление' },
         { accountId: control.id, direction: 'credit' as const, amount, narrative: 'Погасено вземане' }]
      : [{ accountId: control.id, direction: 'debit' as const, amount, narrative: 'Погасено задължение' },
         { accountId: cash.id, direction: 'credit' as const, amount, narrative: 'Плащане' }];
    const entry: PostEntryInput = {
      postingDate: paymentDate, description: `Плащане ${doc.ref ?? doc.documentId}`,
      sourceType: 'payment', sourceRef: doc.documentId, currency, lines,
    };
    const journal = await this.ledger.postInTx(db, entry);

    // 6) Record the payment row + link the ledger entry + audit (same txn).
    const paymentId = await this.repo.insertPayment(db, tenantId, companyId, {
      paymentType, documentType: doc.documentType, documentId: doc.documentId, counterpartyId: doc.counterpartyId,
      amount, currency, paymentDate, reference: input.reference, notes: input.notes, createdBy: userId!,
    });
    await this.repo.linkJournalEntry(db, paymentId, journal.id);
    await this.audit.append(db, {
      companyId, actorType: 'user', actorId: userId, action: PaymentEvents.PaymentRecorded,
      entityType: 'payment', entityId: paymentId,
      after: { documentType: doc.documentType, documentId: doc.documentId, amount, currency, counterpartyId: doc.counterpartyId, journalEntryId: journal.id },
    });
    const newOutstanding = calcOutstanding(doc.total, fromCents(toCents(paid) + amountCents));
    if (toCents(newOutstanding) === 0) {
      await this.audit.append(db, {
        companyId, actorType: 'user', actorId: userId,
        action: doc.documentType === 'sales_invoice' ? PaymentEvents.ReceivableClosed : PaymentEvents.PayableClosed,
        entityType: doc.documentType, entityId: doc.documentId,
        after: { documentId: doc.documentId, total: doc.total, counterpartyId: doc.counterpartyId },
      });
    }

    // 7) Record the idempotency result (same txn → commits with the payment or not at all).
    await this.idem.complete(db, claim.id, { paymentId, journalEntryId: journal.id });
    return (await this.repo.getPayment(db, paymentId))!;
  }

  /**
   * Payment reversal in ONE transaction on ONE ScopedClient:
   * idempotency claim → lock the payment FOR UPDATE → re-read its state under the lock →
   * ledger.reverseInTx (locks the settlement entry, gates both periods on this client, inserts the
   * reversing entry + lines + ledger audit) → conditional payment flip active→reversed (exactly one
   * row) → PaymentReversed audit → idempotency complete → COMMIT. Any failure rolls back all of it,
   * so the ledger can never be reversed while the payment stays active, or vice versa.
   */
  async reversePayment(paymentId: string, reason: string, idem?: { key: string }): Promise<Payment> {
    const { tenantId, companyId } = this.scope();
    const userId = this.requireHuman();
    const why = reason || `Reversal of payment ${paymentId}`;
    return this.db.run(async (db) => {
      let claimId: string | undefined;
      if (idem) {
        const fingerprint = canonicalFingerprint('payment.reverse', { paymentId, reason: reason ?? '' });
        const claim = await this.idem.claim(db, { tenantId, companyId, operation: 'payment.reverse', key: idem.key, fingerprint });
        if (claim.status === 'conflict') throw new ConflictException('Idempotency-Key was already used for a different payment reversal.');
        if (claim.status === 'replay') {
          const existing = await this.repo.getPayment(db, String(claim.result.paymentId));
          if (existing) return existing;
          throw new ConflictException('Idempotency replay could not resolve the reversed payment.');
        }
        claimId = claim.id;
      }

      if (!(await this.repo.lockPayment(db, paymentId))) throw new PaymentNotFoundError(paymentId);
      const payment = await this.repo.getPayment(db, paymentId);
      if (!payment) throw new PaymentNotFoundError(paymentId);
      if (payment.status === 'reversed') throw new AlreadyReversedError(paymentId);
      if (!payment.journalEntryId) throw new PaymentError(`Payment ${paymentId} has no ledger entry to reverse.`);

      let reversal: { id: string };
      try {
        reversal = await this.ledger.reverseInTx(db, payment.journalEntryId, why, { allowSettlement: true });
      } catch (e) {
        // Settlement entry already reversed (legacy data): an expected conflict, not a 500.
        if ((e as Error)?.name === 'AlreadyReversedError') throw new AlreadyReversedError(paymentId);
        throw e;
      }

      if ((await this.repo.markReversedIfActive(db, paymentId)) !== 1) throw new AlreadyReversedError(paymentId);
      await this.audit.append(db, {
        companyId, actorType: 'user', actorId: userId, action: PaymentEvents.PaymentReversed,
        entityType: 'payment', entityId: paymentId, reason,
        before: { status: 'active', amount: payment.amount, journalEntryId: payment.journalEntryId },
        after: { status: 'reversed', amount: payment.amount, documentType: payment.documentType, documentId: payment.documentId, counterpartyId: payment.counterpartyId, reversalEntryId: reversal.id },
      });
      if (claimId) await this.idem.complete(db, claimId, { paymentId, journalEntryId: reversal.id });
      return (await this.repo.getPayment(db, paymentId))!;
    });
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
