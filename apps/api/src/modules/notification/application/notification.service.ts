import { Injectable } from '@nestjs/common';
import type { INotificationService } from './notification.service.interface';

/**
 * Skeleton provider for Notification. No business logic — operations are implemented per feature task.
 * Kept private to the module (not re-exported from the public index).
 */
@Injectable()
export class NotificationService implements INotificationService {}
