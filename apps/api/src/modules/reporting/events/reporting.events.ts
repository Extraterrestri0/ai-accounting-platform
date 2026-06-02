// Domain event contracts PUBLISHED by the Reporting context (names are stable;
// payload shapes are finalized in the reporting feature task). Subscribers depend on these.

export const ReportingEvents = {
  ReportGenerated: 'reporting.report_generated',
} as const;

export type ReportingEventType = (typeof ReportingEvents)[keyof typeof ReportingEvents];
