import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { DocumentKind, EmailDelivery, Invoice, InvoiceLine, InvoiceStatus } from '../domain/invoice/models';

interface InvRow { id: string; document_kind: DocumentKind; references_invoice_id: string | null; status: InvoiceStatus; customer_id: string | null; customer_name: string | null; series_code: string; series_year: number | null; invoice_number: string | null; issue_date: string | null; due_date: string | null; currency: string; net_total: string; vat_total: string; gross_total: string; notes: string | null; journal_entry_id: string | null; issued_by: string | null; issued_at: string | null; created_at: string; }
const mapInv = (r: InvRow, lines: InvoiceLine[]): Invoice => ({
  id: r.id, documentKind: r.document_kind, status: r.status, customerId: r.customer_id ?? undefined, customerName: r.customer_name ?? undefined,
  referencesInvoiceId: r.references_invoice_id ?? undefined,
  seriesCode: r.series_code, seriesYear: r.series_year ?? undefined, invoiceNumber: r.invoice_number ?? undefined,
  issueDate: r.issue_date ?? undefined, dueDate: r.due_date ?? undefined, currency: r.currency,
  netTotal: r.net_total, vatTotal: r.vat_total, grossTotal: r.gross_total, notes: r.notes ?? undefined,
  journalEntryId: r.journal_entry_id ?? undefined, issuedBy: r.issued_by ?? undefined, issuedAt: r.issued_at ?? undefined, createdAt: r.created_at, lines,
});

@Injectable()
export class InvoiceRepository {
  async createDraft(db: ScopedClient, t: string, c: string, inv: { documentKind: DocumentKind; referencesInvoiceId?: string; customerId?: string; customerName?: string; seriesCode: string; currency: string; dueDate?: string; notes?: string }): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO invoices (tenant_id, company_id, document_kind, references_invoice_id, status, customer_id, customer_name, series_code, currency, due_date, notes)
       VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10) RETURNING id`,
      [t, c, inv.documentKind, inv.referencesInvoiceId ?? null, inv.customerId ?? null, inv.customerName ?? null, inv.seriesCode, inv.currency, inv.dueDate ?? null, inv.notes ?? null]);
    return r.rows[0].id;
  }
  async insertLine(db: ScopedClient, t: string, c: string, invoiceId: string, lineNo: number, l: { description: string; quantity: string; unitPrice: string; vatCodeId?: string; vatRate: string; catalogItemId?: string; unit?: string; saftCode?: string; net: string; vat: string; gross: string }): Promise<void> {
    await db.query(
      `INSERT INTO invoice_lines (tenant_id, company_id, invoice_id, line_no, description, quantity, unit_price, vat_code_id, vat_rate, catalog_item_id, unit, saft_code, net_amount, vat_amount, gross_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [t, c, invoiceId, lineNo, l.description, l.quantity, l.unitPrice, l.vatCodeId ?? null, l.vatRate, l.catalogItemId ?? null, l.unit ?? null, l.saftCode ?? null, l.net, l.vat, l.gross]);
  }
  async setTotals(db: ScopedClient, invoiceId: string, net: string, vat: string, gross: string): Promise<void> {
    await db.query(`UPDATE invoices SET net_total=$2, vat_total=$3, gross_total=$4, updated_at=now() WHERE id=$1`, [invoiceId, net, vat, gross]);
  }
  /** Gapless allocation PER document kind: lock the series row, return the number, advance the counter. */
  async allocateNumber(db: ScopedClient, t: string, c: string, documentKind: DocumentKind, seriesCode: string, year: number, prefix: string): Promise<number> {
    await db.query(
      `INSERT INTO invoice_numbering_series (tenant_id, company_id, document_kind, series_code, series_year, prefix)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_id, company_id, document_kind, series_code, series_year) DO NOTHING`,
      [t, c, documentKind, seriesCode, year, prefix]);
    const r = await db.query<{ next_number: string }>(
      `UPDATE invoice_numbering_series SET next_number = next_number + 1
        WHERE company_id=$1 AND document_kind=$2 AND series_code=$3 AND series_year=$4 RETURNING next_number - 1 AS next_number`,
      [c, documentKind, seriesCode, year]);
    return Number(r.rows[0].next_number);
  }

  /** Documents that REFERENCE this one (credit/debit notes, proforma→invoice conversions). */
  async listReferencing(db: ScopedClient, invoiceId: string): Promise<Invoice[]> {
    const r = await db.query<InvRow>(`SELECT * FROM invoices WHERE references_invoice_id=$1 ORDER BY created_at`, [invoiceId]);
    return r.rows.map((x) => mapInv(x, []));
  }
  async markIssued(db: ScopedClient, invoiceId: string, number: string, year: number, issuedBy: string): Promise<void> {
    await db.query(
      `UPDATE invoices SET status='issued', invoice_number=$2, series_year=$3, issue_date=CURRENT_DATE, issued_by=$4, issued_at=now(), updated_at=now()
        WHERE id=$1 AND status='draft'`, [invoiceId, number, year, issuedBy]);
  }
  async linkJournalEntry(db: ScopedClient, invoiceId: string, journalEntryId: string): Promise<void> {
    await db.query(`UPDATE invoices SET journal_entry_id=$2 WHERE id=$1`, [invoiceId, journalEntryId]);
  }
  async get(db: ScopedClient, invoiceId: string): Promise<Invoice | null> {
    const r = await db.query<InvRow>(`SELECT * FROM invoices WHERE id=$1`, [invoiceId]);
    if (!r.rows[0]) return null;
    const lr = await db.query<{ id: string; line_no: number; description: string; quantity: string; unit_price: string; vat_code_id: string | null; vat_rate: string; catalog_item_id: string | null; unit: string | null; saft_code: string | null; net_amount: string; vat_amount: string; gross_amount: string }>(
      `SELECT * FROM invoice_lines WHERE invoice_id=$1 ORDER BY line_no`, [invoiceId]);
    const lines: InvoiceLine[] = lr.rows.map((x) => ({ id: x.id, lineNo: x.line_no, description: x.description, quantity: x.quantity, unitPrice: x.unit_price, vatCodeId: x.vat_code_id ?? undefined, vatRate: x.vat_rate, catalogItemId: x.catalog_item_id ?? undefined, unit: x.unit ?? undefined, saftCode: x.saft_code ?? undefined, netAmount: x.net_amount, vatAmount: x.vat_amount, grossAmount: x.gross_amount }));
    return mapInv(r.rows[0], lines);
  }
  async list(db: ScopedClient, status: InvoiceStatus | undefined, limit: number, offset: number): Promise<Invoice[]> {
    const params: unknown[] = []; let where = 'true';
    if (status) { params.push(status); where = `status=$${params.length}`; }
    params.push(limit); params.push(offset);
    const r = await db.query<InvRow>(`SELECT * FROM invoices WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return r.rows.map((x) => mapInv(x, []));
  }
  async addPdf(db: ScopedClient, t: string, c: string, invoiceId: string, storageKey: string, checksum: string): Promise<void> {
    await db.query(`INSERT INTO invoice_pdf_artifacts (tenant_id, company_id, invoice_id, storage_key, checksum_sha256) VALUES ($1,$2,$3,$4,$5)`, [t, c, invoiceId, storageKey, checksum]);
  }
  async latestPdf(db: ScopedClient, invoiceId: string): Promise<{ storageKey: string } | null> {
    const r = await db.query<{ storage_key: string }>(`SELECT storage_key FROM invoice_pdf_artifacts WHERE invoice_id=$1 ORDER BY generated_at DESC LIMIT 1`, [invoiceId]);
    return r.rows[0] ? { storageKey: r.rows[0].storage_key } : null;
  }
  async queueEmail(db: ScopedClient, t: string, c: string, invoiceId: string, toEmail: string): Promise<string> {
    const r = await db.query<{ id: string }>(`INSERT INTO invoice_email_deliveries (tenant_id, company_id, invoice_id, to_email, status) VALUES ($1,$2,$3,$4,'queued') RETURNING id`, [t, c, invoiceId, toEmail]);
    return r.rows[0].id;
  }
  async updateEmail(db: ScopedClient, id: string, status: string, providerMessageId?: string, error?: string): Promise<void> {
    await db.query(`UPDATE invoice_email_deliveries SET status=$2, provider_message_id=$3, error=$4, sent_at=CASE WHEN $2='sent' THEN now() ELSE sent_at END WHERE id=$1`, [id, status, providerMessageId ?? null, error ?? null]);
  }
  async listEmails(db: ScopedClient, invoiceId: string): Promise<EmailDelivery[]> {
    const r = await db.query<{ id: string; to_email: string; status: EmailDelivery['status']; provider_message_id: string | null; error: string | null; queued_at: string; sent_at: string | null }>(
      `SELECT * FROM invoice_email_deliveries WHERE invoice_id=$1 ORDER BY queued_at`, [invoiceId]);
    return r.rows.map((x) => ({ id: x.id, toEmail: x.to_email, status: x.status, providerMessageId: x.provider_message_id ?? undefined, error: x.error ?? undefined, queuedAt: x.queued_at, sentAt: x.sent_at ?? undefined }));
  }
  async accountIdByCode(db: ScopedClient, code: string): Promise<string | null> {
    const r = await db.query<{ id: string }>(`SELECT id FROM accounts WHERE code=$1 LIMIT 1`, [code]);
    return r.rows[0]?.id ?? null;
  }
}
