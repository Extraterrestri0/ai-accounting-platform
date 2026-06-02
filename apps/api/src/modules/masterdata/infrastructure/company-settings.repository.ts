import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { CompanySettings } from '../domain/models';

interface Row { company_id: string; vat_registered: boolean; vat_number: string | null; vat_registration_date: string | null; default_currency: string; fiscal_year_start_month: number; accounting_basis: 'accrual' | 'cash'; }
const map = (r: Row): CompanySettings => ({ companyId: r.company_id, vatRegistered: r.vat_registered, vatNumber: r.vat_number ?? undefined, vatRegistrationDate: r.vat_registration_date ?? undefined, defaultCurrency: r.default_currency, fiscalYearStartMonth: r.fiscal_year_start_month, accountingBasis: r.accounting_basis });

@Injectable()
export class CompanySettingsRepository {
  async get(db: ScopedClient, companyId: string): Promise<CompanySettings | null> {
    const r = await db.query<Row>(`SELECT * FROM company_settings WHERE company_id=$1`, [companyId]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }
  async upsert(db: ScopedClient, tenantId: string, companyId: string, s: Partial<CompanySettings>): Promise<CompanySettings> {
    const r = await db.query<Row>(
      `INSERT INTO company_settings (tenant_id, company_id, vat_registered, vat_number, vat_registration_date, default_currency, fiscal_year_start_month, accounting_basis)
       VALUES ($1,$2,COALESCE($3,false),$4,$5,COALESCE($6,'EUR'),COALESCE($7,1),COALESCE($8,'accrual'))
       ON CONFLICT (tenant_id, company_id) DO UPDATE SET
         vat_registered=COALESCE($3, company_settings.vat_registered),
         vat_number=COALESCE($4, company_settings.vat_number),
         vat_registration_date=COALESCE($5, company_settings.vat_registration_date),
         default_currency=COALESCE($6, company_settings.default_currency),
         fiscal_year_start_month=COALESCE($7, company_settings.fiscal_year_start_month),
         accounting_basis=COALESCE($8, company_settings.accounting_basis),
         updated_at=now()
       RETURNING *`,
      [tenantId, companyId, s.vatRegistered ?? null, s.vatNumber ?? null, s.vatRegistrationDate ?? null,
       s.defaultCurrency ?? null, s.fiscalYearStartMonth ?? null, s.accountingBasis ?? null]);
    return map(r.rows[0]);
  }
}
