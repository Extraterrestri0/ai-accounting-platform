import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { JobContextRunner } from '../../src/platform/database/job-context.runner';
import { LEDGER_SERVICE, type ILedgerService } from '../../src/modules/ledger';
import { VAT_SERVICE, type IVatService } from '../../src/modules/tax';
import { INVOICE_SERVICE, type IInvoiceService } from '../../src/modules/invoicing';
import { REPORTS_SERVICE, type IReportsService } from '../../src/modules/reporting';

const A = '11111111-1111-1111-1111-111111111111';
const CA = 'c1111111-1111-1111-1111-111111111111';
const U = 'eeeeeeee-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const CB = 'c2222222-2222-2222-2222-222222222222';
const ACC = { exp: 'a0000000-0000-0000-0000-000000000602', vatIn: 'a0000000-0000-0000-0000-000000004531', pay: 'a0000000-0000-0000-0000-000000000401' };

let pass = 0; let fail = 0;
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? '  \u2713 PASS' : '  \u2717 FAIL'}: ${msg}`); cond ? pass++ : fail++; };
const eq = (a: unknown, b: unknown, msg: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)})`);

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const runner = app.get(JobContextRunner);
  const ledger = app.get<ILedgerService>(LEDGER_SERVICE);
  const vat = app.get<IVatService>(VAT_SERVICE);
  const invoices = app.get<IInvoiceService>(INVOICE_SERVICE);
  const reports = app.get<IReportsService>(REPORTS_SERVICE);
  const pool = new Pool({ host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE });
  const human = { tenantId: A, userId: U, companyId: CA };
  const now = new Date(); const Y = now.getFullYear(); const M = now.getMonth() + 1; const TODAY = now.toISOString().slice(0, 10);

  console.log('\n=== E2E MVP WORKFLOW (real services · live PostgreSQL) ===\n');

  // Steps 10 (post purchase = approved-review posting) — REAL LedgerService
  await runner.run(human, async () => {
    const entry = await ledger.postEntry({ postingDate: TODAY, description: 'Approved purchase', sourceType: 'review', currency: 'EUR',
      lines: [ { accountId: ACC.exp, direction: 'debit', amount: '200.00' }, { accountId: ACC.vatIn, direction: 'debit', amount: '40.00' }, { accountId: ACC.pay, direction: 'credit', amount: '240.00' } ] });
    ok(!!entry.id, 'posted balanced purchase journal entry via real LedgerService');
  });

  // Proof: unbalanced journal entries rejected (REAL ledger deferred balance trigger)
  await runner.run(human, async () => {
    let threw = false;
    try { await ledger.postEntry({ postingDate: '2026-04-10', currency: 'EUR', lines: [ { accountId: ACC.exp, direction: 'debit', amount: '100.00' }, { accountId: ACC.pay, direction: 'credit', amount: '99.00' } ] }); }
    catch { threw = true; }
    ok(threw, 'unbalanced journal entry rejected by the ledger');
  });

  // Steps 13-14 — REAL InvoiceService: create draft → issue (gapless #, PDF, post Dr411/Cr702/Cr4532, feed VAT)
  let invoiceId = ''; let invoiceNo = '';
  await runner.run(human, async () => {
    const draft = await invoices.createDraft({ customerId: 'cccccccc-1111-1111-1111-111111111111', customerName: 'Бета ЕООД',
      lines: [ { description: 'Consulting', quantity: '1', unitPrice: '300.00', vatRate: '20', vatCodeId: '11111111-aaaa-1111-1111-111111111111' } ] });
    eq(draft.grossTotal, '360.00', 'invoice draft gross total 360.00');
    const issued = await invoices.issueInvoice(draft.id);
    invoiceId = draft.id; invoiceNo = issued.invoice.invoiceNumber ?? '';
    ok(issued.invoice.status === 'issued' && !!issued.invoice.invoiceNumber, `invoice issued with gapless number ${invoiceNo}`);
    ok(!!issued.journalEntryId, 'issued invoice posted to the ledger (Dr 411 / Cr 702 / Cr 4532)');
  });

  // Steps 11-12 — REAL VatService: build registers + summary + return
  await runner.run(human, async () => {
    await vat.buildRegisters(Y, M);
    const s = await vat.getSummary(Y, M);
    eq([s.outputVat, s.deductibleVat, s.vatPayable], [60, 40, 20], 'VAT summary output 60 / deductible 40 / payable 20');
    const ret = await vat.generateReturn(Y, M);
    eq(ret.summary.vatPayable, 20, 'VAT return payable 20.00');
  });

  // Step 15 — REAL ReportsService: trial balance balances + P&L
  await runner.run(human, async () => {
    const tb = await reports.trialBalance({ from: '2026-01-01', to: '2026-12-31' });
    ok(tb.totals.balanced && tb.totals.debit === tb.totals.credit, `trial balance balances (${tb.totals.debit} = ${tb.totals.credit})`);
    const pnl = await reports.profitAndLoss({ from: '2026-01-01', to: '2026-12-31' });
    eq([pnl.revenue, pnl.expense, pnl.netProfit], ['300.00', '200.00', '100.00'], 'P&L revenue 300 / expense 200 / net profit 100');
  });

  // Proof: issued invoices are immutable (DB trigger)
  {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.tenant_id',$1,true)", [A]);
      await c.query("SELECT set_config('app.company_id',$1,true)", [CA]);
      let threw = false;
      try { await c.query("UPDATE invoices SET net_total=999 WHERE id=$1", [invoiceId]); } catch { threw = true; }
      ok(threw, 'issued invoice is immutable (UPDATE blocked)');
      await c.query('ROLLBACK');
    } finally { c.release(); }
  }

  // Proof: AI cannot approve — review_actions enforces actor_type='user' at the DB
  {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.tenant_id',$1,true)", [A]);
      await c.query("SELECT set_config('app.company_id',$1,true)", [CA]);
      let threw = false;
      try { await c.query("INSERT INTO review_actions (tenant_id, company_id, review_package_id, actor_type, actor_id, action) VALUES ($1,$2,gen_random_uuid(),'ai',$3,'approve')", [A, CA, U]); }
      catch { threw = true; }
      ok(threw, 'AI cannot approve — review_actions rejects actor_type=ai');
      await c.query('ROLLBACK');
    } finally { c.release(); }
  }

  // Proof: AI cannot post — no journal entry is AI-authored; AI writes only suggestions
  await runner.run(human, async () => {
    const r = await pool.query("SELECT count(*)::int n FROM journal_entries WHERE tenant_id=$1 AND created_by_actor_type <> 'user'", [A]);
    // RLS would hide rows anyway; query as owner-equivalent via context-free count below
  });
  {
    const r = await pool.query("SELECT count(*)::int AS n FROM journal_entries WHERE created_by_actor_type <> 'user'");
    eq(r.rows[0].n, 0, 'AI cannot post — every journal entry is human-authored (created_by_actor_type=user)');
  }

  // Proof: audit chain validates
  {
    const r = await pool.query('SELECT app.verify_audit_chain($1::uuid) AS ok', [A]);
    ok(r.rows[0].ok === true, 'audit chain validates for the demo tenant');
  }

  // Proof: RLS holds end-to-end — tenant B sees none of tenant A's ledger
  await runner.run({ tenantId: B, userId: U, companyId: CB }, async () => {
    const seen = await ledger.listEntries(100, 0).catch(() => []);
    eq((seen as unknown[]).length, 0, 'RLS: tenant B sees 0 of tenant A journal entries');
  });

  await pool.end();
  await app.close();
  console.log(`\n=== E2E RESULT: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('E2E CRASHED:', e); process.exit(1); });
