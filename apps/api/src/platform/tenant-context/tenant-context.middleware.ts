import { Inject, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { PRINCIPAL_RESOLVER, type PrincipalResolver } from './principal-resolver';
import { TenantContextService } from './tenant-context.service';

/**
 * Establishes per-request tenant context from the authenticated session.
 * Tenant/user are TRUSTED (from session). The active company is NOT set here —
 * it is authorized later by the company-context guard against assignments.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(PRINCIPAL_RESOLVER) private readonly principals: PrincipalResolver,
    private readonly ctx: TenantContextService,
  ) {}

  async use(req: unknown, _res: unknown, next: (err?: unknown) => void): Promise<void> {
    const principal = await this.principals.resolve(req);
    if (!principal) throw new UnauthorizedException();
    // companyId intentionally undefined until an assignment check sets it.
    this.ctx.run({ tenantId: principal.tenantId, userId: principal.userId }, () => next());
  }
}
