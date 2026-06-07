import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type {
  BankAccount, BankStatement, BankTransaction, BankingSummary, NormalizedRow, ReconciliationStatus,
} from '../domain/models';

interface AccountRowDb { id: string; iban: string; bic: string | null; bank_name: string | null; currency: string; is_primary: boolean; is_active: boolean; created_at: string; updated_at: string; }
const mapAccount = (r: AccountRowDb): BankAccount => ({ id: r.id, iban: r.iban, bic: r.bic ?? undefined, bankName: r.bank_name ?? undefined, currency: r.currency, isPrimary: r.is_primary, isActive: r.is_active, createdAt: r.created_at, updatedAt: r.updated_at });

interface StatementRowDb { id: string; bank_account_id: string; file_name: string; imported_by: string | null; imported_at: string; statement_from: string | null; statement_to: string | null; row_count: number; duplicate_count: number; error_count: number; }
const mapStatement = (r: StatementRowDb): BankStatement => ({ id: r.id, bankAccountId: r.bank_account_id, fileName: r.file_name, importedBy: r.imported_by ?? undefined, importedAt: r.imported_at, statementFrom: r.statement_from ?? undefined, statementTo: r.statement_to ?? undefined, rowCount: Number(r.row_count), duplicateCount: Number(r.duplicate_count), errorCount: Number(r.error_count) });

interface TxnRowDb { id: string; bank_statement_id: string; bank_account_id: string; booking_date: string; value_date: string | null; amount: string; currency: string; description: string | null; counterparty_name: string | null; counterparty_iban: string | null; reference: string | null; transaction_type: 'inbound' | 'outbound'; reconciliation_status: ReconciliationStatus; matched_payment_id: string | null; created_at: string; }
const mapTxn = (r: TxnRowDb): BankTransaction => ({ id: r.id, bankStatementId: r.bank_statement_id, bankAccountId: r.bank_account_id, bookingDate: r.booking_date, valueDate: r.value_date ?? undefined, amount: r.amount, currency: r.currency, description: r.description ?? undefined, counterpartyName: r.counterparty_name ?? undefined, counterpartyIban: r.counterparty_iban ?? undefined, reference: r.reference ?? undefined, transactionType: r.transaction_type, reconciliationStatus: r.reconciliation_status, matchedPaymentId: r.matched_payment_id ?? undefined, createdAt: r.created_at });

const ACC = `SELECT id, iban, bic, bank_name, currency, is_primary, is_active, created_at::text AS created_at, updated_at::text AS updated_at FROM bank_accounts`;
const STMT = `SELECT id, bank_account_id, file_name, imported_by, imported_at::text AS imported_at, statement_from::text AS statement_from, statement_to::text AS statement_to, row_count, duplicate_count, error_count FROM bank_statements`;
const TXN = `SELECT id, bank_statement_id, bank_account_id, booking_date::text AS booking_date, value_date::text AS value_date, amount, currency, description, counterparty_name, counterparty_iban, reference, transaction_type, reconciliation_status, matched_payment_id, created_at::text AS created_at FROM bank_transactions`;

@Injectable()
export class BankingRepository {
  // ---- bank accounts ----
  async createAccount(db: ScopedClient, tenantId: string, companyId: string, a: { iban: string; bic?: string; bankName?: string; currency: string; isPrimary: boolean }): Promise<BankAccount> {
    const r = await db.query<AccountRowDb>(
      `INSERT INTO bank_accounts (tenant_id, company_id, iban, bic, bank_name, currency, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, iban, bic, bank_name, currency, is_primary, is_active, created_at::text AS created_at, updated_at::text AS updated_at`,
      [tenantId, companyId, a.iban, a.bic ?? null, a.bankName ?? null, a.currency, a.isPrimary]);
    return mapAccount(r.rows[0]);
  }
  async listAccounts(db: ScopedClient, companyId: string): Promise<BankAccount[]> {
    const r = await db.query<AccountRowDb>(`${ACC} WHERE company_id=$1 ORDER BY is_primary DESC, created_at`, [companyId]);
    return r.rows.map(mapAccount);
  }
  async getAccount(db: ScopedClient, id: string): Promise<BankAccount | null> {
    const r = await db.query<AccountRowDb>(`${ACC} WHERE id=$1`, [id]);
    return r.rows[0] ? mapAccount(r.rows[0]) : null;
  }
  async findByIban(db: ScopedClient, companyId: string, iban: string): Promise<BankAccount | null> {
    const r = await db.query<AccountRowDb>(`${ACC} WHERE company_id=$1 AND iban=$2`, [companyId, iban]);
    return r.rows[0] ? mapAccount(r.rows[0]) : null;
  }
  async updateAccount(db: ScopedClient, id: string, patch: { bic?: string | null; bankName?: string | null; currency?: string; isActive?: boolean }): Promise<void> {
    await db.query(
      `UPDATE bank_accounts SET bic=COALESCE($2,bic), bank_name=COALESCE($3,bank_name), currency=COALESCE($4,currency), is_active=COALESCE($5,is_active), updated_at=now() WHERE id=$1`,
      [id, patch.bic ?? null, patch.bankName ?? null, patch.currency ?? null, patch.isActive ?? null]);
  }
  async setPrimary(db: ScopedClient, companyId: string, id: string): Promise<void> {
    await db.query(`UPDATE bank_accounts SET is_primary=false, updated_at=now() WHERE company_id=$1 AND is_primary`, [companyId]);
    await db.query(`UPDATE bank_accounts SET is_primary=true, updated_at=now() WHERE id=$1`, [id]);
  }

  // ---- statements ----
  async createStatement(db: ScopedClient, tenantId: string, companyId: string, s: { bankAccountId: string; fileName: string; importedBy?: string; statementFrom?: string; statementTo?: string; rowCount: number; duplicateCount: number; errorCount: number }): Promise<BankStatement> {
    const r = await db.query<StatementRowDb>(
      `INSERT INTO bank_statements (tenant_id, company_id, bank_account_id, file_name, imported_by, statement_from, statement_to, row_count, duplicate_count, error_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, bank_account_id, file_name, imported_by, imported_at::text AS imported_at, statement_from::text AS statement_from, statement_to::text AS statement_to, row_count, duplicate_count, error_count`,
      [tenantId, companyId, s.bankAccountId, s.fileName, s.importedBy ?? null, s.statementFrom ?? null, s.statementTo ?? null, s.rowCount, s.duplicateCount, s.errorCount]);
    return mapStatement(r.rows[0]);
  }
  async listStatements(db: ScopedClient, companyId: string, limit: number, offset: number): Promise<BankStatement[]> {
    const r = await db.query<StatementRowDb>(`${STMT} WHERE company_id=$1 ORDER BY imported_at DESC LIMIT $2 OFFSET $3`, [companyId, limit, offset]);
    return r.rows.map(mapStatement);
  }
  async setDuplicateCount(db: ScopedClient, statementId: string, n: number): Promise<void> {
    await db.query(`UPDATE bank_statements SET duplicate_count=$2 WHERE id=$1`, [statementId, n]);
  }

  // ---- transactions ----
  /** Insert a transaction; returns null when it is a duplicate (dedup unique index). */
  async insertTransaction(db: ScopedClient, tenantId: string, companyId: string, t: { bankStatementId: string; bankAccountId: string; row: NormalizedRow; dedupHash: string }): Promise<BankTransaction | null> {
    const n = t.row;
    const r = await db.query<TxnRowDb>(
      `INSERT INTO bank_transactions (tenant_id, company_id, bank_statement_id, bank_account_id, booking_date, value_date, amount, currency, description, counterparty_name, counterparty_iban, reference, transaction_type, dedup_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (tenant_id, company_id, bank_account_id, dedup_hash) DO NOTHING
       RETURNING id, bank_statement_id, bank_account_id, booking_date::text AS booking_date, value_date::text AS value_date, amount, currency, description, counterparty_name, counterparty_iban, reference, transaction_type, reconciliation_status, matched_payment_id, created_at::text AS created_at`,
      [tenantId, companyId, t.bankStatementId, t.bankAccountId, n.bookingDate, n.valueDate ?? null, n.amount, n.currency, n.description ?? null, n.counterpartyName ?? null, n.counterpartyIban ?? null, n.reference ?? null, n.transactionType, t.dedupHash]);
    return r.rows[0] ? mapTxn(r.rows[0]) : null;
  }
  async getTransaction(db: ScopedClient, id: string): Promise<BankTransaction | null> {
    const r = await db.query<TxnRowDb>(`${TXN} WHERE id=$1`, [id]);
    return r.rows[0] ? mapTxn(r.rows[0]) : null;
  }
  async listTransactions(db: ScopedClient, companyId: string, f: { status?: string; bankAccountId?: string; statementId?: string }, limit: number, offset: number): Promise<BankTransaction[]> {
    const where = ['company_id=$1']; const params: unknown[] = [companyId];
    if (f.status) { params.push(f.status); where.push(`reconciliation_status=$${params.length}`); }
    if (f.bankAccountId) { params.push(f.bankAccountId); where.push(`bank_account_id=$${params.length}`); }
    if (f.statementId) { params.push(f.statementId); where.push(`bank_statement_id=$${params.length}`); }
    params.push(limit); const lim = `$${params.length}`;
    params.push(offset); const off = `$${params.length}`;
    const r = await db.query<TxnRowDb>(`${TXN} WHERE ${where.join(' AND ')} ORDER BY booking_date DESC, created_at DESC LIMIT ${lim} OFFSET ${off}`, params);
    return r.rows.map(mapTxn);
  }
  async markReconciled(db: ScopedClient, id: string, paymentId: string): Promise<void> {
    await db.query(`UPDATE bank_transactions SET reconciliation_status='reconciled', matched_payment_id=$2 WHERE id=$1`, [id, paymentId]);
  }
  async markIgnored(db: ScopedClient, id: string): Promise<void> {
    await db.query(`UPDATE bank_transactions SET reconciliation_status='ignored' WHERE id=$1`, [id]);
  }

  async summary(db: ScopedClient, companyId: string): Promise<BankingSummary> {
    const r = await db.query<{ total: string; unrec: string; rec: string; ign: string; last_import: string | null; accounts: string }>(
      `SELECT
         (SELECT count(*) FROM bank_transactions WHERE company_id=$1)::text AS total,
         (SELECT count(*) FROM bank_transactions WHERE company_id=$1 AND reconciliation_status='unreconciled')::text AS unrec,
         (SELECT count(*) FROM bank_transactions WHERE company_id=$1 AND reconciliation_status='reconciled')::text AS rec,
         (SELECT count(*) FROM bank_transactions WHERE company_id=$1 AND reconciliation_status='ignored')::text AS ign,
         (SELECT max(imported_at)::text FROM bank_statements WHERE company_id=$1) AS last_import,
         (SELECT count(*) FROM bank_accounts WHERE company_id=$1 AND is_active)::text AS accounts`,
      [companyId]);
    const x = r.rows[0];
    return { totalTransactions: Number(x.total), unreconciled: Number(x.unrec), reconciled: Number(x.rec), ignored: Number(x.ign), lastImportAt: x.last_import ?? undefined, accountCount: Number(x.accounts) };
  }
}
