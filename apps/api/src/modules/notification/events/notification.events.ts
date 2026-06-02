// Domain event contracts PUBLISHED by the Notification context (names are stable;
// payload shapes are finalized in the notification feature task). Subscribers depend on these.

export const NotificationEvents = {
  NotificationCreated: 'notification.notification_created',
  NotificationDelivered: 'notification.notification_delivered',
} as const;

export type NotificationEventType = (typeof NotificationEvents)[keyof typeof NotificationEvents];
