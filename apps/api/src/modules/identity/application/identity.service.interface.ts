import type { ApplicationService } from '../../../shared-kernel';

/**
 * PUBLIC application service for the Identity context — the ONLY synchronous entry point
 * other modules may depend on. Operations are declared here per feature task.
 * Responsibilities: Users, sessions, MFA, roles, permissions (auth + RBAC/ABAC checks).
 */
export interface IIdentityService extends ApplicationService {}

/** DI token. Other modules inject by this token, typed as IIdentityService. */
export const IDENTITY_SERVICE = Symbol('Identity.Service');
