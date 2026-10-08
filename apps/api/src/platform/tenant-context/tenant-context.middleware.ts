import { ForbiddenException, Inject, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { PRINCIPAL_RESOLVER, type PrincipalResolver } from './principal-resolver';
import { COMPANY_ACCESS_PORT, type CompanyAccessPort } from './company-access.port';
import { TenantContextService } from './tenant-context.service';
import type { TenantContextHolder } from './tenant-context';

/**
 * Establishes per-request context from the authenticated session.
 * Tenant/user are TRUSTED (from the signed token). The active company comes from
 * the `X-Company-Id` header and is set ONLY after an assignment check (Invariant 1/9):
 * the tenant is never taken from client input, and an unauthorized company is rejected.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(PRINCIPAL_RESOLVER) private readonly principals: PrincipalResolver,
    @Inject(COMPANY_ACCESS_PORT) private readonly companyAccess: CompanyAccessPort,
    private readonly ctx: TenantContextService,
  ) {}

  async use(req: unknown, _res: unknown, next: (err?: unknown) => void): Promise<void> {
    const principal = await this.principals.resolve(req);
    if (!principal) throw new UnauthorizedException();

    const holder: TenantContextHolder = { tenantId: principal.tenantId, userId: principal.userId };

    const companyId = this.readCompanyHeader(req);
    if (companyId) {
      // Authorize within tenant context (RLS-scoped assignment check) BEFORE binding it.
      const authorized = await this.ctx.run(holder, () => this.companyAccess.isAccessible(companyId));
      if (!authorized) throw new ForbiddenException('No access to the requested company');
      holder.companyId = companyId;
    }

    this.ctx.run(holder, () => next());
  }

  private readCompanyHeader(req: unknown): string | undefined {
    const raw = (req as { headers?: Record<string, string | string[] | undefined> })?.headers?.['x-company-id'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value && value.trim() ? value.trim() : undefined;
  }
}
