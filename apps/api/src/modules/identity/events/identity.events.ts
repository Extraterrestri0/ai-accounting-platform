// Domain event contracts PUBLISHED by the Identity context (names are stable;
// payload shapes are finalized in the identity feature task). Subscribers depend on these.

export const IdentityEvents = {
  UserInvited: 'identity.user_invited',
  UserActivated: 'identity.user_activated',
  RoleChanged: 'identity.role_changed',
} as const;

export type IdentityEventType = (typeof IdentityEvents)[keyof typeof IdentityEvents];
