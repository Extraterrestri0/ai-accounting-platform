import type { ApplicationService } from '../../../shared-kernel';
import type { BankAccount } from '../domain/models';

export interface CreateBankAccountInput { iban: string; bic?: string; bankName?: string; currency?: string; isPrimary?: boolean; }
export interface UpdateBankAccountInput { bic?: string; bankName?: string; currency?: string; isActive?: boolean; }

export interface IBankAccountService extends ApplicationService {
  createAccount(input: CreateBankAccountInput): Promise<BankAccount>;
  listAccounts(): Promise<BankAccount[]>;
  updateAccount(id: string, patch: UpdateBankAccountInput): Promise<BankAccount>;
  setPrimary(id: string): Promise<BankAccount>;
}
export const BANK_ACCOUNT_SERVICE = Symbol('Banking.BankAccountService');
