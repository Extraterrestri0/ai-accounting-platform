import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type {
  SaftAccount, SaftExportRecord, SaftExportStatus, SaftGlEntry, SaftGlLine, SaftParty, SaftPaymentDocument,
  SaftProduct, SaftSalesInvoice, SaftTaxCode, ValidationSummary,
} from '../domain/models';

/** Raw purchase row (amounts computed by the builder from the entry lines). */
export interface PurchaseEntryRaw {
  journalEntryId: string; entryNo: number; postingDate: string;
  supplier?: string; supplierId?: string; classificationCategory?: string;
  accountingSuggestion?: string; approvalStatus?: string; lines: SaftGlLine[];
}

const dr = (dir: string, amt: string): string => (dir === 'debit' ? amt : '0.00');
const cr = (dir: string, amt: string): string => (dir === 'credit' ? amt : '0.00');

@Injectable()
export class SaftRepository {
  // ---- header / company ----
  async companyInfo(db: ScopedClient, companyId: string): Promise<{ name: string; eik?: string; vatNumber?: string; currency: string }> {
    const r = await db.query<{ name: string; eik: string | null; base_currency: string; vat_number: string | null }>(
      `SELECT c.name, c.eik, c.base_currency, cs.vat_number
         FROM companies c LEFT JOIN company_settings cs ON cs.company_id = c.id WHERE c.id = $1`, [companyId]);
    const x = r.rows[0];
    return { name: x?.name ?? '—', eik: x?.eik ?? undefined, vatNumber: x?.vat_number ?? undefined, currency: x?.base_currency ?? 'EUR' };
  }

  // ---- master files ----
  private async parties(db: ScopedClient, companyId: string, kinds: string[]): Promise<SaftParty[]> {
    const r = await db.query<{ id: string; name: string; eik: string | null; vat_number: string | null; address_line: string | null; city: string | null; country_code: string }>(
      `SELECT id, name, eik, vat_number, address_line, city, country_code
         FROM counterparties WHERE company_id = $1 AND kind = ANY($2) AND is_active ORDER BY name`, [companyId, kinds]);
    return r.rows.map((x) => ({ id: x.id, name: x.name, eik: x.eik ?? undefined, vatNumber: x.vat_number ?? undefined, address: x.address_line ?? undefined, city: x.city ?? undefined, country: x.country_code, saftCode: undefined }));
  }
  customers(db: ScopedClient, companyId: string): Promise<SaftParty[]> { return this.parties(db, companyId, ['customer', 'both']); }
  suppliers(db: ScopedClient, companyId: string): Promise<SaftParty[]> { return this.parties(db, companyId, ['supplier', 'both']); }

  async products(db: ScopedClient, companyId: string): Promise<SaftProduct[]> {
    const r = await db.query<{ code: string; description: string; unit: string; vat_rate: string; kind: string; saft_code: string | null }>(
      `SELECT code, description, unit, vat_rate, kind, saft_code FROM catalog_items WHERE company_id = $1 AND is_active ORDER BY code`, [companyId]);
    return r.rows.map((x) => ({ code: x.code, description: x.description, unit: x.unit, vatRate: x.vat_rate, kind: x.kind, saftCode: x.saft_code ?? undefined }));
  }

  async accounts(db: ScopedClient, companyId: string): Promise<SaftAccount[]> {
    const r = await db.query<{ code: string; name: string; type: string; parent_code: string | null }>(
      `SELECT a.code, a.name, a.type, p.code AS parent_code
         FROM accounts a LEFT JOIN accounts p ON p.id = a.parent_account_id WHERE a.company_id = $1 ORDER BY a.code`, [companyId]);
    return r.rows.map((x) => ({ accountCode: x.code, accountName: x.name, accountType: x.type, parentAccountCode: x.parent_code ?? undefined, saftCode: undefined }));
  }

  async taxCodes(db: ScopedClient, companyId: string): Promise<SaftTaxCode[]> {
    const r = await db.query<{ code: string; rate: string; kind: string; direction: string }>(
      `SELECT code, rate, kind, direction FROM vat_codes WHERE company_id = $1 ORDER BY code`, [companyId]);
    return r.rows.map((x) => ({ vatCode: x.code, vatRate: x.rate, vatTreatment: x.kind, direction: x.direction, saftTaxCode: undefined }));
  }

  // ---- general ledger ----
  private async linesFor(db: ScopedClient, entryId: string): Promise<SaftGlLine[]> {
    const r = await db.query<{ line_no: number; code: string; direction: string; amount: string; narrative: string | null }>(
      `SELECT jl.line_no, a.code, jl.direction, jl.amount, jl.narrative
         FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id WHERE jl.entry_id = $1 ORDER BY jl.line_no`, [entryId]);
    return r.rows.map((x) => ({ lineNumber: x.line_no, accountCode: x.code, debit: dr(x.direction, x.amount), credit: cr(x.direction, x.amount), narrative: x.narrative ?? undefined }));
  }

  async glEntries(db: ScopedClient, companyId: string, from: string, to: string): Promise<SaftGlEntry[]> {
    const e = await db.query<{ id: string; entry_no: number; posting_date: string; description: string; source_type: string; source_ref: string | null }>(
      `SELECT id, entry_no, posting_date::text AS posting_date, description, source_type, source_ref
         FROM journal_entries WHERE company_id = $1 AND posting_date BETWEEN $2 AND $3 ORDER BY entry_no`, [companyId, from, to]);
    const out: SaftGlEntry[] = [];
    for (const row of e.rows) {
      out.push({ journalEntryId: row.id, entryNo: row.entry_no, postingDate: row.posting_date, documentReference: row.source_ref ?? undefined, description: row.description ?? undefined, sourceType: row.source_type, sourceId: row.source_ref ?? undefined, lines: await this.linesFor(db, row.id) });
    }
    return out;
  }

  // ---- source documents ----
  async salesInvoices(db: ScopedClient, companyId: string, from: string, to: string): Promise<SaftSalesInvoice[]> {
    const r = await db.query<{ invoice_number: string | null; issue_date: string | null; customer_name: string | null; customer_id: string | null; net_total: string; vat_total: string; gross_total: string; document_kind: string; vat_code: string | null }>(
      `SELECT i.invoice_number, i.issue_date::text AS issue_date, i.customer_name, i.customer_id, i.net_total, i.vat_total, i.gross_total, i.document_kind,
              (SELECT vc.code FROM invoice_lines il JOIN vat_codes vc ON vc.id = il.vat_code_id WHERE il.invoice_id = i.id AND il.vat_code_id IS NOT NULL LIMIT 1) AS vat_code
         FROM invoices i
        WHERE i.company_id = $1 AND i.status = 'issued' AND i.issue_date BETWEEN $2 AND $3 ORDER BY i.invoice_number`, [companyId, from, to]);
    return r.rows.map((x) => ({ invoiceNumber: x.invoice_number ?? undefined, invoiceDate: x.issue_date ?? undefined, customer: x.customer_name ?? undefined, customerId: x.customer_id ?? undefined, netAmount: x.net_total, vatAmount: x.vat_total, grossAmount: x.gross_total, vatCode: x.vat_code ?? undefined, documentType: x.document_kind }));
  }

  async purchaseEntries(db: ScopedClient, companyId: string, from: string, to: string): Promise<PurchaseEntryRaw[]> {
    const e = await db.query<{ entry_id: string; entry_no: number; posting_date: string; supplier_id: string | null; supplier_name: string | null; category: string | null; suggestion: string | null; review_status: string | null }>(
      `SELECT je.id AS entry_id, je.entry_no, je.posting_date::text AS posting_date,
              cp.id AS supplier_id, cp.name AS supplier_name,
              ec.name_bg AS category,
              COALESCE(sa.code, s.classification_reason) AS suggestion,
              rp.status AS review_status
         FROM journal_entries je
         LEFT JOIN review_packages rp ON rp.id::text = je.source_ref
         LEFT JOIN documents d ON d.id = rp.document_id
         LEFT JOIN LATERAL (SELECT * FROM accounting_suggestions x WHERE x.document_id = rp.document_id ORDER BY x.created_at DESC LIMIT 1) s ON true
         LEFT JOIN counterparties cp ON cp.id = COALESCE(d.counterparty_id, s.counterparty_id)
         LEFT JOIN expense_categories ec ON ec.id = s.expense_category_id
         LEFT JOIN accounts sa ON sa.id = s.suggested_account_id
        WHERE je.company_id = $1 AND je.source_type = 'review' AND je.reverses_entry_id IS NULL
          AND je.posting_date BETWEEN $2 AND $3
        ORDER BY je.entry_no`, [companyId, from, to]);
    const out: PurchaseEntryRaw[] = [];
    for (const row of e.rows) {
      out.push({ journalEntryId: row.entry_id, entryNo: row.entry_no, postingDate: row.posting_date, supplier: row.supplier_name ?? undefined, supplierId: row.supplier_id ?? undefined, classificationCategory: row.category ?? undefined, accountingSuggestion: row.suggestion ?? undefined, approvalStatus: row.review_status ?? undefined, lines: await this.linesFor(db, row.entry_id) });
    }
    return out;
  }

  async payments(db: ScopedClient, companyId: string, from: string, to: string): Promise<SaftPaymentDocument[]> {
    const r = await db.query<{ payment_date: string; amount: string; payment_type: 'inbound' | 'outbound'; counterparty: string | null; document_type: string; document_id: string; reference: string | null; reconciliation_status: string | null }>(
      `SELECT p.payment_date::text AS payment_date, p.amount, p.payment_type, cp.name AS counterparty,
              p.document_type, p.document_id, p.reference, bt.reconciliation_status
         FROM payments p
         LEFT JOIN counterparties cp ON cp.id = p.counterparty_id
         LEFT JOIN bank_transactions bt ON bt.matched_payment_id = p.id
        WHERE p.company_id = $1 AND p.status = 'active' AND p.payment_date BETWEEN $2 AND $3
        ORDER BY p.payment_date`, [companyId, from, to]);
    return r.rows.map((x) => ({ paymentDate: x.payment_date, amount: x.amount, direction: x.payment_type, counterparty: x.counterparty ?? undefined, linkedDocumentType: x.document_type, linkedDocumentId: x.document_id, bankReference: x.reference ?? undefined, reconciliationStatus: x.reconciliation_status ?? undefined }));
  }

  // ---- export persistence ----
  async insertExport(db: ScopedClient, tenantId: string, companyId: string, e: { year: number; month: number; status: SaftExportStatus; generatedBy?: string; datasetJson: unknown; validationSummary: ValidationSummary | null; error?: string }): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO saft_exports (tenant_id, company_id, year, month, status, generated_by, dataset_json, validation_summary, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [tenantId, companyId, e.year, e.month, e.status, e.generatedBy ?? null, e.datasetJson == null ? null : JSON.stringify(e.datasetJson), e.validationSummary == null ? null : JSON.stringify(e.validationSummary), e.error ?? null]);
    return r.rows[0].id;
  }

  async listExports(db: ScopedClient, companyId: string, limit: number, offset: number): Promise<SaftExportRecord[]> {
    const r = await db.query<ExportRowDb>(
      `SELECT id, year, month, status, generated_by, generated_at::text AS generated_at, validation_summary, error
         FROM saft_exports WHERE company_id = $1 ORDER BY generated_at DESC LIMIT $2 OFFSET $3`, [companyId, limit, offset]);
    return r.rows.map(mapExport);
  }
  async getExport(db: ScopedClient, id: string): Promise<SaftExportRecord | null> {
    const r = await db.query<ExportRowDb>(
      `SELECT id, year, month, status, generated_by, generated_at::text AS generated_at, validation_summary, error
         FROM saft_exports WHERE id = $1`, [id]);
    return r.rows[0] ? mapExport(r.rows[0]) : null;
  }
  async getExportDataset(db: ScopedClient, id: string): Promise<unknown | null> {
    const r = await db.query<{ dataset_json: unknown }>(`SELECT dataset_json FROM saft_exports WHERE id = $1`, [id]);
    return r.rows[0] ? r.rows[0].dataset_json : null;
  }
}

interface ExportRowDb { id: string; year: number; month: number; status: SaftExportStatus; generated_by: string | null; generated_at: string; validation_summary: ValidationSummary | null; error: string | null; }
function mapExport(r: ExportRowDb): SaftExportRecord {
  return { id: r.id, year: r.year, month: r.month, status: r.status, generatedBy: r.generated_by ?? undefined, generatedAt: r.generated_at, validationSummary: r.validation_summary ?? undefined, error: r.error ?? undefined };
}
