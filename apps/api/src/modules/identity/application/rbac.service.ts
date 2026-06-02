import { Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { UserAuthRepository } from '../infrastructure/user-auth.repository';
import { resolveEffectivePermissions, type Permission } from '../domain/roles';

/** Resolves a principal's effective permissions for the CURRENT tenant/active company. */
@Injectable()
export class RbacService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly users: UserAuthRepository,
  ) {}

  async can(permission: Permission): Promise<boolean> {
    const { userId, companyId } = this.ctx.currentOrThrow();
    const perms = await this.db.run((db) => this.users.resolveRoles(db, userId, companyId))
      .then((roles) => resolveEffectivePermissions(roles));
    return perms.has(permission);
  }
}
