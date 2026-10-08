import { Injectable } from '@nestjs/common';
import { DatabaseContextService } from '../../../platform';
import type { Company } from '../domain/models';

interface Row {
  id: string; tenant_id: string; organization_id: string | null; name: string;
  eik: string | null; vat_status: string; base_currency: string;
  fiscal_year_start_month: number; status: string; created_at: string;
}
const map = (r: Row): Company => ({
  id: r.id, tenantId: r.tenant_id, organizationId: r.organization_id ?? undefined,
  name: r.name, eik: r.eik ?? undefined, vatStatus: r.vat_status,
  baseCurrency: r.base_currency, fiscalYearStartMonth: r.fiscal_year_start_month,
  status: r.status as Company['status'], createdAt: r.created_at,
});

@Injectable()
export class CompanyRepository {
  constructor(private readonly db: DatabaseContextService) {}

  /**
   * Insert relies on RLS: tenant_id is taken from the session context (the column
   * default would be NULL, so we pass the current tenant explicitly and RLS
   * WITH CHECK guarantees it equals app.current_tenant_id()). We DO NOT accept a
   * tenant_id from the caller.
   */
  create(tenantId: string, c: {
    organizationId?: string; name: string; eik?: string; vatStatus: string;
    baseCurrency: string; fiscalYearStartMonth: number;
  }): Promise<Company> {
    return this.db.run(async (db) => {
      const res = await db.query<Row>(
        `INSERT INTO companies
           (tenant_id, organization_id, name, eik, vat_status, base_currency, fiscal_year_start_month)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [tenantId, c.organizationId ?? null, c.name, c.eik ?? null, c.vatStatus,
         c.baseCurrency, c.fiscalYearStartMonth],
      );
      const company = map(res.rows[0]);
      // Seed the default BG chart of accounts (+ VAT code) so the company can post
      // immediately. SECURITY DEFINER helper; refuses cross-tenant calls (migration 0040).
      await db.query('SELECT app.seed_chart_of_accounts($1, $2)', [company.tenantId, company.id]);
      return company;
    });
  }

  findById(id: string): Promise<Company | null> {
    return this.db.run(async (db) => {
      const res = await db.query<Row>(`SELECT * FROM companies WHERE id = $1`, [id]);
      return res.rows[0] ? map(res.rows[0]) : null;
    });
  }

  listForUser(userId: string): Promise<Company[]> {
    return this.db.run(async (db) => {
      const res = await db.query<Row>(
        `SELECT c.* FROM companies c
           JOIN company_assignments a ON a.company_id = c.id
          WHERE a.user_id = $1 AND a.status = 'active'
          ORDER BY c.name`,
        [userId],
      );
      return res.rows.map(map);
    });
  }
}
