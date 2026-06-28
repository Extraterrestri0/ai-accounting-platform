import type { ApplicationService } from '../../../shared-kernel';

export interface UserProfile {
  userId: string;
  tenantId: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * PUBLIC application service for the Identity context — the ONLY synchronous entry point
 * other modules may depend on. Responsibilities: Users, sessions, MFA, roles, permissions,
 * and the authenticated user's own profile (incl. avatar).
 */
export interface IIdentityService extends ApplicationService {
  /** The authenticated user's own profile (from request context). */
  getMe(): Promise<UserProfile>;
  /** Set the avatar (validated image data URL). Returns the updated profile. */
  setAvatar(dataUrl: string): Promise<UserProfile>;
  /** Remove the avatar. Returns the updated profile. */
  removeAvatar(): Promise<UserProfile>;
}

/** DI token. Other modules inject by this token, typed as IIdentityService. */
export const IDENTITY_SERVICE = Symbol('Identity.Service');
