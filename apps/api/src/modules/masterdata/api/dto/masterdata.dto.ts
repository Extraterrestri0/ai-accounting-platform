import type { CounterpartyKind, VatDirection, VatKind, AccountType, NormalBalance } from '../../domain/models';
import type { AccountRole } from '../../domain/account-mapping';
import type { CatalogItemKind, ExpenseVatTreatment } from '../../domain/models';
export interface CreateCounterpartyDto {
  kind: CounterpartyKind; name: string; eik?: string; vatNumber?: string; countryCode?: string;
  addressLine?: string; city?: string; postalCode?: string; email?: string; iban?: string;
}
export interface CreateAccountDto { code: string; name: string; type: AccountType; normalBalance: NormalBalance; parentAccountId?: string; category?: string; isPostable?: boolean; }
export interface CreateVatCodeDto { code: string; description: string; kind: VatKind; rate: string; direction?: VatDirection; }
export interface UpdateCompanySettingsDto { vatRegistered?: boolean; vatNumber?: string; vatRegistrationDate?: string; defaultCurrency?: string; fiscalYearStartMonth?: number; accountingBasis?: 'accrual' | 'cash'; }
export interface AccountMappingInputDto { role: AccountRole; accountId: string; }
export interface UpdateAccountMappingsDto { mappings: AccountMappingInputDto[]; }
export interface CreateCatalogItemDto {
  code: string; description: string; kind?: CatalogItemKind; unit?: string; vatRate?: string;
  vatCodeId?: string | null; saftCode?: string | null; defaultAccountId?: string | null; isActive?: boolean;
}
export interface UpdateCatalogItemDto extends Partial<CreateCatalogItemDto> {}
export interface CreateExpenseCategoryDto {
  code: string; nameBg: string; nameEn: string; defaultAccountId?: string | null;
  defaultVatTreatment?: ExpenseVatTreatment; saftCode?: string | null; isActive?: boolean;
}
export interface UpdateExpenseCategoryDto extends Partial<CreateExpenseCategoryDto> {}
