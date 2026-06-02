import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { Counterparty, CounterpartyKind } from '../domain/models';

interface Row {
  id: string; company_id: string; kind: CounterpartyKind; name: string;
  eik: string | null; vat_number: string | null; country_code: string;
  address_line: string | null; city: string | null; postal_code: string | null;
  email: string | null; iban: string | null; is_active: boolean; created_at: string;
}
const map = (r: Row): Counterparty => ({
  id: r.id, companyId: r.company_id, kind: r.kind, name: r.name,
  eik: r.eik ?? undefined, vatNumber: r.vat_number ?? undefined, countryCode: r.country_code,
  addressLine: r.address_line ?? undefined, city: r.city ?? undefined,
  postalCode: r.postal_code ?? undefined, email: r.email ?? undefined, iban: r.iban ?? undefined,
  isActive: r.is_active, createdAt: r.created_at,
});

export interface CounterpartyFilter { kind?: CounterpartyKind; search?: string; activeOnly?: boolean; limit: number; offset: number; }

@Injectable()
export class CounterpartyRepository {
  async findDuplicate(db: ScopedClient, tenantId: string, companyId: string, eik?: string, vat?: string): Promise<string | null> {
    if (!eik && !vat) return null;
    const r = await db.query<{ eik: string | null; vat_number: string | null }>(
      `SELECT eik, vat_number FROM counterparties
        WHERE tenant_id=$1 AND company_id=$2 AND ((eik IS NOT NULL AND eik=$3) OR (vat_number IS NOT NULL AND vat_number=$4))
        LIMIT 1`, [tenantId, companyId, eik ?? null, vat ?? null]);
    if (!r.rows[0]) return null;
    return r.rows[0].eik === eik ? 'eik' : 'vat_number';
  }

  async insert(db: ScopedClient, tenantId: string, companyId: string, c: Omit<Counterparty, 'id' | 'companyId' | 'isActive' | 'createdAt'>): Promise<Counterparty> {
    const r = await db.query<Row>(
      `INSERT INTO counterparties
         (tenant_id, company_id, kind, name, eik, vat_number, country_code, address_line, city, postal_code, email, iban)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [tenantId, companyId, c.kind, c.name, c.eik ?? null, c.vatNumber ?? null, c.countryCode,
       c.addressLine ?? null, c.city ?? null, c.postalCode ?? null, c.email ?? null, c.iban ?? null]);
    return map(r.rows[0]);
  }

  async list(db: ScopedClient, f: CounterpartyFilter): Promise<{ items: Counterparty[]; total: number }> {
    const where: string[] = ['true']; const params: unknown[] = [];
    if (f.kind) { params.push(f.kind); where.push(`(kind=$${params.length} OR kind='both')`); }
    if (f.activeOnly) where.push('is_active = true');
    if (f.search) { params.push(`%${f.search.toLowerCase()}%`); where.push(`(lower(name) LIKE $${params.length} OR eik LIKE $${params.length} OR vat_number LIKE $${params.length})`); }
    const w = where.join(' AND ');
    const total = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM counterparties WHERE ${w}`, params);
    params.push(f.limit); params.push(f.offset);
    const rows = await db.query<Row>(
      `SELECT * FROM counterparties WHERE ${w} ORDER BY lower(name) LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { items: rows.rows.map(map), total: Number(total.rows[0].n) };
  }

  async getById(db: ScopedClient, id: string): Promise<Counterparty | null> {
    const r = await db.query<Row>(`SELECT * FROM counterparties WHERE id=$1`, [id]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }
}
