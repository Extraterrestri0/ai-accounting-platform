/** Thrown when DB access is attempted with no tenant context — fail-closed. */
export class MissingTenantContextError extends Error {
  constructor() {
    super('No tenant context: database access denied (fail-closed).');
    this.name = 'MissingTenantContextError';
  }
}
