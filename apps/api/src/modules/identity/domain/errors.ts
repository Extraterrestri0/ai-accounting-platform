export class InvalidCredentialsError extends Error {
  constructor() { super('Invalid email or password.'); this.name = 'InvalidCredentialsError'; }
}
export class AccountLockedError extends Error {
  constructor() { super('Account temporarily locked after failed attempts.'); this.name = 'AccountLockedError'; }
}
export class MfaRequiredError extends Error {
  constructor() { super('MFA verification required.'); this.name = 'MfaRequiredError'; }
}
export class MfaInvalidError extends Error {
  constructor() { super('Invalid MFA code.'); this.name = 'MfaInvalidError'; }
}
export class ForbiddenError extends Error {
  constructor(perm: string) { super(`Missing required permission: ${perm}`); this.name = 'ForbiddenError'; }
}
