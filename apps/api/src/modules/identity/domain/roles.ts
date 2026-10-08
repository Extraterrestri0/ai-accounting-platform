/** RBAC catalog: permissions, role→permission maps, and non-overridable hard guardrails. */
export const PERMISSIONS = {
  COMPANY_CREATE: 'company.create', COMPANY_READ: 'company.read',
  LEDGER_READ: 'ledger.read', LEDGER_POST: 'ledger.post', LEDGER_REVERSE: 'ledger.reverse',
  VAT_READ: 'vat.read', VAT_SUBMIT: 'vat.submit',
  DOCUMENT_UPLOAD: 'document.upload', REVIEW_APPROVE: 'review.approve',
  USER_MANAGE: 'user.manage', ROLE_ASSIGN: 'role.assign',
  MASTERDATA_READ: 'masterdata.read', MASTERDATA_WRITE: 'masterdata.write',
  INVOICE_READ: 'invoice.read', INVOICE_CREATE: 'invoice.create',
  INVOICE_ISSUE: 'invoice.issue', INVOICE_SEND: 'invoice.send',
  PAYMENT_READ: 'payment.read', PAYMENT_RECORD: 'payment.record', PAYMENT_REVERSE: 'payment.reverse',
  AUDIT_READ: 'audit.read',
  PERIOD_READ: 'period.read', PERIOD_MANAGE: 'period.manage',
  BANK_READ: 'bank.read', BANK_MANAGE: 'bank.manage', BANK_RECONCILE: 'bank.reconcile',
  SAFT_READ: 'saft.read', SAFT_GENERATE: 'saft.generate',
  ASSISTANT_ASK: 'assistant.ask',
} as const;
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type TenantRole = 'tenant_admin' | 'member';
export type CompanyRole = 'owner' | 'accountant' | 'approver' | 'viewer';

const P = PERMISSIONS;
const TENANT_ROLE_PERMS: Record<TenantRole, Permission[]> = {
  tenant_admin: [P.USER_MANAGE, P.ROLE_ASSIGN, P.COMPANY_CREATE, P.COMPANY_READ],
  member: [P.COMPANY_READ, P.MASTERDATA_READ],
};
const COMPANY_ROLE_PERMS: Record<CompanyRole, Permission[]> = {
  owner: Object.values(P),
  accountant: [P.COMPANY_READ, P.LEDGER_READ, P.LEDGER_POST, P.LEDGER_REVERSE, P.VAT_READ, P.DOCUMENT_UPLOAD, P.REVIEW_APPROVE, P.MASTERDATA_READ, P.MASTERDATA_WRITE, P.INVOICE_READ, P.INVOICE_CREATE, P.INVOICE_ISSUE, P.INVOICE_SEND, P.PAYMENT_READ, P.PAYMENT_RECORD, P.PAYMENT_REVERSE, P.AUDIT_READ, P.PERIOD_READ, P.PERIOD_MANAGE, P.BANK_READ, P.BANK_MANAGE, P.BANK_RECONCILE, P.SAFT_READ, P.SAFT_GENERATE, P.ASSISTANT_ASK],
  approver: [P.COMPANY_READ, P.LEDGER_READ, P.VAT_READ, P.VAT_SUBMIT, P.REVIEW_APPROVE, P.MASTERDATA_READ, P.INVOICE_READ, P.PAYMENT_READ, P.AUDIT_READ, P.PERIOD_READ, P.BANK_READ, P.SAFT_READ, P.ASSISTANT_ASK],
  viewer: [P.COMPANY_READ, P.LEDGER_READ, P.VAT_READ, P.MASTERDATA_READ, P.INVOICE_READ, P.PAYMENT_READ, P.AUDIT_READ, P.PERIOD_READ, P.BANK_READ, P.SAFT_READ, P.ASSISTANT_ASK],
};
/** Permissions that may ONLY come from the listed company roles (+ KEP step-up, enforced separately). */
const HARD_GUARDRAILS: Partial<Record<Permission, CompanyRole[]>> = {
  [P.VAT_SUBMIT]: ['approver', 'owner'],
};

export function resolveEffectivePermissions(args: {
  tenantRole?: TenantRole; companyRole?: CompanyRole;
}): Set<Permission> {
  const set = new Set<Permission>([
    ...(args.tenantRole ? TENANT_ROLE_PERMS[args.tenantRole] : []),
    ...(args.companyRole ? COMPANY_ROLE_PERMS[args.companyRole] : []),
  ]);
  for (const [perm, allowed] of Object.entries(HARD_GUARDRAILS) as [Permission, CompanyRole[]][]) {
    if (set.has(perm) && !(args.companyRole && allowed.includes(args.companyRole))) set.delete(perm);
  }
  return set;
}
