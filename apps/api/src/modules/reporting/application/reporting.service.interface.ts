import type { ApplicationService } from '../../../shared-kernel';

/**
 * PUBLIC application service for the Reporting context — the ONLY synchronous entry point
 * other modules may depend on. Operations are declared here per feature task.
 * Responsibilities: Read-model projections, report runs (read-only; never live-aggregates the ledger).
 */
export interface IReportingService extends ApplicationService {}

/** DI token. Other modules inject by this token, typed as IReportingService. */
export const REPORTING_SERVICE = Symbol('Reporting.Service');
