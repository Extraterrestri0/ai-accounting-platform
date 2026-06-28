import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { BankingRepository } from '../infrastructure/banking.repository';
import { STATEMENT_PARSER_REGISTRY, type IStatementParserRegistry } from './statement-parser.port';
import { dedupKey, normalizeRow } from '../domain/normalize';
import { BankAccountNotFoundError, EmptyStatementError } from '../domain/errors';
import { BankEvents } from '../events';
import type { BankStatement, ImportReport, NormalizedRow, RowError, StatementFormat } from '../domain/models';
import type { IBankImportService, ImportStatementInput } from './bank-import.service.interface';

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
function formatFromName(name: string): StatementFormat | string {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return ext || 'csv';
}

@Injectable()
export class BankImportService implements IBankImportService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: BankingRepository,
    @Inject(STATEMENT_PARSER_REGISTRY) private readonly parsers: IStatementParserRegistry,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new BadRequestException('No active company selected.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }

  async importStatement(input: ImportStatementInput): Promise<ImportReport> {
    const { tenantId, companyId, userId } = this.scope();
    const actor = { actorType: (userId ? 'user' : 'system') as 'user' | 'system', actorId: userId };
    const format = (input.format ?? formatFromName(input.fileName)).toString().toLowerCase();
    const parser = this.parsers.get(format); // throws UnsupportedFormatError

    const account = await this.db.run((db) => this.repo.getAccount(db, input.bankAccountId));
    if (!account) throw new BankAccountNotFoundError(input.bankAccountId);

    const parsed = parser.parse(input.content);
    if (parsed.length === 0) throw new EmptyStatementError();

    // normalize + validate
    const normalized: NormalizedRow[] = [];
    const errors: RowError[] = [];
    parsed.forEach((raw, i) => {
      const res = normalizeRow(raw, i + 1);
      if (res.row) normalized.push(res.row); else errors.push(...res.errors);
    });
    const dates = normalized.map((r) => r.bookingDate).sort();
    const statementFrom = dates[0]; const statementTo = dates[dates.length - 1];

    const statement = await this.db.run((db) => this.repo.createStatement(db, tenantId, companyId, {
      bankAccountId: input.bankAccountId, fileName: input.fileName, importedBy: userId,
      statementFrom, statementTo, rowCount: parsed.length, duplicateCount: 0, errorCount: errors.length,
    }));

    let imported = 0; let duplicates = 0;
    const seen = new Set<string>();
    await this.db.run(async (db) => {
      for (const row of normalized) {
        const hash = sha(dedupKey(row));
        if (seen.has(hash)) { duplicates++; continue; }       // in-file duplicate
        seen.add(hash);
        const txn = await this.repo.insertTransaction(db, tenantId, companyId, { bankStatementId: statement.id, bankAccountId: input.bankAccountId, row, dedupHash: hash });
        if (!txn) { duplicates++; continue; }                 // already imported (DB dedup)
        imported++;
        await this.audit.append(db, { companyId, ...actor, action: BankEvents.TransactionCreated, entityType: 'bank_transaction', entityId: txn.id, after: { amount: txn.amount, bookingDate: txn.bookingDate, transactionType: txn.transactionType } });
      }
      await this.repo.setDuplicateCount(db, statement.id, duplicates);
      await this.audit.append(db, { companyId, ...actor, action: BankEvents.StatementImported, entityType: 'bank_statement', entityId: statement.id, after: { fileName: input.fileName, format, rowCount: parsed.length, imported, duplicates, errors: errors.length } });
    });

    return {
      statementId: statement.id, fileName: input.fileName, format: format as StatementFormat,
      rowCount: parsed.length, importedCount: imported, duplicateCount: duplicates, errorCount: errors.length,
      errors, statementFrom, statementTo,
    };
  }

  listStatements(page = 1, pageSize = 50): Promise<BankStatement[]> {
    const { companyId } = this.scope();
    const size = Math.min(200, Math.max(1, pageSize));
    return this.db.run((db) => this.repo.listStatements(db, companyId, size, (Math.max(1, page) - 1) * size));
  }
}
