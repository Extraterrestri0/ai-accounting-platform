import type { CounterpartyKind, VatDirection, VatKind, AccountType, NormalBalance } from '../../domain/models';
export interface CreateCounterpartyDto {
  kind: CounterpartyKind; name: string; eik?: string; vatNumber?: string; countryCode?: string;
  addressLine?: string; city?: string; postalCode?: string; email?: string; iban?: string;
}
export interface CreateAccountDto { code: string; name: string; type: AccountType; normalBalance: NormalBalance; parentAccountId?: string; category?: string; isPostable?: boolean; }
export interface CreateVatCodeDto { code: string; description: string; kind: VatKind; rate: string; direction?: VatDirection; }
export interface UpdateCompanySettingsDto { vatRegistered?: boolean; vatNumber?: string; vatRegistrationDate?: string; defaultCurrency?: string; fiscalYearStartMonth?: number; accountingBasis?: 'accrual' | 'cash'; }
