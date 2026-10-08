import { BankImportService } from '../../src/modules/banking/application/bank-import.service';
import { CsvStatementParser } from '../../src/modules/banking/infrastructure/parsers/csv-parser';

function makeService(repoOverrides: any = {}) {
  const ctx: any = { currentOrThrow: () => ({ tenantId: 't1', companyId: 'c1', userId: 'u1' }) };
  const db: any = { run: async (fn: any) => fn({}) };
  const audit: any = { append: jest.fn(async () => undefined) };
  let txnSeq = 0;
  const repo: any = {
    getAccount: jest.fn(async () => ({ id: 'acc1', currency: 'EUR' })),
    createStatement: jest.fn(async () => ({ id: 'stmt1' })),
    insertTransaction: jest.fn(async () => ({ id: `txn${++txnSeq}`, amount: '1.00', bookingDate: '2026-05-14', transactionType: 'inbound' })),
    setDuplicateCount: jest.fn(async () => undefined),
    ...repoOverrides,
  };
  const registry: any = { get: (f: string) => { if (f === 'csv') return new CsvStatementParser(); throw new Error('unsupported'); }, supported: () => ['csv'] };
  return { svc: new BankImportService(ctx, db, repo, registry, audit), repo, audit };
}

const CSV = 'date,amount,currency,counterparty_name,reference\n' +
  '2026-05-14,1200.00,EUR,ACME,INV-1\n' +
  '2026-05-15,-300.00,EUR,Beta,REF-2\n';

describe('BankImportService (Task 3.2)', () => {
  it('imports a CSV statement and reports counts', async () => {
    const { svc, repo, audit } = makeService();
    const rep = await svc.importStatement({ bankAccountId: 'acc1', fileName: 'may.csv', content: Buffer.from(CSV) });
    expect(rep).toMatchObject({ rowCount: 2, importedCount: 2, duplicateCount: 0, errorCount: 0, statementFrom: '2026-05-14', statementTo: '2026-05-15' });
    expect(repo.insertTransaction).toHaveBeenCalledTimes(2);
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'bank.statement_imported' }));
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'bank.transaction_created' }));
  });

  it('reports invalid rows as errors (not imported)', async () => {
    const { svc } = makeService();
    const bad = 'date,amount\n2026-05-14,1200.00\nbad-date,not-a-number\n';
    const rep = await svc.importStatement({ bankAccountId: 'acc1', fileName: 'x.csv', content: Buffer.from(bad) });
    expect(rep.rowCount).toBe(2);
    expect(rep.importedCount).toBe(1);
    expect(rep.errorCount).toBe(2);             // bad date + bad amount on the same row
    expect(rep.errors[0].row).toBe(2);
  });

  it('detects in-file duplicate rows', async () => {
    const { svc } = makeService();
    const dup = 'date,amount,reference\n2026-05-14,100.00,R1\n2026-05-14,100.00,R1\n';
    const rep = await svc.importStatement({ bankAccountId: 'acc1', fileName: 'd.csv', content: Buffer.from(dup) });
    expect(rep.importedCount).toBe(1);
    expect(rep.duplicateCount).toBe(1);
  });

  it('detects already-imported duplicates (DB unique index → null insert)', async () => {
    const { svc } = makeService({ insertTransaction: jest.fn(async () => null) });
    const rep = await svc.importStatement({ bankAccountId: 'acc1', fileName: 'd.csv', content: Buffer.from(CSV) });
    expect(rep.importedCount).toBe(0);
    expect(rep.duplicateCount).toBe(2);
  });
});
