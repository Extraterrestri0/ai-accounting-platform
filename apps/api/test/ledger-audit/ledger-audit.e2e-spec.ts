/**
 * Ledger + audit suite (RELEASE-BLOCKING). Runs against a real Postgres with
 * migrations 0001-0005 applied and the app connected as app_user (RLS-subject).
 * Exercises the production LedgerService/AuditService (one atomic transaction
 * per posting/reversal). Requires env PGHOST/PGPORT/PGUSER=app_user/PGPASSWORD/PGDATABASE
 * and the seed (test/ledger-audit/seed.sql) applied by an owner connection.
 */
import { Pool } from 'pg';
import { TenantContextService } from '../../src/platform/tenant-context/tenant-context.service';
import { DatabaseContextService } from '../../src/platform/database/database-context.service';
import { JournalRepository } from '../../src/modules/ledger/infrastructure/journal.repository';
import { AuditRepository } from '../../src/modules/audit/infrastructure/audit.repository';
import { AuditService } from '../../src/modules/audit/application/audit.service';
import { LedgerService } from '../../src/modules/ledger/application/ledger.service';
import { UnbalancedEntryError, AlreadyReversedError } from '../../src/modules/ledger/domain/errors';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const COMPANY_A = 'c1111111-1111-1111-1111-111111111111';
const USER_A = 'a1111111-1111-1111-1111-111111111111';
const CASH = 'aa000001-0000-0000-0000-000000000001';
const REVENUE = 'aa000001-0000-0000-0000-000000000002';

let pool: Pool; let ctx: TenantContextService; let db: DatabaseContextService;
let ledger: LedgerService; let audit: AuditService;

const inCompanyA = <T>(fn: () => Promise<T>): Promise<T> =>
  ctx.run({ tenantId: TENANT_A, userId: USER_A, companyId: COMPANY_A }, fn);

beforeAll(() => {
  pool = new Pool({
    host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE,
  });
  ctx = new TenantContextService();
  db = new DatabaseContextService(pool, ctx);
  audit = new AuditService(ctx, db, new AuditRepository());
  // 5th dep = the period-lock guard; periods aren't under test here, so assertOpen is a no-op.
  ledger = new LedgerService(ctx, db, new JournalRepository(), audit, { assertOpen: async () => undefined } as any);
});
afterAll(async () => { await pool.end(); });

test('balanced posting passes and writes an audit event atomically', async () => {
  await inCompanyA(async () => {
    const entry = await ledger.postEntry({
      postingDate: '2026-05-01', description: 'Sale',
      lines: [
        { accountId: CASH, direction: 'debit', amount: '100.00' },
        { accountId: REVENUE, direction: 'credit', amount: '100.00' },
      ],
    });
    expect(entry.lines).toHaveLength(2);
    expect(await audit.verifyChain()).toBe(true);
  });
});

test('unbalanced posting fails (whole transaction rolls back)', async () => {
  await inCompanyA(async () => {
    await expect(
      ledger.postEntry({
        postingDate: '2026-05-02', description: 'Bad',
        lines: [
          { accountId: CASH, direction: 'debit', amount: '100.00' },
          { accountId: REVENUE, direction: 'credit', amount: '90.00' },
        ],
      }),
    ).rejects.toThrow(); // deferred balance constraint at COMMIT
  });
});

test('reversal mirrors the original and is allowed once', async () => {
  await inCompanyA(async () => {
    const e = await ledger.postEntry({
      postingDate: '2026-05-05', description: 'ToReverse',
      lines: [
        { accountId: CASH, direction: 'debit', amount: '50.00' },
        { accountId: REVENUE, direction: 'credit', amount: '50.00' },
      ],
    });
    const rev = await ledger.reverseEntry(e.id, 'mistake');
    expect(rev.reversesEntryId).toBe(e.id);
    const origDebit = e.lines.find((l) => l.direction === 'debit')!.accountId;
    const revOnOrigDebit = rev.lines.find((l) => l.accountId === origDebit)!;
    expect(revOnOrigDebit.direction).toBe('credit'); // swapped
    await expect(ledger.reverseEntry(e.id, 'again')).rejects.toBeInstanceOf(AlreadyReversedError);
  });
});

test('posting without active company is rejected', async () => {
  await ctx.run({ tenantId: TENANT_A, userId: USER_A }, async () => {
    await expect(
      ledger.postEntry({ postingDate: '2026-05-01', lines: [] }),
    ).rejects.toThrow(); // NoActiveCompanyError
  });
});

test('audit chain validates for the tenant', async () => {
  await inCompanyA(async () => { expect(await audit.verifyChain()).toBe(true); });
});
