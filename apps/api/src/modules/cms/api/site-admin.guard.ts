import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../platform';
import { CmsRepository } from '../infrastructure/cms.repository';

/**
 * Authorizes CMS write/admin endpoints. The TenantContextMiddleware already verified
 * the access-token JWT and bound the principal (else the request never reaches here),
 * so we trust ctx.userId and check it against the cms_site_admins allowlist.
 * This is how "which platform users may manage the site" is enforced server-side.
 */
@Injectable()
export class SiteAdminGuard implements CanActivate {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly repo: CmsRepository,
  ) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const { userId } = this.ctx.currentOrThrow();
    if (await this.repo.isSiteAdmin(userId)) return true;
    throw new ForbiddenException('Not a site administrator');
  }
}
