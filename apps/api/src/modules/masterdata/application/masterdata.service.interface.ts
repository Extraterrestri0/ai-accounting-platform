import type { ApplicationService } from '../../../shared-kernel';
import type {
  Account, AccountNode, AccountType, CompanySettings, Counterparty, CounterpartyKind,
  Country, Currency, NormalBalance, VatCode, VatDirection, VatKind,
} from '../domain/models';

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
  // reference
  listCountries(): Promise<Country[]>;
  listCurrencies(): Promise<Currency[]>;
}
export const MASTERDATA_SERVICE = Symbol('MasterData.Service');
