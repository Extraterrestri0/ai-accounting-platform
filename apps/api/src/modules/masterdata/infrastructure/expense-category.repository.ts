import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { ExpenseCategory, ExpenseVatTreatment } from '../domain/models';

interface Row {
  id: string; company_id: string; code: string; name_bg: string; name_en: string;
  default_account_id: string | null; default_account_code: string | null;
  default_vat_treatment: ExpenseVatTreatment; saft_code: string | null; is_active: boolean; created_at: string;
}
const map = (r: Row): ExpenseCategory => ({
  id: r.id, companyId: r.company_id, code: r.code, nameBg: r.name_bg, nameEn: r.name_en,
  defaultAccountId: r.default_account_id ?? undefined, defaultAccountCode: r.default_account_code ?? undefined,
  defaultVatTreatment: r.default_vat_treatment, saftCode: r.saft_code ?? undefined, isActive: r.is_active, createdAt: r.created_at,
});
const SELECT = `SELECT ec.*, a.code AS default_account_code
  FROM expense_categories ec LEFT JOIN accounts a ON a.id = ec.default_account_id`;

export interface ExpenseCategoryInsert {
  code: string; nameBg: string; nameEn: string; defaultAccountId?: string | null;
  defaultVatTreatment: ExpenseVatTreatment; saftCode?: string | null; isActive: boolean;
}
export type ExpenseCategoryPatch = Partial<ExpenseCategoryInsert>;

@Injectable()
export class ExpenseCategoryRepository {
  async list(db: ScopedClient, activeOnly: boolean): Promise<ExpenseCategory[]> {
    const r = await db.query<Row>(`${SELECT} ${activeOnly ? 'WHERE ec.is_active = true' : ''} ORDER BY ec.name_bg`);
    return r.rows.map(map);
  }
  async getById(db: ScopedClient, id: string): Promise<ExpenseCategory | null> {
    const r = await db.query<Row>(`${SELECT} WHERE ec.id=$1`, [id]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }
  async codeExists(db: ScopedClient, tenantId: string, companyId: string, code: string, excludeId?: string): Promise<boolean> {
    const params: unknown[] = [tenantId, companyId, code];
    let sql = `SELECT 1 FROM expense_categories WHERE tenant_id=$1 AND company_id=$2 AND lower(code)=lower($3)`;
    if (excludeId) { params.push(excludeId); sql += ` AND id<>$${params.length}`; }
    const r = await db.query(sql + ' LIMIT 1', params);
    return (r.rowCount ?? 0) > 0;
  }
  async insert(db: ScopedClient, tenantId: string, companyId: string, i: ExpenseCategoryInsert): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO expense_categories (tenant_id, company_id, code, name_bg, name_en, default_account_id, default_vat_treatment, saft_code, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [tenantId, companyId, i.code, i.nameBg, i.nameEn, i.defaultAccountId ?? null, i.defaultVatTreatment, i.saftCode ?? null, i.isActive]);
    return r.rows[0].id;
  }
  async update(db: ScopedClient, id: string, patch: ExpenseCategoryPatch): Promise<void> {
    const cols: Record<string, unknown> = {};
    if (patch.code !== undefined) cols.code = patch.code;
    if (patch.nameBg !== undefined) cols.name_bg = patch.nameBg;
    if (patch.nameEn !== undefined) cols.name_en = patch.nameEn;
    if (patch.defaultAccountId !== undefined) cols.default_account_id = patch.defaultAccountId;
    if (patch.defaultVatTreatment !== undefined) cols.default_vat_treatment = patch.defaultVatTreatment;
    if (patch.saftCode !== undefined) cols.saft_code = patch.saftCode;
    if (patch.isActive !== undefined) cols.is_active = patch.isActive;
    const keys = Object.keys(cols);
    if (keys.length === 0) return;
    const sets = keys.map((k, i) => `${k}=$${i + 1}`);
    const params = keys.map((k) => cols[k]);
    params.push(id);
    await db.query(`UPDATE expense_categories SET ${sets.join(', ')}, updated_at=now() WHERE id=$${params.length}`, params);
  }
}
