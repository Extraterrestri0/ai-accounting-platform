import type { ApplicationService } from '../../../shared-kernel';

/**
 * PUBLIC application service for the Notification context — the ONLY synchronous entry point
 * other modules may depend on. Operations are declared here per feature task.
 * Responsibilities: Notifications + delivery; subscribes to events/obligations.
 */
export interface INotificationService extends ApplicationService {}

/** DI token. Other modules inject by this token, typed as INotificationService. */
export const NOTIFICATION_SERVICE = Symbol('Notification.Service');
