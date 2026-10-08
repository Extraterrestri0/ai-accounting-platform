import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { PostedEntry, RegisterRow, VatPeriod, VatReturnDataset, VatSummary } from '../domain/vat/models';

@Injectable()
export class VatRepository {
  async ensurePeriod(db: ScopedClient, tenantId: string, companyId: string, year: number, month: number): Promise<VatPeriod> {
    const starts = `${year}-${String(month).padStart(2, '0')}-01`;
    const ends = new Date(year, month, 0).toISOString().slice(0, 10);
    const r = await db.query<{ id: string; period_year: number; period_month: number; status: VatPeriod['status']; starts_on: string; ends_on: string }>(
      `INSERT INTO vat_periods (tenant_id, company_id, period_year, period_month, starts_on, ends_on)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (tenant_id, company_id, period_year, period_month) DO UPDATE SET starts_on=EXCLUDED.starts_on
       RETURNING id, period_year, period_month, status, starts_on, ends_on`,
      [tenantId, companyId, year, month, starts, ends]);
    const x = r.rows[0];
    return { id: x.id, year: x.period_year, month: x.period_month, status: x.status, startsOn: x.starts_on, endsOn: x.ends_on };
  }
  /** Read POSTED journal entries (with lines + account codes) in the period. Read-only on the immutable ledger. */
  async postedEntries(db: ScopedClient, startsOn: string, endsOn: string): Promise<PostedEntry[]> {
    const e = await db.query<{ id: string; entry_no: number; posting_date: string; source_ref: string | null }>(
      // Payment settlement entries (Dr 503/Cr 411, Dr 401/Cr 503) touch the AR/AP
      // control + cash accounts but carry NO VAT; they must never reach the VAT
      // register classifier (which keys on 4531/4532/401/411) or they would inflate
      // the SD-return base cells. Exclude them at the source. (Task 3.1)
      `SELECT id, entry_no, posting_date, source_ref FROM journal_entries
        WHERE posting_date BETWEEN $1 AND $2 AND reverses_entry_id IS NULL
          AND source_type <> 'payment' ORDER BY entry_no`, [startsOn, endsOn]);
    const entries: PostedEntry[] = [];
    for (const row of e.rows) {
      const l = await db.query<{ code: string; direction: 'debit' | 'credit'; amount: string }>(
        `SELECT a.code, jl.direction, jl.amount FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id WHERE jl.entry_id=$1 ORDER BY jl.line_no`, [row.id]);
      entries.push({ journalEntryId: row.id, entryNo: row.entry_no, postingDate: row.posting_date, sourceRef: row.source_ref ?? undefined, lines: l.rows });
    }
    return entries;
  }
  async clearRegister(db: ScopedClient, periodId: string): Promise<void> {
    // register rows are immutable; a rebuild is only allowed while no return is final.
    await db.query(`DELETE FROM vat_register_entries WHERE period_id=$1 AND tenant_id=app.current_tenant_id()`, [periodId]).catch(() => undefined);
  }
  async insertRegisterRow(db: ScopedClient, tenantId: string, companyId: string, periodId: string, r: RegisterRow): Promise<void> {
    await db.query(
      `INSERT INTO vat_register_entries (tenant_id, company_id, period_id, journal_entry_id, register_kind, document_ref, vat_code_id, treatment, base_amount, vat_amount, deductible_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (tenant_id, journal_entry_id, register_kind) DO NOTHING`,
      [tenantId, companyId, periodId, r.journalEntryId, r.kind, r.documentRef ?? null, r.vatCodeId ?? null, r.treatment, r.base, r.vat, r.deductible]);
  }
  async listRegister(db: ScopedClient, periodId: string, kind: 'purchase' | 'sales'): Promise<RegisterRow[]> {
    const r = await db.query<{ journal_entry_id: string; register_kind: 'purchase' | 'sales'; base_amount: string; vat_amount: string; deductible_amount: string; treatment: RegisterRow['treatment']; vat_code_id: string | null; document_ref: string | null }>(
      `SELECT * FROM vat_register_entries WHERE period_id=$1 AND register_kind=$2 ORDER BY document_ref`, [periodId, kind]);
    return r.rows.map((x) => ({ journalEntryId: x.journal_entry_id, kind: x.register_kind, base: Number(x.base_amount), vat: Number(x.vat_amount), deductible: Number(x.deductible_amount), treatment: x.treatment, rate: 0, vatCodeId: x.vat_code_id ?? undefined, documentRef: x.document_ref ?? undefined }));
  }
  async allRegister(db: ScopedClient, periodId: string): Promise<RegisterRow[]> {
    return [...await this.listRegister(db, periodId, 'purchase'), ...await this.listRegister(db, periodId, 'sales')];
  }
  async saveReturn(db: ScopedClient, tenantId: string, companyId: string, periodId: string, s: VatSummary, dataset: VatReturnDataset): Promise<void> {
    await db.query(
      `INSERT INTO vat_returns (tenant_id, company_id, period_id, output_vat, deductible_vat, vat_payable, vat_refundable, dataset)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id, period_id) DO UPDATE SET output_vat=EXCLUDED.output_vat, deductible_vat=EXCLUDED.deductible_vat, vat_payable=EXCLUDED.vat_payable, vat_refundable=EXCLUDED.vat_refundable, dataset=EXCLUDED.dataset, generated_at=now()`,
      [tenantId, companyId, periodId, s.outputVat, s.deductibleVat, s.vatPayable, s.vatRefundable, JSON.stringify(dataset)]);
  }
  async vatCodeByKind(db: ScopedClient, kind: string): Promise<string | null> {
    const r = await db.query<{ id: string }>(`SELECT id FROM vat_codes WHERE kind=$1 AND is_active=true LIMIT 1`, [kind]);
    return r.rows[0]?.id ?? null;
  }
}
