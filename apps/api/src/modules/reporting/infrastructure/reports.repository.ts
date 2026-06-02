import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { InvoiceReportRow, LedgerLine } from '../domain/reports/models';

@Injectable()
export class ReportsRepository {
  /** Read posted ledger lines (joined to account code/name/type) in a period. Read-only on the immutable ledger. */
  async ledgerLines(db: ScopedClient, from: string, to: string): Promise<LedgerLine[]> {
    const r = await db.query<{ entry_id: string; entry_no: number; posting_date: string; source_ref: string | null; code: string; name: string; type: LedgerLine['type']; direction: LedgerLine['direction']; amount: string; narrative: string | null }>(
      `SELECT jl.entry_id, je.entry_no, je.posting_date, je.source_ref, a.code, a.name, a.type, jl.direction, jl.amount, jl.narrative
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         JOIN accounts a ON a.id = jl.account_id
        WHERE je.posting_date BETWEEN $1 AND $2
        ORDER BY je.entry_no, jl.line_no`, [from, to]);
    return r.rows.map((x) => ({ entryId: x.entry_id, entryNo: x.entry_no, date: x.posting_date, ref: x.source_ref ?? undefined, accountCode: x.code, accountName: x.name, type: x.type, direction: x.direction, amount: x.amount, narrative: x.narrative ?? undefined }));
  }
  async journalEntries(db: ScopedClient, from: string, to: string): Promise<{ entryNo: number; date: string; description: string; sourceType: string; lines: { accountCode: string; direction: 'debit' | 'credit'; amount: string }[] }[]> {
    const e = await db.query<{ id: string; entry_no: number; posting_date: string; description: string; source_type: string }>(
      `SELECT id, entry_no, posting_date, description, source_type FROM journal_entries WHERE posting_date BETWEEN $1 AND $2 ORDER BY entry_no`, [from, to]);
    const out = [];
    for (const row of e.rows) {
      const l = await db.query<{ code: string; direction: 'debit' | 'credit'; amount: string }>(
        `SELECT a.code, jl.direction, jl.amount FROM journal_lines jl JOIN accounts a ON a.id=jl.account_id WHERE jl.entry_id=$1 ORDER BY jl.line_no`, [row.id]);
      out.push({ entryNo: row.entry_no, date: row.posting_date, description: row.description, sourceType: row.source_type, lines: l.rows.map((x) => ({ accountCode: x.code, direction: x.direction, amount: x.amount })) });
    }
    return out;
  }
  async invoices(db: ScopedClient, from: string, to: string): Promise<InvoiceReportRow[]> {
    const r = await db.query<{ invoice_number: string | null; customer_name: string | null; issue_date: string | null; net_total: string; vat_total: string; gross_total: string; status: string }>(
      `SELECT invoice_number, customer_name, issue_date, net_total, vat_total, gross_total, status
         FROM invoices WHERE status='issued' AND (issue_date IS NULL OR issue_date BETWEEN $1 AND $2) ORDER BY invoice_number`, [from, to]);
    return r.rows.map((x) => ({ invoiceNumber: x.invoice_number ?? undefined, customerName: x.customer_name ?? undefined, issueDate: x.issue_date ?? undefined, netTotal: x.net_total, vatTotal: x.vat_total, grossTotal: x.gross_total, status: x.status }));
  }
  async createRun(db: ScopedClient, t: string, c: string, reportType: string, params: unknown, generatedBy?: string): Promise<string> {
    const r = await db.query<{ id: string }>(`INSERT INTO report_runs (tenant_id, company_id, report_type, params, generated_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [t, c, reportType, JSON.stringify(params ?? {}), generatedBy ?? null]);
    return r.rows[0].id;
  }
  async saveSnapshot(db: ScopedClient, t: string, c: string, runId: string, reportType: string, periodStart: string | null, periodEnd: string | null, payload: unknown, checksum: string): Promise<void> {
    await db.query(`INSERT INTO report_snapshots (tenant_id, company_id, report_run_id, report_type, period_start, period_end, payload, checksum_sha256) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [t, c, runId, reportType, periodStart, periodEnd, JSON.stringify(payload), checksum]);
  }
}
