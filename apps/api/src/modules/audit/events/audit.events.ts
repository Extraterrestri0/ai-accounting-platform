// Domain event contracts PUBLISHED by the Audit context (names are stable;
// payload shapes are finalized in the audit feature task). Subscribers depend on these.

export const AuditEvents = {
  AuditChainCheckpointSealed: 'audit.audit_chain_checkpoint_sealed',
} as const;

export type AuditEventType = (typeof AuditEvents)[keyof typeof AuditEvents];
