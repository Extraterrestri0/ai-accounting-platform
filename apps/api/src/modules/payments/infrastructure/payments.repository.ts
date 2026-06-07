import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { DocumentType, Payment, PaymentType } from '../domain/models';

/** A settleable document resolved for payment validation/posting. */
export interface SettleableDoc {
  documentType: DocumentType;
  documentId: string;
  total: string;            // gross document total (exact decimal)
  currency: string;
  counterpartyId?: string;
  dueDate?: string;
  ref?: string;             // invoice number / entry no
}

/** Raw open-document row (before settlement/aging math is applied by the service). */
export interface RawOpenRow {
  documentId: string;
  documentRef?: string;
  counterpartyId?: string;
  counterpartyName?: string;
  issueDate?: string;
  dueDate?: string;
  currency: string;
  total: string;
  paid: string;
}

const num = (v: unknown): string => (v == null ? '0' : String(v));

/**
 * Persistence + read-model for the Receivables/Payables engine (Task 3.1).
 *
 * Reads `invoices` (AR) and posted purchase `journal_entries` (AP) directly as a
 * cross-cutting financial READ-MODEL — the same sanctioned pattern the `reporting`
 * module uses. All writes are restricted to the `payments` table. RLS-scoped.
 */
@Injectable()
export class PaymentsRepository {
  // ---- account resolution (shared with the ledger posting path) -------------
  async accountIdByCode(db: ScopedClient, code: string): Promise<{ id: string; isPostable: boolean } | null> {
    const r = await db.query<{ id: string; is_postable: boolean }>(
      `SELECT id, is_postable FROM accounts WHERE code = $1 LIMIT 1`, [code]);
    return r.rows[0] ? { id: r.rows[0].id, isPostable: r.rows[0].is_postable } : null;
  }

  // ---- payments write side --------------------------------------------------
  async insertPayment(db: ScopedClient, tenantId: string, companyId: string, p: {
    paymentType: PaymentType; documentType: DocumentType; documentId: string; counterpartyId?: string;
    amount: string; currency: string; paymentDate: string; reference?: string; notes?: string; createdBy: string;
  }): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO payments
         (tenant_id, company_id, payment_type, document_type, document_id, counterparty_id,
          amount, currency, payment_date, reference, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [tenantId, companyId, p.paymentType, p.documentType, p.documentId, p.counterpartyId ?? null,
       p.amount, p.currency, p.paymentDate, p.reference ?? null, p.notes ?? null, p.createdBy]);
    return r.rows[0].id;
  }

  async linkJournalEntry(db: ScopedClient, paymentId: string, journalEntryId: string): Promise<void> {
    await db.query(`UPDATE payments SET journal_entry_id = $2 WHERE id = $1`, [paymentId, journalEntryId]);
  }

  async markReversed(db: ScopedClient, originalId: string, reversedByPaymentId: string | null): Promise<void> {
    await db.query(
      `UPDATE payments SET status = 'reversed', reversed_by_payment_id = $2 WHERE id = $1`,
      [originalId, reversedByPaymentId]);
  }

  async getPayment(db: ScopedClient, id: string): Promise<Payment | null> {
    const r = await db.query<PaymentRowDb>(`${SELECT_PAYMENT} WHERE pm.id = $1`, [id]);
    return r.rows[0] ? mapPayment(r.rows[0]) : null;
  }

  async listPayments(db: ScopedClient, filters: { documentType?: DocumentType; documentId?: string; counterpartyId?: string }, limit: number, offset: number): Promise<Payment[]> {
    const where: string[] = [];
    const args: unknown[] = [];
    if (filters.documentType) { args.push(filters.documentType); where.push(`pm.document_type = $${args.length}`); }
    if (filters.documentId) { args.push(filters.documentId); where.push(`pm.document_id = $${args.length}`); }
    if (filters.counterpartyId) { args.push(filters.counterpartyId); where.push(`pm.counterparty_id = $${args.length}`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    args.push(limit); const lim = `$${args.length}`;
    args.push(offset); const off = `$${args.length}`;
    const r = await db.query<PaymentRowDb>(
      `${SELECT_PAYMENT} ${clause} ORDER BY pm.payment_date DESC, pm.created_at DESC LIMIT ${lim} OFFSET ${off}`, args);
    return r.rows.map(mapPayment);
  }

  /** Σ of ACTIVE payments already applied to a document (exact decimal string). */
  async paidForDocument(db: ScopedClient, documentType: DocumentType, documentId: string): Promise<string> {
    const r = await db.query<{ paid: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS paid FROM payments
        WHERE document_type = $1 AND document_id = $2 AND status = 'active'`, [documentType, documentId]);
    return num(r.rows[0]?.paid);
  }

  // ---- settleable-document resolution (for recordPayment) -------------------
  async receivableDocument(db: ScopedClient, invoiceId: string): Promise<SettleableDoc | null> {
    const r = await db.query<{ id: string; currency: string; customer_id: string | null; gross_total: string; due_date: string | null; invoice_number: string | null; document_kind: string; status: string }>(
      `SELECT id, currency, customer_id, gross_total, due_date, invoice_number, document_kind, status
         FROM invoices WHERE id = $1`, [invoiceId]);
    const x = r.rows[0];
    if (!x || x.status !== 'issued' || !['invoice', 'debit_note'].includes(x.document_kind)) return null;
    return { documentType: 'sales_invoice', documentId: x.id, total: num(x.gross_total), currency: x.currency,
      counterpartyId: x.customer_id ?? undefined, dueDate: x.due_date ?? undefined, ref: x.invoice_number ?? undefined };
  }

  async payableDocument(db: ScopedClient, entryId: string, payableCode: string): Promise<SettleableDoc | null> {
    const r = await db.query<{ id: string; currency: string; posting_date: string; entry_no: string; payable_credit: string | null; counterparty_id: string | null }>(
      `SELECT je.id, je.currency, je.posting_date, je.entry_no::text AS entry_no,
              SUM(jl.amount) FILTER (WHERE jl.direction = 'credit' AND a.code = $2) AS payable_credit,
              COALESCE(d.counterparty_id, (
                 SELECT s.counterparty_id FROM accounting_suggestions s
                  WHERE s.document_id = rp.document_id AND s.counterparty_id IS NOT NULL
                  ORDER BY s.created_at DESC LIMIT 1)) AS counterparty_id
         FROM journal_entries je
         JOIN journal_lines jl ON jl.entry_id = je.id
         JOIN accounts a ON a.id = jl.account_id
         LEFT JOIN review_packages rp ON rp.id::text = je.source_ref
         LEFT JOIN documents d ON d.id = rp.document_id
        WHERE je.id = $1 AND je.source_type = 'review' AND je.reverses_entry_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM journal_entries x WHERE x.reverses_entry_id = je.id)
        GROUP BY je.id, je.currency, je.posting_date, je.entry_no, d.counterparty_id, rp.document_id`,
      [entryId, payableCode]);
    const x = r.rows[0];
    if (!x || !x.payable_credit || Number(x.payable_credit) <= 0) return null;
    return { documentType: 'purchase_invoice', documentId: x.id, total: num(x.payable_credit), currency: x.currency,
      counterpartyId: x.counterparty_id ?? undefined, dueDate: x.posting_date, ref: `#${x.entry_no}` };
  }

  // ---- open-item read models (AR / AP) --------------------------------------
  async openReceivables(db: ScopedClient): Promise<RawOpenRow[]> {
    const r = await db.query<RawOpenRowDb>(
      `SELECT i.id AS document_id, i.invoice_number AS document_ref, i.customer_id AS counterparty_id,
              COALESCE(cp.name, i.customer_name) AS counterparty_name,
              i.issue_date::text AS issue_date, i.due_date::text AS due_date, i.currency,
              i.gross_total AS total,
              (SELECT COALESCE(SUM(amount), 0) FROM payments pm
                WHERE pm.document_type = 'sales_invoice' AND pm.document_id = i.id AND pm.status = 'active') AS paid
         FROM invoices i
         LEFT JOIN counterparties cp ON cp.id = i.customer_id
        WHERE i.status = 'issued' AND i.document_kind IN ('invoice', 'debit_note')
        ORDER BY i.due_date NULLS LAST, i.invoice_number`);
    return r.rows.map(mapRawRow);
  }

  async openPayables(db: ScopedClient, payableCode: string): Promise<RawOpenRow[]> {
    const r = await db.query<RawOpenRowDb>(
      `WITH purchase AS (
         SELECT je.id AS entry_id, je.entry_no, je.posting_date, je.source_ref, je.currency,
                SUM(jl.amount) FILTER (WHERE jl.direction = 'credit' AND a.code = $1) AS payable_credit
           FROM journal_entries je
           JOIN journal_lines jl ON jl.entry_id = je.id
           JOIN accounts a ON a.id = jl.account_id
          WHERE je.source_type = 'review' AND je.reverses_entry_id IS NULL
            AND NOT EXISTS (SELECT 1 FROM journal_entries r WHERE r.reverses_entry_id = je.id)
          GROUP BY je.id, je.entry_no, je.posting_date, je.source_ref, je.currency)
       SELECT pu.entry_id AS document_id, ('#' || pu.entry_no::text) AS document_ref,
              cp.id AS counterparty_id, cp.name AS counterparty_name,
              pu.posting_date::text AS issue_date, pu.posting_date::text AS due_date, pu.currency,
              pu.payable_credit AS total,
              (SELECT COALESCE(SUM(amount), 0) FROM payments pm
                WHERE pm.document_type = 'purchase_invoice' AND pm.document_id = pu.entry_id AND pm.status = 'active') AS paid
         FROM purchase pu
         LEFT JOIN review_packages rp ON rp.id::text = pu.source_ref
         LEFT JOIN documents d ON d.id = rp.document_id
         LEFT JOIN LATERAL (
            SELECT s.counterparty_id FROM accounting_suggestions s
             WHERE s.document_id = rp.document_id AND s.counterparty_id IS NOT NULL
             ORDER BY s.created_at DESC LIMIT 1) sug ON true
         LEFT JOIN counterparties cp ON cp.id = COALESCE(d.counterparty_id, sug.counterparty_id)
        WHERE pu.payable_credit > 0
        ORDER BY pu.posting_date, pu.entry_no`, [payableCode]);
    return r.rows.map(mapRawRow);
  }
}

// ---- row mapping -----------------------------------------------------------
interface RawOpenRowDb {
  document_id: string; document_ref: string | null; counterparty_id: string | null; counterparty_name: string | null;
  issue_date: string | null; due_date: string | null; currency: string; total: string; paid: string;
}
function mapRawRow(x: RawOpenRowDb): RawOpenRow {
  return {
    documentId: x.document_id, documentRef: x.document_ref ?? undefined,
    counterpartyId: x.counterparty_id ?? undefined, counterpartyName: x.counterparty_name ?? undefined,
    issueDate: x.issue_date ?? undefined, dueDate: x.due_date ?? undefined,
    currency: x.currency, total: num(x.total), paid: num(x.paid),
  };
}

interface PaymentRowDb {
  id: string; payment_type: PaymentType; document_type: DocumentType; document_id: string;
  counterparty_id: string | null; counterparty_name: string | null; amount: string; currency: string;
  payment_date: string; reference: string | null; notes: string | null; status: 'active' | 'reversed';
  journal_entry_id: string | null; reversed_by_payment_id: string | null; created_by: string; created_at: string;
}
const SELECT_PAYMENT = `
  SELECT pm.id, pm.payment_type, pm.document_type, pm.document_id, pm.counterparty_id,
         cp.name AS counterparty_name, pm.amount, pm.currency, pm.payment_date::text AS payment_date,
         pm.reference, pm.notes, pm.status, pm.journal_entry_id, pm.reversed_by_payment_id,
         pm.created_by, pm.created_at::text AS created_at
    FROM payments pm
    LEFT JOIN counterparties cp ON cp.id = pm.counterparty_id`;
function mapPayment(x: PaymentRowDb): Payment {
  return {
    id: x.id, paymentType: x.payment_type, documentType: x.document_type, documentId: x.document_id,
    counterpartyId: x.counterparty_id ?? undefined, counterpartyName: x.counterparty_name ?? undefined,
    amount: num(x.amount), currency: x.currency, paymentDate: x.payment_date,
    reference: x.reference ?? undefined, notes: x.notes ?? undefined, status: x.status,
    journalEntryId: x.journal_entry_id ?? undefined, reversedByPaymentId: x.reversed_by_payment_id ?? undefined,
    createdBy: x.created_by, createdAt: x.created_at,
  };
}
