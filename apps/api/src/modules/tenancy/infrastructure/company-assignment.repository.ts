import { Injectable } from '@nestjs/common';
import { DatabaseContextService } from '../../../platform';

@Injectable()
export class CompanyAssignmentRepository {
  constructor(private readonly db: DatabaseContextService) {}

  create(tenantId: string, userId: string, companyId: string, role: string): Promise<void> {
    return this.db.run(async (db) => {
      await db.query(
        `INSERT INTO company_assignments (tenant_id, user_id, company_id, role)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (tenant_id, user_id, company_id) DO NOTHING`,
        [tenantId, userId, companyId, role],
      );
    });
  }

  /** True only if an ACTIVE assignment exists for (user, company) in the current tenant.
   *  RLS guarantees rows from other tenants are invisible, so cross-tenant => false. */
  hasActiveAssignment(userId: string, companyId: string): Promise<boolean> {
    return this.db.run(async (db) => {
      const res = await db.query<{ ok: boolean }>(
        `SELECT EXISTS (
            SELECT 1 FROM company_assignments
             WHERE user_id = $1 AND company_id = $2 AND status = 'active'
         ) AS ok`,
        [userId, companyId],
      );
      return res.rows[0]?.ok === true;
    });
  }
}
