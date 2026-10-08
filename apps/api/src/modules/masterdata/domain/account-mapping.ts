/**
 * Configurable account mappings (Task 0.1).
 *
 * A small, closed set of posting ROLES that the accounting engine resolves to a
 * real chart-of-accounts account per company. Replaces the hardcoded 702/4532/
 * 411/602/4531/401 constants previously embedded in invoice + purchase posting.
 */
export const ACCOUNT_ROLES = [
  'sales_revenue',            // Cr on invoice issue
  'sales_vat_output',         // Cr on invoice issue (when VAT > 0)
  'receivable',               // Dr on invoice issue (gross)
  'purchase_expense_default', // Dr default when no supplier rule/history applies
  'purchase_vat_input',       // Dr on deductible purchase VAT
  'payable',                  // Cr on purchase (gross)
  'cash_bank',                // settlement account for payments (Dr on receipt / Cr on disbursement)
] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];

/**
 * Canonical Bulgarian national-chart defaults. Used as the fallback when a role
 * is not explicitly mapped for a company (backward compatibility).
 *
 * NOTE: these MUST stay aligned with the VAT register classifier
 * (`tax/domain/vat/calculator.ts`), which still recognises 4531/4532 (and
 * 401/411) to split posted entries into purchase vs sales registers. Remapping
 * the VAT roles to non-standard codes requires updating that classifier — see
 * the migration header and the Risks section of the task doc.
 */
export const DEFAULT_ACCOUNT_CODES: Record<AccountRole, string> = {
  sales_revenue: '702',
  sales_vat_output: '4532',
  receivable: '411',
  purchase_expense_default: '602',
  purchase_vat_input: '4531',
  payable: '401',
  cash_bank: '503',
};

export interface AccountMapping {
  role: AccountRole;
  accountId: string | null;   // null => unmapped (posting falls back to the default code)
  code: string;               // resolved account code (mapped, else the canonical default)
  accountName: string | null; // resolved account name when the account exists
  isDefault: boolean;         // true => currently falling back to the canonical default
}

export function isAccountRole(x: unknown): x is AccountRole {
  return typeof x === 'string' && (ACCOUNT_ROLES as readonly string[]).includes(x);
}
