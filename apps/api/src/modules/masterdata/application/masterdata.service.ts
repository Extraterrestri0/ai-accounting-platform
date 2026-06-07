import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService, type ScopedClient } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { CounterpartyRepository } from '../infrastructure/counterparty.repository';
import { AccountRepository } from '../infrastructure/account.repository';
import { VatCodeRepository } from '../infrastructure/vat-code.repository';
import { ReferenceRepository } from '../infrastructure/reference.repository';
import { CompanySettingsRepository } from '../infrastructure/company-settings.repository';
import { AccountMappingRepository } from '../infrastructure/account-mapping.repository';
import { CatalogItemRepository } from '../infrastructure/catalog-item.repository';
import { ExpenseCategoryRepository } from '../infrastructure/expense-category.repository';
import { isValidEik } from '../domain/validation/eik';
import { isValidVatNumberFormat } from '../domain/validation/vat-number';
import {
  DuplicateCounterpartyError, InvalidEikError, InvalidVatNumberError,
  MasterDataNotFoundError, UnknownCountryError,
} from '../domain/errors';
import {
  ACCOUNT_ROLES, DEFAULT_ACCOUNT_CODES, isAccountRole,
  type AccountMapping, type AccountRole,
} from '../domain/account-mapping';
import { MasterDataEvents } from '../events';
import type { Account, AccountNode, CatalogItem, CompanySettings, Counterparty, Country, Currency, ExpenseCategory, VatCode } from '../domain/models';
import type {
  CreateAccountInput, CreateCatalogItemInput, CreateCounterpartyInput, CreateExpenseCategoryInput, CreateVatCodeInput,
  IMasterDataService, ListCatalogItemsQuery, ListCounterpartiesQuery, UpdateAccountMappingsInput, UpdateCatalogItemInput, UpdateExpenseCategoryInput,
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
    private readonly accountMappings: AccountMappingRepository,
    private readonly catalog: CatalogItemRepository,
    private readonly expenseCategories: ExpenseCategoryRepository,
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

  // ---- account mappings (configurable posting accounts) --------------------

  async getAccountMappings(): Promise<AccountMapping[]> {
    const { tenantId, companyId } = this.scope();
    const rows = await this.db.run((db) => this.accountMappings.list(db, tenantId, companyId));
    const byRole = new Map(rows.map((r) => [r.role, r]));
    return ACCOUNT_ROLES.map((role): AccountMapping => {
      const row = byRole.get(role);
      if (row) return { role, accountId: row.account_id, code: row.code, accountName: row.name, isDefault: false };
      return { role, accountId: null, code: DEFAULT_ACCOUNT_CODES[role], accountName: null, isDefault: true };
    });
  }

  async getPostingAccounts(): Promise<Record<AccountRole, string>> {
    const { tenantId, companyId } = this.scope();
    const rows = await this.db.run((db) => this.accountMappings.list(db, tenantId, companyId));
    const byRole = new Map(rows.map((r) => [r.role, r.code]));
    const out: Record<AccountRole, string> = { ...DEFAULT_ACCOUNT_CODES };
    for (const role of ACCOUNT_ROLES) { const code = byRole.get(role); if (code) out[role] = code; }
    return out;
  }

  async updateAccountMappings(input: UpdateAccountMappingsInput): Promise<AccountMapping[]> {
    const { tenantId, companyId, userId } = this.scope();
    if (!Array.isArray(input?.mappings) || input.mappings.length === 0) {
      throw new BadRequestException('No account mappings provided.');
    }
    await this.db.run(async (db) => {
      const before = await this.accountMappings.list(db, tenantId, companyId);
      for (const m of input.mappings) {
        if (!isAccountRole(m?.role)) throw new BadRequestException(`Unknown account role: ${String(m?.role)}.`);
        if (!m.accountId) throw new BadRequestException(`Missing account for role "${m.role}".`);
        const acc = await this.accountMappings.getAccount(db, m.accountId);
        if (!acc) throw new BadRequestException(`Account ${m.accountId} was not found in this company.`);
        if (acc.status !== 'active') throw new BadRequestException(`Account ${acc.code} (${acc.name}) is not active.`);
        if (!acc.isPostable) throw new BadRequestException(`Account ${acc.code} (${acc.name}) is a group/header and cannot be posted to.`);
        await this.accountMappings.upsert(db, tenantId, companyId, m.role, m.accountId, userId);
      }
      const after = await this.accountMappings.list(db, tenantId, companyId);
      await this.audit.append(db, {
        companyId, actorType: 'user', actorId: userId,
        action: 'masterdata.account_mappings_updated', entityType: 'account_mappings', entityId: companyId,
        before, after,
      });
    });
    return this.getAccountMappings();
  }

  // ---- product / service catalog -------------------------------------------

  async createCatalogItem(input: CreateCatalogItemInput): Promise<CatalogItem> {
    const { tenantId, companyId, userId } = this.scope();
    const code = input.code?.trim();
    if (!code) throw new BadRequestException('Catalog item code is required.');
    if (!input.description?.trim()) throw new BadRequestException('Catalog item description is required.');
    return this.db.run(async (db) => {
      if (await this.catalog.codeExists(db, tenantId, companyId, code)) throw new BadRequestException(`Catalog code "${code}" already exists.`);
      await this.validateCatalogRefs(db, input);
      const id = await this.catalog.insert(db, tenantId, companyId, {
        code, description: input.description.trim(), kind: input.kind ?? 'service',
        unit: input.unit?.trim() || 'pcs', vatRate: this.normVatRate(input.vatRate),
        vatCodeId: this.emptyToNull(input.vatCodeId), saftCode: this.trimToNull(input.saftCode),
        defaultAccountId: this.emptyToNull(input.defaultAccountId), isActive: input.isActive ?? true,
      });
      const item = (await this.catalog.getById(db, id))!;
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'masterdata.catalog_item_created', entityType: 'catalog_item', entityId: id, after: item });
      return item;
    });
  }

  async updateCatalogItem(id: string, input: UpdateCatalogItemInput): Promise<CatalogItem> {
    const { tenantId, companyId, userId } = this.scope();
    return this.db.run(async (db) => {
      const before = await this.catalog.getById(db, id);
      if (!before) throw new MasterDataNotFoundError('CatalogItem', id);
      if (input.code !== undefined) {
        const code = input.code.trim();
        if (!code) throw new BadRequestException('Catalog code cannot be empty.');
        if (await this.catalog.codeExists(db, tenantId, companyId, code, id)) throw new BadRequestException(`Catalog code "${code}" already exists.`);
      }
      await this.validateCatalogRefs(db, input);
      await this.catalog.update(db, id, {
        code: input.code?.trim(),
        description: input.description?.trim(),
        kind: input.kind,
        unit: input.unit?.trim(),
        vatRate: input.vatRate !== undefined ? this.normVatRate(input.vatRate) : undefined,
        vatCodeId: input.vatCodeId !== undefined ? this.emptyToNull(input.vatCodeId) : undefined,
        saftCode: input.saftCode !== undefined ? this.trimToNull(input.saftCode) : undefined,
        defaultAccountId: input.defaultAccountId !== undefined ? this.emptyToNull(input.defaultAccountId) : undefined,
        isActive: input.isActive,
      });
      const after = (await this.catalog.getById(db, id))!;
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'masterdata.catalog_item_updated', entityType: 'catalog_item', entityId: id, before, after });
      return after;
    });
  }

  async listCatalogItems(q: ListCatalogItemsQuery) {
    this.scope();
    const page = Math.max(1, q.page ?? 1); const pageSize = Math.min(200, Math.max(1, q.pageSize ?? 50));
    const { items, total } = await this.db.run((db) =>
      this.catalog.list(db, { search: q.search, activeOnly: q.activeOnly ?? false, kind: q.kind, limit: pageSize, offset: (page - 1) * pageSize }));
    return { items, total, page, pageSize };
  }

  async getCatalogItem(id: string): Promise<CatalogItem> {
    this.scope();
    const item = await this.db.run((db) => this.catalog.getById(db, id));
    if (!item) throw new MasterDataNotFoundError('CatalogItem', id);
    return item;
  }

  /** Validate VAT-rate range + that referenced account/VAT-code belong to this company. */
  private async validateCatalogRefs(db: ScopedClient, input: CreateCatalogItemInput | UpdateCatalogItemInput): Promise<void> {
    if (input.vatRate !== undefined && input.vatRate !== null && input.vatRate !== '') {
      const n = Number(input.vatRate);
      if (!Number.isFinite(n) || n < 0 || n > 100) throw new BadRequestException('VAT rate must be between 0 and 100.');
    }
    const accId = this.emptyToNull(input.defaultAccountId);
    if (accId) {
      const a = await this.accountMappings.getAccount(db, accId);
      if (!a) throw new BadRequestException('Default account was not found in this company.');
      if (a.status !== 'active') throw new BadRequestException(`Account ${a.code} (${a.name}) is not active.`);
      if (!a.isPostable) throw new BadRequestException(`Account ${a.code} (${a.name}) is a group/header and cannot be posted to.`);
    }
    const vcId = this.emptyToNull(input.vatCodeId);
    if (vcId) {
      const vc = await this.catalog.getVatCode(db, vcId);
      if (!vc) throw new BadRequestException('VAT code was not found in this company.');
    }
  }

  // ---- expense categories (purchase classification) ------------------------

  listExpenseCategories(activeOnly = true): Promise<ExpenseCategory[]> {
    this.scope();
    return this.db.run((db) => this.expenseCategories.list(db, activeOnly));
  }
  async getExpenseCategory(id: string): Promise<ExpenseCategory> {
    this.scope();
    const c = await this.db.run((db) => this.expenseCategories.getById(db, id));
    if (!c) throw new MasterDataNotFoundError('ExpenseCategory', id);
    return c;
  }
  async createExpenseCategory(input: CreateExpenseCategoryInput): Promise<ExpenseCategory> {
    const { tenantId, companyId, userId } = this.scope();
    const code = input.code?.trim();
    if (!code) throw new BadRequestException('Category code is required.');
    if (!input.nameBg?.trim() || !input.nameEn?.trim()) throw new BadRequestException('Category name (BG + EN) is required.');
    return this.db.run(async (db) => {
      if (await this.expenseCategories.codeExists(db, tenantId, companyId, code)) throw new BadRequestException(`Category code "${code}" already exists.`);
      await this.validateExpenseAccount(db, input.defaultAccountId);
      const id = await this.expenseCategories.insert(db, tenantId, companyId, {
        code, nameBg: input.nameBg.trim(), nameEn: input.nameEn.trim(),
        defaultAccountId: this.emptyToNull(input.defaultAccountId), defaultVatTreatment: input.defaultVatTreatment ?? 'standard',
        saftCode: this.trimToNull(input.saftCode), isActive: input.isActive ?? true,
      });
      const cat = (await this.expenseCategories.getById(db, id))!;
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'masterdata.expense_category_created', entityType: 'expense_category', entityId: id, after: cat });
      return cat;
    });
  }
  async updateExpenseCategory(id: string, input: UpdateExpenseCategoryInput): Promise<ExpenseCategory> {
    const { tenantId, companyId, userId } = this.scope();
    return this.db.run(async (db) => {
      const before = await this.expenseCategories.getById(db, id);
      if (!before) throw new MasterDataNotFoundError('ExpenseCategory', id);
      if (input.code !== undefined) {
        const code = input.code.trim();
        if (!code) throw new BadRequestException('Category code cannot be empty.');
        if (await this.expenseCategories.codeExists(db, tenantId, companyId, code, id)) throw new BadRequestException(`Category code "${code}" already exists.`);
      }
      await this.validateExpenseAccount(db, input.defaultAccountId);
      await this.expenseCategories.update(db, id, {
        code: input.code?.trim(), nameBg: input.nameBg?.trim(), nameEn: input.nameEn?.trim(),
        defaultAccountId: input.defaultAccountId !== undefined ? this.emptyToNull(input.defaultAccountId) : undefined,
        defaultVatTreatment: input.defaultVatTreatment,
        saftCode: input.saftCode !== undefined ? this.trimToNull(input.saftCode) : undefined,
        isActive: input.isActive,
      });
      const after = (await this.expenseCategories.getById(db, id))!;
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'masterdata.expense_category_updated', entityType: 'expense_category', entityId: id, before, after });
      return after;
    });
  }
  private async validateExpenseAccount(db: ScopedClient, accountId?: string | null): Promise<void> {
    const accId = this.emptyToNull(accountId);
    if (!accId) return;
    const a = await this.accountMappings.getAccount(db, accId);
    if (!a) throw new BadRequestException('Default account was not found in this company.');
    if (a.status !== 'active') throw new BadRequestException(`Account ${a.code} is not active.`);
    if (!a.isPostable) throw new BadRequestException(`Account ${a.code} is a group/header and cannot be posted to.`);
  }

  private normVatRate(v?: string): string { const n = Number(v ?? '20'); return (Number.isFinite(n) ? n : 20).toFixed(2); }
  private emptyToNull(v?: string | null): string | null { return v == null || String(v).trim() === '' ? null : String(v).trim(); }
  private trimToNull(v?: string | null): string | null { const s = v == null ? '' : String(v).trim(); return s === '' ? null : s; }

  listCountries(): Promise<Country[]> { this.scope(); return this.db.run((db) => this.reference.listCountries(db)); }
  listCurrencies(): Promise<Currency[]> { this.scope(); return this.db.run((db) => this.reference.listCurrencies(db)); }
}
