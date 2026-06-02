import { Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { VatRepository } from '../infrastructure/vat.repository';
import { buildReturnDataset, classifyEntry, summarize, treatmentFromRate, validate } from '../domain/vat/calculator';
import type { RegisterRow, VatPeriod } from '../domain/vat/models';
import type { IVatService, VatReturnResult } from './vat.service.interface';

class VatError extends Error {}

@Injectable()
export class VatService implements IVatService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: VatRepository,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new VatError('No active company in context.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }

  async buildRegisters(year: number, month: number): Promise<{ period: VatPeriod; purchase: RegisterRow[]; sales: RegisterRow[] }> {
    const { tenantId, companyId, userId } = this.scope();
    return this.db.run(async (db) => {
      const period = await this.repo.ensurePeriod(db, tenantId, companyId, year, month);
      const entries = await this.repo.postedEntries(db, period.startsOn, period.endsOn);
      for (const e of entries) {
        const base = classifyEntry(e);
        const { rate, treatment } = treatmentFromRate(base.base, base.vat);
        const vatCodeId = treatment === 'standard' || treatment === 'reduced' ? await this.repo.vatCodeByKind(db, treatment) ?? undefined : undefined;
        const row: RegisterRow = { ...base, rate, treatment, vatCodeId };
        await this.repo.insertRegisterRow(db, tenantId, companyId, period.id, row);
      }
      await this.audit.append(db, { companyId, actorType: userId ? 'user' : 'system', actorId: userId, action: 'tax.vat_registers_built', entityType: 'vat_period', entityId: period.id, after: { year, month, entries: entries.length } });
      return { period, purchase: await this.repo.listRegister(db, period.id, 'purchase'), sales: await this.repo.listRegister(db, period.id, 'sales') };
    });
  }

  getPurchaseRegister(year: number, month: number): Promise<RegisterRow[]> { return this.register(year, month, 'purchase'); }
  getSalesRegister(year: number, month: number): Promise<RegisterRow[]> { return this.register(year, month, 'sales'); }
  private register(year: number, month: number, kind: 'purchase' | 'sales'): Promise<RegisterRow[]> {
    const { tenantId, companyId } = this.scope();
    return this.db.run(async (db) => {
      const period = await this.repo.ensurePeriod(db, tenantId, companyId, year, month);
      return this.repo.listRegister(db, period.id, kind);
    });
  }

  async getSummary(year: number, month: number) {
    const { tenantId, companyId } = this.scope();
    return this.db.run(async (db) => {
      const period = await this.repo.ensurePeriod(db, tenantId, companyId, year, month);
      return summarize(await this.repo.allRegister(db, period.id));
    });
  }

  async generateReturn(year: number, month: number): Promise<VatReturnResult> {
    const { tenantId, companyId, userId } = this.scope();
    return this.db.run(async (db) => {
      const period = await this.repo.ensurePeriod(db, tenantId, companyId, year, month);
      const rows = await this.repo.allRegister(db, period.id);
      const summary = summarize(rows);
      const dataset = buildReturnDataset(rows, summary);
      await this.repo.saveReturn(db, tenantId, companyId, period.id, summary, dataset);
      await this.audit.append(db, { companyId, actorType: userId ? 'user' : 'system', actorId: userId, action: 'tax.vat_return_generated', entityType: 'vat_return', entityId: period.id, after: { payable: summary.vatPayable, refundable: summary.vatRefundable } });
      return { period, summary, dataset };
    });
  }

  async validatePeriod(year: number, month: number) {
    const { tenantId, companyId } = this.scope();
    return this.db.run(async (db) => {
      const period = await this.repo.ensurePeriod(db, tenantId, companyId, year, month);
      return validate(await this.repo.allRegister(db, period.id));
    });
  }
}
