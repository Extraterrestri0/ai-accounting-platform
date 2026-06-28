import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import { groupLinesByEntry } from '../domain/assemble';
import type {
  SaftAccount, SaftExportRecord, SaftExportStatus, SaftGlEntry, SaftParty, SaftPaymentDocument,
  SaftProduct, SaftSalesInvoice, SaftTaxCode, ValidationSummary,
} from '../domain/models';

// A 'processing' export older than this is considered stale (worker crashed mid-job) and may be
// reclaimed on redelivery. Shares the operational threshold used by the queue monitor (default 15m).
const STALE_PROCESSING_MS = Number(process.env.SAFT_STUCK_THRESHOLD_MS ?? 15 * 60 * 1000);

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
    const r = await db.query<{ code: string; description: string; unit: string; uom_code: string | null; vat_rate: string; kind: string; saft_code: string | null }>(
      `SELECT code, description, unit, uom_code, vat_rate, kind, saft_code FROM catalog_items WHERE company_id = $1 AND is_active ORDER BY code`, [companyId]);
    return r.rows.map((x) => ({ code: x.code, description: x.description, unit: x.unit, uomCode: x.uom_code ?? undefined, vatRate: x.vat_rate, kind: x.kind, saftCode: x.saft_code ?? undefined }));
  }

  async accounts(db: ScopedClient, companyId: string): Promise<SaftAccount[]> {
    // saftCode = the configured НАП standard-account code (data-driven; empty until mapped in 0036).
    const r = await db.query<{ code: string; name: string; type: string; parent_code: string | null; standard_code: string | null }>(
      `SELECT a.code, a.name, a.type, p.code AS parent_code, m.standard_account_code AS standard_code
         FROM accounts a
         LEFT JOIN accounts p ON p.id = a.parent_account_id
         LEFT JOIN saft_standard_accounts m ON m.company_id = a.company_id AND m.account_code = a.code
        WHERE a.company_id = $1 ORDER BY a.code`, [companyId]);
    return r.rows.map((x) => ({ accountCode: x.code, accountName: x.name, accountType: x.type, parentAccountCode: x.parent_code ?? undefined, saftCode: x.standard_code ?? undefined }));
  }

  async taxCodes(db: ScopedClient, companyId: string): Promise<SaftTaxCode[]> {
    const r = await db.query<{ code: string; rate: string; kind: string; direction: string }>(
      `SELECT code, rate, kind, direction FROM vat_codes WHERE company_id = $1 ORDER BY code`, [companyId]);
    return r.rows.map((x) => ({ vatCode: x.code, vatRate: x.rate, vatTreatment: x.kind, direction: x.direction, saftTaxCode: undefined }));
  }

  // ---- general ledger ----
  /**
   * Read posted entries + their lines for a period in exactly TWO queries (no N+1):
   * one for the entries, one for ALL their lines via `entry_id = ANY(...)`, then
   * grouped in memory. Read-only on the immutable ledger; company-scoped by RLS.
   */
  async glEntries(db: ScopedClient, companyId: string, from: string, to: string): Promise<SaftGlEntry[]> {
    const e = await db.query<{ id: string; entry_no: number; posting_date: string; description: string; source_type: string; source_ref: string | null; reverses_entry_id: string | null }>(
      `SELECT id, entry_no, posting_date::text AS posting_date, description, source_type, source_ref, reverses_entry_id
         FROM journal_entries WHERE company_id = $1 AND posting_date BETWEEN $2 AND $3 ORDER BY entry_no`, [companyId, from, to]);
    if (e.rows.length === 0) return [];

    const ids = e.rows.map((r) => r.id);
    const l = await db.query<{ entry_id: string; line_no: number; code: string; direction: string; amount: string; narrative: string | null }>(
      `SELECT jl.entry_id, jl.line_no, a.code, jl.direction, jl.amount, jl.narrative
         FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
        WHERE jl.entry_id = ANY($1) ORDER BY jl.entry_id, jl.line_no`, [ids]);
    const linesByEntry = groupLinesByEntry(l.rows.map((x) => ({ entryId: x.entry_id, lineNumber: x.line_no, accountCode: x.code, direction: x.direction, amount: x.amount, narrative: x.narrative ?? undefined })));

    return e.rows.map((row) => ({
      journalEntryId: row.id, entryNo: row.entry_no, postingDate: row.posting_date,
      documentReference: row.source_ref ?? undefined, description: row.description ?? undefined,
      sourceType: row.source_type, sourceId: row.source_ref ?? undefined,
      reversesEntryId: row.reverses_entry_id ?? undefined,
      lines: linesByEntry.get(row.id) ?? [],
    }));
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

  async payments(db: ScopedClient, companyId: string, from: string, to: string): Promise<SaftPaymentDocument[]> {
    const r = await db.query<{ payment_date: string; amount: string; payment_type: 'inbound' | 'outbound'; counterparty: string | null; document_type: string; document_id: string; reference: string | null; reconciliation_status: string | null; payment_method: string | null }>(
      `SELECT p.payment_date::text AS payment_date, p.amount, p.payment_type, cp.name AS counterparty,
              p.document_type, p.document_id, p.reference, p.payment_method, bt.reconciliation_status
         FROM payments p
         LEFT JOIN counterparties cp ON cp.id = p.counterparty_id
         LEFT JOIN bank_transactions bt ON bt.matched_payment_id = p.id
        WHERE p.company_id = $1 AND p.status = 'active' AND p.payment_date BETWEEN $2 AND $3
        ORDER BY p.payment_date`, [companyId, from, to]);
    return r.rows.map((x) => ({ paymentDate: x.payment_date, amount: x.amount, direction: x.payment_type, counterparty: x.counterparty ?? undefined, linkedDocumentType: x.document_type, linkedDocumentId: x.document_id, bankReference: x.reference ?? undefined, reconciliationStatus: x.reconciliation_status ?? undefined, paymentMechanism: x.payment_method ?? undefined }));
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
      `SELECT id, year, month, status, generated_by, generated_at::text AS generated_at, validation_summary, error, xsd_valid, schema_version
         FROM saft_exports WHERE company_id = $1 ORDER BY generated_at DESC LIMIT $2 OFFSET $3`, [companyId, limit, offset]);
    return r.rows.map(mapExport);
  }
  async getExport(db: ScopedClient, id: string): Promise<SaftExportRecord | null> {
    // Joins the latest XML artifact's xsd_errors so a single-export read can surface them.
    const r = await db.query<ExportRowDb>(
      `SELECT e.id, e.year, e.month, e.status, e.generated_by, e.generated_at::text AS generated_at, e.validation_summary, e.error, e.xsd_valid, e.schema_version, a.xsd_errors
         FROM saft_exports e
         LEFT JOIN LATERAL (SELECT xsd_errors FROM saft_export_artifacts WHERE export_id = e.id AND kind = 'xml' ORDER BY created_at DESC LIMIT 1) a ON true
        WHERE e.id = $1`, [id]);
    return r.rows[0] ? mapExport(r.rows[0]) : null;
  }
  async getExportDataset(db: ScopedClient, id: string): Promise<unknown | null> {
    const r = await db.query<{ dataset_json: unknown }>(`SELECT dataset_json FROM saft_exports WHERE id = $1`, [id]);
    return r.rows[0] ? r.rows[0].dataset_json : null;
  }

  // ---- v2 async lifecycle (state machine) ----
  /** An in-flight export for the period, if any — used for duplicate-submit protection. */
  async findActiveExport(db: ScopedClient, companyId: string, year: number, month: number): Promise<SaftExportRecord | null> {
    const r = await db.query<ExportRowDb>(
      `SELECT id, year, month, status, generated_by, generated_at::text AS generated_at, validation_summary, error, xsd_valid, schema_version
         FROM saft_exports
        WHERE company_id = $1 AND year = $2 AND month = $3 AND status IN ('queued','processing')
        ORDER BY requested_at DESC NULLS LAST, generated_at DESC LIMIT 1`, [companyId, year, month]);
    return r.rows[0] ? mapExport(r.rows[0]) : null;
  }

  /** Create a queued export row (the worker fills the rest later). */
  async insertQueued(db: ScopedClient, tenantId: string, companyId: string, e: { year: number; month: number; requestedBy?: string }): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO saft_exports (tenant_id, company_id, year, month, status, requested_by, requested_at, generated_by)
       VALUES ($1,$2,$3,$4,'queued',$5, now(), $5) RETURNING id`,
      [tenantId, companyId, e.year, e.month, e.requestedBy ?? null]);
    return r.rows[0].id;
  }

  /**
   * Atomic claim: queued|failed → processing. Returns true only if THIS call moved it,
   * so duplicate job deliveries (or a job that ran after completion) are no-ops — idempotent.
   */
  async claimForProcessing(db: ScopedClient, id: string, staleMs: number = STALE_PROCESSING_MS): Promise<boolean> {
    // Reclaim queued|failed, OR a 'processing' row whose started_at is older than staleMs — i.e. a
    // worker crashed AFTER claiming but BEFORE completing/failing. This lets BullMQ stalled-job
    // redelivery recover the export (a fresh/non-stale 'processing' row is left alone — single-flight).
    const r = await db.query(
      `UPDATE saft_exports SET status='processing', started_at=now(), attempt_count=attempt_count+1
        WHERE id=$1 AND (status IN ('queued','failed')
              OR (status='processing' AND started_at IS NOT NULL AND started_at < now() - (($2)::text || ' milliseconds')::interval))`,
      [id, staleMs]);
    return (r.rowCount ?? 0) > 0;
  }

  async markCompleted(db: ScopedClient, id: string, e: { datasetJson: unknown; validationSummary: ValidationSummary | null; xsdValid?: boolean | null; schemaVersion?: string | null }): Promise<void> {
    await db.query(
      `UPDATE saft_exports SET status='completed', completed_at=now(), dataset_json=$2, validation_summary=$3, xsd_valid=$4, schema_version=$5, error=NULL, last_error=NULL
        WHERE id=$1`,
      [id, e.datasetJson == null ? null : JSON.stringify(e.datasetJson), e.validationSummary == null ? null : JSON.stringify(e.validationSummary), e.xsdValid ?? null, e.schemaVersion ?? null]);
  }

  async markFailed(db: ScopedClient, id: string, error: string): Promise<void> {
    await db.query(`UPDATE saft_exports SET status='failed', last_error=$2, error=$2, completed_at=now() WHERE id=$1`, [id, error]);
  }

  // ---- artifacts (Phase 5) ----
  async insertArtifact(db: ScopedClient, tenantId: string, companyId: string, a: { id: string; exportId: string; kind: 'xml' | 'dataset_json'; storageKey: string; contentType: string; sizeBytes: number; sha256: string; xsdValid: boolean | null; xsdErrors: unknown; wormRetainUntil?: string }): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO saft_export_artifacts (id, tenant_id, company_id, export_id, kind, storage_key, content_type, size_bytes, sha256, xsd_valid, xsd_errors, worm_retain_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [a.id, tenantId, companyId, a.exportId, a.kind, a.storageKey, a.contentType, a.sizeBytes, a.sha256, a.xsdValid ?? null, a.xsdErrors == null ? null : JSON.stringify(a.xsdErrors), a.wormRetainUntil ?? null]);
    return r.rows[0].id;
  }

  /** Most recent artifact of a kind for an export (company-scoped by RLS) — for download. */
  async latestArtifact(db: ScopedClient, exportId: string, kind: 'xml' | 'dataset_json'): Promise<{ id: string; storageKey: string; contentType: string; sizeBytes: number } | null> {
    const r = await db.query<{ id: string; storage_key: string; content_type: string; size_bytes: string }>(
      `SELECT id, storage_key, content_type, size_bytes FROM saft_export_artifacts
        WHERE export_id=$1 AND kind=$2 ORDER BY created_at DESC LIMIT 1`, [exportId, kind]);
    const x = r.rows[0];
    return x ? { id: x.id, storageKey: x.storage_key, contentType: x.content_type, sizeBytes: Number(x.size_bytes) } : null;
  }
}

interface ExportRowDb { id: string; year: number; month: number; status: SaftExportStatus; generated_by: string | null; generated_at: string; validation_summary: ValidationSummary | null; error: string | null; xsd_valid?: boolean | null; schema_version?: string | null; xsd_errors?: unknown; }
function mapExport(r: ExportRowDb): SaftExportRecord {
  const rec: SaftExportRecord = {
    id: r.id, year: r.year, month: r.month, status: r.status,
    generatedBy: r.generated_by ?? undefined, generatedAt: r.generated_at,
    validationSummary: r.validation_summary ?? undefined, error: r.error ?? undefined,
    xsdValid: r.xsd_valid ?? null, schemaVersion: r.schema_version ?? undefined,
  };
  if (r.xsd_errors != null) rec.xsdErrors = r.xsd_errors as SaftExportRecord['xsdErrors'];
  return rec;
}
