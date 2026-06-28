import { Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../../masterdata';
import { PaymentsRepository } from '../infrastructure/payments.repository';
import { buildAging, summarize, toCents, toOpenItem } from '../domain/aging';
import type { AgingReport, ArApSummary, OpenItem } from '../domain/models';
import type { IPayablesService } from './payables.service.interface';

const today = (): string => new Date().toISOString().slice(0, 10);

/** Accounts Payable read-model: posted purchase entries with an open payable credit. */
@Injectable()
export class PayablesService implements IPayablesService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: PaymentsRepository,
    @Inject(MASTERDATA_SERVICE) private readonly masterdata: IMasterDataService,
  ) {}

  private requireCompany(): void {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new Error('No active company in context.');
  }

  async getPayables(asOf = today()): Promise<OpenItem[]> {
    this.requireCompany();
    const { payable } = await this.masterdata.getPostingAccounts();
    const rows = await this.db.run((db) => this.repo.openPayables(db, payable));
    return rows
      .map((r) => toOpenItem({ documentType: 'purchase_invoice', ...r }, asOf))
      .filter((it) => toCents(it.outstanding) > 0);
  }

  async getPayablesSummary(asOf = today()): Promise<ArApSummary> {
    return summarize(await this.getPayables(asOf));
  }

  async getPayablesAging(asOf = today()): Promise<AgingReport> {
    const items = await this.getPayables(asOf);
    const { buckets, total } = buildAging(items);
    return { asOf, buckets, total, items };
  }
}
