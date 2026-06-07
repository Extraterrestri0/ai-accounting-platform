import { ReconciliationService } from '../../src/modules/banking/application/reconciliation.service';
import { DirectionMismatchError, AlreadyReconciledError } from '../../src/modules/banking/domain/errors';

function makeService(txn: any, overrides: any = {}) {
  const ctx: any = { currentOrThrow: () => ({ tenantId: 't1', companyId: 'c1', userId: 'u1' }) };
  const db: any = { run: async (fn: any) => fn({}) };
  const audit: any = { append: jest.fn(async () => undefined) };
  const repo: any = {
    getTransaction: jest.fn(async () => txn),
    markReconciled: jest.fn(async () => undefined),
    markIgnored: jest.fn(async () => undefined),
    summary: jest.fn(async () => ({})),
    ...overrides.repo,
  };
  const payments: any = { recordPayment: jest.fn(async () => ({ id: 'pay1', amount: '1200.00' })), ...overrides.payments };
  const receivables: any = { getReceivables: jest.fn(async () => overrides.receivables ?? []) };
  const payables: any = { getPayables: jest.fn(async () => overrides.payables ?? []) };
  const svc = new ReconciliationService(ctx, db, repo, payments, receivables, payables, audit);
  return { svc, repo, payments, receivables, payables, audit };
}

const inboundTxn = { id: 'tx1', amount: '1200.00', transactionType: 'inbound', bookingDate: '2026-05-14', currency: 'EUR', reference: '2026-0001', reconciliationStatus: 'unreconciled', bankStatementId: 's1' };
const outboundTxn = { ...inboundTxn, id: 'tx2', amount: '-300.00', transactionType: 'outbound' };

describe('ReconciliationService.suggestMatches (Task 3.2)', () => {
  it('inbound transaction draws from receivables and audits the suggestion', async () => {
    const { svc, receivables, payables, audit } = makeService(inboundTxn, {
      receivables: [{ documentType: 'sales_invoice', documentId: 'r1', documentRef: '2026-0001', counterpartyName: 'ACME', outstanding: '1200.00', currency: 'EUR' }],
    });
    const s = await svc.suggestMatches('tx1');
    expect(receivables.getReceivables).toHaveBeenCalled();
    expect(payables.getPayables).not.toHaveBeenCalled();
    expect(s[0].documentId).toBe('r1');
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'bank.match_suggested' }));
  });
});

describe('ReconciliationService.confirmMatch (Task 3.2)', () => {
  it('records a payment via PaymentService and reconciles the transaction', async () => {
    const { svc, payments, repo, audit } = makeService(inboundTxn);
    const res = await svc.confirmMatch('tx1', { documentType: 'sales_invoice', documentId: 'r1', confidence: 0.98 });
    expect(payments.recordPayment).toHaveBeenCalledWith(expect.objectContaining({ documentType: 'sales_invoice', documentId: 'r1', amount: '1200.00' }));
    expect(repo.markReconciled).toHaveBeenCalledWith(expect.anything(), 'tx1', 'pay1');
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'bank.match_confirmed' }));
    expect(res.payment.id).toBe('pay1');
  });

  it('rejects a direction mismatch (inbound must settle a receivable)', async () => {
    const { svc, payments } = makeService(inboundTxn);
    await expect(svc.confirmMatch('tx1', { documentType: 'purchase_invoice', documentId: 'p1' })).rejects.toBeInstanceOf(DirectionMismatchError);
    expect(payments.recordPayment).not.toHaveBeenCalled();
  });

  it('refuses to re-reconcile an already reconciled transaction', async () => {
    const { svc } = makeService({ ...inboundTxn, reconciliationStatus: 'reconciled' });
    await expect(svc.confirmMatch('tx1', { documentType: 'sales_invoice', documentId: 'r1' })).rejects.toBeInstanceOf(AlreadyReconciledError);
  });
});

describe('ReconciliationService manual + reject (Task 3.2)', () => {
  it('manualMatch records a payment and audits a manual confirmation', async () => {
    const { svc, payments, audit } = makeService(outboundTxn);
    await svc.manualMatch('tx2', { documentType: 'purchase_invoice', documentId: 'p1' });
    expect(payments.recordPayment).toHaveBeenCalledWith(expect.objectContaining({ documentType: 'purchase_invoice', documentId: 'p1', amount: '300.00' }));
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'bank.manual_match_confirmed' }));
  });

  it('rejectMatch ignores the transaction without creating a payment', async () => {
    const { svc, repo, payments, audit } = makeService(inboundTxn);
    await svc.rejectMatch('tx1', 'no matching invoice');
    expect(repo.markIgnored).toHaveBeenCalledWith(expect.anything(), 'tx1');
    expect(payments.recordPayment).not.toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'bank.match_rejected' }));
  });
});
