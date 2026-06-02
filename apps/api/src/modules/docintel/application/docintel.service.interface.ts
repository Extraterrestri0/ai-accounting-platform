import type { ApplicationService } from '../../../shared-kernel';

/**
 * PUBLIC application service for the DocIntel context — the ONLY synchronous entry point
 * other modules may depend on. Operations are declared here per feature task.
 * Responsibilities: Documents, extractions, AI suggestions, review items, feedback.
 */
export interface IDocIntelService extends ApplicationService {}

/** DI token. Other modules inject by this token, typed as IDocIntelService. */
export const DOCINTEL_SERVICE = Symbol('DocIntel.Service');
