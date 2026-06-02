// Domain event contracts PUBLISHED by the Tenancy context (names are stable;
// payload shapes are finalized in the tenancy feature task). Subscribers depend on these.

export const TenancyEvents = {
  TenantProvisioned: 'tenancy.tenant_provisioned',
  CompanyCreated: 'tenancy.company_created',
  CompanyArchived: 'tenancy.company_archived',
  EntitlementChanged: 'tenancy.entitlement_changed',
} as const;

export type TenancyEventType = (typeof TenancyEvents)[keyof typeof TenancyEvents];
