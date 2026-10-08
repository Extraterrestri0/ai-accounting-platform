// Domain event / audit-action names PUBLISHED by the VIES context (Task 4.2).
export const ViesEvents = {
  ValidationRequested: 'vies.validation_requested',
  ValidationCompleted: 'vies.validation_completed',
  ValidationFailed: 'vies.validation_failed',
  DatasetGenerated: 'vies.dataset_generated',
} as const;

export type ViesEventType = (typeof ViesEvents)[keyof typeof ViesEvents];
