// Domain event / audit-action names PUBLISHED by the Periods context (Task 4.3).
// Stable strings — also used as the audit-trail `action` for each transition.
export const PeriodEvents = {
  PeriodOpened: 'period.opened',
  PeriodLocked: 'period.locked',
} as const;

export type PeriodEventType = (typeof PeriodEvents)[keyof typeof PeriodEvents];
