import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { BankingRepository } from '../infrastructure/banking.repository';
import { BankAccountNotFoundError } from '../domain/errors';
import { BankEvents } from '../events';
import type { BankAccount } from '../domain/models';
import type { CreateBankAccountInput, IBankAccountService, UpdateBankAccountInput } from './bank-account.service.interface';

@Injectable()
export class BankAccountService implements IBankAccountService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: BankingRepository,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new BadRequestException('No active company selected.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }
  private actor() { const { userId } = this.scope(); return { actorType: (userId ? 'user' : 'system') as 'user' | 'system', actorId: userId }; }

  async createAccount(input: CreateBankAccountInput): Promise<BankAccount> {
    const { tenantId, companyId } = this.scope();
    const iban = (input.iban ?? '').replace(/\s/g, '').toUpperCase();
    if (!iban) throw new BadRequestException('IBAN е задължителен.');
    const existing = await this.db.run((db) => this.repo.findByIban(db, companyId, iban));
    if (existing) throw new ConflictException('Банкова сметка с този IBAN вече съществува.');

    const accounts = await this.db.run((db) => this.repo.listAccounts(db, companyId));
    const makePrimary = input.isPrimary === true || accounts.length === 0;

    const created = await this.db.run((db) => this.repo.createAccount(db, tenantId, companyId, {
      iban, bic: input.bic?.toUpperCase(), bankName: input.bankName, currency: (input.currency ?? 'EUR').toUpperCase(), isPrimary: false,
    }));
    if (makePrimary) await this.db.run((db) => this.repo.setPrimary(db, companyId, created.id));

    const fresh = (await this.db.run((db) => this.repo.getAccount(db, created.id)))!;
    await this.db.run((db) => this.audit.append(db, { companyId, ...this.actor(), action: BankEvents.AccountCreated, entityType: 'bank_account', entityId: fresh.id, after: { iban: fresh.iban, currency: fresh.currency, isPrimary: fresh.isPrimary } }));
    return fresh;
  }

  listAccounts(): Promise<BankAccount[]> {
    const { companyId } = this.scope();
    return this.db.run((db) => this.repo.listAccounts(db, companyId));
  }

  async updateAccount(id: string, patch: UpdateBankAccountInput): Promise<BankAccount> {
    const { companyId } = this.scope();
    const before = await this.db.run((db) => this.repo.getAccount(db, id));
    if (!before) throw new BankAccountNotFoundError(id);
    await this.db.run((db) => this.repo.updateAccount(db, id, { bic: patch.bic, bankName: patch.bankName, currency: patch.currency?.toUpperCase(), isActive: patch.isActive }));
    const after = (await this.db.run((db) => this.repo.getAccount(db, id)))!;
    await this.db.run((db) => this.audit.append(db, { companyId, ...this.actor(), action: BankEvents.AccountUpdated, entityType: 'bank_account', entityId: id, before, after }));
    return after;
  }

  async setPrimary(id: string): Promise<BankAccount> {
    const { companyId } = this.scope();
    const acc = await this.db.run((db) => this.repo.getAccount(db, id));
    if (!acc) throw new BankAccountNotFoundError(id);
    await this.db.run((db) => this.repo.setPrimary(db, companyId, id));
    const after = (await this.db.run((db) => this.repo.getAccount(db, id)))!;
    await this.db.run((db) => this.audit.append(db, { companyId, ...this.actor(), action: BankEvents.AccountUpdated, entityType: 'bank_account', entityId: id, after: { isPrimary: true } }));
    return after;
  }
}
