/* Real-service posting-date proof (live PostgreSQL). Complements the deterministic unit tests
   with a real-DB check that: the review package persists a confirmed posting date (migration +
   repo + date normalization), the real LedgerService posts with that exact date (not today), and
   the real period gate is authoritative on the confirmed date (locked → refused, never moved). */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { JobContextRunner } from '../../src/platform/database/job-context.runner';
import { ReviewRepository } from '../../src/modules/docintel/infrastructure/review.repository';
import { DatabaseContextService } from '../../src/platform';
import { LEDGER_SERVICE, type ILedgerService } from '../../src/modules/ledger';
import { PERIOD_SERVICE, type IAccountingPeriodService } from '../../src/modules/periods';
import { Pool } from 'pg';

const A = '11111111-1111-1111-1111-111111111111';
const CA = 'c1111111-1111-1111-1111-111111111111';
const U = 'eeeeeeee-1111-1111-1111-111111111111';
const ACC = { exp: 'a0000000-0000-0000-0000-000000000602', pay: 'a0000000-0000-0000-0000-000000000401' };
const CONFIRMED = '2026-07-15';
const TODAY = new Date().toISOString().slice(0, 10);

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? '  ✓ PASS' : '  ✗ FAIL'}: ${m}`); c ? pass++ : fail++; };

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const runner = app.get(JobContextRunner);
  const reviews = app.get(ReviewRepository);
  const db = app.get(DatabaseContextService);
  const ledger = app.get<ILedgerService>(LEDGER_SERVICE);
  const periods = app.get<IAccountingPeriodService>(PERIOD_SERVICE);
  // Owner pool for the test's OWN seeding/verification SQL only (superuser → not RLS-bound).
  // The code under test (setPostingDate, postEntry, assertOpen) still runs as app_user under RLS.
  const pool = new Pool({ host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.MIGRATION_USER ?? process.env.PGUSER, password: process.env.MIGRATION_PASSWORD ?? process.env.PGPASSWORD, database: process.env.PGDATABASE });
  const human = { tenantId: A, userId: U, companyId: CA };

  console.log('\n=== POSTING-DATE E2E (real services · live PostgreSQL) ===\n');
  console.log(`  (confirmed date ${CONFIRMED}; today ${TODAY})`);

  // a review package to carry the confirmed date (document FK satisfied by a bare documents row)
  const docId = (await pool.query(
    `INSERT INTO documents (tenant_id, company_id, original_filename, mime_type, size_bytes, status, source, uploaded_by)
     VALUES ($1,$2,'pd-e2e.pdf','application/pdf',100,'ready','upload',$3) RETURNING id`, [A, CA, U])).rows[0].id;
  const rpId = (await pool.query(
    `INSERT INTO review_packages (tenant_id, company_id, document_id, status) VALUES ($1,$2,$3,'approved') RETURNING id`,
    [A, CA, docId])).rows[0].id;

  // 1) confirmed posting date round-trips through the real repo as a plain YYYY-MM-DD string
  await runner.run(human, async () => {
    await db.run((c) => reviews.setPostingDate(c, rpId, CONFIRMED));
    const pkg = await db.run((c) => reviews.getById(c, rpId));
    ok(pkg?.approvedPostingDate === CONFIRMED, `review package persists confirmed date (got ${pkg?.approvedPostingDate})`);
  });

  // 2) the real ledger posts with the confirmed date, not today
  let entryDate = '';
  await runner.run(human, async () => {
    const entry = await ledger.postEntry({ postingDate: CONFIRMED, description: 'posting-date proof', sourceType: 'review', currency: 'EUR',
      lines: [{ accountId: ACC.exp, direction: 'debit', amount: '100.00' }, { accountId: ACC.pay, direction: 'credit', amount: '100.00' }] });
    const pd: unknown = entry.postingDate;
    entryDate = pd instanceof Date ? pd.toISOString().slice(0, 10) : String(pd).slice(0, 10);
    ok(entryDate === CONFIRMED && entryDate !== TODAY, `ledger stored the confirmed posting date (got ${entryDate})`);
    // debit = credit invariant intact
    const sums = await pool.query<{ d: string; c: string }>(
      `SELECT coalesce(sum(amount) FILTER (WHERE direction='debit'),0) d, coalesce(sum(amount) FILTER (WHERE direction='credit'),0) c
         FROM journal_lines WHERE entry_id=$1`, [entry.id]);
    ok(sums.rows[0].d === sums.rows[0].c, `debit = credit (${sums.rows[0].d} = ${sums.rows[0].c})`);
  });

  // 3) the period gate is authoritative on the confirmed date: lock 2026-07, a 2026-07-15 post is refused
  await runner.run(human, async () => {
    await periods.lockPeriod(2026, 7);
    let locked = false;
    try {
      await periods.assertOpen(CONFIRMED, 'Posting');
    } catch { locked = true; }
    ok(locked, 'confirmed date in a locked period fails closed (never moved to an open period)');
    await periods.openPeriod(2026, 7); // restore for idempotent re-runs
  });

  await pool.end();
  await app.close();
  console.log(`\n=== POSTING-DATE E2E: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0); // explicit: don't hang on lingering DB/Redis handles
}
main().catch((e) => { console.error('CRASHED:', e); process.exit(1); });
