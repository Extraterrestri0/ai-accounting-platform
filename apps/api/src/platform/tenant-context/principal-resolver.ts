import type { AuthenticatedPrincipal } from './tenant-context';

/**
 * Port: resolve the authenticated principal from the request SESSION.
 * Real implementation (Task 005 auth) validates the session/JWT server-side.
 * The tenantId MUST come from the verified session — never from request input.
 */
export interface PrincipalResolver {
  resolve(request: unknown): Promise<AuthenticatedPrincipal | null>;
}
export const PRINCIPAL_RESOLVER = Symbol('PrincipalResolver');
