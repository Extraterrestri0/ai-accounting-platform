import { Injectable } from '@nestjs/common';
import type { PrincipalResolver, AuthenticatedPrincipal } from '../../../platform';

/**
 * MINIMAL principal resolver (full auth is Task 005).
 * Reads the principal that a verified session/auth guard has attached to the request
 * (server-side, trusted). It must NEVER read tenantId from client-controlled input
 * (body/query/custom headers).
 */
@Injectable()
export class SessionPrincipalResolver implements PrincipalResolver {
  async resolve(request: unknown): Promise<AuthenticatedPrincipal | null> {
    const principal = (request as { principal?: AuthenticatedPrincipal })?.principal;
    if (!principal?.userId || !principal?.tenantId) return null;
    return { userId: principal.userId, tenantId: principal.tenantId };
  }
}
