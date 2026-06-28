import type { ApplicationService } from '../../../shared-kernel';
import type { BankStatement, ImportReport, StatementFormat } from '../domain/models';

export interface ImportStatementInput {
  bankAccountId: string;
  fileName: string;
  format?: StatementFormat | string;   // inferred from fileName when omitted
  content: Buffer;
}

export interface IBankImportService extends ApplicationService {
  /** Parse → normalize → validate → dedup → persist; returns the import report. */
  importStatement(input: ImportStatementInput): Promise<ImportReport>;
  listStatements(page?: number, pageSize?: number): Promise<BankStatement[]>;
}
export const BANK_IMPORT_SERVICE = Symbol('Banking.BankImportService');
