import { Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService, type ScopedClient } from '../../../platform';
import type { CompanyRole, TenantRole } from '../domain/roles';

export interface AuthUserRow {
  id: string; tenantId: string; passwordHash: string | null; passwordAlgo: string;
  mfaEnabled: boolean; mfaSecret: string | null; status: string;
  lockedUntil: string | null; failedLoginAttempts: number;
}

@Injectable()
export class UserAuthRepository {
  constructor(
    private readonly db: DatabaseContextService,
    private readonly ctx: TenantContextService,
  ) {}

  /**
   * PRE-AUTH lookup by email across tenants, via the SECURITY DEFINER function
   * (owned by the NOLOGIN/BYPASSRLS `auth_lookup` role). Runs WITHOUT tenant context.
   * app_user can only EXECUTE it; it cannot read users cross-tenant directly.
   */
  async findForLogin(email: string): Promise<AuthUserRow | null> {
    return this.db.runWithoutTenant(async (db) => {
      const r = await db.query<{
        id: string; tenant_id: string; password_hash: string | null; password_algo: string;
        mfa_enabled: boolean; mfa_secret: string | null; status: string;
        locked_until: string | null; failed_login_attempts: number;
      }>(`SELECT * FROM app.authenticate_lookup($1)`, [email]);
      const x = r.rows[0];
      if (!x) return null;
      return {
        id: x.id, tenantId: x.tenant_id, passwordHash: x.password_hash, passwordAlgo: x.password_algo,
        mfaEnabled: x.mfa_enabled, mfaSecret: x.mfa_secret, status: x.status,
        lockedUntil: x.locked_until, failedLoginAttempts: x.failed_login_attempts,
      };
    });
  }

  /** Post-auth writes run UNDER the resolved tenant context (RLS-scoped). */
  recordFailedAttempt(tenantId: string, userId: string, lockThreshold: number, lockMinutes: number): Promise<void> {
    return this.ctx.run({ tenantId, userId }, () => this.db.run(async (db) => {
      await db.query(
        `UPDATE users
            SET failed_login_attempts = failed_login_attempts + 1,
                locked_until = CASE WHEN failed_login_attempts + 1 >= $2
                                    THEN now() + ($3 || ' minutes')::interval ELSE locked_until END
          WHERE id = $1`,
        [userId, lockThreshold, String(lockMinutes)],
      );
    }));
  }
  recordSuccessfulLogin(tenantId: string, userId: string): Promise<void> {
    return this.ctx.run({ tenantId, userId }, () => this.db.run(async (db) => {
      await db.query(
        `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`,
        [userId],
      );
    }));
  }

  /** Read a user's MFA secret UNDER tenant context (RLS-scoped) — used by verifyMfa. */
  getMfaSecret(tenantId: string, userId: string): Promise<string | null> {
    return this.ctx.run({ tenantId, userId }, () => this.db.run(async (db) => {
      const r = await db.query<{ mfa_secret: string | null }>(
        `SELECT mfa_secret FROM users WHERE id = $1`, [userId]);
      return r.rows[0]?.mfa_secret ?? null;
    }));
  }

  /** Effective roles for RBAC: tenant membership + (optional) active-company assignment. */
  async resolveRoles(db: ScopedClient, userId: string, companyId?: string): Promise<{ tenantRole?: TenantRole; companyRole?: CompanyRole }> {
    const m = await db.query<{ role: string }>(
      `SELECT role FROM memberships WHERE user_id = $1 AND status = 'active'`, [userId]);
    let companyRole: string | undefined;
    if (companyId) {
      const a = await db.query<{ role: string }>(
        `SELECT role FROM company_assignments WHERE user_id = $1 AND company_id = $2 AND status = 'active'`,
        [userId, companyId]);
      companyRole = a.rows[0]?.role;
    }
    return { tenantRole: m.rows[0]?.role as TenantRole, companyRole: companyRole as CompanyRole };
  }
}
