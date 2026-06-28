import type { ApplicationService } from '../../../shared-kernel';
import type {
  Account, AccountNode, AccountType, CatalogItem, CatalogItemKind, CompanySettings, Counterparty, CounterpartyKind,
  Country, Currency, ExpenseCategory, ExpenseVatTreatment, NormalBalance, VatCode, VatDirection, VatKind,
} from '../domain/models';
import type { AccountMapping, AccountRole } from '../domain/account-mapping';

export interface AccountMappingUpdate { role: AccountRole; accountId: string; }
export interface UpdateAccountMappingsInput { mappings: AccountMappingUpdate[]; }

export interface CreateCatalogItemInput {
  code: string; description: string; kind?: CatalogItemKind; unit?: string; vatRate?: string;
  vatCodeId?: string | null; saftCode?: string | null; defaultAccountId?: string | null; isActive?: boolean;
}
export type UpdateCatalogItemInput = Partial<CreateCatalogItemInput>;
export interface ListCatalogItemsQuery { search?: string; activeOnly?: boolean; kind?: CatalogItemKind; page?: number; pageSize?: number; }

export interface CreateExpenseCategoryInput {
  code: string; nameBg: string; nameEn: string; defaultAccountId?: string | null;
  defaultVatTreatment?: ExpenseVatTreatment; saftCode?: string | null; isActive?: boolean;
}
export type UpdateExpenseCategoryInput = Partial<CreateExpenseCategoryInput>;

export interface CreateCounterpartyInput {
  kind: CounterpartyKind; name: string; eik?: string; vatNumber?: string;
  countryCode?: string; addressLine?: string; city?: string; postalCode?: string; email?: string; iban?: string;
}
export interface ListCounterpartiesQuery { kind?: CounterpartyKind; search?: string; activeOnly?: boolean; page?: number; pageSize?: number; }
export interface CreateAccountInput { code: string; name: string; type: AccountType; normalBalance: NormalBalance; parentAccountId?: string; category?: string; isPostable?: boolean; }
export interface CreateVatCodeInput { code: string; description: string; kind: VatKind; rate: string; direction?: VatDirection; }

/** PUBLIC master-data service — the read/write surface other modules (e.g. Upload, Invoicing) use. */
export interface IMasterDataService extends ApplicationService {
  // counterparties
  createCounterparty(input: CreateCounterpartyInput): Promise<Counterparty>;
  listCounterparties(q: ListCounterpartiesQuery): Promise<{ items: Counterparty[]; total: number; page: number; pageSize: number }>;
  getCounterparty(id: string): Promise<Counterparty>;
  // chart of accounts
  createAccount(input: CreateAccountInput): Promise<Account>;
  getChartOfAccounts(): Promise<AccountNode[]>;
  searchAccounts(query: string, activeOnly?: boolean): Promise<Account[]>;
  // vat codes
  createVatCode(input: CreateVatCodeInput): Promise<VatCode>;
  listVatCodes(activeOnly?: boolean): Promise<VatCode[]>;
  // company settings
  getCompanySettings(): Promise<CompanySettings | null>;
  updateCompanySettings(input: Partial<CompanySettings>): Promise<CompanySettings>;
  // account mappings (posting configuration)
  /** All roles with their resolved account (mapped or canonical default) — for the config UI. */
  getAccountMappings(): Promise<AccountMapping[]>;
  /** role → account CODE, merging explicit mappings over the canonical defaults — for the posting engine. */
  getPostingAccounts(): Promise<Record<AccountRole, string>>;
  /** Validate + upsert the provided role mappings; returns the full refreshed set. */
  updateAccountMappings(input: UpdateAccountMappingsInput): Promise<AccountMapping[]>;
  // product / service catalog
  createCatalogItem(input: CreateCatalogItemInput): Promise<CatalogItem>;
  updateCatalogItem(id: string, input: UpdateCatalogItemInput): Promise<CatalogItem>;
  listCatalogItems(q: ListCatalogItemsQuery): Promise<{ items: CatalogItem[]; total: number; page: number; pageSize: number }>;
  getCatalogItem(id: string): Promise<CatalogItem>;
  // expense categories (purchase classification)
  listExpenseCategories(activeOnly?: boolean): Promise<ExpenseCategory[]>;
  getExpenseCategory(id: string): Promise<ExpenseCategory>;
  createExpenseCategory(input: CreateExpenseCategoryInput): Promise<ExpenseCategory>;
  updateExpenseCategory(id: string, input: UpdateExpenseCategoryInput): Promise<ExpenseCategory>;
  // reference
  listCountries(): Promise<Country[]>;
  listCurrencies(): Promise<Currency[]>;
}
export const MASTERDATA_SERVICE = Symbol('MasterData.Service');
