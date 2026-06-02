import { Injectable } from '@nestjs/common';
import type { PrincipalResolver, AuthenticatedPrincipal } from '../../../platform';
import { TokenService } from './token.service';

/**
 * Resolves the principal from a verified access-token JWT (Authorization: Bearer ...).
 * tenantId comes from the SIGNED token claim (server-issued), never from client input.
 * Replaces Task 003's placeholder SessionPrincipalResolver.
 */
@Injectable()
export class JwtPrincipalResolver implements PrincipalResolver {
  constructor(private readonly tokens: TokenService) {}

  async resolve(request: unknown): Promise<AuthenticatedPrincipal | null> {
    const header = (request as { headers?: Record<string, string | undefined> })?.headers?.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    const claims = this.tokens.verifyAccess(header.slice(7));
    if (!claims || claims.sub.startsWith('mfa:')) return null; // half-auth MFA tokens are not principals
    return { userId: claims.sub, tenantId: claims.tid };
  }
}
