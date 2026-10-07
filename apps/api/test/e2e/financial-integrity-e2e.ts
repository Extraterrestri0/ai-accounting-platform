/* Financial-write integrity proof (real services · live PostgreSQL) — Pass 1A P0.
 *
 * Proves, against a real database with real concurrency, that money-moving writes are
 * idempotent and atomic:
 *   1  same-key replay returns the ORIGINAL payment (no second row, no second journal)
 *   2  concurrent same-key requests → exactly ONE payment / ONE journal entry
 *   3  same key + different payload → refused as a conflict (409), nothing written
 *   4  two legitimate partial payments (different keys) → both apply, exact arithmetic
 *   5  concurrent full payments (different keys) on one invoice → exactly ONE settles,
 *      the other is refused as overpayment; outstanding never goes negative
 *   6  manual ledger POST idempotency: replay returns the same entry; different payload → conflict
 *   7  closed accounting period fails closed (payment refused, nothing written)
 *   8  RLS isolation: an idempotency key in tenant A is invisible to / independent of tenant B
 *   9  bank reconciliation is atomic + idempotent: retry replays, concurrent → one settle,
 *      the bank line flips to reconciled exactly once
 *  10  payment reversal still works end-to-end (ledger reversing entry + flag)
 *  11  global invariant: every journal entry balances (Σ debit = Σ credit)
 *
 * Idempotent across re-runs: each scenario issues its OWN fresh invoice(s), so a reused DB
 * does not accumulate state that changes the outcome.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { JobContextRunner } from '../../src/platform/database/job-context.runner';
import { PAYMENT_SERVICE, type IPaymentService } from '../../src/modules/payments';
import { LEDGER_SERVICE, type ILedgerService } from '../../src/modules/ledger';
import { INVOICE_SERVICE, type IInvoiceService } from '../../src/modules/invoicing';
import { RECONCILIATION_SERVICE, type IReconciliationService } from '../../src/modules/banking';
import { PERIOD_SERVICE, type IAccountingPeriodService } from '../../src/modules/periods';
import { DatabaseContextService } from '../../src/platform';
import { PaymentsRepository } from '../../src/modules/payments/infrastructure/payments.repository';
import { BankingRepository } from '../../src/modules/banking/infrastructure/banking.repository';
import { PeriodRepository } from '../../src/modules/periods/infrastructure/period.repository';
import { JournalRepository } from '../../src/modules/ledger/infrastructure/journal.repository';
import { IdempotencyRepository } from '../../src/platform/database/idempotency.repository';
import { randomUUID } from 'node:crypto';

const A = '11111111-1111-1111-1111-111111111111';
const CA = 'c1111111-1111-1111-1111-111111111111';
const U = 'eeeeeeee-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const CB = 'c2222222-2222-2222-2222-222222222222';
const UB = 'eeeeeeee-2222-2222-2222-222222222222';
const CUSTOMER = 'cccccccc-1111-1111-1111-111111111111';
const VAT_CODE = '11111111-aaaa-1111-1111-111111111111';
const ACC = { exp: 'a0000000-0000-0000-0000-000000000602', pay: 'a0000000-0000-0000-0000-000000000401' };

let pass = 0; let fail = 0;
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? '  ✓ PASS' : '  ✗ FAIL'}: ${msg}`); cond ? pass++ : fail++; };
const isConflict = (e: unknown): boolean => {
  if (!e || typeof e !== 'object') return false;
  const o = e as { status?: number; getStatus?: () => number };
  if (o.status === 409) return true;
  if (typeof o.getStatus === 'function' && o.getStatus() === 409) return true;
  return false;
};
const named = (e: unknown, n: string): boolean => !!e && typeof e === 'object' && ((e as { name?: string }).name === n || (e as Error).constructor?.name === n);

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const runner = app.get(JobContextRunner);
  const payments = app.get<IPaymentService>(PAYMENT_SERVICE);
  const ledger = app.get<ILedgerService>(LEDGER_SERVICE);
  const invoices = app.get<IInvoiceService>(INVOICE_SERVICE);
  const reconcile = app.get<IReconciliationService>(RECONCILIATION_SERVICE);
  const periods = app.get<IAccountingPeriodService>(PERIOD_SERVICE);
  const db = app.get(DatabaseContextService);
  const pool = new Pool({ host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.MIGRATION_USER ?? process.env.PGUSER, password: process.env.MIGRATION_PASSWORD ?? process.env.PGPASSWORD, database: process.env.PGDATABASE });
  const human = { tenantId: A, userId: U, companyId: CA };
  const humanB = { tenantId: B, userId: UB, companyId: CB };

  console.log('\n=== FINANCIAL-WRITE INTEGRITY E2E (real services · live PostgreSQL) ===\n');

  // Issue a fresh 360.00 sales invoice (Dr 411 / Cr 702 / Cr 4532) and return its id + gross.
  const freshInvoice = async (): Promise<{ id: string; gross: string }> =>
    runner.run(human, async () => {
      const draft = await invoices.createDraft({ customerId: CUSTOMER, customerName: 'Бета ЕООД',
        lines: [{ description: 'Consulting', quantity: '1', unitPrice: '300.00', vatRate: '20', vatCodeId: VAT_CODE }] });
      await invoices.issueInvoice(draft.id);
      return { id: draft.id, gross: draft.grossTotal };
    });

  const countPayments = (invoiceId: string): Promise<number> =>
    pool.query<{ n: string }>(`SELECT count(*)::text n FROM payments WHERE document_id=$1 AND status='active'`, [invoiceId]).then((r) => Number(r.rows[0].n));
  const countJournalsFor = (invoiceId: string): Promise<number> =>
    pool.query<{ n: string }>(`SELECT count(*)::text n FROM journal_entries WHERE source_type='payment' AND source_ref=$1`, [invoiceId]).then((r) => Number(r.rows[0].n));

  // --- 1) same-key replay ---------------------------------------------------
  {
    const inv = await freshInvoice();
    const key = randomUUID();
    const body = { documentType: 'sales_invoice' as const, documentId: inv.id, amount: '100.00', paymentDate: '2026-05-10', currency: 'EUR' };
    const p1 = await runner.run(human, () => payments.recordPayment(body, { key }));
    const p2 = await runner.run(human, () => payments.recordPayment(body, { key }));
    ok(p1.id === p2.id, `replay with the same key returns the original payment (${p1.id === p2.id})`);
    ok((await countPayments(inv.id)) === 1, 'exactly one payment row after replay');
    ok((await countJournalsFor(inv.id)) === 1, 'exactly one settlement journal entry after replay');
  }

  // --- 2) concurrent same-key ----------------------------------------------
  {
    const inv = await freshInvoice();
    const key = randomUUID();
    const body = { documentType: 'sales_invoice' as const, documentId: inv.id, amount: '140.00', paymentDate: '2026-05-10', currency: 'EUR' };
    const results = await Promise.allSettled([
      runner.run(human, () => payments.recordPayment(body, { key })),
      runner.run(human, () => payments.recordPayment(body, { key })),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    ok(fulfilled.length === 2, `both concurrent same-key requests resolve (replay-safe) (${fulfilled.length}/2)`);
    ok((await countPayments(inv.id)) === 1, 'concurrent same-key → exactly ONE payment row');
    ok((await countJournalsFor(inv.id)) === 1, 'concurrent same-key → exactly ONE journal entry');
  }

  // --- 3) same key, different payload → conflict ----------------------------
  {
    const inv = await freshInvoice();
    const key = randomUUID();
    await runner.run(human, () => payments.recordPayment({ documentType: 'sales_invoice', documentId: inv.id, amount: '100.00', paymentDate: '2026-05-10', currency: 'EUR' }, { key }));
    let conflict = false;
    try { await runner.run(human, () => payments.recordPayment({ documentType: 'sales_invoice', documentId: inv.id, amount: '200.00', paymentDate: '2026-05-10', currency: 'EUR' }, { key })); }
    catch (e) { conflict = isConflict(e); }
    ok(conflict, 'same key + different amount is refused as a conflict (409)');
    ok((await countPayments(inv.id)) === 1, 'the conflicting second request wrote nothing');
  }

  // --- 4) two legitimate partial payments (different keys) ------------------
  {
    const inv = await freshInvoice(); // gross 360.00
    await runner.run(human, () => payments.recordPayment({ documentType: 'sales_invoice', documentId: inv.id, amount: '100.00', paymentDate: '2026-05-10', currency: 'EUR' }, { key: randomUUID() }));
    await runner.run(human, () => payments.recordPayment({ documentType: 'sales_invoice', documentId: inv.id, amount: '260.00', paymentDate: '2026-05-11', currency: 'EUR' }, { key: randomUUID() }));
    ok((await countPayments(inv.id)) === 2, 'two partial payments with distinct keys both apply');
    const bal = await runner.run(human, () => payments.calculateOutstandingBalance('sales_invoice', inv.id));
    ok(bal.outstanding === '0.00' && bal.settled, `partials settle the document exactly (outstanding ${bal.outstanding})`);
  }

  // --- 5) concurrent full payments, different keys → one settles ------------
  {
    const inv = await freshInvoice(); // gross 360.00
    const body = (k: string) => payments.recordPayment({ documentType: 'sales_invoice', documentId: inv.id, amount: '360.00', paymentDate: '2026-05-10', currency: 'EUR' }, { key: k });
    const results = await Promise.allSettled([
      runner.run(human, () => body(randomUUID())),
      runner.run(human, () => body(randomUUID())),
    ]);
    const good = results.filter((r) => r.status === 'fulfilled').length;
    const refused = results.filter((r) => r.status === 'rejected').length;
    ok(good === 1 && refused === 1, `concurrent full double-pay: exactly one settles, one refused (${good} ok / ${refused} refused)`);
    ok((await countPayments(inv.id)) === 1, 'only ONE payment row for the double-pay invoice');
    const bal = await runner.run(human, () => payments.calculateOutstandingBalance('sales_invoice', inv.id));
    ok(Number(bal.outstanding) >= 0, `outstanding never negative (${bal.outstanding})`);
  }

  // --- 6) manual ledger POST idempotency ------------------------------------
  {
    const key = randomUUID();
    const entry = { postingDate: '2026-05-10', description: 'manual idemp', sourceType: 'manual' as const, currency: 'EUR',
      lines: [{ accountId: ACC.exp, direction: 'debit' as const, amount: '50.00' }, { accountId: ACC.pay, direction: 'credit' as const, amount: '50.00' }] };
    const e1 = await runner.run(human, () => ledger.postEntry(entry, { key }));
    const e2 = await runner.run(human, () => ledger.postEntry(entry, { key }));
    ok(e1.id === e2.id, `manual ledger POST replay returns the same entry (${e1.id === e2.id})`);
    let conflict = false;
    try {
      await runner.run(human, () => ledger.postEntry({ ...entry, lines: [{ accountId: ACC.exp, direction: 'debit', amount: '51.00' }, { accountId: ACC.pay, direction: 'credit', amount: '51.00' }] }, { key }));
    } catch (e) { conflict = isConflict(e); }
    ok(conflict, 'manual ledger POST same key + different lines → conflict (409)');
    // Same canonical payload with object properties in a DIFFERENT order → still a replay.
    const reordered = { currency: 'EUR', lines: entry.lines.map((l) => ({ amount: l.amount, direction: l.direction, accountId: l.accountId })),
      sourceType: 'manual' as const, description: 'manual idemp', postingDate: '2026-05-10' };
    const e3 = await runner.run(human, () => ledger.postEntry(reordered, { key }));
    ok(e3.id === e1.id, 'property order does not change the fingerprint (reordered payload replays)');
    // Legitimately identical entries under DIFFERENT keys are both posted (keys ≠ uniqueness).
    const d1 = await runner.run(human, () => ledger.postEntry(entry, { key: randomUUID() }));
    const d2 = await runner.run(human, () => ledger.postEntry(entry, { key: randomUUID() }));
    ok(d1.id !== d2.id && d1.id !== e1.id, 'identical manual entries with different keys both post (3 distinct entries)');
  }

  // --- 7) closed period fails closed; a rolled-back attempt FREES the key -----
  {
    const inv = await freshInvoice();
    const key = randomUUID();
    await runner.run(human, () => periods.lockPeriod(2026, 3));
    let refused = false;
    try { await runner.run(human, () => payments.recordPayment({ documentType: 'sales_invoice', documentId: inv.id, amount: '100.00', paymentDate: '2026-03-15', currency: 'EUR' }, { key })); }
    catch { refused = true; }
    ok(refused, 'payment into a locked period is refused');
    ok((await countPayments(inv.id)) === 0, 'nothing was written for the locked-period payment');
    // The failed attempt's idempotency claim rolled back with the transaction → the key is free.
    const idemRows = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM financial_write_idempotency WHERE idempotency_key=$1`, [key]);
    ok(Number(idemRows.rows[0].n) === 0, 'the rolled-back attempt left NO idempotency row (key freed for retry)');
    await runner.run(human, () => periods.openPeriod(2026, 3));
    // Retry with the SAME key now succeeds into the re-opened period (proves the key was freed).
    const retry = await runner.run(human, () => payments.recordPayment({ documentType: 'sales_invoice', documentId: inv.id, amount: '100.00', paymentDate: '2026-03-15', currency: 'EUR' }, { key }));
    ok(!!retry.id && (await countPayments(inv.id)) === 1, 'retry with the same key after a rolled-back failure succeeds exactly once');
  }

  // --- 8) RLS isolation of the idempotency record ---------------------------
  {
    const inv = await freshInvoice();
    const sharedKey = randomUUID();
    await runner.run(human, () => payments.recordPayment({ documentType: 'sales_invoice', documentId: inv.id, amount: '100.00', paymentDate: '2026-05-10', currency: 'EUR' }, { key: sharedKey }));
    // Under tenant A's RLS context the claim row is visible; under tenant B's context it is NOT
    // (the SELECT runs through the FORCE-RLS policy, exactly as the app does — not the owner pool).
    const scopedCount = (ctx: { tenantId: string; userId: string; companyId: string }) =>
      runner.run(ctx, () => db.run((c) =>
        c.query<{ n: string }>(`SELECT count(*)::text n FROM financial_write_idempotency WHERE idempotency_key=$1`, [sharedKey])
          .then((r) => Number(r.rows[0].n))));
    const seenByA = await scopedCount(human);
    const seenByB = await scopedCount(humanB).catch(() => -1);
    ok(seenByA === 1, `tenant A sees its own idempotency row under RLS (${seenByA})`);
    ok(seenByB === 0, `tenant B cannot see tenant A's idempotency row under RLS (${seenByB})`);
  }

  // --- 9) bank reconciliation atomicity + idempotency -----------------------
  {
    const inv = await freshInvoice(); // receivable 360.00
    // Seed a bank account + statement + inbound transaction for 360.00.
    const acctId = (await pool.query(`INSERT INTO bank_accounts (tenant_id, company_id, iban, currency, is_primary) VALUES ($1,$2,$3,'EUR',false) RETURNING id`, [A, CA, 'BG' + Date.now().toString().slice(-16)])).rows[0].id;
    const stmtId = (await pool.query(`INSERT INTO bank_statements (tenant_id, company_id, bank_account_id, file_name, row_count, duplicate_count, error_count) VALUES ($1,$2,$3,'s.csv',1,0,0) RETURNING id`, [A, CA, acctId])).rows[0].id;
    const txnId = (await pool.query(
      `INSERT INTO bank_transactions (tenant_id, company_id, bank_statement_id, bank_account_id, booking_date, amount, currency, transaction_type, dedup_hash)
       VALUES ($1,$2,$3,$4,'2026-05-10',360.00,'EUR','inbound',$5) RETURNING id`, [A, CA, stmtId, acctId, randomUUID()])).rows[0].id;

    const r1 = await runner.run(human, () => reconcile.confirmMatch(txnId, { documentType: 'sales_invoice', documentId: inv.id, amount: '360.00' }));
    ok(r1.transaction.reconciliationStatus === 'reconciled' && !!r1.payment.id, 'confirmMatch records the payment and flips the bank line to reconciled');

    // Retry the same reconcile → must NOT create a second payment (idempotent / already-reconciled).
    let retryHandled = false;
    try {
      const r2 = await runner.run(human, () => reconcile.confirmMatch(txnId, { documentType: 'sales_invoice', documentId: inv.id, amount: '360.00' }));
      retryHandled = r2.payment.id === r1.payment.id; // replayed the original
    } catch (e) { retryHandled = named(e, 'AlreadyReconciledError') || isConflict(e); }
    ok(retryHandled, 'retrying the reconcile does not double-settle (replay or already-reconciled)');
    ok((await countPayments(inv.id)) === 1, 'bank reconcile produced exactly ONE payment for the invoice');
    const matched = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM bank_transactions WHERE id=$1 AND reconciliation_status='reconciled'`, [txnId]);
    ok(Number(matched.rows[0].n) === 1, 'the bank transaction is reconciled exactly once');
  }

  // --- 9b) concurrent reconcile of the same bank line → one settle ----------
  {
    const inv = await freshInvoice();
    const acctId = (await pool.query(`INSERT INTO bank_accounts (tenant_id, company_id, iban, currency, is_primary) VALUES ($1,$2,$3,'EUR',false) RETURNING id`, [A, CA, 'BG' + (Date.now() + 1).toString().slice(-16)])).rows[0].id;
    const stmtId = (await pool.query(`INSERT INTO bank_statements (tenant_id, company_id, bank_account_id, file_name, row_count, duplicate_count, error_count) VALUES ($1,$2,$3,'s.csv',1,0,0) RETURNING id`, [A, CA, acctId])).rows[0].id;
    const txnId = (await pool.query(
      `INSERT INTO bank_transactions (tenant_id, company_id, bank_statement_id, bank_account_id, booking_date, amount, currency, transaction_type, dedup_hash)
       VALUES ($1,$2,$3,$4,'2026-05-10',360.00,'EUR','inbound',$5) RETURNING id`, [A, CA, stmtId, acctId, randomUUID()])).rows[0].id;
    const results = await Promise.allSettled([
      runner.run(human, () => reconcile.confirmMatch(txnId, { documentType: 'sales_invoice', documentId: inv.id, amount: '360.00' })),
      runner.run(human, () => reconcile.confirmMatch(txnId, { documentType: 'sales_invoice', documentId: inv.id, amount: '360.00' })),
    ]);
    const settled = results.filter((r) => r.status === 'fulfilled').length;
    ok((await countPayments(inv.id)) === 1, `concurrent reconcile of one bank line → exactly ONE payment (fulfilled ${settled})`);
  }

  // --- 10) payment reversal still works -------------------------------------
  {
    const inv = await freshInvoice();
    const p = await runner.run(human, () => payments.recordPayment({ documentType: 'sales_invoice', documentId: inv.id, amount: '100.00', paymentDate: '2026-05-10', currency: 'EUR' }, { key: randomUUID() }));
    const rev = await runner.run(human, () => payments.reversePayment(p.id, 'тест сторно'));
    ok(rev.status === 'reversed', 'payment reversal flags the payment reversed');
    const bal = await runner.run(human, () => payments.calculateOutstandingBalance('sales_invoice', inv.id));
    ok(bal.outstanding === inv.gross, `reversal restores the full outstanding (${bal.outstanding})`);
  }

  // --- 12) REVERSAL invariant: one original → at most one reversal ----------
  // The DB unique index uq_reversal_target is the PRIMARY accounting guarantee; the
  // Idempotency-Key is only HTTP-retry protection layered on top.
  {
    const reversalsOf = (id: string) =>
      pool.query<{ n: string }>(`SELECT count(*)::text n FROM journal_entries WHERE reverses_entry_id=$1`, [id]).then((r) => Number(r.rows[0].n));
    const mk = (amt: string) => ({ postingDate: '2026-05-12', description: 'reversal target', sourceType: 'manual' as const, currency: 'EUR',
      lines: [{ accountId: ACC.exp, direction: 'debit' as const, amount: amt }, { accountId: ACC.pay, direction: 'credit' as const, amount: amt }] });
    const orig = await runner.run(human, () => ledger.postEntry(mk('77.00'), { key: randomUUID() }));

    // 12a) two CONCURRENT reversals with DIFFERENT idempotency keys → exactly one reversal.
    const k1 = randomUUID(); const k2 = randomUUID();
    const rs = await Promise.allSettled([
      runner.run(human, () => ledger.reverseEntry(orig.id, 'concurrent', { key: k1 })),
      runner.run(human, () => ledger.reverseEntry(orig.id, 'concurrent', { key: k2 })),
    ]);
    const won = rs.findIndex((r) => r.status === 'fulfilled');
    const lostReason = rs.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    const lostErr = lostReason?.reason as { name?: string; code?: string; constraint?: string } | undefined;
    ok(rs.filter((r) => r.status === 'fulfilled').length === 1, 'concurrent reversals (different keys): exactly one succeeds');
    ok((await reversalsOf(orig.id)) === 1, 'concurrent reversals (different keys): exactly ONE reversal entry exists');
    console.log(`      (race loser error: name=${lostErr?.name} code=${lostErr?.code ?? '-'} constraint=${lostErr?.constraint ?? '-'})`);
    const winnerKey = won === 0 ? k1 : k2; const loserKey = won === 0 ? k2 : k1;
    const winner = (rs[won] as PromiseFulfilledResult<{ id: string }>).value;

    // 12b) same-key retry → returns the ORIGINAL reversal, no new entry.
    const replay = await runner.run(human, () => ledger.reverseEntry(orig.id, 'concurrent', { key: winnerKey }));
    ok(replay.id === winner.id && (await reversalsOf(orig.id)) === 1, 'same-key reversal retry returns the original reversal');

    // 12c) same key + different reason → conflict.
    let conflict = false;
    try { await runner.run(human, () => ledger.reverseEntry(orig.id, 'different reason', { key: winnerKey })); } catch (e) { conflict = isConflict(e); }
    ok(conflict, 'same key + different reversal reason → conflict (409)');

    // 12d) the loser's claim rolled back; re-using it (or any new key) on an already-reversed entry fails.
    let already1 = false; let already2 = false;
    try { await runner.run(human, () => ledger.reverseEntry(orig.id, 'concurrent', { key: loserKey })); } catch (e) { already1 = named(e, 'AlreadyReversedError'); }
    try { await runner.run(human, () => ledger.reverseEntry(orig.id, 'again', { key: randomUUID() })); } catch (e) { already2 = named(e, 'AlreadyReversedError'); }
    ok(already1 && already2, 'reversing an already-reversed entry with a new key fails (AlreadyReversedError)');
    ok((await reversalsOf(orig.id)) === 1, 'still exactly ONE reversal after all retries');
    const idemRev = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM financial_write_idempotency WHERE operation='ledger.reverse' AND idempotency_key = ANY($1)`, [[k1, k2]]);
    ok(Number(idemRev.rows[0].n) === 1, 'only the winning reversal key is recorded (loser claim rolled back)');

    // 12e) closed-period rule still enforced for reversal (original's period locked → refused).
    const febEntry = await runner.run(human, () => ledger.postEntry({ ...mk('12.00'), postingDate: '2026-02-10' }, { key: randomUUID() }));
    await runner.run(human, () => periods.lockPeriod(2026, 2));
    let lockedRefused = false;
    try { await runner.run(human, () => ledger.reverseEntry(febEntry.id, 'locked', { key: randomUUID() })); } catch (e) { lockedRefused = named(e, 'PeriodLockedError'); }
    ok(lockedRefused && (await reversalsOf(febEntry.id)) === 0, 'reversal of an entry in a LOCKED period is refused (PeriodLockedError), nothing written');
    await runner.run(human, () => periods.openPeriod(2026, 2));

    // 12f) Date→ISO normalization: a 1st-of-month entry is gated against ITS OWN month.
    //      Lock 2026-06 and reverse an entry dated 2026-06-01: must be refused as 2026-06 (not May).
    const junEntry = await runner.run(human, () => ledger.postEntry({ ...mk('5.00'), postingDate: '2026-06-01' }, { key: randomUUID() }));
    await runner.run(human, () => periods.lockPeriod(2026, 6));
    let junMsg = '';
    try { await runner.run(human, () => ledger.reverseEntry(junEntry.id, 'boundary', { key: randomUUID() })); } catch (e) { junMsg = (e as Error).message; }
    ok(/06\/2026/.test(junMsg) && (await reversalsOf(junEntry.id)) === 0, `1st-of-month entry gated against its own month (TZ=${process.env.TZ ?? 'system'}; "${junMsg}")`);
    await runner.run(human, () => periods.openPeriod(2026, 6));
  }

  // --- 13) FAULT INJECTION: failure at each step rolls everything back -------
  {
    const payRepo = app.get(PaymentsRepository, { strict: false });
    const bankRepo = app.get(BankingRepository, { strict: false });
    const journalsFor = (invoiceId: string) => countJournalsFor(invoiceId);
    const idemFor = (key: string) =>
      pool.query<{ n: string }>(`SELECT count(*)::text n FROM financial_write_idempotency WHERE idempotency_key=$1`, [key]).then((r) => Number(r.rows[0].n));
    // Patch a repository method to throw ONCE, then restore.
    const failOnce = <T extends object>(obj: T, method: keyof T, label: string) => {
      const orig = (obj[method] as unknown as (...a: unknown[]) => unknown).bind(obj);
      (obj as Record<string, unknown>)[method as string] = async (...a: unknown[]) => {
        (obj as Record<string, unknown>)[method as string] = orig;   // restore immediately
        void a; throw new Error(`INJECTED FAULT: ${label}`);
      };
    };
    const payOnce = async (step: keyof PaymentsRepository, label: string) => {
      const inv = await freshInvoice();
      const key = randomUUID();
      const body = { documentType: 'sales_invoice' as const, documentId: inv.id, amount: '90.00', paymentDate: '2026-05-10', currency: 'EUR' };
      failOnce(payRepo, step, label);
      let threw = false;
      try { await runner.run(human, () => payments.recordPayment(body, { key })); } catch (e) { threw = /INJECTED FAULT/.test((e as Error).message); }
      const [p, j, k] = [await countPayments(inv.id), await journalsFor(inv.id), await idemFor(key)];
      ok(threw && p === 0 && j === 0 && k === 0, `fault ${label}: payment=${p} journal=${j} idempotency=${k} → full rollback`);
      const retry = await runner.run(human, () => payments.recordPayment(body, { key }));
      ok(!!retry.id && (await countPayments(inv.id)) === 1 && (await journalsFor(inv.id)) === 1, `fault ${label}: same key reusable → exactly one payment + one journal`);
    };
    await payOnce('lockDocument', 'after idempotency claim (at document lock)');
    await payOnce('insertPayment', 'after journal insertion (at payment insert)');
    await payOnce('linkJournalEntry', 'after payment insertion (at journal link)');

    // Bank: failure immediately before the bank status flip → settlement rolls back too.
    const inv = await freshInvoice();
    const acctId = (await pool.query(`INSERT INTO bank_accounts (tenant_id, company_id, iban, currency, is_primary) VALUES ($1,$2,$3,'EUR',false) RETURNING id`, [A, CA, 'BG' + (Date.now() + 7).toString().slice(-16)])).rows[0].id;
    const stmtId = (await pool.query(`INSERT INTO bank_statements (tenant_id, company_id, bank_account_id, file_name, row_count, duplicate_count, error_count) VALUES ($1,$2,$3,'s.csv',1,0,0) RETURNING id`, [A, CA, acctId])).rows[0].id;
    const txnId = (await pool.query(
      `INSERT INTO bank_transactions (tenant_id, company_id, bank_statement_id, bank_account_id, booking_date, amount, currency, transaction_type, dedup_hash)
       VALUES ($1,$2,$3,$4,'2026-05-10',360.00,'EUR','inbound',$5) RETURNING id`, [A, CA, stmtId, acctId, randomUUID()])).rows[0].id;
    failOnce(bankRepo, 'markReconciledIfUnreconciled', 'before bank status flip');
    let threw = false;
    try { await runner.run(human, () => reconcile.confirmMatch(txnId, { documentType: 'sales_invoice', documentId: inv.id, amount: '360.00' })); } catch (e) { threw = /INJECTED FAULT/.test((e as Error).message); }
    const st = (await pool.query<{ s: string }>(`SELECT reconciliation_status s FROM bank_transactions WHERE id=$1`, [txnId])).rows[0].s;
    const [p, j, k] = [await countPayments(inv.id), await journalsFor(inv.id), await idemFor(txnId)];
    ok(threw && p === 0 && j === 0 && k === 0 && st === 'unreconciled', `fault before bank flip: payment=${p} journal=${j} idempotency=${k} status=${st} → full rollback`);
    const r = await runner.run(human, () => reconcile.confirmMatch(txnId, { documentType: 'sales_invoice', documentId: inv.id, amount: '360.00' }));
    ok(r.transaction.reconciliationStatus === 'reconciled' && (await countPayments(inv.id)) === 1, 'bank reconcile retry after the fault succeeds exactly once');

    // No orphans anywhere: every payment-sourced journal has a payment row, and vice versa.
    const orphanJ = await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM journal_entries je WHERE je.source_type='payment'
         AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.journal_entry_id = je.id)`);
    const orphanP = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM payments WHERE journal_entry_id IS NULL`);
    ok(Number(orphanJ.rows[0].n) === 0 && Number(orphanP.rows[0].n) === 0, `no orphan settlement journals (${orphanJ.rows[0].n}) or unlinked payments (${orphanP.rows[0].n})`);
    const incomplete = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM financial_write_idempotency WHERE result_json IS NULL`);
    ok(Number(incomplete.rows[0].n) === 0, `no committed idempotency row is incomplete (result_json NULL: ${incomplete.rows[0].n})`);
  }

  // --- 5b) PAYABLES (purchase journal entry as the settleable document) -----
  // Regression: the payable lock must work for app_user, who has NO UPDATE on journal_entries.
  {
    const purchase = await runner.run(human, () => ledger.postEntry({ postingDate: '2026-05-15', description: 'supplier bill', sourceType: 'review', currency: 'EUR',
      lines: [{ accountId: ACC.exp, direction: 'debit', amount: '240.00' }, { accountId: ACC.pay, direction: 'credit', amount: '240.00' }] }, { key: randomUUID() }));
    const countPay = () => pool.query<{ n: string }>(`SELECT count(*)::text n FROM payments WHERE document_id=$1 AND status='active'`, [purchase.id]).then((r) => Number(r.rows[0].n));
    const key = randomUUID();
    const body = { documentType: 'purchase_invoice' as const, documentId: purchase.id, amount: '40.00', paymentDate: '2026-05-16', currency: 'EUR' };
    const a = await runner.run(human, () => payments.recordPayment(body, { key }));
    const b = await runner.run(human, () => payments.recordPayment(body, { key }));
    ok(a.id === b.id && (await countPay()) === 1, 'payable: supplier payment works under app_user and same-key replays');
    const rs = await Promise.allSettled([
      runner.run(human, () => payments.recordPayment({ ...body, amount: '200.00' }, { key: randomUUID() })),
      runner.run(human, () => payments.recordPayment({ ...body, amount: '200.00' }, { key: randomUUID() })),
    ]);
    ok(rs.filter((r) => r.status === 'fulfilled').length === 1 && (await countPay()) === 2, 'payable: concurrent full settlement (different keys) → exactly one succeeds, no overpayment');
    const rev = await runner.run(human, () => payments.reversePayment(a.id, 'payable reversal', { key: randomUUID() }));
    ok(rev.status === 'reversed' && (await countPay()) === 1, 'payable: payment reversal works and is atomic');
  }

  // --- 14) ATOMIC PAYMENT REVERSAL ------------------------------------------
  {
    const payRepo = app.get(PaymentsRepository, { strict: false });
    const idemRepo = app.get(IdempotencyRepository, { strict: false });
    const statusOf = (pid: string) => pool.query<{ s: string }>(`SELECT status s FROM payments WHERE id=$1`, [pid]).then((r) => r.rows[0].s);
    const reversalsOf = (jeId: string) =>
      pool.query<{ n: string }>(`SELECT count(*)::text n FROM journal_entries WHERE reverses_entry_id=$1`, [jeId]).then((r) => Number(r.rows[0].n));
    const idemFor = (key: string) =>
      pool.query<{ n: string }>(`SELECT count(*)::text n FROM financial_write_idempotency WHERE idempotency_key=$1`, [key]).then((r) => Number(r.rows[0].n));
    const failOnce = <T extends object>(obj: T, method: keyof T, label: string) => {
      const orig = (obj[method] as unknown as (...a: unknown[]) => unknown).bind(obj);
      (obj as Record<string, unknown>)[method as string] = async (...a: unknown[]) => {
        (obj as Record<string, unknown>)[method as string] = orig;
        void a; throw new Error(`INJECTED FAULT: ${label}`);
      };
    };
    const paid = async (paymentDate = '2026-05-20') => {
      const inv = await freshInvoice();
      const p = await runner.run(human, () => payments.recordPayment({ documentType: 'sales_invoice', documentId: inv.id, amount: '100.00', paymentDate, currency: 'EUR' }, { key: randomUUID() }));
      return { inv, p, je: p.journalEntryId! };
    };
    const consistent = async (pid: string, je: string) => {
      const [s, n] = [await statusOf(pid), await reversalsOf(je)];
      return (s === 'active' && n === 0) || (s === 'reversed' && n === 1);
    };

    // A) fault AFTER the reversal journal is created, BEFORE the payment status update.
    {
      const { p, je } = await paid(); const key = randomUUID();
      failOnce(payRepo, 'markReversedIfActive', 'after reversal journal, before payment update');
      let threw = false;
      try { await runner.run(human, () => payments.reversePayment(p.id, 'A', { key })); } catch (e) { threw = /INJECTED FAULT/.test((e as Error).message); }
      const [n, s, k] = [await reversalsOf(je), await statusOf(p.id), await idemFor(key)];
      ok(threw && n === 0 && s === 'active' && k === 0, `A: fault before payment update → reversal journals=${n}, payment=${s}, idempotency=${k} (all rolled back)`);
      const r = await runner.run(human, () => payments.reversePayment(p.id, 'A', { key }));
      ok(r.status === 'reversed' && (await reversalsOf(je)) === 1, 'A: same key reusable after the rollback → exactly one reversal');
    }

    // B) fault AFTER the payment state update + audit, BEFORE commit (at idempotency completion).
    {
      const { p, je } = await paid(); const key = randomUUID();
      failOnce(idemRepo, 'complete', 'after payment update, before commit');
      let threw = false;
      try { await runner.run(human, () => payments.reversePayment(p.id, 'B', { key })); } catch (e) { threw = /INJECTED FAULT/.test((e as Error).message); }
      const [n, s, k] = [await reversalsOf(je), await statusOf(p.id), await idemFor(key)];
      ok(threw && n === 0 && s === 'active' && k === 0, `B: fault after payment update → reversal journals=${n}, payment=${s}, idempotency=${k} (all rolled back)`);
    }

    // C) two CONCURRENT payment reversals with DIFFERENT keys → exactly one reversal.
    {
      const { inv, p, je } = await paid();
      const rs = await Promise.allSettled([
        runner.run(human, () => payments.reversePayment(p.id, 'C', { key: randomUUID() })),
        runner.run(human, () => payments.reversePayment(p.id, 'C', { key: randomUUID() })),
      ]);
      const loser = rs.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      const lname = (loser?.reason as Error | undefined)?.constructor?.name;
      ok(rs.filter((r) => r.status === 'fulfilled').length === 1, `C: concurrent reversals, different keys → one succeeds (loser: ${lname})`);
      ok(lname === 'AlreadyReversedError' && /Payment/.test((loser?.reason as Error).message), 'C: loser gets the payment AlreadyReversedError (HTTP 409), not a DB error');
      ok((await reversalsOf(je)) === 1 && (await statusOf(p.id)) === 'reversed', 'C: exactly ONE reversal journal and payment reversed');
      const bal = await runner.run(human, () => payments.calculateOutstandingBalance('sales_invoice', inv.id));
      ok(bal.outstanding === inv.gross, `C: outstanding restored exactly once (${bal.outstanding})`);
    }

    // D) closed period (the payment's own period locked) → no reversal, payment unchanged, key free.
    {
      const { p, je } = await paid('2026-03-20'); const key = randomUUID();
      await runner.run(human, () => periods.lockPeriod(2026, 3));
      let locked = false;
      try { await runner.run(human, () => payments.reversePayment(p.id, 'D', { key })); } catch (e) { locked = named(e, 'PeriodLockedError'); }
      ok(locked && (await reversalsOf(je)) === 0 && (await statusOf(p.id)) === 'active' && (await idemFor(key)) === 0, 'D: locked period → PeriodLockedError, no reversal, payment active, key free');
      await runner.run(human, () => periods.openPeriod(2026, 3));
    }

    // F) same-key retry → stable replay; same key + different reason → 409; new key → already reversed.
    {
      const { p, je } = await paid(); const key = randomUUID();
      const r1 = await runner.run(human, () => payments.reversePayment(p.id, 'F', { key }));
      const r2 = await runner.run(human, () => payments.reversePayment(p.id, 'F', { key }));
      ok(r1.id === r2.id && r2.status === 'reversed' && (await reversalsOf(je)) === 1, 'F: same-key retry replays the original result, exactly one reversal');
      let conflict = false; let already = false;
      try { await runner.run(human, () => payments.reversePayment(p.id, 'F-other', { key })); } catch (e) { conflict = isConflict(e); }
      try { await runner.run(human, () => payments.reversePayment(p.id, 'F', { key: randomUUID() })); } catch (e) { already = (e as Error).constructor.name === 'AlreadyReversedError'; }
      ok(conflict && already && (await reversalsOf(je)) === 1, 'F: same key + different reason → 409; new key → AlreadyReversedError; still one reversal');
    }

    // G) timezone: a payment dated the 1st of a month is gated against ITS OWN month.
    {
      const { p, je } = await paid('2026-06-01');
      await runner.run(human, () => periods.lockPeriod(2026, 6));
      let msg = '';
      try { await runner.run(human, () => payments.reversePayment(p.id, 'G', { key: randomUUID() })); } catch (e) { msg = (e as Error).message; }
      ok(/06\/2026/.test(msg) && (await reversalsOf(je)) === 0 && (await statusOf(p.id)) === 'active', `G: 2026-06-01 payment gated as 06/2026 (TZ=${process.env.TZ ?? 'system'}; "${msg}")`);
      await runner.run(human, () => periods.openPeriod(2026, 6));
    }

    // Settlement guard: the ledger API cannot reverse a payment's settlement entry directly.
    {
      const { p, je } = await paid();
      let refused = false;
      try { await runner.run(human, () => ledger.reverseEntry(je, 'direct', { key: randomUUID() })); } catch (e) { refused = named(e, 'SettlementReversalNotAllowedError'); }
      ok(refused && (await reversalsOf(je)) === 0 && (await statusOf(p.id)) === 'active', 'direct ledger reversal of a settlement entry is refused (409); payment stays active');
    }

    // Global payment/ledger consistency: no payment is active with a reversed settlement, or reversed without one.
    const bad = await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM payments p
        WHERE p.journal_entry_id IS NOT NULL AND (
          (p.status = 'active'   AND EXISTS     (SELECT 1 FROM journal_entries r WHERE r.reverses_entry_id = p.journal_entry_id)) OR
          (p.status = 'reversed' AND NOT EXISTS (SELECT 1 FROM journal_entries r WHERE r.reverses_entry_id = p.journal_entry_id)))`);
    ok(Number(bad.rows[0].n) === 0, `no payment/ledger divergence anywhere (${bad.rows[0].n} inconsistent payments)`);
    void consistent;
  }

  // --- 15) PERIOD-CLOSE vs REVERSAL CONCURRENCY ------------------------------
  // The reversal posts into the CURRENT period (ledger uses the UTC calendar date), so lock that one.
  {
    const periodRepo = app.get(PeriodRepository, { strict: false });
    const journalRepo = app.get(JournalRepository, { strict: false });
    const now = new Date().toISOString().slice(0, 7); const Y = Number(now.slice(0, 4)); const M = Number(now.slice(5, 7));
    const statusOf = (pid: string) => pool.query<{ s: string }>(`SELECT status s FROM payments WHERE id=$1`, [pid]).then((r) => r.rows[0].s);
    const reversalsOf = (jeId: string) =>
      pool.query<{ n: string }>(`SELECT count(*)::text n FROM journal_entries WHERE reverses_entry_id=$1`, [jeId]).then((r) => Number(r.rows[0].n));
    const deferred = () => { let release!: () => void; const p = new Promise<void>((r) => { release = r; }); return { p, release }; };
    const settledWithin = async (pr: Promise<unknown>, ms: number) => {
      let done = false; pr.then(() => { done = true; }, () => { done = true; });
      await new Promise((r) => setTimeout(r, ms)); return done;
    };
    // Pause ONE call of obj.method: signal entry, then wait for release before continuing.
    const pauseOnce = <T extends object>(obj: T, method: keyof T, after: boolean) => {
      const entered = deferred(); const gate = deferred();
      const orig = (obj[method] as unknown as (...a: unknown[]) => Promise<unknown>).bind(obj);
      (obj as Record<string, unknown>)[method as string] = async (...a: unknown[]) => {
        (obj as Record<string, unknown>)[method as string] = orig;
        if (after) { const res = await orig(...a); entered.release(); await gate.p; return res; }
        entered.release(); await gate.p; return orig(...a);
      };
      return { entered: entered.p, release: gate.release };
    };
    const paidNow = async () => {
      const inv = await freshInvoice();
      const p = await runner.run(human, () => payments.recordPayment({ documentType: 'sales_invoice', documentId: inv.id, amount: '50.00', paymentDate: '2026-05-21', currency: 'EUR' }, { key: randomUUID() }));
      return { p, je: p.journalEntryId! };
    };

    // E1) LOCK FIRST: lockPeriod has written 'locked' but not committed; a reversal starts.
    //     Without serialization the reversal would read 'open' and commit into the locked period.
    {
      const { p, je } = await paidNow();
      const pause = pauseOnce(periodRepo, 'upsert', true);
      const lockP = runner.run(human, () => periods.lockPeriod(Y, M));
      await pause.entered;                                   // lock tx holds the exclusive gate, uncommitted
      const revP = runner.run(human, () => payments.reversePayment(p.id, 'E1', { key: randomUUID() }));
      const revFinishedEarly = await settledWithin(revP, 800);
      pause.release(); await lockP;
      let refused = false; try { await revP; } catch (e) { refused = named(e, 'PeriodLockedError'); }
      ok(!revFinishedEarly, 'E1: reversal WAITS while a period lock is in flight (did not run against the stale "open" status)');
      ok(refused && (await reversalsOf(je)) === 0 && (await statusOf(p.id)) === 'active', 'E1: after the lock commits the reversal is refused (PeriodLockedError); nothing posted into the closed period');
      await runner.run(human, () => periods.openPeriod(Y, M));
    }

    // E2) REVERSAL FIRST: the reversal has passed its period gate and is mid-transaction; a lock starts.
    {
      const { p, je } = await paidNow();
      const pause = pauseOnce(journalRepo, 'nextEntryNo', false); // reverseInTx: gates done → paused before insert
      const revP = runner.run(human, () => payments.reversePayment(p.id, 'E2', { key: randomUUID() }));
      await pause.entered;
      const lockP = runner.run(human, () => periods.lockPeriod(Y, M));
      const lockFinishedEarly = await settledWithin(lockP, 800);
      pause.release(); const rev = await revP; await lockP;
      ok(!lockFinishedEarly, 'E2: lockPeriod WAITS for the in-flight reversal to commit');
      const lockedNow = (await pool.query<{ s: string }>(`SELECT status s FROM accounting_periods WHERE company_id=$1 AND year=$2 AND month=$3`, [CA, Y, M])).rows[0]?.s;
      ok(rev.status === 'reversed' && (await reversalsOf(je)) === 1 && lockedNow === 'locked',
        'E2: the reversal that passed the gate first commits, THEN the lock completes (serialized; never interleaved)');
      await runner.run(human, () => periods.openPeriod(Y, M));
    }

  }

  // --- 11) global balance invariant -----------------------------------------
  {
    const unbalanced = await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM (
         SELECT entry_id, SUM(amount) FILTER (WHERE direction='debit') d, SUM(amount) FILTER (WHERE direction='credit') c
           FROM journal_lines GROUP BY entry_id HAVING SUM(amount) FILTER (WHERE direction='debit') <> SUM(amount) FILTER (WHERE direction='credit')
       ) q`);
    ok(Number(unbalanced.rows[0].n) === 0, `every journal entry balances Σdebit=Σcredit (${unbalanced.rows[0].n} unbalanced)`);
  }

  await pool.end();
  await app.close();
  console.log(`\n=== FINANCIAL-WRITE INTEGRITY E2E: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error('CRASHED:', e); process.exit(1); });
