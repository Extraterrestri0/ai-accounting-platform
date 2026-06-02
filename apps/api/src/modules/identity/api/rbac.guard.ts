import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../application/rbac.service';
import { PERMISSION_KEY } from './require-permission.decorator';
import type { Permission } from '../domain/roles';

/**
 * Enforces @RequirePermission(...) by re-authorizing on the SERVER against the
 * principal's effective permissions for the current tenant/active company.
 * UI permission hints are never trusted (Invariant 9).
 */
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly rbac: RbacService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!required) return true;
    if (await this.rbac.can(required)) return true;
    throw new ForbiddenException(`Missing required permission: ${required}`);
  }
}
