import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PRINCIPAL_RESOLVER } from '../../platform';

import { AuthController } from './api/auth.controller';
import { RbacGuard } from './api/rbac.guard';
import { IDENTITY_SERVICE } from './application/identity.service.interface';
import { IdentityService } from './application/identity.service';
import { AUTH_SERVICE } from './application/auth.service.interface';
import { AuthService } from './application/auth.service';
import { RbacService } from './application/rbac.service';
import { PasswordHasher } from './infrastructure/password.hasher';
import { TotpService } from './infrastructure/totp.service';
import { TokenService } from './infrastructure/token.service';
import { UserAuthRepository } from './infrastructure/user-auth.repository';
import { SessionRepository } from './infrastructure/session.repository';
import { JwtPrincipalResolver } from './infrastructure/jwt-principal-resolver';

/**
 * Identity context: authentication (login/MFA/refresh), RBAC, and the JWT-based
 * PrincipalResolver consumed by the global TenantContextMiddleware. The RbacGuard is
 * registered globally so @RequirePermission re-authorizes every protected route.
 */
@Module({
  controllers: [AuthController],
  providers: [
    { provide: IDENTITY_SERVICE, useClass: IdentityService },
    { provide: AUTH_SERVICE, useClass: AuthService },
    { provide: PRINCIPAL_RESOLVER, useClass: JwtPrincipalResolver }, // replaces Task 003 stub
    { provide: APP_GUARD, useClass: RbacGuard },
    RbacService, PasswordHasher, TotpService, TokenService, UserAuthRepository, SessionRepository,
  ],
  exports: [IDENTITY_SERVICE, AUTH_SERVICE, PRINCIPAL_RESOLVER, RbacService],
})
export class IdentityModule {}
