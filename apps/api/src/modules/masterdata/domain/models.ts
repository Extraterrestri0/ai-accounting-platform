/** Master data domain models (data shapes; no behavior). */
export type CounterpartyKind = 'customer' | 'supplier' | 'both';
export type VatKind =
  | 'standard' | 'reduced' | 'zero' | 'exempt'
  | 'reverse_charge' | 'intra_community' | 'export' | 'import';
export type VatDirection = 'sales' | 'purchase' | 'both';
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface Counterparty {
  id: string; companyId: string; kind: CounterpartyKind; name: string;
  eik?: string; vatNumber?: string; countryCode: string;
  addressLine?: string; city?: string; postalCode?: string; email?: string; iban?: string;
  isActive: boolean; createdAt: string;
}
export interface Account {
  id: string; companyId: string; code: string; name: string; type: AccountType;
  normalBalance: NormalBalance; parentAccountId?: string; category?: string;
  isPostable: boolean; status: string;
}
export interface AccountNode extends Account { children: AccountNode[]; }
export interface VatCode {
  id: string; companyId: string; code: string; description: string;
  kind: VatKind; rate: string; direction: VatDirection; isActive: boolean;
}
export interface Country { code: string; name: string; isEu: boolean; }
export interface Currency { code: string; name: string; minorUnits: number; }
export interface CompanySettings {
  companyId: string; vatRegistered: boolean; vatNumber?: string;
  vatRegistrationDate?: string; defaultCurrency: string;
  fiscalYearStartMonth: number; accountingBasis: 'accrual' | 'cash';
}
