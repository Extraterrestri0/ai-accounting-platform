// Public surface of the Notification context. Other modules import from here ONLY —
// never from domain/, infrastructure/, or the stub service.
export { NotificationModule } from './notification.module';
export * from './application'; // INotificationService + NOTIFICATION_SERVICE token
export * from './events';      // published event contracts
