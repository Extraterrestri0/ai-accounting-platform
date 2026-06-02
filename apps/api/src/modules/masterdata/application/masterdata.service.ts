import { Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { CounterpartyRepository } from '../infrastructure/counterparty.repository';
import { AccountRepository } from '../infrastructure/account.repository';
import { VatCodeRepository } from '../infrastructure/vat-code.repository';
import { ReferenceRepository } from '../infrastructure/reference.repository';
import { CompanySettingsRepository } from '../infrastructure/company-settings.repository';
import { isValidEik } from '../domain/validation/eik';
import { isValidVatNumberFormat } from '../domain/validation/vat-number';
import {
  DuplicateCounterpartyError, InvalidEikError, InvalidVatNumberError,
  MasterDataNotFoundError, UnknownCountryError,
} from '../domain/errors';
import { MasterDataEvents } from '../events';
import type { Account, AccountNode, CompanySettings, Counterparty, Country, Currency, VatCode } from '../domain/models';
import type {
  CreateAccountInput, CreateCounterpartyInput, CreateVatCodeInput,
  IMasterDataService, ListCounterpartiesQuery,
} from './masterdata.service.interface';

@Injectable()
export class MasterDataService implements IMasterDataService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly counterparties: CounterpartyRepository,
    private readonly accounts: AccountRepository,
    private readonly vatCodes: VatCodeRepository,
    private readonly reference: ReferenceRepository,
    private readonly settings: CompanySettingsRepository,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new MasterDataNotFoundError('active company', '(none)');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }

  async createCounterparty(input: CreateCounterpartyInput): Promise<Counterparty> {
    const { tenantId, companyId, userId } = this.scope();
    const countryCode = (input.countryCode ?? 'BG').toUpperCase();
    if (input.eik && !isValidEik(input.eik)) throw new InvalidEikError(input.eik);
    if (input.vatNumber && !isValidVatNumberFormat(input.vatNumber)) throw new InvalidVatNumberError(input.vatNumber);
    return this.db.run(async (db) => {
      if (!(await this.reference.countryExists(db, countryCode))) throw new UnknownCountryError(countryCode);
      const dup = await this.counterparties.findDuplicate(db, tenantId, companyId, input.eik, input.vatNumber);
      if (dup) throw new DuplicateCounterpartyError(dup, (dup === 'eik' ? input.eik : input.vatNumber) ?? '');
      const cp = await this.counterparties.insert(db, tenantId, companyId, { ...input, countryCode });
      await this.audit.append(db, {
        companyId, actorType: 'user', actorId: userId,
        action: MasterDataEvents.CounterpartyValidated, entityType: 'counterparty', entityId: cp.id, after: cp,
      });
      return cp;
    });
  }

  async listCounterparties(q: ListCounterpartiesQuery) {
    this.scope();
    const page = Math.max(1, q.page ?? 1); const pageSize = Math.min(200, Math.max(1, q.pageSize ?? 25));
    const { items, total } = await this.db.run((db) =>
      this.counterparties.list(db, { kind: q.kind, search: q.search, activeOnly: q.activeOnly ?? false, limit: pageSize, offset: (page - 1) * pageSize }));
    return { items, total, page, pageSize };
  }

  async getCounterparty(id: string): Promise<Counterparty> {
    this.scope();
    const cp = await this.db.run((db) => this.counterparties.getById(db, id));
    if (!cp) throw new MasterDataNotFoundError('Counterparty', id);
    return cp;
  }

  async createAccount(input: CreateAccountInput): Promise<Account> {
    const { tenantId, companyId, userId } = this.scope();
    return this.db.run(async (db) => {
      const acc = await this.accounts.insert(db, tenantId, companyId, input);
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: MasterDataEvents.ChartOfAccountsInitialized, entityType: 'account', entityId: acc.id, after: acc });
      return acc;
    });
  }
  async getChartOfAccounts(): Promise<AccountNode[]> {
    this.scope();
    const all = await this.db.run((db) => this.accounts.listAll(db));
    return this.accounts.buildTree(all);
  }
  searchAccounts(query: string, activeOnly = true): Promise<Account[]> {
    this.scope();
    return this.db.run((db) => this.accounts.search(db, query, activeOnly));
  }

  async createVatCode(input: CreateVatCodeInput): Promise<VatCode> {
    const { tenantId, companyId } = this.scope();
    return this.db.run((db) => this.vatCodes.insert(db, tenantId, companyId, { ...input, direction: input.direction ?? 'both' }));
  }
  listVatCodes(activeOnly = true): Promise<VatCode[]> {
    this.scope();
    return this.db.run((db) => this.vatCodes.list(db, activeOnly));
  }

  getCompanySettings(): Promise<CompanySettings | null> {
    const { companyId } = this.scope();
    return this.db.run((db) => this.settings.get(db, companyId));
  }
  async updateCompanySettings(input: Partial<CompanySettings>): Promise<CompanySettings> {
    const { tenantId, companyId, userId } = this.scope();
    return this.db.run(async (db) => {
      const before = await this.settings.get(db, companyId);
      const after = await this.settings.upsert(db, tenantId, companyId, input);
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'masterdata.company_settings_updated', entityType: 'company_settings', entityId: companyId, before, after });
      return after;
    });
  }

  listCountries(): Promise<Country[]> { this.scope(); return this.db.run((db) => this.reference.listCountries(db)); }
  listCurrencies(): Promise<Currency[]> { this.scope(); return this.db.run((db) => this.reference.listCurrencies(db)); }
}
