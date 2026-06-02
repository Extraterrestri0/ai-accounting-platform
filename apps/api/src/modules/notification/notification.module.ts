import { Module } from '@nestjs/common';
import { NotificationController } from './api/notification.controller';
import { NOTIFICATION_SERVICE } from './application/notification.service.interface';
import { NotificationService } from './application/notification.service';

/**
 * Notification bounded context. Exposes ONLY NOTIFICATION_SERVICE (public application surface)
 * and its event contracts. Internals (domain/infrastructure/stub) stay private.
 */
@Module({
  controllers: [NotificationController],
  providers: [{ provide: NOTIFICATION_SERVICE, useClass: NotificationService }],
  exports: [NOTIFICATION_SERVICE],
})
export class NotificationModule {}
