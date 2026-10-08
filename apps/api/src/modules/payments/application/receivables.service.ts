import { Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { PaymentsRepository } from '../infrastructure/payments.repository';
import { buildAging, summarize, toCents, toOpenItem } from '../domain/aging';
import type { AgingReport, ArApSummary, OpenItem } from '../domain/models';
import type { IReceivablesService } from './receivables.service.interface';

const today = (): string => new Date().toISOString().slice(0, 10);

/** Accounts Receivable read-model: unpaid sales invoices (kind invoice/debit_note). */
@Injectable()
export class ReceivablesService implements IReceivablesService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: PaymentsRepository,
  ) {}

  private requireCompany(): void {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new Error('No active company in context.');
  }

  async getReceivables(asOf = today()): Promise<OpenItem[]> {
    this.requireCompany();
    const rows = await this.db.run((db) => this.repo.openReceivables(db));
    return rows
      .map((r) => toOpenItem({ documentType: 'sales_invoice', ...r }, asOf))
      .filter((it) => toCents(it.outstanding) > 0);
  }

  async getReceivablesSummary(asOf = today()): Promise<ArApSummary> {
    return summarize(await this.getReceivables(asOf));
  }

  async getReceivablesAging(asOf = today()): Promise<AgingReport> {
    const items = await this.getReceivables(asOf);
    const { buckets, total } = buildAging(items);
    return { asOf, buckets, total, items };
  }
}
