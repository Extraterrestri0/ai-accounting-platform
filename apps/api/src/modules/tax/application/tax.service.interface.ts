import type { ApplicationService } from '../../../shared-kernel';

/**
 * PUBLIC application service for the Tax context — the ONLY synchronous entry point
 * other modules may depend on. Operations are declared here per feature task.
 * Responsibilities: VAT periods, registers, return, validation, export (manual filing in MVP).
 */
export interface ITaxService extends ApplicationService {}

/** DI token. Other modules inject by this token, typed as ITaxService. */
export const TAX_SERVICE = Symbol('Tax.Service');
