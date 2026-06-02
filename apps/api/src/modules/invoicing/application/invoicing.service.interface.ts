import type { ApplicationService } from '../../../shared-kernel';

/**
 * PUBLIC application service for the Invoicing context — the ONLY synchronous entry point
 * other modules may depend on. Operations are declared here per feature task.
 * Responsibilities: Sales documents, lines, gapless numbering, payments, receivables.
 */
export interface IInvoicingService extends ApplicationService {}

/** DI token. Other modules inject by this token, typed as IInvoicingService. */
export const INVOICING_SERVICE = Symbol('Invoicing.Service');
