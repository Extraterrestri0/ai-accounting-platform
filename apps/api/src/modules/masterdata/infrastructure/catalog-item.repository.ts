import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { CatalogItem, CatalogItemKind } from '../domain/models';

interface Row {
  id: string; company_id: string; code: string; description: string; kind: CatalogItemKind;
  unit: string; vat_rate: string; vat_code_id: string | null; saft_code: string | null;
  default_account_id: string | null; is_active: boolean; created_at: string;
  default_account_code: string | null; vat_code_label: string | null;
}
const map = (r: Row): CatalogItem => ({
  id: r.id, companyId: r.company_id, code: r.code, description: r.description, kind: r.kind,
  unit: r.unit, vatRate: r.vat_rate, vatCodeId: r.vat_code_id ?? undefined, saftCode: r.saft_code ?? undefined,
  defaultAccountId: r.default_account_id ?? undefined, isActive: r.is_active,
  defaultAccountCode: r.default_account_code ?? undefined, vatCodeLabel: r.vat_code_label ?? undefined,
  createdAt: r.created_at,
});
const SELECT = `SELECT ci.*, a.code AS default_account_code, vc.code AS vat_code_label
  FROM catalog_items ci
  LEFT JOIN accounts a   ON a.id  = ci.default_account_id
  LEFT JOIN vat_codes vc ON vc.id = ci.vat_code_id`;

export interface CatalogInsert {
  code: string; description: string; kind: CatalogItemKind; unit: string; vatRate: string;
  vatCodeId?: string | null; saftCode?: string | null; defaultAccountId?: string | null; isActive: boolean;
}
export type CatalogPatch = Partial<CatalogInsert>;
export interface CatalogFilter { search?: string; activeOnly?: boolean; kind?: CatalogItemKind; limit: number; offset: number; }

@Injectable()
export class CatalogItemRepository {
  async codeExists(db: ScopedClient, tenantId: string, companyId: string, code: string, excludeId?: string): Promise<boolean> {
    const params: unknown[] = [tenantId, companyId, code];
    let sql = `SELECT 1 FROM catalog_items WHERE tenant_id=$1 AND company_id=$2 AND lower(code)=lower($3)`;
    if (excludeId) { params.push(excludeId); sql += ` AND id<>$${params.length}`; }
    sql += ' LIMIT 1';
    const r = await db.query(sql, params);
    return (r.rowCount ?? 0) > 0;
  }

  async insert(db: ScopedClient, tenantId: string, companyId: string, i: CatalogInsert): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO catalog_items
         (tenant_id, company_id, code, description, kind, unit, vat_rate, vat_code_id, saft_code, default_account_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [tenantId, companyId, i.code, i.description, i.kind, i.unit, i.vatRate,
       i.vatCodeId ?? null, i.saftCode ?? null, i.defaultAccountId ?? null, i.isActive]);
    return r.rows[0].id;
  }

  async update(db: ScopedClient, id: string, patch: CatalogPatch): Promise<void> {
    const cols: Record<string, unknown> = {};
    if (patch.code !== undefined) cols.code = patch.code;
    if (patch.description !== undefined) cols.description = patch.description;
    if (patch.kind !== undefined) cols.kind = patch.kind;
    if (patch.unit !== undefined) cols.unit = patch.unit;
    if (patch.vatRate !== undefined) cols.vat_rate = patch.vatRate;
    if (patch.vatCodeId !== undefined) cols.vat_code_id = patch.vatCodeId;
    if (patch.saftCode !== undefined) cols.saft_code = patch.saftCode;
    if (patch.defaultAccountId !== undefined) cols.default_account_id = patch.defaultAccountId;
    if (patch.isActive !== undefined) cols.is_active = patch.isActive;
    const keys = Object.keys(cols);
    if (keys.length === 0) return;
    const sets = keys.map((k, idx) => `${k}=$${idx + 1}`);
    const params = keys.map((k) => cols[k]);
    params.push(id);
    await db.query(`UPDATE catalog_items SET ${sets.join(', ')}, updated_at=now() WHERE id=$${params.length}`, params);
  }

  async getById(db: ScopedClient, id: string): Promise<CatalogItem | null> {
    const r = await db.query<Row>(`${SELECT} WHERE ci.id=$1`, [id]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }

  async list(db: ScopedClient, f: CatalogFilter): Promise<{ items: CatalogItem[]; total: number }> {
    const where: string[] = ['true']; const params: unknown[] = [];
    if (f.activeOnly) where.push('ci.is_active = true');
    if (f.kind) { params.push(f.kind); where.push(`ci.kind=$${params.length}`); }
    if (f.search) { params.push(`%${f.search.toLowerCase()}%`); where.push(`(lower(ci.description) LIKE $${params.length} OR lower(ci.code) LIKE $${params.length})`); }
    const w = where.join(' AND ');
    const total = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM catalog_items ci WHERE ${w}`, params);
    params.push(f.limit); params.push(f.offset);
    const rows = await db.query<Row>(`${SELECT} WHERE ${w} ORDER BY ci.code LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { items: rows.rows.map(map), total: Number(total.rows[0].n) };
  }

  /** VAT-code ownership check (RLS-scoped to the active company). */
  async getVatCode(db: ScopedClient, id: string): Promise<{ id: string; isActive: boolean } | null> {
    const r = await db.query<{ id: string; is_active: boolean }>(`SELECT id, is_active FROM vat_codes WHERE id=$1`, [id]);
    return r.rows[0] ? { id: r.rows[0].id, isActive: r.rows[0].is_active } : null;
  }
}
