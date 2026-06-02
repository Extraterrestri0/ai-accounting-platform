import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { VatCode, VatDirection, VatKind } from '../domain/models';

interface Row { id: string; company_id: string; code: string; description: string; kind: VatKind; rate: string; direction: VatDirection; is_active: boolean; }
const map = (r: Row): VatCode => ({ id: r.id, companyId: r.company_id, code: r.code, description: r.description, kind: r.kind, rate: r.rate, direction: r.direction, isActive: r.is_active });

@Injectable()
export class VatCodeRepository {
  async insert(db: ScopedClient, tenantId: string, companyId: string, v: { code: string; description: string; kind: VatKind; rate: string; direction: VatDirection }): Promise<VatCode> {
    const r = await db.query<Row>(
      `INSERT INTO vat_codes (tenant_id, company_id, code, description, kind, rate, direction)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, companyId, v.code, v.description, v.kind, v.rate, v.direction]);
    return map(r.rows[0]);
  }
  async list(db: ScopedClient, activeOnly: boolean): Promise<VatCode[]> {
    const r = await db.query<Row>(`SELECT * FROM vat_codes ${activeOnly ? "WHERE is_active=true" : ''} ORDER BY code`);
    return r.rows.map(map);
  }
}
