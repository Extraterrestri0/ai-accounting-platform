import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';

export interface ViesCheckRow {
  id: string;
  counterpartyId?: string;
  vatNumber: string;
  countryCode: string;
  isValid: boolean;
  checkedAt: string;
  expiresAt: string;
  responsePayload?: unknown;
}

export interface CounterpartyVat {
  id: string;
  name: string;
  vatNumber?: string;
  countryCode?: string;
}

export interface DatasetInvoiceRow {
  invoiceId: string; invoiceNumber: string; invoiceDate: string; netTotal: string; currency: string;
  documentKind: string; counterpartyId: string; counterpartyName: string; vatNumber: string; countryCode: string;
}

interface CheckRowDb {
  id: string; counterparty_id: string | null; vat_number: string; country_code: string;
  is_valid: boolean; checked_at: string; expires_at: string; response_payload: unknown;
}
const mapCheck = (r: CheckRowDb): ViesCheckRow => ({
  id: r.id, counterpartyId: r.counterparty_id ?? undefined, vatNumber: r.vat_number, countryCode: r.country_code,
  isValid: r.is_valid, checkedAt: r.checked_at, expiresAt: r.expires_at, responsePayload: r.response_payload ?? undefined,
});
const SELECT = `SELECT id, counterparty_id, vat_number, country_code, is_valid,
                       checked_at::text AS checked_at, expires_at::text AS expires_at, response_payload
                  FROM vies_checks`;

@Injectable()
export class ViesRepository {
  /** Most recent NON-EXPIRED check for a VAT number (cache hit), or null. */
  async latestFresh(db: ScopedClient, companyId: string, vatNumber: string, nowISO: string): Promise<ViesCheckRow | null> {
    const r = await db.query<CheckRowDb>(
      `${SELECT} WHERE company_id = $1 AND vat_number = $2 AND expires_at > $3 ORDER BY checked_at DESC LIMIT 1`,
      [companyId, vatNumber, nowISO]);
    return r.rows[0] ? mapCheck(r.rows[0]) : null;
  }

  /** Most recent check for a VAT number regardless of freshness (status display). */
  async latestForVat(db: ScopedClient, companyId: string, vatNumber: string): Promise<ViesCheckRow | null> {
    const r = await db.query<CheckRowDb>(
      `${SELECT} WHERE company_id = $1 AND vat_number = $2 ORDER BY checked_at DESC LIMIT 1`, [companyId, vatNumber]);
    return r.rows[0] ? mapCheck(r.rows[0]) : null;
  }

  async insert(db: ScopedClient, tenantId: string, companyId: string, c: {
    counterpartyId?: string; vatNumber: string; countryCode: string; isValid: boolean;
    checkedAt: string; expiresAt: string; responsePayload?: unknown;
  }): Promise<ViesCheckRow> {
    const r = await db.query<CheckRowDb>(
      `INSERT INTO vies_checks
         (tenant_id, company_id, counterparty_id, vat_number, country_code, is_valid, checked_at, expires_at, response_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, counterparty_id, vat_number, country_code, is_valid,
                 checked_at::text AS checked_at, expires_at::text AS expires_at, response_payload`,
      [tenantId, companyId, c.counterpartyId ?? null, c.vatNumber, c.countryCode, c.isValid,
       c.checkedAt, c.expiresAt, c.responsePayload == null ? null : JSON.stringify(c.responsePayload)]);
    return mapCheck(r.rows[0]);
  }

  /** Resolve a counterparty's VAT number + country (read-model; RLS-scoped). */
  async counterpartyVat(db: ScopedClient, counterpartyId: string): Promise<CounterpartyVat | null> {
    const r = await db.query<{ id: string; name: string; vat_number: string | null; country_code: string | null }>(
      `SELECT id, name, vat_number, country_code FROM counterparties WHERE id = $1`, [counterpartyId]);
    const x = r.rows[0];
    return x ? { id: x.id, name: x.name, vatNumber: x.vat_number ?? undefined, countryCode: x.country_code ?? undefined } : null;
  }

  /** Issued invoices to EU (non-BG) VAT-registered customers in a month — the VIES dataset source. */
  async euInvoicesForMonth(db: ScopedClient, companyId: string, year: number, month: number): Promise<DatasetInvoiceRow[]> {
    const r = await db.query<{
      invoice_id: string; invoice_number: string | null; invoice_date: string; net_total: string; currency: string;
      document_kind: string; counterparty_id: string; counterparty_name: string; vat_number: string; country_code: string;
    }>(
      `SELECT i.id AS invoice_id, i.invoice_number, i.issue_date::text AS invoice_date, i.net_total, i.currency,
              i.document_kind, cp.id AS counterparty_id, COALESCE(cp.name, i.customer_name) AS counterparty_name,
              cp.vat_number, cp.country_code
         FROM invoices i
         JOIN counterparties cp ON cp.id = i.customer_id
         JOIN countries co ON co.code = cp.country_code
        WHERE i.company_id = $1 AND i.status = 'issued'
          AND i.document_kind IN ('invoice','credit_note','debit_note')
          AND co.is_eu = true AND cp.country_code <> 'BG' AND cp.vat_number IS NOT NULL
          AND EXTRACT(YEAR FROM i.issue_date) = $2 AND EXTRACT(MONTH FROM i.issue_date) = $3
        ORDER BY i.issue_date, i.invoice_number`,
      [companyId, year, month]);
    return r.rows.map((x) => ({
      invoiceId: x.invoice_id, invoiceNumber: x.invoice_number ?? '—', invoiceDate: x.invoice_date,
      netTotal: x.net_total, currency: x.currency, documentKind: x.document_kind,
      counterpartyId: x.counterparty_id, counterpartyName: x.counterparty_name,
      vatNumber: x.vat_number, countryCode: x.country_code,
    }));
  }
}
