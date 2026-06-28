import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { AccountingSuggestion, ClassificationSource, PostingLine, VatTreatment } from '../domain/rules/models';

@Injectable()
export class SuggestionRepository {
  /** Most frequent prior account for this counterparty (supplier history). */
  async supplierHistory(db: ScopedClient, counterpartyId: string): Promise<{ accountCode: string; count: number } | null> {
    const r = await db.query<{ code: string; n: string }>(
      `SELECT a.code AS code, count(*)::text AS n
         FROM accounting_suggestions s JOIN accounts a ON a.id = s.suggested_account_id
        WHERE s.counterparty_id=$1 AND s.status IN ('accepted','suggested') AND s.suggested_account_id IS NOT NULL
        GROUP BY a.code ORDER BY count(*) DESC LIMIT 1`, [counterpartyId]);
    return r.rows[0] ? { accountCode: r.rows[0].code, count: Number(r.rows[0].n) } : null;
  }
  /** Most frequent prior expense CATEGORY for this counterparty (classification memory). */
  async categoryMemory(db: ScopedClient, counterpartyId: string): Promise<{ categoryCode: string; count: number } | null> {
    const r = await db.query<{ code: string; n: string }>(
      `SELECT ec.code AS code, count(*)::text AS n
         FROM accounting_suggestions s JOIN expense_categories ec ON ec.id = s.expense_category_id
        WHERE s.counterparty_id=$1 AND s.status IN ('accepted','suggested') AND s.expense_category_id IS NOT NULL
        GROUP BY ec.code ORDER BY count(*) DESC LIMIT 1`, [counterpartyId]);
    return r.rows[0] ? { categoryCode: r.rows[0].code, count: Number(r.rows[0].n) } : null;
  }
  /** Another document in this company whose current extraction has the same invoice number. */
  async findDuplicateByInvoiceNumber(db: ScopedClient, invoiceNumber: string, excludeDocumentId: string): Promise<string | null> {
    const r = await db.query<{ document_id: string }>(
      `SELECT de.document_id FROM extraction_fields ef
         JOIN document_extractions de ON de.id = ef.extraction_id
        WHERE ef.field_key='invoice_number' AND ef.value_text=$1 AND de.document_id <> $2 AND de.status='extracted'
        LIMIT 1`, [invoiceNumber, excludeDocumentId]);
    return r.rows[0]?.document_id ?? null;
  }
  async accountIdByCode(db: ScopedClient, code: string): Promise<string | null> {
    const r = await db.query<{ id: string }>(`SELECT id FROM accounts WHERE code=$1 LIMIT 1`, [code]);
    return r.rows[0]?.id ?? null;
  }
  async save(db: ScopedClient, tenantId: string, companyId: string, s: {
    documentId: string; extractionId?: string; counterpartyId?: string; suggestedAccountId?: string;
    posting: PostingLine[]; confidence: number; explanation: string; isDuplicate: boolean; duplicateOf?: string;
    vat: { treatment: VatTreatment; rate: number; vatCodeId?: string; confidence: number; explanation: string };
    classification?: { categoryId?: string; confidence: number; reason: string; source: ClassificationSource };
  }): Promise<string> {
    await db.query(`UPDATE accounting_suggestions SET status='superseded' WHERE document_id=$1 AND status='suggested'`, [s.documentId]);
    const r = await db.query<{ id: string }>(
      `INSERT INTO accounting_suggestions (tenant_id, company_id, document_id, extraction_id, counterparty_id, suggested_account_id, suggested_posting, confidence, explanation, is_duplicate, duplicate_of_document_id, expense_category_id, classification_confidence, classification_reason, classification_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [tenantId, companyId, s.documentId, s.extractionId ?? null, s.counterpartyId ?? null, s.suggestedAccountId ?? null, JSON.stringify(s.posting), s.confidence, s.explanation, s.isDuplicate, s.duplicateOf ?? null,
       s.classification?.categoryId ?? null, s.classification?.confidence ?? null, s.classification?.reason ?? null, s.classification?.source ?? null]);
    const id = r.rows[0].id;
    await db.query(
      `INSERT INTO vat_suggestions (tenant_id, company_id, document_id, accounting_suggestion_id, suggested_vat_code_id, treatment, rate, confidence, explanation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [tenantId, companyId, s.documentId, id, s.vat.vatCodeId ?? null, s.vat.treatment, s.vat.rate, s.vat.confidence, s.vat.explanation]);
    return id;
  }
  private readonly SELECT = `SELECT s.*, a.code AS account_code,
      ec.code AS category_code, ec.name_bg AS category_name_bg, ec.name_en AS category_name_en, ec.saft_code AS category_saft
    FROM accounting_suggestions s
    LEFT JOIN accounts a            ON a.id  = s.suggested_account_id
    LEFT JOIN expense_categories ec ON ec.id = s.expense_category_id`;

  async getCurrent(db: ScopedClient, documentId: string): Promise<AccountingSuggestion | null> {
    const r = await db.query<SuggRow>(`${this.SELECT} WHERE s.document_id=$1 AND s.status='suggested'`, [documentId]);
    return r.rows[0] ? this.hydrate(db, r.rows[0]) : null;
  }
  async getById(db: ScopedClient, suggestionId: string): Promise<AccountingSuggestion | null> {
    const r = await db.query<SuggRow>(`${this.SELECT} WHERE s.id=$1`, [suggestionId]);
    return r.rows[0] ? this.hydrate(db, r.rows[0]) : null;
  }

  /** Reclassify a suggestion: set category + (optionally) the resolved account and rewritten posting. */
  async updateCategory(db: ScopedClient, suggestionId: string, p: { categoryId: string; source: ClassificationSource; confidence: number; reason: string; suggestedAccountId?: string; posting?: PostingLine[] }): Promise<void> {
    const sets = ['expense_category_id=$2', 'classification_source=$3', 'classification_confidence=$4', 'classification_reason=$5'];
    const params: unknown[] = [suggestionId, p.categoryId, p.source, p.confidence, p.reason];
    if (p.suggestedAccountId !== undefined) { params.push(p.suggestedAccountId); sets.push(`suggested_account_id=$${params.length}`); }
    if (p.posting !== undefined) { params.push(JSON.stringify(p.posting)); sets.push(`suggested_posting=$${params.length}`); }
    await db.query(`UPDATE accounting_suggestions SET ${sets.join(', ')} WHERE id=$1 AND status='suggested'`, params);
  }

  private async hydrate(db: ScopedClient, x: SuggRow): Promise<AccountingSuggestion> {
    const v = await db.query<{ treatment: VatTreatment; rate: string | null; suggested_vat_code_id: string | null; confidence: string; explanation: string }>(
      `SELECT * FROM vat_suggestions WHERE accounting_suggestion_id=$1 ORDER BY created_at DESC LIMIT 1`, [x.id]);
    const vat = v.rows[0];
    return {
      id: x.id, documentId: x.document_id, counterpartyId: x.counterparty_id ?? undefined,
      suggestedAccountCode: x.account_code ?? undefined, suggestedPosting: x.suggested_posting, confidence: Number(x.confidence),
      explanation: x.explanation, status: x.status, isDuplicate: x.is_duplicate, duplicateOfDocumentId: x.duplicate_of_document_id ?? undefined,
      vat: vat ? { treatment: vat.treatment, rate: Number(vat.rate ?? 0), vatCodeId: vat.suggested_vat_code_id ?? undefined, confidence: Number(vat.confidence), explanation: vat.explanation } : undefined,
      expenseCategory: x.expense_category_id && x.category_code ? { id: x.expense_category_id, code: x.category_code, nameBg: x.category_name_bg ?? x.category_code, nameEn: x.category_name_en ?? x.category_code, saftCode: x.category_saft ?? undefined } : undefined,
      classification: x.classification_source ? { confidence: Number(x.classification_confidence ?? 0), reason: x.classification_reason ?? '', source: x.classification_source } : undefined,
    };
  }
}

interface SuggRow {
  id: string; document_id: string; counterparty_id: string | null; suggested_posting: PostingLine[];
  confidence: string; explanation: string; status: AccountingSuggestion['status']; is_duplicate: boolean;
  duplicate_of_document_id: string | null; account_code: string | null;
  expense_category_id: string | null; category_code: string | null; category_name_bg: string | null; category_name_en: string | null; category_saft: string | null;
  classification_confidence: string | null; classification_reason: string | null; classification_source: ClassificationSource | null;
}
